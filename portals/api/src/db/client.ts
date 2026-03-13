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

// Seed admin user if not exists
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@openclaw.ai');
if (!adminExists) {
  const hash = bcrypt.hashSync('Admin@123', 10);
  db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(
    uuid(), 'admin@openclaw.ai', hash, 'Admin', 'admin'
  );
  console.log('Seeded admin user: admin@openclaw.ai');
}

export default db;
