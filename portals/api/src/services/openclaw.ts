import db from '../db/client.js';

const GATEWAY_TOKEN = process.env.LITELLM_API_KEY || 'sk-1234';

/**
 * Forward a chat message to the user's OpenClaw sandbox gateway.
 * The gateway exposes an OpenAI-compatible /v1/chat/completions endpoint.
 */
export async function forwardToOpenClaw(userId: string, message: string, conversationId: string): Promise<string> {
  const sandbox = db.prepare('SELECT endpoint, status FROM sandboxes WHERE user_id = ?').get(userId) as any;
  if (!sandbox || !sandbox.endpoint) {
    return 'Your sandbox is not provisioned yet. Please wait for setup to complete.';
  }
  if (sandbox.status !== 'running') {
    return `Your sandbox is currently ${sandbox.status}. Please wait for it to be ready.`;
  }

  try {
    const response = await fetch(`${sandbox.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        model: 'litellm/gpt-5.4',
        messages: [
          { role: 'user', content: message },
        ],
        max_completion_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('OpenClaw gateway error:', response.status, text);
      return `I'm having trouble connecting to the AI service. (Status: ${response.status})`;
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || 'No response from AI.';
  } catch (error: any) {
    console.error('OpenClaw gateway error:', error.message);
    return "I'm currently unable to reach the AI service. Please try again later.";
  }
}
