import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import db from '../db/client.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { sendVerificationCode, verifyCode } from '../services/email.js';

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
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, approval_status: user.approval_status } };
  });

  // Step 1: Send verification code to email
  app.post('/auth/send-code', async (request, reply) => {
    const { email } = request.body as { email: string };
    if (!email) {
      return reply.status(400).send({ error: 'Email is required' });
    }
    // Rate limit: max 1 code per email per 60 seconds
    const recent = db.prepare(
      "SELECT created_at FROM email_verification_codes WHERE email = ? AND created_at > datetime('now', '-1 minute')"
    ).get(email);
    if (recent) {
      return reply.status(429).send({ error: 'Please wait 60 seconds before requesting another code' });
    }
    try {
      await sendVerificationCode(email);
      return { success: true, message: 'Verification code sent' };
    } catch (err: any) {
      console.error('Failed to send verification code:', err.message);
      return reply.status(500).send({ error: 'Failed to send verification code. Please try again.' });
    }
  });

  // Step 2: Register with verified code
  app.post('/auth/register', async (request, reply) => {
    const { email, password, name, code } = request.body as { email: string; password: string; name: string; code: string };
    if (!email || !password || !name) {
      return reply.status(400).send({ error: 'Email, password, and name required' });
    }
    if (!code) {
      return reply.status(400).send({ error: 'Verification code is required' });
    }
    // Verify the code
    if (!verifyCode(email, code)) {
      return reply.status(400).send({ error: 'Invalid or expired verification code' });
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

    const token = signToken({ userId: id, email, role: 'user' });
    return { token, user: { id, email, name, role: 'user', approval_status: 'pending' } };
  });

  app.get('/auth/me', { preHandler: [requireAuth] }, async (request) => {
    const { userId } = (request as any).user;
    const user = db.prepare('SELECT id, email, name, role, approval_status, created_at FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return { error: 'User not found' };
    }
    return user;
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
