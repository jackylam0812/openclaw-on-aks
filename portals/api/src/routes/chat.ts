import { FastifyInstance, FastifyRequest } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';
import db from '../db/client.js';
import { forwardToOpenClaw } from '../services/openclaw.js';
import { ensureSandboxAwake } from '../services/sandbox.js';
import { checkCredits, deductCredits, getUserCredits } from '../services/credits.js';

export default async function chatRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.post('/chat/message', async (request: FastifyRequest) => {
    const user = (request as any).user;
    const { message, conversationId } = request.body as { message: string; conversationId?: string };

    // Check credit balance before proceeding
    const creditCheck = checkCredits(user.userId);
    if (!creditCheck.allowed) {
      return { reply: `本月额度已用完（${creditCheck.quota} credits）。请联系管理员充值或等待下月重置。`, conversationId: conversationId || null, creditExhausted: true };
    }

    // Ensure sandbox is awake; wake it if sleeping
    const wake = await ensureSandboxAwake(user.userId);
    if (!wake.ready) {
      return { reply: wake.message || 'Your sandbox is starting up...', conversationId: conversationId || null, waking: true };
    }

    let convId = conversationId;
    if (!convId) {
      convId = uuid();
      const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');
      db.prepare('INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)').run(convId, user.userId, title);
    } else {
      db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(convId);
    }

    // Save user message
    db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(
      uuid(), convId, 'user', message
    );

    // Forward to user's OpenClaw sandbox gateway
    const result = await forwardToOpenClaw(user.userId, message, convId);

    // Deduct credits based on actual cost
    if (result.costUsd > 0) {
      deductCredits(user.userId, result.costUsd);
    }

    // Save assistant reply
    db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(
      uuid(), convId, 'assistant', result.reply
    );

    return { reply: result.reply, conversationId: convId };
  });

  app.get('/chat/history', async (request: FastifyRequest) => {
    const user = (request as any).user;
    const conversations = db.prepare(
      'SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC'
    ).all(user.userId);
    return conversations;
  });

  app.get('/chat/history/:id', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const messages = db.prepare(
      'SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(id);
    return messages;
  });

  // User's own credit balance
  app.get('/chat/credits', async (request: FastifyRequest) => {
    const user = (request as any).user;
    return getUserCredits(user.userId);
  });
}
