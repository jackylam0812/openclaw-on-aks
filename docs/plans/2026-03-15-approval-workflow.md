# Approval Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add admin approval workflow so users must be approved before their sandbox pod is created.

**Architecture:** Add `approval_status` field to users table. Registration no longer auto-provisions sandbox. Admin approves users via new API endpoints and Approvals page. Customer portal checks approval status and shows pending page or chat page accordingly.

**Tech Stack:** Fastify (API), better-sqlite3 (DB), Next.js (Admin + Customer portals), TypeScript

---

### Task 1: Database Schema — Add approval_status column

**Files:**
- Modify: `portals/api/src/db/schema.sql`

**Step 1: Add approval_status to users table**

In `portals/api/src/db/schema.sql`, add the `approval_status` column to the `users` table:

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  approval_status TEXT NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Step 2: Commit**

```bash
git add portals/api/src/db/schema.sql
git commit -m "feat: add approval_status column to users schema"
```

---

### Task 2: Database Client — Migration + Admin seed as approved

**Files:**
- Modify: `portals/api/src/db/client.ts`

**Step 1: Add migration for existing DBs and update admin seed**

After `db.exec(schema);` (line 23), add migration logic. Also update admin seed to set `approval_status='approved'`:

```typescript
// Migration: add approval_status column if missing (existing DBs)
try {
  db.exec("ALTER TABLE users ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'");
  console.log('Migration: added approval_status column to users table');
} catch {
  // Column already exists — ignore
}
```

Note: The migration defaults existing users to `'approved'` (so current users aren't blocked). New users created via schema.sql default to `'pending'`.

**Step 2: Update admin seed to include approval_status**

Change the admin INSERT (line 30-31) from:

```typescript
db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(
    adminId, 'admin@openclaw.ai', hash, 'Admin', 'admin'
  );
```

to:

```typescript
db.prepare('INSERT INTO users (id, email, password_hash, name, role, approval_status) VALUES (?, ?, ?, ?, ?, ?)').run(
    adminId, 'admin@openclaw.ai', hash, 'Admin', 'admin', 'approved'
  );
```

**Step 3: Commit**

```bash
git add portals/api/src/db/client.ts
git commit -m "feat: add approval_status migration and seed admin as approved"
```

---

### Task 3: Auth Routes — Remove auto-provision, add /auth/me

**Files:**
- Modify: `portals/api/src/routes/auth.ts`

**Step 1: Modify register to NOT provision sandbox**

In `POST /auth/register` handler, remove lines 37-44 (sandbox creation + provisionSandbox call). The register handler should just create the user and return. Also include `approval_status` in the response.

Replace the register handler body (lines 22-48) with:

```typescript
  app.post('/auth/register', async (request, reply) => {
    const { email, password, name } = request.body as { email: string; password: string; name: string };
    if (!email || !password || !name) {
      return reply.status(400).send({ error: 'Email, password, and name required' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }
    const id = uuid();
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (id, email, password_hash, name, role, approval_status) VALUES (?, ?, ?, ?, ?, ?)').run(
      id, email, hash, name, 'user', 'pending'
    );

    const token = signToken({ userId: id, email, role: 'user' });
    return { token, user: { id, email, name, role: 'user', approval_status: 'pending' } };
  });
```

**Step 2: Update login to include approval_status in response**

In `POST /auth/login` handler (line 19), change the return to include approval_status:

```typescript
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, approval_status: user.approval_status } };
```

**Step 3: Add GET /auth/me endpoint**

Add this after the refresh endpoint, before the closing `}`. Need to import `requireAuth`:

```typescript
  app.get('/auth/me', { preHandler: [requireAuth] }, async (request) => {
    const { userId } = (request as any).user;
    const user = db.prepare('SELECT id, email, name, role, approval_status, created_at FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return { error: 'User not found' };
    }
    return user;
  });
```

Also add `requireAuth` to the import at line 5:

```typescript
import { signToken, requireAuth } from '../middleware/auth.js';
```

And remove the unused `provisionSandbox` import from line 6.

**Step 4: Commit**

```bash
git add portals/api/src/routes/auth.ts
git commit -m "feat: remove auto-provision from register, add /auth/me endpoint"
```

---

### Task 4: Admin Routes — Add approval endpoints

**Files:**
- Modify: `portals/api/src/routes/admin.ts`

**Step 1: Add provisionSandbox import**

Add at top of file after existing imports:

```typescript
import { provisionSandbox } from '../services/sandbox.js';
import { v4 as uuid } from 'uuid';
```

**Step 2: Update /admin/users to include approval_status**

The existing query on line 34-36 already joins users but doesn't select `approval_status`. Update:

```typescript
  app.get('/admin/users', async () => {
    const users = db.prepare(
      'SELECT u.id, u.email, u.name, u.role, u.approval_status, u.created_at, s.status as sandbox_status FROM users u LEFT JOIN sandboxes s ON u.id = s.user_id ORDER BY u.created_at DESC'
    ).all();
    return users;
  });
```

**Step 3: Add approval endpoints before the closing `}`**

```typescript
  // --- Approval endpoints ---

  app.get('/admin/approvals', async (request) => {
    const { status } = request.query as { status?: string };
    const validStatuses = ['pending', 'approved', 'rejected'];
    const filterStatus = validStatuses.includes(status || '') ? status : 'pending';
    const users = db.prepare(
      'SELECT id, email, name, role, approval_status, created_at FROM users WHERE approval_status = ? AND role != ? ORDER BY created_at DESC'
    ).all(filterStatus, 'admin');
    return users;
  });

  app.get('/admin/approvals/counts', async () => {
    const counts = db.prepare(
      "SELECT approval_status, COUNT(*) as count FROM users WHERE role != 'admin' GROUP BY approval_status"
    ).all() as { approval_status: string; count: number }[];
    const result: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
    for (const row of counts) {
      result[row.approval_status] = row.count;
    }
    return result;
  });

  app.post('/admin/approvals/:userId/approve', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = db.prepare('SELECT id, email, approval_status FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }
    if (user.approval_status === 'approved') {
      return reply.status(400).send({ error: 'User already approved' });
    }

    db.prepare('UPDATE users SET approval_status = ? WHERE id = ?').run('approved', userId);

    // Provision sandbox
    const sandboxId = uuid();
    db.prepare('INSERT INTO sandboxes (id, user_id, status) VALUES (?, ?, ?)').run(
      sandboxId, userId, 'provisioning'
    );
    provisionSandbox(userId, user.email).catch((err) => {
      console.error('Background sandbox provisioning error:', err);
    });

    return { success: true, approval_status: 'approved' };
  });

  app.post('/admin/approvals/:userId/reject', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = db.prepare('SELECT id, approval_status FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }
    if (user.approval_status === 'rejected') {
      return reply.status(400).send({ error: 'User already rejected' });
    }

    db.prepare('UPDATE users SET approval_status = ? WHERE id = ?').run('rejected', userId);
    return { success: true, approval_status: 'rejected' };
  });
```

**Step 4: Update /admin/cluster/overview to include pendingApprovals count**

Add after `activeSandboxes` const (line 58):

```typescript
    const pendingApprovals = (db.prepare("SELECT COUNT(*) as count FROM users WHERE approval_status = 'pending'").get() as any).count;
```

And include it in the return object:

```typescript
    return {
      totalUsers,
      activeSandboxes,
      pendingApprovals,
      nodeCount: nodes.length,
      totalPods: runningPods.length,
      nodes,
    };
```

**Step 5: Commit**

```bash
git add portals/api/src/routes/admin.ts
git commit -m "feat: add admin approval endpoints and counts"
```

---

### Task 5: Startup auto-provision — Only provision approved users

**Files:**
- Modify: `portals/api/src/index.ts`

**Step 1: Update the startup auto-provision query**

Change the query on lines 33-35 to only provision sandboxes for approved users:

```typescript
  const pending = db.prepare(
    "SELECT s.user_id, u.email FROM sandboxes s JOIN users u ON s.user_id = u.id WHERE s.status = 'provisioning' AND u.approval_status = 'approved'"
  ).all() as { user_id: string; email: string }[];
```

**Step 2: Commit**

```bash
git add portals/api/src/index.ts
git commit -m "fix: only auto-provision sandboxes for approved users on startup"
```

---

### Task 6: Admin Portal — API client functions

**Files:**
- Modify: `portals/admin/src/lib/api.ts`

**Step 1: Add approval API functions**

Append to end of file:

```typescript
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
```

**Step 2: Commit**

```bash
git add portals/admin/src/lib/api.ts
git commit -m "feat: add approval API client functions to admin portal"
```

---

### Task 7: Admin Portal — Approvals page

**Files:**
- Create: `portals/admin/src/app/approvals/page.tsx`

**Step 1: Create the approvals page**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import { getApprovals, approveUser, rejectUser } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  approval_status: string;
  created_at: string;
}

const tabs = [
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'rejected', label: 'Rejected', icon: XCircle },
  { key: 'approved', label: 'Approved', icon: CheckCircle },
] as const;

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadUsers = async (status: string) => {
    setLoading(true);
    try {
      const data = await getApprovals(status);
      setUsers(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadUsers(activeTab);
  }, [activeTab]);

  const handleApprove = async (userId: string) => {
    setActionLoading(userId);
    try {
      await approveUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {}
    setActionLoading(null);
  };

  const handleReject = async (userId: string) => {
    setActionLoading(userId);
    try {
      await rejectUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {}
    setActionLoading(null);
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Approvals</h1>
        <p className="text-sm text-gray-500 mt-1">Review and approve user registrations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/[0.04] rounded-lg p-1 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-white/[0.08] text-gray-200'
                  : 'text-gray-500 hover:text-gray-400'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Name</th>
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Email</th>
              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Registered</th>
              {activeTab !== 'approved' && (
                <th className="text-right text-xs text-gray-500 font-medium px-5 py-3">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center text-sm text-gray-500 py-8">Loading...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-sm text-gray-500 py-8">
                  No {activeTab} users
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3 text-sm text-gray-200">{user.name}</td>
                  <td className="px-5 py-3 text-sm text-gray-400">{user.email}</td>
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  {activeTab !== 'approved' && (
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApprove(user.id)}
                          disabled={actionLoading === user.id}
                          className="px-3 py-1.5 text-xs font-medium text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/10 transition-colors disabled:opacity-50"
                        >
                          Approve
                        </button>
                        {activeTab === 'pending' && (
                          <button
                            onClick={() => handleReject(user.id)}
                            disabled={actionLoading === user.id}
                            className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
```

**Step 2: Commit**

```bash
git add portals/admin/src/app/approvals/page.tsx
git commit -m "feat: add admin approvals page with tabs and action buttons"
```

---

### Task 8: Admin Portal — Sidebar + Dashboard updates

**Files:**
- Modify: `portals/admin/src/components/layout/sidebar.tsx`
- Modify: `portals/admin/src/app/dashboard/page.tsx`

**Step 1: Add Approvals to sidebar nav**

In `portals/admin/src/components/layout/sidebar.tsx`, add `ClipboardCheck` to the lucide-react import (line 5):

```typescript
import { LayoutDashboard, Server, Cpu, Users, BarChart2, LogOut, ClipboardCheck } from 'lucide-react';
```

Add approvals entry to `navItems` array (line 8-14), between Dashboard and Cluster:

```typescript
const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/approvals', label: 'Approvals', icon: ClipboardCheck },
  { href: '/cluster', label: 'Cluster', icon: Server },
  { href: '/models', label: 'Models', icon: Cpu },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/monitoring', label: 'Monitoring', icon: BarChart2 },
];
```

**Step 2: Add pending approvals card to dashboard**

In `portals/admin/src/app/dashboard/page.tsx`, add `ClipboardCheck` to lucide-react import (line 4):

```typescript
import { Users, Server, Box, Cpu, ClipboardCheck } from 'lucide-react';
```

Update the `ClusterOverview` interface to include `pendingApprovals`:

```typescript
interface ClusterOverview {
  totalUsers: number;
  activeSandboxes: number;
  pendingApprovals: number;
  nodeCount: number;
  totalPods: number;
  openclawPods: number;
  nodes: any[];
}
```

Add to `statCards` array, as the last item:

```typescript
const statCards = [
  { key: 'totalUsers', label: 'Total Users', icon: Users, gradient: 'from-blue-500 to-cyan-500' },
  { key: 'activeSandboxes', label: 'Active Sandboxes', icon: Box, gradient: 'from-green-500 to-emerald-500' },
  { key: 'nodeCount', label: 'Cluster Nodes', icon: Server, gradient: 'from-purple-500 to-violet-500' },
  { key: 'totalPods', label: 'Sandbox Pods', icon: Cpu, gradient: 'from-orange-500 to-amber-500' },
  { key: 'pendingApprovals', label: 'Pending Approvals', icon: ClipboardCheck, gradient: 'from-yellow-500 to-amber-500', href: '/approvals' },
] as const;
```

Make the card clickable when it has an `href`. Update the card rendering (inside the grid map around line 43-58). Wrap in a link when href exists:

Replace the card div with:

```tsx
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = overview ? (overview as any)[card.key] : '—';
          const CardWrapper = ('href' in card && card.href) ? 'a' : 'div';
          const extraProps = ('href' in card && card.href) ? { href: card.href } : {};
          return (
            <CardWrapper
              key={card.key}
              {...extraProps}
              className={`bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm ${('href' in card && card.href) ? 'hover:bg-white/[0.05] transition-colors cursor-pointer' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">{card.label}</span>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center`}>
                  <Icon size={16} className="text-white" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-gray-100">
                {overview ? String(value) : '—'}
              </p>
            </CardWrapper>
          );
        })}
```

**Step 3: Commit**

```bash
git add portals/admin/src/components/layout/sidebar.tsx portals/admin/src/app/dashboard/page.tsx
git commit -m "feat: add Approvals to admin sidebar and pending count to dashboard"
```

---

### Task 9: Customer Portal — API client + getMe function

**Files:**
- Modify: `portals/customer/src/lib/api.ts`

**Step 1: Add getMe function**

Append to end of file:

```typescript
export async function getMe() {
  const res = await authFetch('/auth/me');
  return res.json();
}
```

**Step 2: Commit**

```bash
git add portals/customer/src/lib/api.ts
git commit -m "feat: add getMe API function to customer portal"
```

---

### Task 10: Customer Portal — Pending page

**Files:**
- Create: `portals/customer/src/app/pending/page.tsx`

**Step 1: Create the pending/rejected status page**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, XCircle, LogOut } from 'lucide-react';
import { getToken, getMe, clearToken } from '@/lib/api';

export default function PendingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('pending');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [router]);

  const checkStatus = async () => {
    try {
      const user = await getMe();
      if (user.approval_status === 'approved') {
        router.push('/chat');
        return;
      }
      setStatus(user.approval_status);
    } catch {}
  };

  const handleLogout = () => {
    clearToken();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[#0a0a0a]" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-600/8 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px]" />

      <div className="relative w-full max-w-sm mx-4">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 text-center">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              OpenClaw
            </h1>
          </div>

          {status === 'pending' ? (
            <>
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
                <Clock size={32} className="text-yellow-400" />
              </div>
              <h2 className="text-lg font-medium text-gray-200 mb-2">Pending Approval</h2>
              <p className="text-sm text-gray-500 mb-6">
                Your account is pending admin approval. You'll be redirected automatically once approved.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-600 mb-6">
                <div className="w-2 h-2 border border-yellow-400 border-t-transparent rounded-full animate-spin" />
                Checking status...
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <XCircle size={32} className="text-red-400" />
              </div>
              <h2 className="text-lg font-medium text-gray-200 mb-2">Not Approved</h2>
              <p className="text-sm text-gray-500 mb-6">
                Your registration was not approved. Please contact the administrator.
              </p>
            </>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 mx-auto text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add portals/customer/src/app/pending/page.tsx
git commit -m "feat: add pending approval page to customer portal"
```

---

### Task 11: Customer Portal — Login redirect + route guards

**Files:**
- Modify: `portals/customer/src/app/login/page.tsx`
- Modify: `portals/customer/src/app/chat/page.tsx`
- Modify: `portals/customer/src/app/integrations/page.tsx`

**Step 1: Update login page redirect logic**

In `portals/customer/src/app/login/page.tsx`, update the `handleSubmit` function (lines 16-34).

Change the section after `setToken(data.token)` (lines 27-29) from:

```typescript
      setToken(data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/chat');
```

to:

```typescript
      setToken(data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.user.approval_status === 'approved') {
        router.push('/chat');
      } else {
        router.push('/pending');
      }
```

**Step 2: Add route guard to chat page**

In `portals/customer/src/app/chat/page.tsx`, add `getMe` to the import from `@/lib/api` (line 6):

```typescript
import { getToken, getChatHistory, getConversationMessages, sendMessage, getSandboxStatus, getIntegrations, getMe } from '@/lib/api';
```

In the `useEffect` on lines 36-44, add approval check after the token check:

```typescript
  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    // Check approval status
    getMe().then((user) => {
      if (user.approval_status !== 'approved') {
        router.push('/pending');
        return;
      }
      loadConversations();
      loadSandboxStatus();
      loadChannels();
    }).catch(() => {
      router.push('/login');
    });
  }, [router]);
```

**Step 3: Add route guard to integrations page**

In `portals/customer/src/app/integrations/page.tsx`, add `getMe` to the import from `@/lib/api` (line 6):

```typescript
import { getToken, getIntegrations, getChatHistory, connectIntegration, disconnectIntegration, getMe } from '@/lib/api';
```

Update the `useEffect` on lines 60-67:

```typescript
  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    getMe().then((user) => {
      if (user.approval_status !== 'approved') {
        router.push('/pending');
        return;
      }
      loadIntegrations();
      loadConversations();
    }).catch(() => {
      router.push('/login');
    });
  }, [router]);
```

**Step 4: Commit**

```bash
git add portals/customer/src/app/login/page.tsx portals/customer/src/app/chat/page.tsx portals/customer/src/app/integrations/page.tsx
git commit -m "feat: add approval route guards to customer portal pages"
```

---

### Task 12: Final verification

**Step 1: Check TypeScript compilation for API**

Run: `cd portals/api && npx tsc --noEmit`
Expected: No errors

**Step 2: Check TypeScript compilation for Admin portal**

Run: `cd portals/admin && npx tsc --noEmit`
Expected: No errors

**Step 3: Check TypeScript compilation for Customer portal**

Run: `cd portals/customer && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit all remaining changes (if any)**

```bash
git add -A
git commit -m "feat: complete approval workflow implementation"
```
