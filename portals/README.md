# OpenClaw Portals

Web portals for the OpenClaw platform: an Admin Console and a Customer Chat Interface, backed by a shared API.

## Architecture

```
                  ┌─────────────────────────────────┐
                  │        NGINX Ingress             │
                  │  /admin  /app  /api              │
                  └──┬────────┬────────┬─────────────┘
                     │        │        │
              ┌──────┴──┐ ┌───┴────┐ ┌─┴──────────┐
              │  Admin   │ │Customer│ │  Portal    │
              │  Portal  │ │ Portal │ │  API       │
              │ (Next.js)│ │(Next.js)│ │ (Fastify) │
              │ :3000    │ │ :3000  │ │ :3000     │
              └──────────┘ └────────┘ └────┬───────┘
                                           │
                                      ┌────┴────┐
                                      │ SQLite  │
                                      │  (PVC)  │
                                      └─────────┘
```

- **Admin Portal** (`/admin`) — Platform administration: dashboard, cluster monitoring, model management, user management
- **Customer Portal** (`/app`) — End-user chat interface with AI, plus integrations (Feishu, Telegram, Slack)
- **Portal API** (`/api`) — Fastify backend handling auth, chat, admin endpoints, and integrations

## Local Development

### Prerequisites

- Node.js 20+
- pnpm (`corepack enable && corepack prepare pnpm@9 --activate`)

### Run the API

```bash
cd portals/api
npm install
npm run dev
# Runs on http://localhost:3000
```

### Run the Admin Portal

```bash
cd portals/admin
pnpm install
pnpm dev
# Runs on http://localhost:3001 (accessible at http://localhost:3001/admin)
```

### Run the Customer Portal

```bash
cd portals/customer
pnpm install
pnpm dev
# Runs on http://localhost:3002 (accessible at http://localhost:3002/app)
```

## Environment Variables

### Portal API

| Variable | Description | Default |
|---|---|---|
| `JWT_SECRET` | Secret key for JWT signing | `openclaw-portal-secret-change-me` |
| `OPENCLAW_API_URL` | LiteLLM API endpoint | `http://litellm.litellm.svc.cluster.local:4000` |
| `DB_PATH` | SQLite database file path | `./data/db.sqlite` |
| `PORT` | Server port | `3000` |

### Admin Portal / Customer Portal

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Portal API URL | `http://localhost:3000` |

## Default Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@openclaw.ai` | `Admin@123` |

The default admin user is created automatically when the API starts for the first time.

## Kubernetes Deployment

The `k8s/` directory contains all manifests. During `install.sh`, images are built, pushed to ACR, and deployed automatically.

Manifests:
- `namespace.yaml` — `portals` namespace
- `pvc.yaml` — Persistent volume for SQLite database
- `api-deployment.yaml` — API deployment + service
- `admin-portal-deployment.yaml` — Admin portal deployment + service
- `customer-portal-deployment.yaml` — Customer portal deployment + service
- `ingress.yaml` — NGINX ingress routing `/admin`, `/app`, `/api`
