'use client';

import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, Star, X } from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import { getModels, addModel, deleteModel, setDefaultModel, syncModels } from '@/lib/api';

interface Model {
  id: string;
  name: string;
  model_id: string;
  litellm_model: string;
  api_base: string;
  api_key: string;
  api_version: string;
  reasoning: number;
  input_types: string;
  context_window: number;
  max_tokens: number;
  is_default: number;
  enabled: number;
  created_at: string;
}

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: number; failed: number } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    name: '', model_id: '', litellm_model: '', api_base: '', api_key: '', api_version: '2025-04-01-preview',
    reasoning: false, input_types: 'text', context_window: 200000, max_tokens: 8192,
  });

  const loadModels = async () => {
    setLoading(true);
    try { setModels(await getModels()); } catch {}
    setLoading(false);
  };

  useEffect(() => { loadModels(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.model_id || !form.litellm_model) return;
    setActionLoading('add');
    try {
      const res = await addModel(form);
      if (res.error) { alert(res.error); } else {
        setShowAddForm(false);
        setForm({ name: '', model_id: '', litellm_model: '', api_base: '', api_key: '', api_version: '2025-04-01-preview', reasoning: false, input_types: 'text', context_window: 200000, max_tokens: 8192 });
        await loadModels();
      }
    } catch {}
    setActionLoading(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete model "${name}"? You will need to sync sandboxes after.`)) return;
    setActionLoading(id);
    try {
      const res = await deleteModel(id);
      if (res.error) { alert(res.error); } else { await loadModels(); }
    } catch {}
    setActionLoading(null);
  };

  const handleSetDefault = async (id: string) => {
    setActionLoading(id);
    try { await setDefaultModel(id); await loadModels(); } catch {}
    setActionLoading(null);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncModels();
      setSyncResult(result);
    } catch {}
    setSyncing(false);
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Models</h1>
          <p className="text-sm text-gray-500 mt-1">Manage AI models available via LiteLLM</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-500/10 transition-colors"
          >
            <Plus size={14} /> Add Model
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync to Sandboxes'}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${syncResult.failed > 0 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-green-500/10 text-green-400'}`}>
          Sync complete: {syncResult.success} succeeded{syncResult.failed > 0 ? `, ${syncResult.failed} failed` : ''}. Pods are restarting.
        </div>
      )}

      {/* Add Model Form */}
      {showAddForm && (
        <div className="mb-6 bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-200">Add New Model</h2>
            <button onClick={() => setShowAddForm(false)} className="text-gray-500 hover:text-gray-300">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="GPT-5.4"
                className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/30"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Model Alias * <span className="text-gray-600">(used in OpenClaw)</span></label>
              <input
                value={form.model_id}
                onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                placeholder="gpt-5.4"
                className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/30"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">LiteLLM Model * <span className="text-gray-600">(provider/model)</span></label>
              <input
                value={form.litellm_model}
                onChange={(e) => setForm({ ...form, litellm_model: e.target.value })}
                placeholder="azure/gpt-4o"
                className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/30"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">API Base URL</label>
              <input
                value={form.api_base}
                onChange={(e) => setForm({ ...form, api_base: e.target.value })}
                placeholder="https://eastus2.api.cognitive.microsoft.com"
                className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/30"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">API Key</label>
              <input
                type="password"
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/30"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">API Version</label>
              <input
                value={form.api_version}
                onChange={(e) => setForm({ ...form, api_version: e.target.value })}
                placeholder="2025-04-01-preview"
                className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/30"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Input Types</label>
              <input
                value={form.input_types}
                onChange={(e) => setForm({ ...form, input_types: e.target.value })}
                placeholder="text,image"
                className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/30"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Context Window</label>
              <input
                type="number"
                value={form.context_window}
                onChange={(e) => setForm({ ...form, context_window: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-200 focus:outline-none focus:border-purple-500/30"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max Tokens</label>
              <input
                type="number"
                value={form.max_tokens}
                onChange={(e) => setForm({ ...form, max_tokens: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-gray-200 focus:outline-none focus:border-purple-500/30"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.reasoning}
                  onChange={(e) => setForm({ ...form, reasoning: e.target.checked })}
                  className="rounded border-gray-600"
                />
                Reasoning model
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleAdd}
              disabled={!form.name || !form.model_id || !form.litellm_model || actionLoading === 'add'}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'add' ? 'Adding...' : 'Add Model'}
            </button>
          </div>
        </div>
      )}

      {/* Model Cards */}
      {loading ? (
        <div className="text-center text-sm text-gray-500 py-12">Loading...</div>
      ) : models.length === 0 ? (
        <div className="text-center text-sm text-gray-500 py-12">No models configured</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((model) => (
            <div key={model.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-200">{model.name}</h3>
                <div className="flex items-center gap-2">
                  {model.is_default ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">Default</span>
                  ) : null}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">Active</span>
                </div>
              </div>
              <div className="space-y-1.5 mb-4">
                <p className="text-xs text-gray-500">
                  Alias: <span className="text-gray-400 font-mono">{model.model_id}</span>
                </p>
                <p className="text-xs text-gray-500">
                  LiteLLM: <span className="text-gray-400 font-mono">{model.litellm_model || '-'}</span>
                </p>
                {model.api_base && (
                  <p className="text-xs text-gray-500">
                    API Base: <span className="text-gray-400 font-mono text-[10px]">{model.api_base.replace(/https?:\/\//, '').slice(0, 30)}...</span>
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  Context: <span className="text-gray-400">{(model.context_window / 1000).toFixed(0)}K</span>
                  {' / '}Max: <span className="text-gray-400">{model.max_tokens.toLocaleString()}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Input: <span className="text-gray-400">{model.input_types}</span>
                  {model.reasoning ? <span className="ml-2 text-blue-400">Reasoning</span> : null}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                {!model.is_default && (
                  <button
                    onClick={() => handleSetDefault(model.id)}
                    disabled={actionLoading === model.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-500/10 transition-colors disabled:opacity-50"
                  >
                    <Star size={12} /> Set Default
                  </button>
                )}
                {!model.is_default && (
                  <button
                    onClick={() => handleDelete(model.id, model.name)}
                    disabled={actionLoading === model.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
