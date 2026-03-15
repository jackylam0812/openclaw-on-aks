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
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/admin/login';
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

export async function getStats() {
  const res = await authFetch('/admin/stats');
  return res.json();
}

export async function getNodes() {
  const res = await authFetch('/admin/nodes');
  return res.json();
}

export async function getPods() {
  const res = await authFetch('/admin/pods');
  return res.json();
}

export async function getUsers() {
  const res = await authFetch('/admin/users');
  return res.json();
}

export async function getSandboxes() {
  const res = await authFetch('/admin/sandboxes');
  return res.json();
}

export async function getClusterOverview() {
  const res = await authFetch('/admin/cluster/overview');
  return res.json();
}

export async function getApprovals(status: string = 'pending') {
  const res = await authFetch(`/admin/approvals?status=${status}`);
  return res.json();
}

export async function getApprovalCounts() {
  const res = await authFetch('/admin/approvals/counts');
  return res.json();
}

export async function approveUser(userId: string) {
  const res = await authFetch(`/admin/approvals/${userId}/approve`, { method: 'POST' });
  return res.json();
}

export async function rejectUser(userId: string) {
  const res = await authFetch(`/admin/approvals/${userId}/reject`, { method: 'POST' });
  return res.json();
}
