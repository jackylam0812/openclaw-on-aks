'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, Trash2, Shield, Box } from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import { getApprovals, approveUser, rejectUser, deleteUser } from '@/lib/api';

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
  const [approveModal, setApproveModal] = useState<{ userId: string; userName: string } | null>(null);
  const [selectedRuntime, setSelectedRuntime] = useState<'kata' | 'standard'>('kata');

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

  const handleApprove = async (userId: string, userName: string) => {
    setSelectedRuntime('kata');
    setApproveModal({ userId, userName });
  };

  const confirmApprove = async () => {
    if (!approveModal) return;
    setActionLoading(approveModal.userId);
    setApproveModal(null);
    try {
      await approveUser(approveModal.userId, selectedRuntime);
      setUsers((prev) => prev.filter((u) => u.id !== approveModal.userId));
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

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`Delete user "${userName}"? This will also delete their sandbox pod and all data. This action cannot be undone.`)) return;
    setActionLoading(userId);
    try {
      await deleteUser(userId);
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
              <th className="text-right text-xs text-gray-500 font-medium px-5 py-3">Actions</th>
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
                  <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {activeTab !== 'approved' && (
                          <button
                            onClick={() => handleApprove(user.id, user.name)}
                            disabled={actionLoading === user.id}
                            className="px-3 py-1.5 text-xs font-medium text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/10 transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                        {activeTab === 'pending' && (
                          <button
                            onClick={() => handleReject(user.id)}
                            disabled={actionLoading === user.id}
                            className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(user.id, user.name)}
                          disabled={actionLoading === user.id}
                          className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={12} className="inline mr-1" />
                          Delete
                        </button>
                      </div>
                    </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Runtime Type Selection Modal */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1a1a2e] border border-white/[0.08] rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-100 mb-1">Approve User</h3>
            <p className="text-sm text-gray-400 mb-5">
              Select sandbox runtime for <span className="text-gray-200">{approveModal.userName}</span>
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => setSelectedRuntime('kata')}
                className={`w-full flex items-start gap-3 p-4 rounded-lg border transition-colors text-left ${
                  selectedRuntime === 'kata'
                    ? 'border-blue-500/40 bg-blue-500/10'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <Shield size={20} className={selectedRuntime === 'kata' ? 'text-blue-400 mt-0.5' : 'text-gray-500 mt-0.5'} />
                <div>
                  <div className={`text-sm font-medium ${selectedRuntime === 'kata' ? 'text-blue-300' : 'text-gray-300'}`}>
                    Kata VM Isolation
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Hardware-level isolation via Kata Containers. Runs in a lightweight VM on Intel nodes. Recommended for production.
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedRuntime('standard')}
                className={`w-full flex items-start gap-3 p-4 rounded-lg border transition-colors text-left ${
                  selectedRuntime === 'standard'
                    ? 'border-blue-500/40 bg-blue-500/10'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <Box size={20} className={selectedRuntime === 'standard' ? 'text-blue-400 mt-0.5' : 'text-gray-500 mt-0.5'} />
                <div>
                  <div className={`text-sm font-medium ${selectedRuntime === 'standard' ? 'text-blue-300' : 'text-gray-300'}`}>
                    Standard Pod
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Regular container isolation. Runs on system node pool. Lower resource overhead, suitable for testing.
                  </div>
                </div>
              </button>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setApproveModal(null)}
                className="px-4 py-2 text-sm text-gray-400 border border-white/[0.08] rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmApprove}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
