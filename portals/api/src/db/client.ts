import Database, { Database as DatabaseType } from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || join(__dirname, '..', '..', 'data', 'db.sqlite');

// Ensure data directory exists
import { mkdirSync } from 'fs';
mkdirSync(dirname(DB_PATH), { recursive: true });

const db: DatabaseType = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Migration: add approval_status column if missing (existing DBs)
try {
  db.exec("ALTER TABLE users ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'");
  console.log('Migration: added approval_status column to users table');
} catch {
  // Column already exists — ignore
}

// Seed admin user if not exists
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@openclaw.ai') as { id: string } | undefined;
if (!adminExists) {
  const adminId = uuid();
  const hash = bcrypt.hashSync('Admin@123', 10);
  db.prepare('INSERT INTO users (id, email, password_hash, name, role, approval_status) VALUES (?, ?, ?, ?, ?, ?)').run(
    adminId, 'admin@openclaw.ai', hash, 'Admin', 'admin', 'approved'
  );
  // Also create sandbox record for admin (provisioned on startup)
  db.prepare('INSERT INTO sandboxes (id, user_id, status) VALUES (?, ?, ?)').run(
    uuid(), adminId, 'provisioning'
  );
  console.log('Seeded admin user: admin@openclaw.ai (with sandbox)');
} else {
  // Ensure admin has a sandbox record (handles upgrades from older DBs)
  const adminSandbox = db.prepare('SELECT id FROM sandboxes WHERE user_id = ?').get(adminExists.id);
  if (!adminSandbox) {
    db.prepare('INSERT INTO sandboxes (id, user_id, status) VALUES (?, ?, ?)').run(
      uuid(), adminExists.id, 'provisioning'
    );
    console.log('Created missing sandbox record for admin user');
  }
}

export default db;
