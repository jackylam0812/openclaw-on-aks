import { FastifyInstance } from 'fastify';
import { requireAdmin } from '../middleware/auth.js';
import db from '../db/client.js';
import { getNodes, getPods } from '../services/k8s.js';

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);

  app.get('/admin/stats', async () => {
    const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
    const tokenUsageToday = Math.floor(Math.random() * 50000) + 10000; // placeholder
    const activeModels = 1; // gpt-5.4
    const clusterUptime = '99.9%';
    return { totalUsers, clusterUptime, tokenUsageToday, activeModels };
  });

  app.get('/admin/nodes', async () => {
    try {
      return await getNodes();
    } catch (e: any) {
      return { nodes: [], error: e.message };
    }
  });

  app.get('/admin/pods', async () => {
    try {
      return await getPods();
    } catch (e: any) {
      return { pods: [], error: e.message };
    }
  });

  app.get('/admin/users', async () => {
    const users = db.prepare(
      'SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC'
    ).all();
    return users;
  });
}
