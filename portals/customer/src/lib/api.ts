const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export async function authFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/app/login';
    throw new Error('Unauthorized');
  }
  return res;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Login failed');
  }
  return res.json();
}

export async function sendVerificationCode(email: string) {
  const res = await fetch(`${API_URL}/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to send verification code');
  }
  return res.json();
}

export async function register(name: string, email: string, password: string, code: string) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, code }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Registration failed');
  }
  return res.json();
}

export async function sendMessage(message: string, conversationId?: string) {
  const res = await authFetch('/chat/message', {
    method: 'POST',
    body: JSON.stringify({ message, conversationId }),
  });
  return res.json();
}

export async function getChatHistory() {
  const res = await authFetch('/chat/history');
  return res.json();
}

export async function getConversationMessages(id: string) {
  const res = await authFetch(`/chat/history/${id}`);
  return res.json();
}

export async function getIntegrations() {
  const res = await authFetch('/integrations');
  return res.json();
}

export async function connectIntegration(type: string, config: Record<string, string>) {
  const res = await authFetch(`/integrations/${type}`, {
    method: 'POST',
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function disconnectIntegration(id: string) {
  const res = await authFetch(`/integrations/${id}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function getSandboxStatus() {
  const res = await authFetch('/sandbox/status');
  return res.json();
}

export async function getMe() {
  const res = await authFetch('/auth/me');
  return res.json();
}
