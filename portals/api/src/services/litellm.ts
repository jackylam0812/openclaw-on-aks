/**
 * LiteLLM Proxy API client — pulls real token usage, spend, and model metrics.
 * Used by /admin/usage/* routes to complement portal-level tracking.
 */

const LITELLM_URL = process.env.OPENCLAW_API_URL || 'http://litellm.litellm.svc.cluster.local:4000';
const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY || '';

async function litellmFetch(path: string, query: Record<string, string> = {}): Promise<any> {
  const qs = new URLSearchParams(query).toString();
  const url = `${LITELLM_URL}${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${LITELLM_MASTER_KEY}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LiteLLM ${path} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

export interface LiteLLMSpendLog {
  request_id: string;
  call_type: string;
  spend: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  startTime: string;
  endTime: string;
  request_duration_ms: number;
  model: string;
  model_group: string;
  custom_llm_provider: string;
  api_base: string;
  status: string;
  cache_hit: string;
  user: string;
  end_user: string;
}

/** Get recent spend logs from LiteLLM (real token data). */
export async function getSpendLogs(limit = 50): Promise<LiteLLMSpendLog[]> {
  return litellmFetch('/spend/logs', { limit: String(limit) });
}

/** Get total global spend. */
export async function getGlobalSpend(): Promise<{ spend: number; max_budget: number }> {
  return litellmFetch('/global/spend');
}

/** Get model info. */
export async function getModelInfo(): Promise<any[]> {
  const data = await litellmFetch('/model/info');
  return data.data || [];
}

/** Aggregate spend logs into summary stats. */
export function aggregateSpendLogs(logs: LiteLLMSpendLog[]) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStr = now.toISOString().slice(0, 7);

  const today = { tokens: 0, promptTokens: 0, completionTokens: 0, cost: 0, requests: 0, totalLatencyMs: 0, errors: 0 };
  const month = { tokens: 0, cost: 0, requests: 0 };
  const total = { tokens: 0, cost: 0, requests: 0 };

  const byModel: Record<string, { model: string; provider: string; tokens: number; promptTokens: number; completionTokens: number; cost: number; requests: number; totalLatencyMs: number; errors: number }> = {};
  const byDay: Record<string, { date: string; tokens: number; promptTokens: number; completionTokens: number; cost: number; requests: number; totalLatencyMs: number }> = {};
  const byProvider: Record<string, { provider: string; tokens: number; cost: number; requests: number }> = {};
  const recentErrors: { time: string; model: string; status: string; request_id: string }[] = [];

  for (const log of logs) {
    const day = log.startTime?.slice(0, 10) || '';
    const inMonth = day.startsWith(monthStr);
    const isToday = day === todayStr;
    const isError = log.status === 'failure' || log.status === 'error';

    total.tokens += log.total_tokens || 0;
    total.cost += log.spend || 0;
    total.requests++;

    if (inMonth) {
      month.tokens += log.total_tokens || 0;
      month.cost += log.spend || 0;
      month.requests++;
    }

    if (isToday) {
      today.tokens += log.total_tokens || 0;
      today.promptTokens += log.prompt_tokens || 0;
      today.completionTokens += log.completion_tokens || 0;
      today.cost += log.spend || 0;
      today.requests++;
      today.totalLatencyMs += log.request_duration_ms || 0;
      if (isError) today.errors++;
    }

    // By model
    const modelKey = log.model_group || log.model || 'unknown';
    if (!byModel[modelKey]) {
      byModel[modelKey] = { model: modelKey, provider: log.custom_llm_provider || '', tokens: 0, promptTokens: 0, completionTokens: 0, cost: 0, requests: 0, totalLatencyMs: 0, errors: 0 };
    }
    byModel[modelKey].tokens += log.total_tokens || 0;
    byModel[modelKey].promptTokens += log.prompt_tokens || 0;
    byModel[modelKey].completionTokens += log.completion_tokens || 0;
    byModel[modelKey].cost += log.spend || 0;
    byModel[modelKey].requests++;
    byModel[modelKey].totalLatencyMs += log.request_duration_ms || 0;
    if (isError) byModel[modelKey].errors++;

    // By day
    if (day) {
      if (!byDay[day]) {
        byDay[day] = { date: day, tokens: 0, promptTokens: 0, completionTokens: 0, cost: 0, requests: 0, totalLatencyMs: 0 };
      }
      byDay[day].tokens += log.total_tokens || 0;
      byDay[day].promptTokens += log.prompt_tokens || 0;
      byDay[day].completionTokens += log.completion_tokens || 0;
      byDay[day].cost += log.spend || 0;
      byDay[day].requests++;
      byDay[day].totalLatencyMs += log.request_duration_ms || 0;
    }

    // By provider
    const prov = log.custom_llm_provider || 'unknown';
    if (!byProvider[prov]) {
      byProvider[prov] = { provider: prov, tokens: 0, cost: 0, requests: 0 };
    }
    byProvider[prov].tokens += log.total_tokens || 0;
    byProvider[prov].cost += log.spend || 0;
    byProvider[prov].requests++;

    // Errors
    if (isError) {
      recentErrors.push({ time: log.startTime, model: modelKey, status: log.status, request_id: log.request_id });
    }
  }

  return {
    today: { ...today, avgLatencyMs: today.requests > 0 ? Math.round(today.totalLatencyMs / today.requests) : 0 },
    month,
    total,
    byModel: Object.values(byModel).sort((a, b) => b.cost - a.cost).map(m => ({
      ...m,
      avgLatencyMs: m.requests > 0 ? Math.round(m.totalLatencyMs / m.requests) : 0,
      successRate: m.requests > 0 ? Math.round(((m.requests - m.errors) / m.requests) * 10000) / 100 : 100,
    })),
    byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      ...d,
      avgLatencyMs: d.requests > 0 ? Math.round(d.totalLatencyMs / d.requests) : 0,
    })),
    byProvider: Object.values(byProvider).sort((a, b) => b.cost - a.cost),
    recentErrors: recentErrors.slice(0, 20),
  };
}
