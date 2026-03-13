import { FastifyInstance, FastifyRequest } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { getSandboxStatus } from '../services/sandbox.js';

export default async function sandboxRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/sandbox/status', async (request: FastifyRequest) => {
    const user = (request as any).user;
    const sandbox = getSandboxStatus(user.userId);
    if (!sandbox) {
      return { status: 'none' };
    }
    return sandbox;
  });
}
