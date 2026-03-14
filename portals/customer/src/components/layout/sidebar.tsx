'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Plus, LogOut, MessageSquare, Plug, Bird } from 'lucide-react';
import { clearToken } from '@/lib/api';

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeConvId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  userName: string;
}

export default function Sidebar({
  conversations,
  activeConvId,
  onSelectConversation,
  onNewChat,
  userName,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isChat = pathname === '/chat' || pathname === '/app/chat';
  const isIntegrations = pathname === '/integrations' || pathname === '/app/integrations';

  const handleLogout = () => {
    clearToken();
    router.push('/login');
  };

  return (
    <aside className="w-[260px] bg-[#111111] border-r border-white/[0.06] flex flex-col shrink-0">
      {/* New Chat */}
      <div className="p-3">
        <button
          onClick={() => {
            if (!isChat) router.push('/chat');
            onNewChat();
          }}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-white/[0.08] text-sm text-gray-300 hover:bg-white/[0.04] transition-colors"
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      {/* Navigation */}
      <div className="px-3 mb-1">
        <button
          onClick={() => {
            if (!isChat) router.push('/chat');
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            isChat
              ? 'bg-white/[0.06] text-gray-200'
              : 'text-gray-400 hover:bg-white/[0.03]'
          }`}
        >
          <MessageSquare size={16} />
          Chat
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {isChat &&
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeConvId === conv.id
                  ? 'bg-white/[0.06] text-gray-200'
                  : 'text-gray-400 hover:bg-white/[0.03]'
              }`}
            >
              <p className="truncate">{conv.title}</p>
              <p className="text-xs text-gray-600 mt-0.5">
                {new Date(conv.updated_at).toLocaleDateString()}
              </p>
            </button>
          ))}
      </div>

      {/* IM / Integrations Section */}
      <div className="border-t border-white/[0.06]">
        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] uppercase tracking-wider text-gray-600 px-3 mb-1">Channels</p>
        </div>
        <div className="px-3 pb-2 space-y-0.5">
          <button
            onClick={() => router.push('/integrations')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              isIntegrations
                ? 'bg-white/[0.06] text-gray-200'
                : 'text-gray-400 hover:bg-white/[0.03]'
            }`}
          >
            <Bird size={16} className="text-blue-400" />
            Feishu
          </button>
          <button
            onClick={() => router.push('/integrations')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-white/[0.03] transition-colors"
          >
            <Plug size={16} />
            More Integrations
          </button>
        </div>
      </div>

      {/* User Info */}
      <div className="p-3 border-t border-white/[0.06]">
        <p className="text-xs text-gray-500 truncate mb-2">{userName}</p>
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
