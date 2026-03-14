'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { getToken, getChatHistory, getConversationMessages, sendMessage, getSandboxStatus, getIntegrations } from '@/lib/api';
import MessageBubble from '@/components/chat/message-bubble';
import InputBar from '@/components/chat/input-bar';
import TypingIndicator from '@/components/chat/typing-indicator';
import Sidebar from '@/components/layout/sidebar';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export default function ChatPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sandboxStatus, setSandboxStatus] = useState<string>('none');
  const [channels, setChannels] = useState<{ id: string; type: string; status: string }[]>([]);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    loadConversations();
    loadSandboxStatus();
    loadChannels();
  }, [router]);

  const loadSandboxStatus = async () => {
    try {
      const data = await getSandboxStatus();
      setSandboxStatus(data.status || 'none');
    } catch {}
  };

  const loadChannels = async () => {
    try {
      const data = await getIntegrations();
      setChannels(data);
    } catch {}
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const loadConversations = async () => {
    try {
      const data = await getChatHistory();
      setConversations(data);
    } catch {}
  };

  const loadMessages = async (convId: string) => {
    setActiveConvId(convId);
    try {
      const data = await getConversationMessages(convId);
      setMessages(data);
    } catch {}
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
  };

  const handleSend = async (message: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const data = await sendMessage(message, activeConvId || undefined);
      if (!activeConvId) {
        setActiveConvId(data.conversationId);
        loadConversations();
      }
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const userName = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('user') || '{}').name || 'User'
    : 'User';

  return (
    <div className="h-screen flex">
      <Sidebar
        conversations={conversations}
        activeConvId={activeConvId}
        onSelectConversation={loadMessages}
        onNewChat={handleNewChat}
        userName={userName}
        channels={channels}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-14 border-b border-white/[0.06] flex items-center px-6 gap-3 shrink-0">
          <MessageSquare size={18} className="text-gray-500" />
          <span className="text-sm text-gray-300">
            {activeConvId ? conversations.find((c) => c.id === activeConvId)?.title || 'Chat' : 'New Chat'}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 ml-auto">
            gpt-5.4
          </span>
        </header>

        {/* Sandbox Status Banner */}
        {sandboxStatus !== 'none' && sandboxStatus !== 'running' && (
          <div className={`px-4 py-2 text-xs flex items-center gap-2 shrink-0 ${
            sandboxStatus === 'failed'
              ? 'bg-red-500/10 text-red-400 border-b border-red-500/20'
              : 'bg-purple-500/10 text-purple-400 border-b border-purple-500/20'
          }`}>
            {(sandboxStatus === 'provisioning' || sandboxStatus === 'creating') && (
              <>
                <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                Setting up your environment...
              </>
            )}
            {sandboxStatus === 'failed' && 'Environment setup failed'}
          </div>
        )}
        {sandboxStatus === 'running' && (
          <div className="px-4 py-2 text-xs flex items-center gap-2 shrink-0 bg-green-500/10 text-green-400 border-b border-green-500/20">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            Your environment is ready
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 && !isTyping ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-2xl font-bold mb-4">
                O
              </div>
              <p className="text-lg text-gray-400">How can I help you today?</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <InputBar onSend={handleSend} disabled={isTyping} />
      </div>
    </div>
  );
}
