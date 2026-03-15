'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import { getApprovals, approveUser, rejectUser } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  approval_status: string;
  created_at: string;
}

const tabs = [
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'rejected', label: 'Rejected', icon: XCircle },
  { key: 'approved', label: 'Approved', icon: CheckCircle },
] as const;

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadUsers = async (status: string) => {
    setLoading(true);
    try {
      const data = await getApprovals(status);
      setUsers(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadUsers(activeTab);
  }, [activeTab]);

  const handleApprove = async (userId: string) => {
    setActionLoading(userId);
    try {
      await approveUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {}
    setActionLoading(null);
  };

  const handleReject = async (userId: string) => {
    setActionLoading(userId);
    try {
      await rejectUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {}
    setActionLoading(null);
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Approvals</h1>
        <p className="text-sm text-gray-500 mt-1">Review and approve user registrations</p>
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.04] rounded-lg p-1 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-white/[0.08] text-gray-200'
                  : 'text-gray-500 hover:text-gray-400'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Name</th>
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Email</th>
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Registered</th>
              {activeTab !== 'approved' && (
                <th className="text-right text-xs text-gray-500 font-medium px-5 py-3">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center text-sm text-gray-500 py-8">Loading...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-sm text-gray-500 py-8">
                  No {activeTab} users
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3 text-sm text-gray-200">{user.name}</td>
                  <td className="px-5 py-3 text-sm text-gray-400">{user.email}</td>
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  {activeTab !== 'approved' && (
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApprove(user.id)}
                          disabled={actionLoading === user.id}
                          className="px-3 py-1.5 text-xs font-medium text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/10 transition-colors disabled:opacity-50"
                        >
                          Approve
                        </button>
                        {activeTab === 'pending' && (
                          <button
                            onClick={() => handleReject(user.id)}
                            disabled={actionLoading === user.id}
                            className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
