import { FastifyInstance, FastifyRequest } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';
import db from '../db/client.js';

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
    const webhookUrl = `${process.env.API_BASE_URL || 'http://localhost:3000'}/webhooks/feishu/${id}`;
    db.prepare('INSERT INTO integrations (id, user_id, type, config, status) VALUES (?, ?, ?, ?, ?)').run(
      id, user.userId, 'feishu', JSON.stringify({ appId, appSecret, webhookUrl }), 'connected'
    );
    return { id, type: 'feishu', status: 'connected', webhookUrl };
  });

  app.post('/integrations/telegram', async (request: FastifyRequest) => {
    const user = (request as any).user;
    const { botToken } = request.body as { botToken: string };
    const id = uuid();
    const webhookUrl = `${process.env.API_BASE_URL || 'http://localhost:3000'}/webhooks/telegram/${id}`;
    db.prepare('INSERT INTO integrations (id, user_id, type, config, status) VALUES (?, ?, ?, ?, ?)').run(
      id, user.userId, 'telegram', JSON.stringify({ botToken, webhookUrl }), 'connected'
    );
    return { id, type: 'telegram', status: 'connected', webhookUrl };
  });

  app.post('/integrations/slack', async (request: FastifyRequest) => {
    const user = (request as any).user;
    const { botToken, appToken } = request.body as { botToken: string; appToken: string };
    const id = uuid();
    db.prepare('INSERT INTO integrations (id, user_id, type, config, status) VALUES (?, ?, ?, ?, ?)').run(
      id, user.userId, 'slack', JSON.stringify({ botToken, appToken }), 'connected'
    );
    return { id, type: 'slack', status: 'connected' };
  });

  app.delete('/integrations/:id', async (request: FastifyRequest) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const result = db.prepare('DELETE FROM integrations WHERE id = ? AND user_id = ?').run(id, user.userId);
    if (result.changes === 0) {
      return { error: 'Integration not found' };
    }
    return { success: true };
  });
}
