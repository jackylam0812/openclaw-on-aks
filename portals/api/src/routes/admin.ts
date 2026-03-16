import { FastifyInstance } from 'fastify';
import { execSync } from 'child_process';
import { requireAdmin } from '../middleware/auth.js';
import db from '../db/client.js';
import { getNodes, getPods } from '../services/k8s.js';
import { provisionSandbox } from '../services/sandbox.js';
import { v4 as uuid } from 'uuid';

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
      'SELECT u.id, u.email, u.name, u.role, u.approval_status, u.created_at, s.status as sandbox_status FROM users u LEFT JOIN sandboxes s ON u.id = s.user_id ORDER BY u.created_at DESC'
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
    const pendingApprovals = (db.prepare("SELECT COUNT(*) as count FROM users WHERE approval_status = 'pending' AND role != 'admin'").get() as any).count;
    return {
      totalUsers,
      activeSandboxes,
      pendingApprovals,
      nodeCount: nodes.length,
      totalPods: runningPods.length,
      nodes,
    };
  });

  // --- Approval endpoints ---

  app.get('/admin/approvals', async (request) => {
    const { status } = request.query as { status?: string };
    const filterStatus = status || 'pending';
    const users = db.prepare(
      "SELECT id, email, name, role, approval_status, created_at FROM users WHERE approval_status = ? AND role != 'admin' ORDER BY created_at DESC"
    ).all(filterStatus);
    return users;
  });

  app.get('/admin/approvals/counts', async () => {
    const counts = db.prepare(
      "SELECT approval_status, COUNT(*) as count FROM users WHERE role != 'admin' GROUP BY approval_status"
    ).all() as { approval_status: string; count: number }[];
    const result: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
    for (const row of counts) {
      result[row.approval_status] = row.count;
    }
    return result;
  });

  app.post('/admin/approvals/:userId/approve', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = db.prepare('SELECT id, email, approval_status FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }
    if (user.approval_status === 'approved') {
      return reply.status(400).send({ error: 'User already approved' });
    }

    db.prepare("UPDATE users SET approval_status = 'approved' WHERE id = ?").run(userId);

    // Create sandbox record and provision
    const existingSandbox = db.prepare('SELECT id FROM sandboxes WHERE user_id = ?').get(userId);
    if (!existingSandbox) {
      db.prepare('INSERT INTO sandboxes (id, user_id, status) VALUES (?, ?, ?)').run(
        uuid(), userId, 'provisioning'
      );
    }
    provisionSandbox(userId, user.email).catch((err) => {
      console.error(`Failed to provision sandbox for ${user.email}:`, err);
    });

    return { success: true, message: `User ${user.email} approved and sandbox provisioning started` };
  });

  app.post('/admin/approvals/:userId/reject', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = db.prepare('SELECT id, email, approval_status FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    db.prepare("UPDATE users SET approval_status = 'rejected' WHERE id = ?").run(userId);
    return { success: true, message: `User ${user.email} rejected` };
  });

  // --- Delete user ---

  app.delete('/admin/users/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }
    if (user.role === 'admin') {
      return reply.status(400).send({ error: 'Cannot delete admin user' });
    }

    // Delete sandbox pod + Sandbox CR in k8s
    const sandbox = db.prepare('SELECT pod_name, namespace FROM sandboxes WHERE user_id = ?').get(userId) as any;
    if (sandbox?.pod_name) {
      const ns = sandbox.namespace || 'openclaw';
      try {
        execSync(`kubectl delete sandbox ${sandbox.pod_name} -n ${ns} --grace-period=10`, {
          encoding: 'utf-8',
          timeout: 30000,
        });
      } catch (err: any) {
        console.warn(`Failed to delete sandbox CR ${sandbox.pod_name}: ${err.message}`);
      }
    }

    // Delete all DB records for this user
    db.prepare('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)').run(userId);
    db.prepare('DELETE FROM conversations WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM integrations WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM sandboxes WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    return { success: true, message: `User ${user.email} and associated sandbox deleted` };
  });
}
