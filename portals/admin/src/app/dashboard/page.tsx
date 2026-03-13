'use client';

import { useEffect, useState } from 'react';
import { Users, Server, Zap, Cpu } from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import { getStats } from '@/lib/api';

interface Stats {
  totalUsers: number;
  clusterUptime: string;
  tokenUsageToday: number;
  activeModels: number;
}

const statCards = [
  { key: 'totalUsers', label: 'Total Users', icon: Users, gradient: 'from-blue-500 to-cyan-500', format: (v: number) => String(v) },
  { key: 'clusterUptime', label: 'Cluster Uptime', icon: Server, gradient: 'from-green-500 to-emerald-500', format: (v: string) => v },
  { key: 'tokenUsageToday', label: 'Token Usage Today', icon: Zap, gradient: 'from-purple-500 to-violet-500', format: (v: number) => v.toLocaleString() },
  { key: 'activeModels', label: 'Active Models', icon: Cpu, gradient: 'from-orange-500 to-amber-500', format: (v: number) => String(v) },
] as const;

const recentActivity = [
  { text: 'New user registered: user@example.com', time: '2 minutes ago' },
  { text: 'Model gpt-5.4 health check passed', time: '5 minutes ago' },
  { text: 'Cluster auto-scaled to 3 nodes', time: '12 minutes ago' },
  { text: 'API key generated for production', time: '1 hour ago' },
  { text: 'Database backup completed', time: '3 hours ago' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your OpenClaw platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = stats ? (stats as any)[card.key] : '—';
          return (
            <div
              key={card.key}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">{card.label}</span>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center`}>
                  <Icon size={16} className="text-white" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-gray-100">
                {stats ? card.format(value as never) : '—'}
              </p>
            </div>
          );
        })}
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm">
        <h2 className="text-sm font-medium text-gray-300 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {recentActivity.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
              <span className="text-sm text-gray-400">{item.text}</span>
              <span className="text-xs text-gray-600 shrink-0 ml-4">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
