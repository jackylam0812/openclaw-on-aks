'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { Box, Shield, Container, Monitor } from 'lucide-react';
import { getSandboxes } from '@/lib/api';

interface Sandbox {
  id: string;
  user_id: string;
  pod_name: string | null;
  namespace: string;
  status: string;
  runtime_type: string;
  endpoint: string | null;
  created_at: string;
  ready_at: string | null;
  vm_name: string | null;
  vm_public_ip: string | null;
  email: string;
  user_name: string;
}

export default function MonitoringPage() {
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);

  useEffect(() => {
    getSandboxes().then(setSandboxes).catch(() => {});
  }, []);

  const counts = {
    active: sandboxes.filter((s) => s.status === 'running' || s.status === 'creating').length,
    provisioning: sandboxes.filter((s) => s.status === 'provisioning').length,
    failed: sandboxes.filter((s) => s.status === 'failed').length,
    total: sandboxes.length,
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Monitoring</h1>
        <p className="text-sm text-gray-500 mt-1">Sandbox overview and platform metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Sandboxes', value: counts.total, color: 'text-gray-300' },
          { label: 'Active', value: counts.active, color: 'text-green-400' },
          { label: 'Provisioning', value: counts.provisioning, color: 'text-purple-400' },
          { label: 'Failed', value: counts.failed, color: 'text-red-400' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm"
          >
            <span className="text-sm text-gray-400">{stat.label}</span>
            <p className={`text-2xl font-semibold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <Box size={16} className="text-gray-400" />
          <h2 className="text-sm font-medium text-gray-300">All Sandboxes</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-3 text-gray-500 font-medium">User</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Pod / VM</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Type</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {sandboxes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-600">
                  No sandboxes found
                </td>
              </tr>
            ) : (
              sandboxes.map((sb) => (
                <tr key={sb.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-3 text-gray-200">{sb.user_name}</td>
                  <td className="px-4 py-3 text-gray-400">{sb.email}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    {sb.runtime_type === 'azure-vm' ? (sb.vm_name || '—') : (sb.pod_name || '—')}
                  </td>
                  <td className="px-4 py-3">
                    {sb.runtime_type === 'azure-vm' ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                        <Monitor size={12} /> Azure VM
                      </span>
                    ) : sb.runtime_type === 'standard' ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                        <Container size={12} /> Standard Pod
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">
                        <Shield size={12} /> Kata VM
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        sb.status === 'running'
                          ? 'bg-green-500/10 text-green-400'
                          : sb.status === 'creating'
                            ? 'bg-blue-500/10 text-blue-400'
                            : sb.status === 'provisioning'
                              ? 'bg-purple-500/10 text-purple-400'
                              : sb.status === 'failed'
                                ? 'bg-red-500/10 text-red-400'
                                : 'bg-gray-500/10 text-gray-400'
                      }`}
                    >
                      {sb.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(sb.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
