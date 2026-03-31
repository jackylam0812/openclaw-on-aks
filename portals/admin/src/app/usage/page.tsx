'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { Activity, DollarSign, Zap, TrendingUp, User, Cpu } from 'lucide-react';
import { getUsageStats, getUsageDaily, getUsageByUser, getUsageByModel } from '@/lib/api';

interface UsageStats {
  today: { tokens: number; cost: number; requests: number; avgLatencyMs: number; errors: number };
  month: { tokens: number; cost: number; requests: number };
  total: { tokens: number; cost: number; requests: number };
}

interface DailyUsage {
  date: string;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  requests: number;
  avgLatencyMs: number;
}

interface UserUsage {
  userId: string;
  email: string;
  name: string;
  tokens: number;
  cost: number;
  requests: number;
}

interface ModelUsage {
  model: string;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  requests: number;
  avgLatencyMs: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function formatCost(n: number): string {
  return '$' + n.toFixed(4);
}

// Simple bar chart using CSS
function BarChart({ data, maxValue, label }: { data: { label: string; value: number }[]; maxValue: number; label: string }) {
  if (data.length === 0) return <p className="text-gray-600 text-sm py-4 text-center">No data yet</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-3">{label}</p>
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-16 text-right shrink-0">{d.label}</span>
          <div className="flex-1 h-5 bg-white/[0.03] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
              style={{ width: `${maxValue > 0 ? (d.value / maxValue) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 w-16 shrink-0">{formatTokens(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function UsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [daily, setDaily] = useState<DailyUsage[]>([]);
  const [byUser, setByUser] = useState<UserUsage[]>([]);
  const [byModel, setByModel] = useState<ModelUsage[]>([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    getUsageStats().then(setStats).catch(() => {});
    getUsageDaily(days).then(setDaily).catch(() => {});
    getUsageByUser(days).then(setByUser).catch(() => {});
    getUsageByModel(days).then(setByModel).catch(() => {});
  }, [days]);

  const summaryCards = stats ? [
    { label: 'Tokens Today', value: formatTokens(stats.today.tokens), sub: `${stats.today.requests} requests`, icon: Zap, gradient: 'from-blue-500 to-cyan-500' },
    { label: 'Cost Today', value: formatCost(stats.today.cost), sub: `Avg ${stats.today.avgLatencyMs}ms latency`, icon: DollarSign, gradient: 'from-green-500 to-emerald-500' },
    { label: 'Cost This Month', value: formatCost(stats.month.cost), sub: `${formatTokens(stats.month.tokens)} tokens`, icon: TrendingUp, gradient: 'from-purple-500 to-violet-500' },
    { label: 'Total Cost', value: formatCost(stats.total.cost), sub: `${formatTokens(stats.total.tokens)} tokens / ${stats.total.requests} requests`, icon: Activity, gradient: 'from-orange-500 to-amber-500' },
  ] : [];

  const dailyChartData = daily.slice(-14).map((d) => ({ label: d.date.slice(5), value: d.tokens }));
  const dailyMax = Math.max(...dailyChartData.map((d) => d.value), 1);

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Usage & Cost</h1>
          <p className="text-sm text-gray-500 mt-1">Token usage, cost tracking, and API audit trail</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">{card.label}</span>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center`}>
                  <Icon size={16} className="text-white" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-gray-100">{card.value}</p>
              <p className="text-xs text-gray-500 mt-1">{card.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Token Usage Chart */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-gray-400" />
            <h2 className="text-sm font-medium text-gray-300">Daily Token Usage</h2>
          </div>
          <BarChart data={dailyChartData} maxValue={dailyMax} label="Tokens per day" />
        </div>

        {/* Model Breakdown */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <Cpu size={16} className="text-gray-400" />
            <h2 className="text-sm font-medium text-gray-300">Usage by Model</h2>
          </div>
          {byModel.length === 0 ? (
            <p className="text-gray-600 text-sm py-4 text-center">No data yet</p>
          ) : (
            <div className="space-y-4">
              {byModel.map((m) => (
                <div key={m.model} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div>
                    <span className="text-sm text-gray-200 font-mono">{m.model}</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {m.requests} requests · Avg {m.avgLatencyMs}ms
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-gray-200">{formatTokens(m.tokens)}</span>
                    <p className="text-xs text-green-400">{formatCost(m.cost)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Usage by User Table */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <User size={16} className="text-gray-400" />
          <h2 className="text-sm font-medium text-gray-300">Usage by User</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-3 text-gray-500 font-medium">User</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Requests</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Tokens</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {byUser.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-600">
                  No usage data yet — start chatting to see metrics here
                </td>
              </tr>
            ) : (
              byUser.map((u) => (
                <tr key={u.userId} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-3 text-gray-200">{u.name}</td>
                  <td className="px-4 py-3 text-gray-400">{u.email}</td>
                  <td className="px-4 py-3 text-gray-300 text-right">{u.requests}</td>
                  <td className="px-4 py-3 text-gray-300 text-right">{formatTokens(u.tokens)}</td>
                  <td className="px-4 py-3 text-green-400 text-right">{formatCost(u.cost)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
