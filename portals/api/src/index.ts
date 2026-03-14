import Fastify from 'fastify';
import cors from '@fastify/cors';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';
import integrationRoutes from './routes/integrations.js';
import sandboxRoutes from './routes/sandbox.js';
import webhookRoutes from './routes/webhooks.js';

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
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
