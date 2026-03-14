import { FastifyInstance, FastifyRequest } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';
import db from '../db/client.js';
import { updateSandboxChannels } from '../services/sandbox.js';

export default async function integrationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/integrations', async (request: FastifyRequest) => {
    const user = (request as any).user;
    const integrations = db.prepare(
      'SELECT id, type, status, created_at FROM integrations WHERE user_id = ?'
    ).all(user.userId);
    return integrations;
  });

  app.post('/integrations/feishu', async (request: FastifyRequest) => {
    const user = (request as any).user;
    const { appId, appSecret } = request.body as { appId: string; appSecret: string };
    const id = uuid();
    db.prepare('INSERT INTO integrations (id, user_id, type, config, status) VALUES (?, ?, ?, ?, ?)').run(
      id, user.userId, 'feishu', JSON.stringify({ appId, appSecret }), 'connected'
    );

    updateSandboxChannels(user.userId).catch((err) => {
      console.error('Background sandbox channel update error:', err);
    });

    return { id, type: 'feishu', status: 'connected' };
  });

  // Telegram: OpenClaw handles Telegram natively via long polling (grammY runner).
  // We just store the bot token and update the sandbox config — no webhook needed.
  app.post('/integrations/telegram', async (request: FastifyRequest) => {
    const user = (request as any).user;
    const { botToken } = request.body as { botToken: string };
    const id = uuid();

    // Delete any existing Telegram webhook so OpenClaw's long polling works
    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, { method: 'POST' });
      const data = await resp.json() as any;
      if (data.ok) {
        console.log('Cleared existing Telegram webhook (OpenClaw uses polling)');
      }
    } catch (err: any) {
      console.warn('Could not clear Telegram webhook:', err.message);
    }

    db.prepare('INSERT INTO integrations (id, user_id, type, config, status) VALUES (?, ?, ?, ?, ?)').run(
      id, user.userId, 'telegram', JSON.stringify({ botToken }), 'connected'
    );

    updateSandboxChannels(user.userId).catch((err) => {
      console.error('Background sandbox channel update error:', err);
    });

    return { id, type: 'telegram', status: 'connected' };
  });

  app.post('/integrations/slack', async (request: FastifyRequest) => {
    const user = (request as any).user;
    const { botToken, appToken } = request.body as { botToken: string; appToken: string };
    const id = uuid();
    db.prepare('INSERT INTO integrations (id, user_id, type, config, status) VALUES (?, ?, ?, ?, ?)').run(
      id, user.userId, 'slack', JSON.stringify({ botToken, appToken }), 'connected'
    );

    updateSandboxChannels(user.userId).catch((err) => {
      console.error('Background sandbox channel update error:', err);
    });

    return { id, type: 'slack', status: 'connected' };
  });

  app.delete('/integrations/:id', async (request: FastifyRequest) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const integration = db.prepare('SELECT type, config FROM integrations WHERE id = ? AND user_id = ?').get(id, user.userId) as any;
    if (!integration) {
      return { error: 'Integration not found' };
    }

    db.prepare('DELETE FROM integrations WHERE id = ? AND user_id = ?').run(id, user.userId);

    updateSandboxChannels(user.userId).catch((err) => {
      console.error('Background sandbox channel update error:', err);
    });

    return { success: true };
  });
}
