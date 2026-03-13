'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './sidebar';
import Topbar from './topbar';
import { getToken } from '@/lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="ml-60">
        <Topbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
