import Fastify from 'fastify';
import cors from '@fastify/cors';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';
import integrationRoutes from './routes/integrations.js';
import sandboxRoutes from './routes/sandbox.js';
import webhookRoutes from './routes/webhooks.js';
import db from './db/client.js';
import { provisionSandbox } from './services/sandbox.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

await app.register(authRoutes);
await app.register(adminRoutes);
await app.register(chatRoutes);
await app.register(integrationRoutes);
await app.register(sandboxRoutes);
await app.register(webhookRoutes);

app.get('/health', async () => ({ status: 'ok' }));

const port = parseInt(process.env.PORT || '3000');
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  console.log(`Portal API running on ${host}:${port}`);

  // Provision any sandboxes still in "provisioning" state (e.g. admin user on fresh deploy)
  const pending = db.prepare(
    "SELECT s.user_id, u.email FROM sandboxes s JOIN users u ON s.user_id = u.id WHERE s.status = 'provisioning' AND u.approval_status = 'approved'"
  ).all() as { user_id: string; email: string }[];
  for (const row of pending) {
    console.log(`Auto-provisioning sandbox for ${row.email}...`);
    provisionSandbox(row.user_id, row.email).catch((err) => {
      console.error(`Failed to auto-provision sandbox for ${row.email}:`, err);
    });
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
