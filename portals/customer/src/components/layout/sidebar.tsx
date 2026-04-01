'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Plus, LogOut, MessageSquare, Plug, Bird, Send, MessageCircle, Coins } from 'lucide-react';
import { clearToken } from '@/lib/api';

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface ConnectedChannel {
  id: string;
  type: string;
  status: string;
}

interface CreditInfo {
  monthlyQuota: number;
  usedCredits: number;
  remainingCredits: number;
  usagePercent: number;
}

interface SidebarProps {
  conversations: Conversation[];
  activeConvId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  userName: string;
  channels?: ConnectedChannel[];
  credits?: CreditInfo | null;
}

const channelMeta: Record<string, { label: string; Icon: typeof Bird; color: string }> = {
  feishu: { label: 'Feishu', Icon: Bird, color: 'text-blue-400' },
  telegram: { label: 'Telegram', Icon: Send, color: 'text-sky-400' },
  slack: { label: 'Slack', Icon: MessageCircle, color: 'text-green-400' },
};

export default function Sidebar({
  conversations,
  activeConvId,
  onSelectConversation,
  onNewChat,
  userName,
  channels = [],
  credits,
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
          {channels.map((ch) => {
            const meta = channelMeta[ch.type];
            if (!meta) return null;
            const { label, Icon, color } = meta;
            return (
              <button
                key={ch.id}
                onClick={() => router.push('/integrations')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/[0.03] transition-colors"
              >
                <Icon size={16} className={color} />
                {label}
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400" />
              </button>
            );
          })}
          <button
            onClick={() => router.push('/integrations')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              isIntegrations
                ? 'bg-white/[0.06] text-gray-200'
                : 'text-gray-500 hover:bg-white/[0.03]'
            }`}
          >
            <Plug size={16} />
            More Integrations
          </button>
        </div>
      </div>

      {/* Credits */}
      {credits && (
        <div className="px-3 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 mb-2">
            <Coins size={14} className="text-amber-400" />
            <span className="text-xs text-gray-400">本月额度</span>
          </div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className={`text-lg font-semibold ${credits.remainingCredits <= 0 ? 'text-red-400' : credits.usagePercent >= 80 ? 'text-amber-400' : 'text-gray-100'}`}>
              {Math.round(credits.remainingCredits)}
            </span>
            <span className="text-[11px] text-gray-500">/ {credits.monthlyQuota} credits</span>
          </div>
          <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${credits.usagePercent >= 90 ? 'bg-red-500' : credits.usagePercent >= 70 ? 'bg-amber-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'}`}
              style={{ width: `${Math.min(credits.usagePercent, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-600 mt-1">已用 {Math.round(credits.usedCredits)} credits ({credits.usagePercent}%)</p>
        </div>
      )}

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
