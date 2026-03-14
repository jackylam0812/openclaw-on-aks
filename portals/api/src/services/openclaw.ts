const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://litellm.litellm.svc.cluster.local:4000';
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || 'sk-1234';

export async function forwardToOpenClaw(message: string, conversationId: string): Promise<string> {
  try {
    const response = await fetch(`${OPENCLAW_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LITELLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.4',
        messages: [
          { role: 'system', content: 'You are OpenClaw, a helpful AI assistant.' },
          { role: 'user', content: message },
        ],
        max_completion_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('OpenClaw API error:', response.status, text);
      return `I'm having trouble connecting to the AI service. Please try again later. (Status: ${response.status})`;
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || 'No response from AI.';
  } catch (error: any) {
    console.error('OpenClaw API error:', error.message);
    return 'I\'m currently unable to reach the AI service. Please try again later.';
  }
}
