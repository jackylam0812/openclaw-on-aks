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
  const res = await authFetch(`/admin/approvals/${userId}/approve`, { method: 'POST', body: '{}' });
  return res.json();
}

export async function rejectUser(userId: string) {
  const res = await authFetch(`/admin/approvals/${userId}/reject`, { method: 'POST', body: '{}' });
  return res.json();
}

export async function deleteUser(userId: string) {
  const res = await authFetch(`/admin/users/${userId}`, { method: 'DELETE' });
  return res.json();
}

export async function getModels() {
  const res = await authFetch('/admin/models');
  return res.json();
}

export async function addModel(model: { name: string; model_id: string; litellm_model: string; api_base?: string; api_key?: string; api_version?: string; reasoning?: boolean; input_types?: string; context_window?: number; max_tokens?: number }) {
  const res = await authFetch('/admin/models', { method: 'POST', body: JSON.stringify(model) });
  return res.json();
}

export async function deleteModel(id: string) {
  const res = await authFetch(`/admin/models/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function setDefaultModel(id: string) {
  const res = await authFetch(`/admin/models/${id}/default`, { method: 'PATCH', body: '{}' });
  return res.json();
}

export async function syncModels() {
  const res = await authFetch('/admin/models/sync', { method: 'POST', body: '{}' });
  return res.json();
}
