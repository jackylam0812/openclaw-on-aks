import db from '../db/client.js';

const LITELLM_URL = process.env.OPENCLAW_API_URL || 'http://litellm.litellm.svc.cluster.local:4000';
const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY || '';

/** 1000 credits = $10, so 100 credits per $1 */
function getCreditsPerDollar(): number {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'credits_per_dollar'").get() as { value: string } | undefined;
  return parseFloat(row?.value || '100');
}

function getDefaultMonthlyQuota(): number {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'default_monthly_credits'").get() as { value: string } | undefined;
  return parseInt(row?.value || '1000', 10);
}

function currentBillingCycle(): string {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

export interface UserCreditInfo {
  userId: string;
  monthlyQuota: number;
  usedCredits: number;
  remainingCredits: number;
  billingCycle: string;
  usagePercent: number;
}

/** Ensure a user has a credit record, auto-reset if billing cycle changed. */
function ensureCreditRecord(userId: string): void {
  const cycle = currentBillingCycle();
  const row = db.prepare('SELECT billing_cycle FROM user_credits WHERE user_id = ?').get(userId) as { billing_cycle: string } | undefined;

  if (!row) {
    // First time — create record with default quota
    const quota = getDefaultMonthlyQuota();
    db.prepare('INSERT INTO user_credits (user_id, monthly_quota, used_credits, billing_cycle) VALUES (?, ?, 0, ?)').run(userId, quota, cycle);
  } else if (row.billing_cycle !== cycle) {
    // New month — reset used credits
    db.prepare('UPDATE user_credits SET used_credits = 0, billing_cycle = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(cycle, userId);
  }
}

/** Get credit info for a user. */
export function getUserCredits(userId: string): UserCreditInfo {
  ensureCreditRecord(userId);
  const row = db.prepare('SELECT monthly_quota, used_credits, billing_cycle FROM user_credits WHERE user_id = ?').get(userId) as any;
  const remaining = Math.max(0, row.monthly_quota - row.used_credits);
  return {
    userId,
    monthlyQuota: row.monthly_quota,
    usedCredits: Math.round(row.used_credits * 100) / 100,
    remainingCredits: Math.round(remaining * 100) / 100,
    billingCycle: row.billing_cycle,
    usagePercent: row.monthly_quota > 0 ? Math.round((row.used_credits / row.monthly_quota) * 10000) / 100 : 0,
  };
}

/** Check if user has enough credits to proceed. Returns remaining credits. */
export function checkCredits(userId: string): { allowed: boolean; remaining: number; quota: number } {
  const info = getUserCredits(userId);
  return { allowed: info.remainingCredits > 0, remaining: info.remainingCredits, quota: info.monthlyQuota };
}

/** Deduct credits after a successful request. costUsd is the actual dollar cost. */
export function deductCredits(userId: string, costUsd: number): void {
  ensureCreditRecord(userId);
  const creditsUsed = costUsd * getCreditsPerDollar();
  db.prepare('UPDATE user_credits SET used_credits = used_credits + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(creditsUsed, userId);
}

/**
 * Sync a user's credit usage from LiteLLM spend logs.
 * Queries LiteLLM for all recent spend logs, sums up the user's spend
 * in the current billing cycle, then updates used_credits.
 * LiteLLM has stream_options.include_usage configured so spend is accurate
 * (includes Azure prompt caching discount automatically).
 */
export async function syncUserCreditsFromLiteLLM(userId: string): Promise<void> {
  const userRow = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
  if (!userRow) return;

  ensureCreditRecord(userId);
  const cycle = currentBillingCycle(); // 'YYYY-MM'

  try {
    const res = await fetch(`${LITELLM_URL}/spend/logs?limit=2000`, {
      headers: { 'Authorization': `Bearer ${LITELLM_MASTER_KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return;

    const logs = await res.json() as any[];
    // Sum up adjusted spend for this user in current billing cycle
    let totalSpend = 0;
    for (const log of logs) {
      const logMonth = log.startTime?.slice(0, 7);
      if (logMonth !== cycle) continue;
      if (log.user === userRow.email || log.end_user === userRow.email) {
        totalSpend += log.spend || 0;
      }
    }

    // Convert to credits and update (absolute set, not increment)
    const creditsUsed = totalSpend * getCreditsPerDollar();
    db.prepare('UPDATE user_credits SET used_credits = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(creditsUsed, userId);
  } catch (err: any) {
    console.error('Failed to sync credits from LiteLLM:', err.message);
  }
}

/** Admin: set monthly quota for a specific user. */
export function setUserQuota(userId: string, quota: number): void {
  ensureCreditRecord(userId);
  db.prepare('UPDATE user_credits SET monthly_quota = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(quota, userId);
}

/** Admin: reset used credits for a user in current cycle. */
export function resetUserCredits(userId: string): void {
  ensureCreditRecord(userId);
  db.prepare('UPDATE user_credits SET used_credits = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(userId);
}

/** Admin: get all users' credit info. */
export function getAllUserCredits(): (UserCreditInfo & { email: string; name: string })[] {
  const cycle = currentBillingCycle();
  // Ensure all users have credit records
  const users = db.prepare('SELECT id FROM users').all() as { id: string }[];
  for (const u of users) ensureCreditRecord(u.id);

  const rows = db.prepare(`
    SELECT uc.user_id, uc.monthly_quota, uc.used_credits, uc.billing_cycle, u.email, u.name
    FROM user_credits uc JOIN users u ON uc.user_id = u.id
    ORDER BY uc.used_credits DESC
  `).all() as any[];

  return rows.map(r => {
    const remaining = Math.max(0, r.monthly_quota - r.used_credits);
    return {
      userId: r.user_id,
      email: r.email,
      name: r.name,
      monthlyQuota: r.monthly_quota,
      usedCredits: Math.round(r.used_credits * 100) / 100,
      remainingCredits: Math.round(remaining * 100) / 100,
      billingCycle: r.billing_cycle,
      usagePercent: r.monthly_quota > 0 ? Math.round((r.used_credits / r.monthly_quota) * 10000) / 100 : 0,
    };
  });
}
