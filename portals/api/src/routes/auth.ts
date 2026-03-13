import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import db from '../db/client.js';
import { signToken } from '../middleware/auth.js';
import { provisionSandbox } from '../services/sandbox.js';

export default async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };
    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password required' });
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  });

  app.post('/auth/register', async (request, reply) => {
    const { email, password, name } = request.body as { email: string; password: string; name: string };
    if (!email || !password || !name) {
      return reply.status(400).send({ error: 'Email, password, and name required' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }
    const id = uuid();
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(
      id, email, hash, name, 'user'
    );

    // Provision sandbox for new user
    const sandboxId = uuid();
    db.prepare('INSERT INTO sandboxes (id, user_id, status) VALUES (?, ?, ?)').run(
      sandboxId, id, 'provisioning'
    );
    provisionSandbox(id, email).catch((err) => {
      console.error('Background sandbox provisioning error:', err);
    });

    const token = signToken({ userId: id, email, role: 'user' });
    return { token, user: { id, email, name, role: 'user' } };
  });

  app.post('/auth/refresh', async (request, reply) => {
    const { token } = request.body as { token: string };
    if (!token) {
      return reply.status(400).send({ error: 'Token required' });
    }
    try {
      const jwt = await import('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'openclaw-portal-secret-change-me';
      const payload = jwt.default.verify(token, JWT_SECRET) as any;
      const newToken = signToken({ userId: payload.userId, email: payload.email, role: payload.role });
      return { token: newToken };
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });
}
