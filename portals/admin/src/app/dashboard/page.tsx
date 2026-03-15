'use client';

import { useEffect, useState } from 'react';
import { Users, Server, Box, Cpu, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import AppLayout from '@/components/layout/app-layout';
import { getClusterOverview } from '@/lib/api';

interface ClusterOverview {
  totalUsers: number;
  activeSandboxes: number;
  nodeCount: number;
  totalPods: number;
  openclawPods: number;
  pendingApprovals: number;
  nodes: any[];
}

const statCards = [
  { key: 'totalUsers', label: 'Total Users', icon: Users, gradient: 'from-blue-500 to-cyan-500' },
  { key: 'activeSandboxes', label: 'Active Sandboxes', icon: Box, gradient: 'from-green-500 to-emerald-500' },
  { key: 'nodeCount', label: 'Cluster Nodes', icon: Server, gradient: 'from-purple-500 to-violet-500' },
  { key: 'totalPods', label: 'Sandbox Pods', icon: Cpu, gradient: 'from-orange-500 to-amber-500' },
  { key: 'pendingApprovals', label: 'Pending Approvals', icon: ClipboardCheck, gradient: 'from-yellow-500 to-amber-400', href: '/approvals' },
] as const;

export default function DashboardPage() {
  const [overview, setOverview] = useState<ClusterOverview | null>(null);

  useEffect(() => {
    getClusterOverview().then(setOverview).catch(() => {});
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
          const value = overview ? (overview as any)[card.key] : '—';
          const content = (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">{card.label}</span>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center`}>
                  <Icon size={16} className="text-white" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-gray-100">
                {overview ? String(value) : '—'}
              </p>
            </>
          );
          const className = "bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm" +
            ('href' in card ? ' hover:bg-white/[0.06] transition-colors cursor-pointer' : '');
          return 'href' in card ? (
            <Link key={card.key} href={card.href} className={className}>
              {content}
            </Link>
          ) : (
            <div key={card.key} className={className}>
              {content}
            </div>
          );
        })}
      </div>

      {overview && overview.nodes.length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Cluster Nodes</h2>
          <div className="space-y-3">
            {overview.nodes.map((node: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                <span className="text-sm text-gray-200">{node.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">CPU: {node.cpu}</span>
                  <span className="text-xs text-gray-500">Mem: {node.memory}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    node.status === 'Ready'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {node.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
