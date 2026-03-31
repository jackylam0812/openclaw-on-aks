import { EmailClient } from '@azure/communication-email';
import db from '../db/client.js';

const ACS_CONNECTION_STRING = process.env.ACS_CONNECTION_STRING || '';
const SENDER_ADDRESS = process.env.ACS_SENDER_ADDRESS || 'noreply@openclaw-azure.org';
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let emailClient: EmailClient | null = null;

function getEmailClient(): EmailClient {
  if (!emailClient) {
    if (!ACS_CONNECTION_STRING) {
      throw new Error('ACS_CONNECTION_STRING is not configured');
    }
    emailClient = new EmailClient(ACS_CONNECTION_STRING);
  }
  return emailClient;
}

/**
 * Generate a 6-digit verification code, store it in DB, and send via ACS Email.
 */
export async function sendVerificationCode(email: string): Promise<void> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS).toISOString();

  // Upsert: delete any existing codes for this email, then insert new one
  db.prepare('DELETE FROM email_verification_codes WHERE email = ?').run(email);
  db.prepare('INSERT INTO email_verification_codes (email, code, expires_at) VALUES (?, ?, ?)').run(email, code, expiresAt);

  const client = getEmailClient();
  const message = {
    senderAddress: SENDER_ADDRESS,
    content: {
      subject: 'OpenClaw - Email Verification Code',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7c3aed; margin: 0;">🦞 OpenClaw</h1>
            <p style="color: #6b7280; font-size: 14px;">Your AI Assistant Platform</p>
          </div>
          <div style="background: #f9fafb; border-radius: 12px; padding: 30px; text-align: center;">
            <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">Your verification code is:</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #7c3aed; font-family: monospace; background: white; border-radius: 8px; padding: 16px; border: 2px dashed #e5e7eb;">
              ${code}
            </div>
            <p style="color: #9ca3af; font-size: 13px; margin: 20px 0 0;">This code expires in 10 minutes.</p>
            <p style="color: #9ca3af; font-size: 13px; margin: 5px 0 0;">If you didn't request this, please ignore this email.</p>
          </div>
        </div>
      `,
      plainText: `Your OpenClaw verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    },
    recipients: {
      to: [{ address: email }],
    },
  };

  const poller = await client.beginSend(message);
  const result = await poller.pollUntilDone();
  if (result.status !== 'Succeeded') {
    throw new Error(`Email send failed: ${result.error?.message || 'Unknown error'}`);
  }
  console.log(`Verification code sent to ${email}`);
}

/**
 * Verify a code submitted by the user. Returns true if valid.
 */
export function verifyCode(email: string, code: string): boolean {
  const row = db.prepare(
    'SELECT code, expires_at FROM email_verification_codes WHERE email = ? ORDER BY expires_at DESC LIMIT 1'
  ).get(email) as { code: string; expires_at: string } | undefined;

  if (!row) return false;
  if (new Date(row.expires_at) < new Date()) {
    // Expired — clean up
    db.prepare('DELETE FROM email_verification_codes WHERE email = ?').run(email);
    return false;
  }
  if (row.code !== code) return false;

  // Valid — clean up used code
  db.prepare('DELETE FROM email_verification_codes WHERE email = ?').run(email);
  return true;
}
