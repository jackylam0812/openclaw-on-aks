'use client';

import { useEffect, useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import { getSoulMd, updateSoulMd, syncSoulMd } from '@/lib/api';

export default function SecurityPage() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const loadSoulMd = async () => {
    setLoading(true);
    try {
      const data = await getSoulMd();
      setContent(data.content || '');
      setUpdatedAt(data.updated_at || null);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadSoulMd(); }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await updateSoulMd(content);
      if (res.error) {
        setMessage({ type: 'error', text: res.error });
      } else {
        setMessage({ type: 'success', text: 'SOUL.md saved successfully.' });
        loadSoulMd();
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
    setSaving(false);
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await syncSoulMd(content);
      if (res.error) {
        setMessage({ type: 'error', text: res.error });
      } else {
        setMessage({ type: 'success', text: `Saved & synced to sandboxes. Success: ${res.success}, Failed: ${res.failed}` });
        loadSoulMd();
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
    setSyncing(false);
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Security Control</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage the SOUL.md system prompt that controls agent behavior in sandboxes
          </p>
        </div>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium text-gray-200">SOUL.md Content</h2>
            <p className="text-xs text-gray-500 mt-1">
              This file is placed in each sandbox workspace with read-only (444) permissions. The agent uses it as system-level instructions.
            </p>
          </div>
          {updatedAt && (
            <span className="text-xs text-gray-500">
              Last updated: {new Date(updatedAt).toLocaleString()}
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-gray-500 py-8 text-center">Loading...</div>
        ) : (
          <>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              className="w-full bg-black/30 border border-white/[0.08] rounded-lg p-4 text-sm text-gray-200 font-mono resize-y focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/30"
              placeholder="Enter SOUL.md content..."
            />

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSave}
                disabled={saving || syncing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-500/10 transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleSyncAll}
                disabled={saving || syncing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing...' : 'Save & Sync to All Sandboxes'}
              </button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
