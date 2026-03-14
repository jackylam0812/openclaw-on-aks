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
      'SELECT u.id, u.email, u.name, u.role, u.created_at, s.status as sandbox_status FROM users u LEFT JOIN sandboxes s ON u.id = s.user_id ORDER BY u.created_at DESC'
    ).all();
    return users;
  });

  app.get('/admin/sandboxes', async () => {
    const sandboxes = db.prepare(
      'SELECT s.*, u.email, u.name as user_name FROM sandboxes s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC'
    ).all();
    return sandboxes;
  });

  app.get('/admin/cluster/overview', async () => {
    let nodes: any[] = [];
    let sandboxPods: any[] = [];
    try {
      nodes = await getNodes();
    } catch {}
    try {
      sandboxPods = await getPods('openclaw');
    } catch {}
    const runningPods = sandboxPods.filter((p: any) => p.status === 'Running');
    const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
    const activeSandboxes = (db.prepare("SELECT COUNT(*) as count FROM sandboxes WHERE status IN ('running', 'creating')").get() as any).count;
    return {
      totalUsers,
      activeSandboxes,
      nodeCount: nodes.length,
      totalPods: runningPods.length,
      nodes,
    };
  });
}
