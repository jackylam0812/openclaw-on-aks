'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { Activity, DollarSign, Zap, TrendingUp, User, Cpu, AlertTriangle, Clock, Server } from 'lucide-react';
import { getLiteLLMUsage } from '@/lib/api';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function formatCost(n: number): string {
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(4);
  return '$' + n.toFixed(6);
}

function formatMs(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 's';
  return Math.round(n) + 'ms';
}

function BarChart({ data, maxValue, label, formatFn }: { data: { label: string; value: number }[]; maxValue: number; label: string; formatFn?: (n: number) => string }) {
  const fmt = formatFn || formatTokens;
  if (data.length === 0) return <p className="text-gray-600 text-sm py-4 text-center">No data yet</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-3">{label}</p>
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-16 text-right shrink-0 truncate" title={d.label}>{d.label}</span>
          <div className="flex-1 h-5 bg-white/[0.03] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all" style={{ width: `${maxValue > 0 ? Math.max((d.value / maxValue) * 100, 1) : 0}%` }} />
          </div>
          <span className="text-xs text-gray-400 w-20 shrink-0 text-right">{fmt(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

interface LiteLLMData {
  today: { tokens: number; promptTokens: number; completionTokens: number; cost: number; requests: number; avgLatencyMs: number; errors: number };
  month: { tokens: number; cost: number; requests: number };
  total: { tokens: number; cost: number; requests: number };
  globalSpend: number;
  byModel: { model: string; provider: string; tokens: number; promptTokens: number; completionTokens: number; cost: number; requests: number; avgLatencyMs: number; successRate: number; errors: number }[];
  byDay: { date: string; tokens: number; promptTokens: number; completionTokens: number; cost: number; requests: number; avgLatencyMs: number }[];
  byProvider: { provider: string; tokens: number; cost: number; requests: number }[];
  recentErrors: { time: string; model: string; status: string; request_id: string }[];
  recentLogs: { requestId: string; model: string; provider: string; promptTokens: number; completionTokens: number; totalTokens: number; cost: number; latencyMs: number; status: string; cacheHit: string; time: string }[];
  error?: string;
}

export default function UsagePage() {
  const [data, setData] = useState<LiteLLMData | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(500);

  useEffect(() => {
    setLoading(true);
    getLiteLLMUsage(limit).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [limit]);

  if (loading || !data) {
    return <AppLayout><div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading usage data from LiteLLM...</div></div></AppLayout>;
  }
  if (data.error) {
    return <AppLayout><div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-red-400"><p className="font-medium">Failed to load LiteLLM data</p><p className="text-sm mt-1">{data.error}</p></div></AppLayout>;
  }

  const successRate = data.today.requests > 0 ? Math.round(((data.today.requests - data.today.errors) / data.today.requests) * 10000) / 100 : 100;
  const summaryCards = [
    { label: 'Today Requests', value: String(data.today.requests), sub: `${formatTokens(data.today.tokens)} tokens`, icon: Zap, gradient: 'from-blue-500 to-cyan-500' },
    { label: 'Today Tokens', value: formatTokens(data.today.tokens), sub: `In: ${formatTokens(data.today.promptTokens)} / Out: ${formatTokens(data.today.completionTokens)}`, icon: Activity, gradient: 'from-cyan-500 to-teal-500' },
    { label: 'Today Cost', value: formatCost(data.today.cost), sub: `Avg ${formatMs(data.today.avgLatencyMs)} latency`, icon: DollarSign, gradient: 'from-green-500 to-emerald-500' },
    { label: 'Today Errors', value: String(data.today.errors), sub: `${successRate}% success rate`, icon: AlertTriangle, gradient: data.today.errors > 0 ? 'from-red-500 to-orange-500' : 'from-gray-500 to-gray-600' },
    { label: 'Month Cost', value: formatCost(data.month.cost), sub: `${formatTokens(data.month.tokens)} tokens · ${data.month.requests} reqs`, icon: TrendingUp, gradient: 'from-purple-500 to-violet-500' },
    { label: 'Global Spend', value: formatCost(data.globalSpend), sub: `${formatTokens(data.total.tokens)} tokens · ${data.total.requests} reqs`, icon: DollarSign, gradient: 'from-orange-500 to-amber-500' },
  ];
  const dailyTokenData = data.byDay.slice(-14).map(d => ({ label: d.date.slice(5), value: d.tokens }));
  const dailyTokenMax = Math.max(...dailyTokenData.map(d => d.value), 1);
  const dailyCostData = data.byDay.slice(-14).map(d => ({ label: d.date.slice(5), value: d.cost }));
  const dailyCostMax = Math.max(...dailyCostData.map(d => d.value), 0.001);

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Usage & Cost</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time metrics from LiteLLM gateway</p>
        </div>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500/50">
          <option value={200}>Last 200 requests</option>
          <option value={500}>Last 500 requests</option>
          <option value={1000}>Last 1,000 requests</option>
          <option value={2000}>Last 2,000 requests</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {summaryCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">{card.label}</span>
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center`}><Icon size={14} className="text-white" /></div>
              </div>
              <p className="text-xl font-semibold text-gray-100">{card.value}</p>
              <p className="text-[11px] text-gray-500 mt-1 truncate" title={card.sub}>{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4"><TrendingUp size={16} className="text-gray-400" /><h2 className="text-sm font-medium text-gray-300">Daily Token Usage</h2></div>
          <BarChart data={dailyTokenData} maxValue={dailyTokenMax} label="Tokens per day" />
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4"><DollarSign size={16} className="text-gray-400" /><h2 className="text-sm font-medium text-gray-300">Daily Cost</h2></div>
          <BarChart data={dailyCostData} maxValue={dailyCostMax} label="Cost per day (USD)" formatFn={formatCost} />
        </div>
      </div>

      {/* Model Stats + Provider */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden backdrop-blur-sm">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2"><Cpu size={16} className="text-gray-400" /><h2 className="text-sm font-medium text-gray-300">Model Runtime Stats</h2></div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs">Model</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs">Provider</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Requests</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Tokens</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Cost</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Avg Latency</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Success</th>
            </tr></thead>
            <tbody>
              {data.byModel.map(m => (
                <tr key={m.model} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 text-gray-200 font-mono text-xs">{m.model}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{m.provider}</td>
                  <td className="px-4 py-2.5 text-gray-300 text-right text-xs">{m.requests}</td>
                  <td className="px-4 py-2.5 text-gray-300 text-right text-xs">{formatTokens(m.tokens)}</td>
                  <td className="px-4 py-2.5 text-green-400 text-right text-xs">{formatCost(m.cost)}</td>
                  <td className="px-4 py-2.5 text-gray-300 text-right text-xs">{formatMs(m.avgLatencyMs)}</td>
                  <td className="px-4 py-2.5 text-right text-xs"><span className={m.successRate >= 99 ? 'text-green-400' : m.successRate >= 90 ? 'text-yellow-400' : 'text-red-400'}>{m.successRate}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4"><Server size={16} className="text-gray-400" /><h2 className="text-sm font-medium text-gray-300">Provider Distribution</h2></div>
          {data.byProvider.map(p => {
            const pct = Math.round((p.requests / (data.total.requests || 1)) * 100);
            return (
              <div key={p.provider} className="mb-4">
                <div className="flex justify-between mb-1"><span className="text-sm text-gray-200 capitalize">{p.provider}</span><span className="text-xs text-gray-400">{p.requests} reqs · {pct}%</span></div>
                <div className="w-full h-2 bg-white/[0.04] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                <div className="flex justify-between mt-1"><span className="text-[11px] text-gray-500">{formatTokens(p.tokens)} tokens</span><span className="text-[11px] text-green-400">{formatCost(p.cost)}</span></div>
              </div>
            );
          })}
          {data.recentErrors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <div className="flex items-center gap-2 mb-3"><AlertTriangle size={14} className="text-red-400" /><span className="text-xs font-medium text-gray-300">Recent Errors</span></div>
              {data.recentErrors.slice(0, 5).map((e, i) => (
                <div key={i} className="text-xs text-gray-400 flex justify-between mb-1"><span className="truncate mr-2">{e.model}</span><span className="text-red-400 shrink-0">{e.status}</span></div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Requests */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2"><Clock size={16} className="text-gray-400" /><h2 className="text-sm font-medium text-gray-300">Recent Requests</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-white/[0.06]">
              <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Time</th>
              <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Model</th>
              <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Provider</th>
              <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Prompt</th>
              <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Completion</th>
              <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Total</th>
              <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Cost</th>
              <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Latency</th>
              <th className="text-center px-3 py-2.5 text-gray-500 font-medium">Cache</th>
              <th className="text-center px-3 py-2.5 text-gray-500 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {data.recentLogs.map(log => (
                <tr key={log.requestId} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{new Date(log.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                  <td className="px-3 py-2 text-gray-200 font-mono">{log.model}</td>
                  <td className="px-3 py-2 text-gray-400 capitalize">{log.provider}</td>
                  <td className="px-3 py-2 text-gray-300 text-right">{log.promptTokens.toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-300 text-right">{log.completionTokens.toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-200 text-right font-medium">{log.totalTokens.toLocaleString()}</td>
                  <td className="px-3 py-2 text-green-400 text-right">{formatCost(log.cost)}</td>
                  <td className="px-3 py-2 text-gray-300 text-right">{formatMs(log.latencyMs)}</td>
                  <td className="px-3 py-2 text-center">{log.cacheHit === 'True' ? <span className="text-cyan-400">HIT</span> : <span className="text-gray-600">—</span>}</td>
                  <td className="px-3 py-2 text-center"><span className={`inline-block w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
