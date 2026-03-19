# Approval Workflow Design

## Overview

Add an admin approval step between user registration and sandbox provisioning. Users must be approved by an admin before their OpenClaw sandbox pod is created.

## Status Flow

```
Register → pending_approval → approved → provisionSandbox()
                            → rejected → (admin can re-approve later)
```

## Database Changes

Add `approval_status` column to `users` table:

```sql
approval_status TEXT NOT NULL DEFAULT 'pending'  -- pending / approved / rejected
```

Existing users (including seeded admin) should default to `approved`.

## API Changes

### Modified Endpoints

- **POST /auth/register** — No longer calls `provisionSandbox()`. Sets `approval_status='pending'`.

### New Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/me` | GET | user | Returns current user info including `approval_status` |
| `/admin/approvals` | GET | admin | List users by approval status (`?status=pending\|approved\|rejected`) |
| `/admin/approvals/:userId/approve` | POST | admin | Set `approved`, trigger `provisionSandbox()` |
| `/admin/approvals/:userId/reject` | POST | admin | Set `rejected` |

### Key Logic

- Registration: create user with `approval_status='pending'`, no sandbox
- Approve: update to `approved`, async `provisionSandbox()`
- Reject→Re-approve: admin can approve a previously rejected user
- Admin user (seeded): auto-set to `approved`

## Admin Portal Changes

### New: Approvals Page (`/approvals`)

- Sidebar menu item between Dashboard and Users
- Three tabs: Pending (default) / Rejected / Approved
- Table columns: Name, Email, Registered Date, Actions
- Pending tab: "Approve" + "Reject" buttons per row
- Rejected tab: "Approve" button per row (allow reversal)
- Approved tab: read-only, no action buttons

### Modified: Dashboard

- New stat card: "Pending Approvals" count, clickable to navigate to `/approvals`

## Customer Portal Changes

### New: Pending Page (`/pending`)

- Centered card layout
- `pending`: hourglass + "Your account is pending admin approval"
- `rejected`: notice + "Your registration was not approved. Please contact the administrator."
- Logout button at bottom
- Polls `/auth/me` every 30 seconds; auto-redirects to `/chat` when `approved`

### Route Guards

- `/chat`, `/integrations`: redirect to `/pending` if not `approved`
- `/pending`: redirect to `/chat` if already `approved`
- Login/register: after auth, check `approval_status` to decide redirect target (`/chat` vs `/pending`)

## Files to Modify

### Portal API
1. `portals/api/src/db/schema.sql` — Add `approval_status` column
2. `portals/api/src/db/client.ts` — Migration for existing users, admin seed as `approved`
3. `portals/api/src/routes/auth.ts` — Remove auto-provision from register, add `/auth/me`
4. `portals/api/src/routes/admin.ts` — Add approval endpoints
5. `portals/api/src/routes/sandbox.ts` — Guard sandbox status behind approval check

### Admin Portal
6. `portals/admin/src/app/approvals/page.tsx` — New approvals page
7. `portals/admin/src/components/layout/sidebar.tsx` — Add Approvals menu item
8. `portals/admin/src/app/dashboard/page.tsx` — Add pending approvals stat card

### Customer Portal
9. `portals/customer/src/app/pending/page.tsx` — New pending/rejected status page
10. `portals/customer/src/app/login/page.tsx` — Redirect based on approval_status
11. `portals/customer/src/app/chat/page.tsx` — Route guard for unapproved users
12. `portals/customer/src/app/integrations/page.tsx` — Route guard for unapproved users
