import db from '../db/client.js';
import { v4 as uuid } from 'uuid';

const GATEWAY_TOKEN = process.env.LITELLM_API_KEY || 'sk-1234';

// GPT-5.4 pricing (USD per 1K tokens) — update when pricing changes
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-5.4': { input: 0.005, output: 0.015 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
};
const DEFAULT_PRICING = { input: 0.005, output: 0.015 };

function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
  return (promptTokens / 1000) * pricing.input + (completionTokens / 1000) * pricing.output;
}

const insertUsageLog = db.prepare(
  `INSERT INTO api_usage_logs (id, user_id, sandbox_id, conversation_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

/**
 * Forward a chat message to the user's OpenClaw sandbox gateway.
 * The gateway exposes an OpenAI-compatible /v1/chat/completions endpoint.
 * Sends full conversation history so the agent retains context across turns.
 * Records token usage and cost in api_usage_logs.
 */
export async function forwardToOpenClaw(userId: string, message: string, conversationId: string): Promise<string> {
  // Load conversation history so the agent has full context
  const history = db.prepare(
    'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).all(conversationId) as { role: string; content: string }[];
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ];
  const sandbox = db.prepare('SELECT id, endpoint, status FROM sandboxes WHERE user_id = ?').get(userId) as any;
  if (!sandbox || !sandbox.endpoint) {
    return 'Your sandbox is not provisioned yet. Please wait for setup to complete.';
  }
  if (sandbox.status !== 'running') {
    return `Your sandbox is currently ${sandbox.status}. Please wait for it to be ready.`;
  }

  // Wait for sandbox gateway to be responsive (up to 30s after wake)
  let gatewayReady = false;
  for (let i = 0; i < 6; i++) {
    try {
      const healthCheck = await fetch(`${sandbox.endpoint}/v1/models`, {
        headers: { 'Authorization': `Bearer ${GATEWAY_TOKEN}` },
        signal: AbortSignal.timeout(5000),
      });
      if (healthCheck.ok) { gatewayReady = true; break; }
    } catch {}
    if (i < 5) await new Promise(r => setTimeout(r, 5000));
  }
  if (!gatewayReady) {
    return "Your sandbox is still starting up. Please try again in a few seconds.";
  }

  const startTime = Date.now();
  try {
    const response = await fetch(`${sandbox.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        model: 'openclaw',
        messages,
        max_completion_tokens: 8192,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const text = await response.text();
      console.error('OpenClaw gateway error:', response.status, text);
      // Log failed request
      insertUsageLog.run(uuid(), userId, sandbox.id, conversationId, 'gpt-5.4', 0, 0, 0, 0, latencyMs, 'error', 'chat');
      return `I'm having trouble connecting to the AI service. (Status: ${response.status})`;
    }

    const data = await response.json() as any;

    // Extract token usage from OpenAI-compatible response
    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || promptTokens + completionTokens;
    const model = data.model || 'gpt-5.4';
    const costUsd = calculateCost(model, promptTokens, completionTokens);

    // Record usage log
    insertUsageLog.run(uuid(), userId, sandbox.id, conversationId, model, promptTokens, completionTokens, totalTokens, costUsd, latencyMs, 'success', 'chat');

    return data.choices?.[0]?.message?.content || 'No response from AI.';
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error('OpenClaw gateway error:', error.message);
    // Log failed request
    insertUsageLog.run(uuid(), userId, sandbox.id, conversationId, 'gpt-5.4', 0, 0, 0, 0, latencyMs, 'error', 'chat');
    return "I'm currently unable to reach the AI service. Please try again later.";
  }
}
