'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plug } from 'lucide-react';
import { getToken, getIntegrations, getChatHistory, connectIntegration, disconnectIntegration } from '@/lib/api';
import Sidebar from '@/components/layout/sidebar';

interface Integration {
  id: string;
  type: string;
  status: string;
  webhookUrl?: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface IntegrationConfig {
  type: string;
  label: string;
  emoji: string;
  description: string;
  fields: { key: string; label: string; type?: string; placeholder?: string }[];
}

const integrationConfigs: IntegrationConfig[] = [
  {
    type: 'feishu',
    label: 'Feishu',
    emoji: '\uD83D\uDC26',
    description: 'Connect your Feishu bot to let team members chat with OpenClaw directly in Feishu.',
    fields: [
      { key: 'appId', label: 'App ID', placeholder: 'cli_xxxxxxxxxx' },
      { key: 'appSecret', label: 'App Secret', type: 'password', placeholder: 'Enter your App Secret' },
    ],
  },
  {
    type: 'telegram',
    label: 'Telegram',
    emoji: '\u2708\uFE0F',
    description: 'Connect a Telegram bot powered by OpenClaw.',
    fields: [
      { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: 'Enter your Bot Token' },
    ],
  },
];

export default function IntegrationsPage() {
  const router = useRouter();
  const [connected, setConnected] = useState<Integration[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    loadIntegrations();
    loadConversations();
  }, [router]);

  const loadIntegrations = async () => {
    try {
      const data = await getIntegrations();
      setConnected(data);
    } catch {}
  };

  const loadConversations = async () => {
    try {
      const data = await getChatHistory();
      setConversations(data);
    } catch {}
  };

  const handleConnect = async (type: string) => {
    const config = formData[type] || {};
    setLoading(type);
    try {
      const result = await connectIntegration(type, config);
      setConnected((prev) => [...prev, result]);
      setFormData((prev) => ({ ...prev, [type]: {} }));
    } catch {}
    setLoading(null);
  };

  const handleDisconnect = async (integration: Integration) => {
    setLoading(integration.type);
    try {
      await disconnectIntegration(integration.id);
      setConnected((prev) => prev.filter((i) => i.id !== integration.id));
    } catch {}
    setLoading(null);
  };

  const getConnected = (type: string) => connected.find((i) => i.type === type);

  const userName = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('user') || '{}').name || 'User'
    : 'User';

  return (
    <div className="h-screen flex">
      <Sidebar
        conversations={conversations}
        activeConvId={null}
        onSelectConversation={(id) => router.push('/chat')}
        onNewChat={() => router.push('/chat')}
        userName={userName}
        channels={connected}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-white/[0.06] flex items-center px-6 gap-3 shrink-0">
          <Plug size={18} className="text-gray-500" />
          <span className="text-sm text-gray-300">Integrations</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 ml-auto">
            {connected.length} connected
          </span>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-gray-100">Channel Integrations</h1>
              <p className="text-sm text-gray-500 mt-1">Connect OpenClaw to your IM platforms</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {integrationConfigs.map((config) => {
                const existing = getConnected(config.type);
                const isConnected = !!existing;

                return (
                  <div
                    key={config.type}
                    className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{config.emoji}</span>
                      <div>
                        <h3 className="text-sm font-medium text-gray-200">{config.label}</h3>
                        {isConnected && (
                          <span className="text-xs text-green-400">Connected</span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mb-4">{config.description}</p>

                    {isConnected ? (
                      <div>
                        {existing?.webhookUrl && (
                          <div className="mb-3">
                            <label className="block text-xs text-gray-500 mb-1">Webhook URL</label>
                            <input
                              readOnly
                              value={existing.webhookUrl}
                              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs text-gray-400"
                            />
                          </div>
                        )}
                        <button
                          onClick={() => handleDisconnect(existing!)}
                          disabled={loading === config.type}
                          className="w-full py-2 text-sm text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="space-y-3 mb-4">
                          {config.fields.map((field) => (
                            <div key={field.key}>
                              <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                              <input
                                type={field.type || 'text'}
                                placeholder={field.placeholder}
                                value={formData[config.type]?.[field.key] || ''}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    [config.type]: {
                                      ...prev[config.type],
                                      [field.key]: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                              />
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => handleConnect(config.type)}
                          disabled={loading === config.type}
                          className="w-full py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg transition-all disabled:opacity-50"
                        >
                          {loading === config.type ? 'Connecting...' : 'Connect'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
