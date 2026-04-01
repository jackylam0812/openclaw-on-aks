'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { getUsers, stopSandbox, startSandbox, restartSandbox, getAllCredits, setUserQuota, resetUserCredits } from '@/lib/api';
import { Play, Square, RotateCcw, Coins, RotateCw } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  sandbox_status: string | null;
}

interface CreditInfo {
  userId: string;
  email: string;
  name: string;
  monthlyQuota: number;
  usedCredits: number;
  remainingCredits: number;
  usagePercent: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [credits, setCredits] = useState<Record<string, CreditInfo>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [editingQuota, setEditingQuota] = useState<string | null>(null);
  const [quotaInput, setQuotaInput] = useState('');

  const reload = () => {
    getUsers().then(setUsers).catch(() => {});
    getAllCredits().then((data: CreditInfo[]) => {
      const map: Record<string, CreditInfo> = {};
      for (const c of data) map[c.userId] = c;
      setCredits(map);
    }).catch(() => {});
  };

  useEffect(() => { reload(); }, []);

  const handleAction = async (userId: string, action: 'stop' | 'start' | 'restart') => {
    setLoading(l => ({ ...l, [userId]: true }));
    try {
      if (action === 'stop') await stopSandbox(userId);
      else if (action === 'start') await startSandbox(userId);
      else await restartSandbox(userId);
      await new Promise(r => setTimeout(r, 1000));
      await reload();
    } catch {} finally {
      setLoading(l => ({ ...l, [userId]: false }));
    }
  };

  const handleSaveQuota = async (userId: string) => {
    const q = parseInt(quotaInput, 10);
    if (isNaN(q) || q < 0) return;
    setLoading(l => ({ ...l, [userId]: true }));
    try {
      await setUserQuota(userId, q);
      setEditingQuota(null);
      reload();
    } catch {} finally {
      setLoading(l => ({ ...l, [userId]: false }));
    }
  };

  const handleResetCredits = async (userId: string) => {
    setLoading(l => ({ ...l, [userId]: true }));
    try {
      await resetUserCredits(userId);
      reload();
    } catch {} finally {
      setLoading(l => ({ ...l, [userId]: false }));
    }
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Users</h1>
        <p className="text-sm text-gray-500 mt-1">Registered platform users</p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden backdrop-blur-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Role</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Credits</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Sandbox</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Actions</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-600">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isLoading = loading[user.id];
                const status = user.sandbox_status;
                return (
                  <tr key={user.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-3 text-gray-200">{user.name}</td>
                    <td className="px-4 py-3 text-gray-400">{user.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          user.role === 'admin'
                            ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const c = credits[user.id];
                        if (!c) return <span className="text-xs text-gray-600">&mdash;</span>;
                        return (
                          <div className="flex items-center gap-2">
                            {editingQuota === user.id ? (
                              <div className="flex items-center gap-1">
                                <input type="number" value={quotaInput} onChange={e => setQuotaInput(e.target.value)} className="w-16 px-1.5 py-0.5 text-xs bg-white/[0.05] border border-white/[0.1] rounded text-gray-200 focus:outline-none focus:border-purple-500" autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveQuota(user.id); if (e.key === 'Escape') setEditingQuota(null); }} />
                                <button onClick={() => handleSaveQuota(user.id)} className="text-[10px] text-green-400 hover:text-green-300">✓</button>
                                <button onClick={() => setEditingQuota(null)} className="text-[10px] text-gray-500 hover:text-gray-300">✕</button>
                              </div>
                            ) : (
                              <div className="min-w-[100px]">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <Coins size={12} className="text-amber-400" />
                                  <span className={`text-xs font-medium ${c.remainingCredits <= 0 ? 'text-red-400' : c.usagePercent >= 80 ? 'text-amber-400' : 'text-gray-200'}`}>
                                    {Math.round(c.remainingCredits)} / {c.monthlyQuota}
                                  </span>
                                </div>
                                <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${c.usagePercent >= 90 ? 'bg-red-500' : c.usagePercent >= 70 ? 'bg-amber-500' : 'bg-purple-500'}`} style={{ width: `${Math.min(c.usagePercent, 100)}%` }} />
                                </div>
                                <div className="flex gap-1 mt-1">
                                  <button onClick={() => { setEditingQuota(user.id); setQuotaInput(String(c.monthlyQuota)); }} className="text-[10px] text-gray-500 hover:text-purple-400" title="修改额度">配额</button>
                                  <button onClick={() => handleResetCredits(user.id)} className="text-[10px] text-gray-500 hover:text-green-400 flex items-center gap-0.5" title="重置已用"><RotateCw size={9} />重置</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {status ? (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            status === 'running'
                              ? 'bg-green-500/10 text-green-400'
                              : status === 'stopped'
                                ? 'bg-slate-500/10 text-slate-400'
                                : status === 'starting'
                                  ? 'bg-yellow-500/10 text-yellow-400'
                                  : status === 'creating'
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : status === 'provisioning'
                                      ? 'bg-purple-500/10 text-purple-400'
                                      : status === 'failed'
                                        ? 'bg-red-500/10 text-red-400'
                                        : 'bg-gray-500/10 text-gray-400'
                          }`}
                        >
                          {status}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {status && user.role !== 'admin' && (
                        <div className="flex gap-1">
                          {status === 'running' && (
                            <>
                              <button
                                onClick={() => handleAction(user.id, 'stop')}
                                disabled={isLoading}
                                title="Sleep"
                                className="p-1 rounded hover:bg-white/[0.06] text-slate-400 hover:text-orange-400 transition-colors disabled:opacity-40"
                              >
                                <Square size={14} />
                              </button>
                              <button
                                onClick={() => handleAction(user.id, 'restart')}
                                disabled={isLoading}
                                title="Restart"
                                className="p-1 rounded hover:bg-white/[0.06] text-slate-400 hover:text-blue-400 transition-colors disabled:opacity-40"
                              >
                                <RotateCcw size={14} />
                              </button>
                            </>
                          )}
                          {status === 'stopped' && (
                            <button
                              onClick={() => handleAction(user.id, 'start')}
                              disabled={isLoading}
                              title="Wake up"
                              className="p-1 rounded hover:bg-white/[0.06] text-slate-400 hover:text-green-400 transition-colors disabled:opacity-40"
                            >
                              <Play size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
