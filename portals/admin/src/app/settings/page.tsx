'use client';

import { useEffect, useState } from 'react';
import { getSandboxSettings, updateSandboxSettings, triggerAutoSleep } from '@/lib/api';
import { Moon, Timer, RefreshCw, Power, Zap, Save, AlertCircle } from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [idleTimeout, setIdleTimeout] = useState(10);
  const [checkInterval, setCheckInterval] = useState(60);
  const [autoSleepEnabled, setAutoSleepEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await getSandboxSettings();
      setSettings(data);
      setIdleTimeout(data.idleTimeoutMinutes);
      setCheckInterval(data.checkIntervalSeconds);
      setAutoSleepEnabled(data.autoSleepEnabled);
      setDirty(false);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to load settings' });
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await updateSandboxSettings({
        idleTimeoutMinutes: idleTimeout,
        checkIntervalSeconds: checkInterval,
        autoSleepEnabled,
      });
      setMessage({ type: 'success', text: 'Settings saved. Auto-sleep timer restarted with new configuration.' });
      setDirty(false);
      loadSettings();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  async function handleTriggerSleep() {
    setTriggering(true);
    setMessage(null);
    try {
      const result = await triggerAutoSleep();
      const count = result.stopped?.length || 0;
      setMessage({ type: 'success', text: count > 0 ? `Stopped ${count} idle sandbox(es): ${result.stopped.join(', ')}` : 'No idle sandboxes found.' });
      loadSettings();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to trigger auto-sleep' });
    } finally {
      setTriggering(false);
    }
  }

  function markDirty() {
    setDirty(true);
    setMessage(null);
  }

  const presets = [
    { label: '5 min', value: 5 },
    { label: '10 min', value: 10 },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '60 min', value: 60 },
  ];

  return (
    <AppLayout>
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500 mt-1">Configure sandbox lifecycle and auto-sleep behavior</p>
      </div>

      {/* Status Cards */}
      {settings && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1a1a1a] rounded-xl border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Running Sandboxes</span>
              <Zap size={18} className="text-green-400" />
            </div>
            <p className="text-2xl font-bold text-green-400">{settings.runningSandboxes}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Sleeping Sandboxes</span>
              <Moon size={18} className="text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-blue-400">{settings.stoppedSandboxes}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Auto-Sleep Status</span>
              <Power size={18} className={autoSleepEnabled ? 'text-green-400' : 'text-gray-500'} />
            </div>
            <p className={`text-2xl font-bold ${autoSleepEnabled ? 'text-green-400' : 'text-gray-500'}`}>
              {autoSleepEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          <AlertCircle size={16} />
          {message.text}
        </div>
      )}

      {/* Auto-Sleep Configuration */}
      <div className="bg-[#1a1a1a] rounded-xl border border-white/[0.06] p-6 space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Moon size={20} className="text-blue-400" />
          Auto-Sleep Configuration
        </h2>
        <p className="text-sm text-gray-500">
          Automatically stop idle sandboxes (including Kata VMs, Standard Pods, and Azure VMs) to save compute costs.
          Sandboxes will wake automatically when the user sends a new message.
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
          <div>
            <p className="text-sm font-medium">Enable Auto-Sleep</p>
            <p className="text-xs text-gray-500 mt-0.5">Periodically check for idle sandboxes and stop them</p>
          </div>
          <button
            onClick={() => { setAutoSleepEnabled(!autoSleepEnabled); markDirty(); }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoSleepEnabled ? 'bg-purple-600' : 'bg-gray-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoSleepEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Idle Timeout */}
        <div className={`space-y-3 ${!autoSleepEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2">
            <Timer size={16} className="text-yellow-400" />
            <label className="text-sm font-medium">Idle Timeout</label>
          </div>
          <p className="text-xs text-gray-500">
            How long a sandbox can be idle (no chat activity) before it gets automatically stopped.
            Applies to all runtime types: Kata VM, Standard Pod, and Azure VM.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={120}
              value={idleTimeout}
              onChange={(e) => { setIdleTimeout(parseInt(e.target.value)); markDirty(); }}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={1440}
                value={idleTimeout}
                onChange={(e) => { setIdleTimeout(parseInt(e.target.value) || 10); markDirty(); }}
                className="w-16 bg-[#111] border border-white/10 rounded px-2 py-1.5 text-sm text-center"
              />
              <span className="text-xs text-gray-500">min</span>
            </div>
          </div>
          {/* Quick presets */}
          <div className="flex gap-2">
            {presets.map((p) => (
              <button
                key={p.value}
                onClick={() => { setIdleTimeout(p.value); markDirty(); }}
                className={`px-3 py-1 text-xs rounded-md border transition-colors ${idleTimeout === p.value ? 'border-purple-500 bg-purple-500/10 text-purple-400' : 'border-white/10 text-gray-400 hover:border-white/20'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Check Interval */}
        <div className={`space-y-3 ${!autoSleepEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-cyan-400" />
            <label className="text-sm font-medium">Check Interval</label>
          </div>
          <p className="text-xs text-gray-500">
            How often the system checks for idle sandboxes. Lower values mean faster detection but slightly more DB queries.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={10}
              max={300}
              step={10}
              value={checkInterval}
              onChange={(e) => { setCheckInterval(parseInt(e.target.value)); markDirty(); }}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={10}
                max={3600}
                value={checkInterval}
                onChange={(e) => { setCheckInterval(parseInt(e.target.value) || 60); markDirty(); }}
                className="w-16 bg-[#111] border border-white/10 rounded px-2 py-1.5 text-sm text-center"
              />
              <span className="text-xs text-gray-500">sec</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${dirty ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {dirty && <span className="text-xs text-yellow-400">Unsaved changes</span>}
        </div>
      </div>

      {/* Manual Actions */}
      <div className="bg-[#1a1a1a] rounded-xl border border-white/[0.06] p-6 space-y-4">
        <h2 className="text-lg font-semibold">Manual Actions</h2>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium">Trigger Auto-Sleep Now</p>
            <p className="text-xs text-gray-500 mt-0.5">Immediately check all running sandboxes and stop any that exceed the idle timeout</p>
          </div>
          <button
            onClick={handleTriggerSleep}
            disabled={triggering}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Moon size={16} />
            {triggering ? 'Checking...' : 'Sleep Idle Sandboxes'}
          </button>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-[#1a1a1a] rounded-xl border border-white/[0.06] p-6 space-y-4">
        <h2 className="text-lg font-semibold">How Auto-Sleep Works</h2>
        <div className="space-y-3 text-sm text-gray-400">
          <div className="flex gap-3">
            <span className="text-purple-400 font-mono text-xs mt-0.5">1.</span>
            <p>Every time a user sends a chat message, the sandbox&apos;s <code className="text-purple-300 bg-purple-500/10 px-1 rounded">last_activity_at</code> timestamp is updated.</p>
          </div>
          <div className="flex gap-3">
            <span className="text-purple-400 font-mono text-xs mt-0.5">2.</span>
            <p>The auto-sleep timer runs every <strong className="text-white">{checkInterval} seconds</strong>, checking for sandboxes that have been idle longer than <strong className="text-white">{idleTimeout} minutes</strong>.</p>
          </div>
          <div className="flex gap-3">
            <span className="text-purple-400 font-mono text-xs mt-0.5">3.</span>
            <p>Idle sandboxes are stopped: <strong className="text-cyan-300">Kata/Standard Pods</strong> are deleted (PVC data persists), <strong className="text-orange-300">Azure VMs</strong> are deallocated (no compute billing, disk retained).</p>
          </div>
          <div className="flex gap-3">
            <span className="text-purple-400 font-mono text-xs mt-0.5">4.</span>
            <p>When the user sends a new message, the sandbox wakes automatically — the customer portal shows a &quot;waking up&quot; indicator and retries until the sandbox is ready.</p>
          </div>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
