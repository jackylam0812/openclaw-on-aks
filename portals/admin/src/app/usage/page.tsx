'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { Activity, DollarSign, Zap, TrendingUp, User, Cpu, AlertTriangle, Clock, Server, Users, ChevronDown, Search, X } from 'lucide-react';
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

const TIME_PERIODS = [
  { label: '7 天', value: 7 },
  { label: '14 天', value: 14 },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
  { label: '180 天', value: 180 },
];

interface UserStat {
  user: string;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  requests: number;
  avgLatencyMs: number;
  totalLatencyMs: number;
  errors: number;
  successRate: number;
}

interface LiteLLMData {
  today: { tokens: number; promptTokens: number; completionTokens: number; cachedTokens: number; cost: number; requests: number; avgLatencyMs: number; errors: number };
  month: { tokens: number; cost: number; requests: number };
  total: { tokens: number; promptTokens: number; completionTokens: number; cachedTokens: number; cost: number; requests: number; avgLatencyMs: number; errors: number; successRate: number };
  globalSpend: number;
  days: number;
  byModel: { model: string; provider: string; tokens: number; promptTokens: number; completionTokens: number; cost: number; requests: number; avgLatencyMs: number; successRate: number; errors: number }[];
  byDay: { date: string; tokens: number; promptTokens: number; completionTokens: number; cost: number; requests: number; avgLatencyMs: number }[];
  byProvider: { provider: string; tokens: number; cost: number; requests: number }[];
  byUser: UserStat[];
  recentErrors: { time: string; model: string; status: string; request_id: string }[];
  recentLogs: { requestId: string; model: string; provider: string; promptTokens: number; completionTokens: number; cachedTokens: number; totalTokens: number; cost: number; latencyMs: number; status: string; cacheHit: string; time: string; user: string }[];
  allUsers?: string[];
  error?: string;
}

export default function UsagePage() {
  const [data, setData] = useState<LiteLLMData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [selectedUser, setSelectedUser] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    getLiteLLMUsage(days, selectedUser || undefined).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [days, selectedUser]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredUsers = useMemo(() => {
    if (!data?.allUsers) return [];
    if (!searchQuery.trim()) return data.allUsers;
    const q = searchQuery.toLowerCase();
    return data.allUsers.filter(u => u.toLowerCase().includes(q));
  }, [data?.allUsers, searchQuery]);

  if (loading || !data) {
    return <AppLayout><div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading usage data from LiteLLM...</div></div></AppLayout>;
  }
  if (data.error) {
    return <AppLayout><div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-red-400"><p className="font-medium">Failed to load LiteLLM data</p><p className="text-sm mt-1">{data.error}</p></div></AppLayout>;
  }

  const periodLabel = `${days} 天`;
  const summaryCards = [
    { label: `总请求数`, value: String(data.total.requests), sub: `${periodLabel}内`, icon: Zap, gradient: 'from-blue-500 to-cyan-500' },
    { label: '总 Tokens', value: formatTokens(data.total.tokens), sub: `In: ${formatTokens(data.total.promptTokens)} / Cached: ${formatTokens(data.total.cachedTokens)} / Out: ${formatTokens(data.total.completionTokens)}`, icon: Activity, gradient: 'from-cyan-500 to-teal-500' },
    { label: '总费用', value: formatCost(data.total.cost), sub: `平均延迟 ${formatMs(data.total.avgLatencyMs)}`, icon: DollarSign, gradient: 'from-green-500 to-emerald-500' },
    { label: '成功率', value: `${data.total.successRate}%`, sub: `${data.total.errors} 个错误`, icon: AlertTriangle, gradient: data.total.errors > 0 ? 'from-red-500 to-orange-500' : 'from-gray-500 to-gray-600' },
    { label: '活跃用户', value: String(data.byUser.length), sub: `${periodLabel}内`, icon: Users, gradient: 'from-purple-500 to-violet-500' },
    { label: '全局累计费用', value: formatCost(data.globalSpend), sub: 'LiteLLM 全局', icon: TrendingUp, gradient: 'from-orange-500 to-amber-500' },
  ];
  const dailyTokenData = data.byDay.map(d => ({ label: d.date.slice(5), value: d.tokens }));
  const dailyTokenMax = Math.max(...dailyTokenData.map(d => d.value), 1);
  const dailyCostData = data.byDay.map(d => ({ label: d.date.slice(5), value: d.cost }));
  const dailyCostMax = Math.max(...dailyCostData.map(d => d.value), 0.001);

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Usage & Cost</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time metrics from LiteLLM gateway</p>
        </div>
        <div className="flex items-center gap-3">
          {/* User filter dropdown + search */}
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => { setDropdownOpen(!dropdownOpen); setSearchQuery(''); }} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white/[0.05] border border-white/[0.1] rounded-lg hover:bg-white/[0.08] transition-all min-w-[160px]">
              <Users size={14} className="text-gray-400 shrink-0" />
              <span className={`truncate ${selectedUser ? 'text-gray-200' : 'text-gray-400'}`}>{selectedUser || '全部用户'}</span>
              <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-[#1a1a2e] border border-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden">
                {/* Search input */}
                <div className="p-2 border-b border-white/[0.06]">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索用户名或邮箱..." className="w-full pl-8 pr-8 py-1.5 text-sm bg-white/[0.05] border border-white/[0.08] rounded-lg text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50" autoFocus />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X size={14} /></button>
                    )}
                  </div>
                </div>
                {/* Options */}
                <div className="max-h-64 overflow-y-auto py-1">
                  <button onClick={() => { setSelectedUser(''); setDropdownOpen(false); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-white/[0.05] transition-colors flex items-center gap-2 ${!selectedUser ? 'text-purple-400 bg-purple-500/10' : 'text-gray-300'}`}>
                    <Users size={13} className="shrink-0" />
                    <span className="font-medium">全部用户（汇总）</span>
                  </button>
                  {filteredUsers.map(u => (
                    <button key={u} onClick={() => { setSelectedUser(u); setDropdownOpen(false); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-white/[0.05] transition-colors flex items-center gap-2 ${selectedUser === u ? 'text-purple-400 bg-purple-500/10' : 'text-gray-300'}`}>
                      <User size={13} className="shrink-0" />
                      <span className="truncate">{u}</span>
                    </button>
                  ))}
                  {filteredUsers.length === 0 && searchQuery && (
                    <p className="px-3 py-4 text-center text-gray-600 text-xs">未找到匹配用户</p>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Selected user badge */}
          {selectedUser && (
            <button onClick={() => setSelectedUser('')} className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/20 text-purple-300 rounded-md hover:bg-purple-500/30 transition-colors" title="清除筛选">
              <User size={12} /><span className="truncate max-w-[100px]">{selectedUser}</span><X size={12} />
            </button>
          )}
          <div className="flex gap-1 bg-white/[0.05] border border-white/[0.1] rounded-lg p-1">
            {TIME_PERIODS.map(p => (
              <button key={p.value} onClick={() => setDays(p.value)} className={`px-3 py-1.5 text-sm rounded-md transition-all ${days === p.value ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.05]'}`}>{p.label}</button>
            ))}
          </div>
        </div>
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
          <BarChart data={dailyTokenData} maxValue={dailyTokenMax} label={`最近 ${periodLabel} Tokens 趋势`} />
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4"><DollarSign size={16} className="text-gray-400" /><h2 className="text-sm font-medium text-gray-300">Daily Cost</h2></div>
          <BarChart data={dailyCostData} maxValue={dailyCostMax} label={`最近 ${periodLabel} 费用趋势 (USD)`} formatFn={formatCost} />
        </div>
      </div>

      {/* User Stats */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden backdrop-blur-sm mb-8">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2"><Users size={16} className="text-gray-400" /><h2 className="text-sm font-medium text-gray-300">用户用量统计 (By User)</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs">用户</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">请求数</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Prompt Tokens</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Completion Tokens</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Total Tokens</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">费用</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">平均延迟</th>
              <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">成功率</th>
            </tr></thead>
            <tbody>
              {data.byUser.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-600 text-sm">暂无用户数据</td></tr>}
              {data.byUser.map(u => (
                <tr key={u.user} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 text-gray-200 text-xs font-medium">{u.user || 'unknown'}</td>
                  <td className="px-4 py-2.5 text-gray-300 text-right text-xs">{u.requests}</td>
                  <td className="px-4 py-2.5 text-gray-300 text-right text-xs">{formatTokens(u.promptTokens)}</td>
                  <td className="px-4 py-2.5 text-gray-300 text-right text-xs">{formatTokens(u.completionTokens)}</td>
                  <td className="px-4 py-2.5 text-gray-200 text-right text-xs font-medium">{formatTokens(u.tokens)}</td>
                  <td className="px-4 py-2.5 text-green-400 text-right text-xs">{formatCost(u.cost)}</td>
                  <td className="px-4 py-2.5 text-gray-300 text-right text-xs">{formatMs(u.avgLatencyMs)}</td>
                  <td className="px-4 py-2.5 text-right text-xs"><span className={u.successRate >= 99 ? 'text-green-400' : u.successRate >= 90 ? 'text-yellow-400' : 'text-red-400'}>{u.successRate}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <th className="text-left px-3 py-2.5 text-gray-500 font-medium">User</th>
              <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Model</th>
              <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Provider</th>
              <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Prompt</th>
              <th className="text-right px-3 py-2.5 text-gray-500 font-medium">Cached</th>
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
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{new Date(log.time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-3 py-2 text-gray-300 truncate max-w-[120px]" title={log.user}>{log.user || '—'}</td>
                  <td className="px-3 py-2 text-gray-200 font-mono">{log.model}</td>
                  <td className="px-3 py-2 text-gray-400 capitalize">{log.provider}</td>
                  <td className="px-3 py-2 text-gray-300 text-right">{log.promptTokens.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{log.cachedTokens > 0 ? <span className="text-cyan-400">{log.cachedTokens.toLocaleString()}</span> : <span className="text-gray-600">0</span>}</td>
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
