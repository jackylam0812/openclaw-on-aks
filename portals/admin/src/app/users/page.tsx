'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { getUsers } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  sandbox_status: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    getUsers().then(setUsers).catch(() => {});
  }, []);

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
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Sandbox</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-600">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
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
                    {user.sandbox_status ? (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          user.sandbox_status === 'running'
                            ? 'bg-green-500/10 text-green-400'
                            : user.sandbox_status === 'creating'
                              ? 'bg-blue-500/10 text-blue-400'
                              : user.sandbox_status === 'provisioning'
                                ? 'bg-purple-500/10 text-purple-400'
                                : user.sandbox_status === 'failed'
                                  ? 'bg-red-500/10 text-red-400'
                                  : 'bg-gray-500/10 text-gray-400'
                        }`}
                      >
                        {user.sandbox_status}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
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
