import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../db/client.js';

export default async function webhookRoutes(app: FastifyInstance) {
  // Feishu webhook: receives event callbacks from Feishu platform
  app.post('/webhooks/feishu/:integrationId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { integrationId } = request.params as { integrationId: string };
    const body = request.body as any;

    // Feishu URL verification challenge
    if (body?.type === 'url_verification') {
      return { challenge: body.challenge };
    }

    const integration = db.prepare(
      'SELECT id, user_id, config FROM integrations WHERE id = ? AND type = ? AND status = ?'
    ).get(integrationId, 'feishu', 'connected') as any;

    if (!integration) {
      return reply.status(200).send({ ok: true });
    }

    // Feishu events are forwarded to the OpenClaw sandbox via its gateway.
    // For now, acknowledge receipt — OpenClaw handles Feishu via its WebSocket plugin.
    console.log(`Feishu webhook received for integration ${integrationId}`);
    return reply.status(200).send({ ok: true });
  });

  // Note: Telegram is handled natively by OpenClaw via long polling (grammY runner).
  // No webhook endpoint needed — the OpenClaw gateway in each user's sandbox
  // connects directly to Telegram Bot API to receive updates.
}
