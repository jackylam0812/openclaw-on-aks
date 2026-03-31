'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Server, Cpu, Users, BarChart2, LogOut, ClipboardCheck, Shield, Activity, Settings } from 'lucide-react';
import { clearToken } from '@/lib/api';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/approvals', label: 'Approvals', icon: ClipboardCheck },
  { href: '/cluster', label: 'Cluster', icon: Server },
  { href: '/models', label: 'Models', icon: Cpu },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/monitoring', label: 'Monitoring', icon: BarChart2 },
  { href: '/usage', label: 'Usage & Cost', icon: Activity },
  { href: '/security', label: 'Security', icon: Shield },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    clearToken();
    router.push('/login');
  };

  const userEmail = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('user') || '{}').email || 'admin'
    : 'admin';

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-[#111111] border-r border-white/[0.06] flex flex-col z-50">
      <div className="px-5 py-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl" role="img" aria-label="lobster">{'\uD83E\uDD9E'}</span>
          <span className="text-sm font-semibold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent leading-tight">
            OpenClaw<br />Admin Portal
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'text-purple-400 bg-purple-500/10'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/[0.06]">
        <p className="text-xs text-gray-500 truncate mb-2">{userEmail}</p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
