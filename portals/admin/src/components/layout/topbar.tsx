'use client';

import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/cluster': 'Cluster',
  '/models': 'Models',
  '/users': 'Users',
  '/monitoring': 'Monitoring',
};

export default function Topbar() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'Dashboard';

  return (
    <header className="h-14 border-b border-white/[0.06] flex items-center justify-between px-6">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">Admin</span>
        <span className="text-gray-600">/</span>
        <span className="text-gray-200">{title}</span>
      </div>
      <div className="flex items-center gap-4">
        <button className="text-gray-500 hover:text-gray-300 transition-colors">
          <Bell size={18} />
        </button>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs text-white font-medium">
          A
        </div>
      </div>
    </header>
  );
}
