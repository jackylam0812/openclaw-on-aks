'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, XCircle, LogOut } from 'lucide-react';
import { getToken, getMe, clearToken } from '@/lib/api';

export default function PendingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('pending');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [router]);

  const checkStatus = async () => {
    try {
      const user = await getMe();
      if (user.approval_status === 'approved') {
        router.push('/chat');
        return;
      }
      setStatus(user.approval_status);
    } catch {}
  };

  const handleLogout = () => {
    clearToken();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[#0a0a0a]" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-600/8 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px]" />

      <div className="relative w-full max-w-sm mx-4">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 text-center">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              OpenClaw
            </h1>
          </div>

          {status === 'pending' ? (
            <>
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
                <Clock size={32} className="text-yellow-400" />
              </div>
              <h2 className="text-lg font-medium text-gray-200 mb-2">Pending Approval</h2>
              <p className="text-sm text-gray-500 mb-6">
                Your account is pending admin approval. You'll be redirected automatically once approved.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-600 mb-6">
                <div className="w-2 h-2 border border-yellow-400 border-t-transparent rounded-full animate-spin" />
                Checking status...
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <XCircle size={32} className="text-red-400" />
              </div>
              <h2 className="text-lg font-medium text-gray-200 mb-2">Not Approved</h2>
              <p className="text-sm text-gray-500 mb-6">
                Your registration was not approved. Please contact the administrator.
              </p>
            </>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 mx-auto text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
