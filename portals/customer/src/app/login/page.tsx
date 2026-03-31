'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { login, register, sendVerificationCode, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendCode = async () => {
    if (!email) {
      setError('Please enter your email first');
      return;
    }
    setError('');
    setSendingCode(true);
    try {
      await sendVerificationCode(email);
      setCodeSent(true);
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to send code');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let data;
      if (tab === 'signin') {
        data = await login(email, password);
      } else {
        if (!code) {
          setError('Please enter the verification code');
          setLoading(false);
          return;
        }
        data = await register(name, email, password, code);
      }
      setToken(data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.user.approval_status === 'approved') {
        router.push('/chat');
      } else {
        router.push('/pending');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[#0a0a0a]" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-600/8 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px]" />

      <div className="relative w-full max-w-sm mx-4">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              OpenClaw
            </h1>
            <p className="text-sm text-gray-500 mt-1">Your AI Assistant</p>
          </div>

          <div className="flex mb-6 bg-white/[0.04] rounded-lg p-1">
            <button
              onClick={() => { setTab('signin'); setError(''); setCodeSent(false); setCode(''); }}
              className={`flex-1 py-2 text-sm rounded-md transition-colors ${
                tab === 'signin' ? 'bg-white/[0.08] text-gray-200' : 'text-gray-500'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 py-2 text-sm rounded-md transition-colors ${
                tab === 'register' ? 'bg-white/[0.08] text-gray-200' : 'text-gray-500'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                  placeholder="Your name"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            {tab === 'register' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Verification Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="flex-1 px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors tracking-widest font-mono"
                    placeholder="000000"
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sendingCode || cooldown > 0 || !email}
                    className="px-3 py-2.5 bg-purple-600/20 border border-purple-500/30 text-purple-400 text-xs font-medium rounded-lg hover:bg-purple-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {sendingCode ? 'Sending...' : cooldown > 0 ? `${cooldown}s` : codeSent ? 'Resend' : 'Send Code'}
                  </button>
                </div>
                {codeSent && (
                  <p className="text-xs text-green-400 mt-1.5">Code sent to {email}</p>
                )}
              </div>
            )}

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : tab === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
