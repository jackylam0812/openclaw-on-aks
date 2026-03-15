# OpenClaw on AKS — Architecture & Technical Deep Dive

> **Repository**: github.com/jackylam0812/openclaw-on-aks
> **Last Updated**: 2026-03-15

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Azure Infrastructure (Layer 1)](#3-azure-infrastructure-layer-1)
   - 3.1 [Resource Groups](#31-resource-groups)
   - 3.2 [Virtual Network & Subnets](#32-virtual-network--subnets)
   - 3.3 [AKS Cluster](#33-aks-cluster)
   - 3.4 [Why Intel VMs for Kata Isolation](#34-why-intel-vms-for-kata-isolation)
   - 3.5 [Azure AI Foundry & GPT-5.4](#35-azure-ai-foundry--gpt-54)
   - 3.6 [Azure Container Registry](#36-azure-container-registry)
4. [Kubernetes Workloads (Layer 2)](#4-kubernetes-workloads-layer-2)
   - 4.1 [Namespaces](#41-namespaces)
   - 4.2 [Storage Classes](#42-storage-classes)
   - 4.3 [LiteLLM Proxy](#43-litellm-proxy)
   - 4.4 [Agent Sandbox Controller](#44-agent-sandbox-controller)
5. [Portal System](#5-portal-system)
   - 5.1 [Portal API (Fastify + SQLite)](#51-portal-api-fastify--sqlite)
   - 5.2 [Admin Portal (Next.js)](#52-admin-portal-nextjs)
   - 5.3 [Customer Portal (Next.js)](#53-customer-portal-nextjs)
6. [OpenClaw Sandbox Architecture](#6-openclaw-sandbox-architecture)
   - 6.1 [Sandbox CRD & Manifest](#61-sandbox-crd--manifest)
   - 6.2 [Provisioning Flow](#62-provisioning-flow)
   - 6.3 [Chat Routing](#63-chat-routing)
   - 6.4 [Resource Profile & Capacity Planning](#64-resource-profile--capacity-planning)
7. [IM Integrations](#7-im-integrations)
   - 7.1 [Telegram](#71-telegram)
   - 7.2 [Feishu (飞书)](#72-feishu-飞书)
   - 7.3 [Slack](#73-slack)
8. [Security](#8-security)
9. [Data Persistence](#9-data-persistence)
10. [Networking & Ingress](#10-networking--ingress)
11. [Deployment Automation (install.sh)](#11-deployment-automation-installsh)
12. [Appendix: Quick Reference](#12-appendix-quick-reference)

---

## 1. Project Overview

**OpenClaw on AKS** is a multi-tenant AI agent platform that deploys [OpenClaw](https://github.com/openclaw/openclaw) on Azure Kubernetes Service (AKS) with hardware-level sandbox isolation. Each user gets a dedicated, Kata VM-isolated sandbox pod running an OpenClaw gateway, backed by Azure OpenAI GPT-5.4 through a LiteLLM proxy.

### Key Features

- **Per-user AI sandbox**: Each user receives a dedicated OpenClaw instance running in a Kata VM-isolated pod, providing hardware-level tenant isolation.
- **Multi-channel IM integration**: Users can connect Telegram, Feishu, and Slack bots to their sandbox, enabling AI-powered conversations across messaging platforms.
- **Azure AI Foundry integration**: GPT-5.4 model deployed via Azure AI Foundry, accessed through a centralized LiteLLM proxy with API key management.
- **Self-service portal**: Customer portal for chat and integration management; Admin portal for cluster monitoring, user management, and sandbox oversight.
- **One-command deployment**: A single `install.sh` script provisions the entire stack from Azure infrastructure to running applications.

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Cloud Provider | Microsoft Azure |
| Container Orchestration | AKS (Kubernetes 1.32) |
| Sandbox Isolation | Kata Containers (Microsoft Hypervisor / Mshv) |
| AI Model | Azure OpenAI GPT-5.4 |
| AI Gateway | LiteLLM Proxy |
| AI Agent Runtime | OpenClaw |
| Portal API | Node.js + Fastify + SQLite |
| Portal Frontend | Next.js 14 (Admin & Customer) |
| Infrastructure as Code | Terraform (azurerm ~4.19) |
| Container Registry | Azure Container Registry (Basic) |
| Ingress | NGINX Ingress Controller |
| Network Policy | Calico |

---

## 2. Architecture Overview

```
                         Internet
                            │
                     ┌──────┴──────┐
                     │ Azure LB    │  (externalTrafficPolicy: Local)
                     │ Public IP   │
                     └──────┬──────┘
                            │
                    ┌───────┴────────┐
                    │ NGINX Ingress  │  (ingress-nginx namespace)
                    │ Controller     │
                    └───────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
        /admin/*      /app/*        /api/*
              │             │             │
     ┌────────┴──┐  ┌──────┴───┐  ┌──────┴──────┐
     │ Admin     │  │ Customer │  │ Portal API  │
     │ Portal    │  │ Portal   │  │ (Fastify)   │
     │ (Next.js) │  │ (Next.js)│  │ + SQLite DB │
     └───────────┘  └──────────┘  └──────┬──────┘
                                         │
                          ┌──────────────┼──────────────┐
                          │              │              │
                    kubectl apply    HTTP /v1/chat   Integration
                    (Sandbox CRD)    /completions    Management
                          │              │              │
                          ▼              ▼              │
              ┌───────────────────────────────────┐    │
              │       openclaw namespace          │    │
              │  ┌─────────┐ ┌─────────┐ ┌─────┐ │    │
              │  │ oc-fed9 │ │ oc-a851 │ │ ... │ │    │
              │  │ (Kata)  │ │ (Kata)  │ │     │ │    │
              │  │ :18789  │ │ :18789  │ │     │ │    │
              │  └────┬────┘ └────┬────┘ └─────┘ │    │
              └───────┼──────────┼───────────────┘    │
                      │          │                     │
                      ▼          ▼                     │
              ┌──────────────────────┐                │
              │   LiteLLM Proxy      │ ◄──────────────┘
              │   (litellm namespace) │   /key/generate
              │   :4000               │
              └──────────┬───────────┘
                         │ azure/gpt-5.4
                         ▼
              ┌──────────────────────┐
              │ Azure AI Foundry     │
              │ (eastus2)            │
              │ GPT-5.4 Deployment   │
              │ GlobalStandard 50PTU │
              └──────────────────────┘
```

### Deployment Topology

```
AKS Cluster
├── System Node Pool (Standard_D4as_v7, 1-3 nodes)
│   ├── ingress-nginx/      — NGINX Ingress Controller
│   ├── portals/             — Portal API, Admin Portal, Customer Portal
│   ├── litellm/             — LiteLLM Proxy + PostgreSQL
│   └── agent-sandbox-system/— Sandbox CRD Controller
│
└── Kata Node Pool (Standard_D4s_v5, 1-10 nodes)
    └── openclaw/            — Per-user Kata-isolated sandbox pods
        ├── oc-fed9c3d3 (admin@openclaw.ai)
        ├── oc-a8515d82 (jackylam0083@gmail.com)
        └── oc-d99e0fad (24009026@qq.com)
```

---

## 3. Azure Infrastructure (Layer 1)

Layer 1 is managed by Terraform in `terraform/layer1-azure/` and provisions all Azure-native resources.

### 3.1 Resource Groups

| Resource Group | Location | Purpose |
|---|---|---|
| `<cluster-name>-rg` | AKS region (e.g. `southeastasia`) | AKS cluster, VNet, ACR |
| `<cluster-name>-foundry-rg` | Foundry region (e.g. `eastus2`) | AI Foundry Hub, AI Services, GPT-5.4 |

The two resource groups are in different regions because GPT-5.4 is only available in select regions (eastus2, swedencentral, polandcentral, southcentralus), while the AKS cluster can be in any Azure region for latency optimization.

### 3.2 Virtual Network & Subnets

**VNet CIDR**: `10.1.0.0/16` (65,536 IPs)

| Subnet | CIDR | Purpose | NAT Gateway |
|--------|------|---------|-------------|
| System | `10.1.0.0/24` (256 IPs) | System node pool | No (uses AKS LB for outbound) |
| Kata | `10.1.1.0/24` (256 IPs) | Kata node pool | Yes (static public IP) |
| Pods | `10.1.16.0/20` (4,096 IPs) | Azure CNI Overlay pod IPs | N/A |

**Design Decisions**:

- **System subnet has no NAT Gateway**: The system subnet hosts the AKS LoadBalancer for ingress. Attaching a NAT Gateway to the same subnet would cause asymmetric routing (inbound via LB, outbound via NAT), breaking TCP connections.
- **Kata subnet uses NAT Gateway**: Kata sandbox pods need outbound internet access (e.g., pulling packages, connecting to Telegram API) but don't receive inbound traffic directly. A NAT Gateway provides predictable outbound IP and avoids LB SNAT port exhaustion.

**Network Security Group (NSG)**:
- Applied to both system and kata subnets
- Rule: Allow inbound TCP 80, 443 from any source

### 3.3 AKS Cluster

**Cluster Configuration**:

| Parameter | Value |
|-----------|-------|
| Kubernetes Version | 1.32 |
| Identity | SystemAssigned |
| Network Plugin | Azure CNI Overlay |
| Network Policy | Calico |
| Load Balancer SKU | Standard |
| Service CIDR | 172.16.0.0/16 |
| DNS Service IP | 172.16.0.10 |
| Pod CIDR | 10.244.0.0/16 |
| CSI Drivers | Azure Disk |

**Node Pools**:

| | System Pool | Kata Pool |
|---|---|---|
| VM Size | `Standard_D4as_v7` | `Standard_D4s_v5` |
| CPU Architecture | AMD (EPYC) | Intel (Xeon) |
| vCPUs | 4 | 4 |
| RAM | 16 GB | 16 GB |
| OS | AzureLinux | AzureLinux |
| OS Disk | 100 GB | 200 GB |
| Autoscaling | 1–3 nodes | 1–10 nodes |
| Workload Runtime | Default (runc) | `KataMshvVmIsolation` |
| Taints | None | `kata=true:NoSchedule` |
| Labels | `WorkerType=ON_DEMAND`, `NodeGroupType=core` | `workload-type=kata`, `katacontainers.io/kata-runtime=true` |

### 3.4 Why Intel VMs for Kata Isolation

Kata Containers on AKS uses **Microsoft Hypervisor (Mshv)** to run each pod inside a lightweight VM, providing hardware-level isolation between tenants. This requires **nested virtualization** — the ability to run a hypervisor inside a VM.

**The constraint**: On Azure, only Intel-based VM series support nested virtualization. AMD-based VMs do **not** expose nested virtualization capabilities, even though AMD hardware (AMD-V/SVM) supports it natively.

| VM Series | CPU | Nested Virtualization | Kata Compatible |
|-----------|-----|----------------------|-----------------|
| Dsv3 | Intel Xeon E5-2673 v4 | Yes | Yes |
| Dsv4 | Intel Xeon Platinum 8272CL | Yes | Yes |
| **Dsv5** | **Intel Xeon Platinum 8370C** | **Yes** | **Yes (used)** |
| Dsv6 | Intel Xeon (next-gen) | Yes | Yes |
| Dasv4 | AMD EPYC 7452 | No | No |
| Dasv5 | AMD EPYC 7763V | No | No |
| **Dasv7** | **AMD EPYC 9V74** | **No** | **No** |

We chose `Standard_D4s_v5` (Dsv5 series) because:
1. It supports nested virtualization (required for Kata Mshv)
2. It's a current-generation Intel VM with good price-performance
3. 4 vCPUs and 16 GB RAM provide adequate resources for 2-3 sandboxes per node

The system node pool uses `Standard_D4as_v7` (AMD) because system workloads (portals, LiteLLM) don't need nested virtualization, and AMD VMs offer better cost efficiency.

> **Important**: The `workloadRuntime=KataMshvVmIsolation` setting must be specified at nodepool **creation time** — it cannot be changed after creation. The Kata nodepool **cannot scale to 0** nodes; the minimum count must be >= 1.

### 3.5 Azure AI Foundry & GPT-5.4

The AI stack is deployed in a separate resource group in a GPT-5.4-supported region:

```
AI Foundry Resource Group
├── Storage Account         (Standard LRS, required by Hub)
├── Key Vault               (Standard, purge-protected, required by Hub)
├── AI Services Account     (S0 SKU, provides OpenAI API access)
│   └── GPT-5.4 Deployment  (GlobalStandard, 50 PTU, version 2026-03-05)
├── AI Foundry Hub          (SystemAssigned identity)
└── AI Foundry Project      (linked to Hub)
```

**GPT-5.4 Model Details**:

| Parameter | Value |
|-----------|-------|
| Model | gpt-5.4 |
| Version | 2026-03-05 |
| SKU | GlobalStandard |
| Capacity | 50 PTU |
| API Version | 2025-04-01-preview |
| Auth Method | API Key (regional endpoint requires key-based auth) |

> **Note on authentication**: The Azure AI Services regional endpoint (`eastus2.api.cognitive.microsoft.com`) requires API key authentication. Azure AD token-based auth with this endpoint returns "Resource Id is badly formed". The `*.openai.azure.com` and `*.services.ai.azure.com` subdomain patterns do not resolve for the AIServices kind resource.

> **Note on GPT-5.4 API**: GPT-5.4 uses `max_completion_tokens` instead of the legacy `max_tokens` parameter. Sending `max_tokens` returns a 400 error.

### 3.6 Azure Container Registry

| Parameter | Value |
|-----------|-------|
| SKU | Basic |
| Admin | Disabled |
| Auth | AKS kubelet identity → AcrPull role assignment |

Three images are built via ACR Tasks (cloud-based `linux/amd64` builds):
- `openclaw-portal-api:latest`
- `openclaw-admin-portal:latest`
- `openclaw-customer-portal:latest`

---

## 4. Kubernetes Workloads (Layer 2)

Layer 2 is managed by Terraform in `terraform/layer2-k8s/` and reads outputs from Layer 1 via `terraform_remote_state`. It uses the Kubernetes, Helm, and kubectl providers authenticated via the AKS cluster's client certificate.

### 4.1 Namespaces

| Namespace | Purpose |
|-----------|---------|
| `openclaw` | Per-user OpenClaw sandbox pods |
| `litellm` | LiteLLM proxy + PostgreSQL database |
| `portals` | Admin Portal, Customer Portal, Portal API |
| `agent-sandbox-system` | Sandbox CRD controller |
| `ingress-nginx` | NGINX Ingress Controller |

### 4.2 Storage Classes

| Name | Provisioner | SKU | Reclaim | Expansion | Default |
|------|------------|-----|---------|-----------|---------|
| `azure-disk-premium` | disk.csi.azure.com | Premium_LRS | Delete | Yes | Yes |

All persistent storage uses Azure Managed Disk (Premium SSD). No Azure File or Azure Blob storage is used.

### 4.3 LiteLLM Proxy

LiteLLM acts as a unified AI gateway, providing:
- Model routing and aliasing (maps `gpt-5.4` to `azure/gpt-5.4`)
- API key management (per-tenant keys with quotas)

**Deployment**:

| Parameter | Value |
|-----------|-------|
| Helm Chart | `oci://ghcr.io/berriai/litellm-helm` |
| Image Tag | `main-latest` |
| ServiceAccount | `litellm` |
| Database | Standalone PostgreSQL (Bitnami) |
| Service | ClusterIP on port 4000 |

**Model Configuration**:
```
Model Name:  gpt-5.4
Backend:     azure/gpt-5.4
API Base:    <AI Foundry regional endpoint>
API Version: 2025-04-01-preview
Auth:        API Key (from AI Services account)
```

**API Key Management**:
- A master key is stored as a Kubernetes secret (`litellm-masterkey`)
- Portal-specific keys are generated via `/key/generate` endpoint during `install.sh`
- Keys have model restrictions and duration (365 days for portal-api)

### 4.4 Agent Sandbox Controller

The Agent Sandbox Controller manages the lifecycle of sandbox CRDs (`sandboxes.agents.x-k8s.io/v1alpha1`). It is deployed from the `agent-sandbox/` directory and includes:

| Component | Description |
|-----------|-------------|
| `manifest.yaml` | Core CRD definition + controller deployment (`registry.k8s.io/agent-sandbox/agent-sandbox-controller:v0.1.0`) |
| `extensions.yaml` | Additional CRD extensions |
| `subagent-rbac.yaml` | ServiceAccount, Role, RoleBinding for subagent feature |
| `subagent-sandbox-template.yaml` | Template ConfigMap for sandbox creation |
| `subagent-config.yaml` | Configuration ConfigMap |
| `subagent-controller.yaml` | Subagent controller deployment |
| `ttl-controller.yaml` | CronJob for auto-cleanup of expired sandboxes |

The controller watches for `Sandbox` CR creation and manages the underlying pod lifecycle, including volume claim templates (similar to StatefulSet behavior).

---

## 5. Portal System

The portal system consists of three services deployed in the `portals` namespace:

```
portals namespace
├── portal-api          (Fastify + SQLite, ClusterIP :3000)
│   ├── /health         — Health check
│   ├── /auth/*         — Authentication (login, signup, me)
│   ├── /admin/*        — Admin endpoints (cluster, users, sandboxes)
│   ├── /chat/*         — Chat routing to OpenClaw sandbox
│   ├── /integrations/* — IM integration management
│   └── /webhooks/*     — Feishu webhook receiver
├── admin-portal        (Next.js, ClusterIP :3000, path: /admin)
└── customer-portal     (Next.js, ClusterIP :3000, path: /app)
```

### 5.1 Portal API (Fastify + SQLite)

The Portal API is the central backend service responsible for:
- User authentication (JWT-based)
- Sandbox lifecycle management (provision, status check, channel updates)
- Chat message routing to OpenClaw sandboxes
- IM integration CRUD and webhook handling
- Cluster overview (delegates to `kubectl`)

**Database**: SQLite stored on a 1 Gi Azure Disk PVC (`portal-db-pvc`) mounted at `/data/db.sqlite`.

**Key Environment Variables**:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | 32-byte hex string for JWT signing |
| `OPENCLAW_API_URL` | LiteLLM proxy URL (`http://litellm.litellm.svc.cluster.local:4000`) |
| `LITELLM_API_KEY` | API key for LiteLLM proxy |
| `API_BASE_URL` | Public-facing API URL (`https://<ingress-ip>/api`) |
| `TLS_CERT_PATH` | Path to TLS cert for webhook endpoints |
| `DB_PATH` | SQLite database path (`/data/db.sqlite`) |

**RBAC**: The `portal-api` ServiceAccount has a ClusterRole (`portal-api-sandbox-manager`) granting:
- `agents.x-k8s.io/sandboxes`: get, list, create, update, patch, delete
- `pods`: get, list
- `nodes`: get, list

**Dockerfile**: Installs `kubectl` binary for in-pod sandbox provisioning via `kubectl apply`.

**Default Admin User**:
- Email: `admin@openclaw.ai`
- Password: `Admin@123`
- Created automatically on first startup with a sandbox record in "provisioning" state
- Auto-provisioning runs on server startup for any sandboxes in "provisioning" state

### 5.2 Admin Portal (Next.js)

The Admin Portal is a Next.js application served at `/admin` with a dark-themed glass-morphism UI.

**Pages**:

| Page | Path | Features |
|------|------|----------|
| Login | `/admin/login` | Email + password authentication |
| Dashboard | `/admin/dashboard` | Total Users, Active Sandboxes, Cluster Nodes, Sandbox Pods (with live counts); node list with CPU/memory/status |
| Users | `/admin/users` | User table (name, email, role badge, sandbox status badge, join date) |
| Cluster | `/admin/cluster` | Node detail cards (name, status, roles, CPU, memory, kubelet version); pods table with namespace filter |
| Monitoring | `/admin/monitoring` | Sandbox overview cards (total/active/provisioning/failed); sandbox detail table |
| Models | `/admin/models` | Model catalog cards (gpt-5.4 active, gpt-4o inactive, claude-opus-4-6 inactive) |

**Sidebar**: Lobster emoji icon + "OpenClaw Admin Portal" title.

### 5.3 Customer Portal (Next.js)

The Customer Portal is a Next.js application served at `/app` providing the end-user experience.

**Pages**:

| Page | Path | Features |
|------|------|----------|
| Login | `/app/login` | Email + password authentication |
| Signup | `/app/signup` | New user registration |
| Chat | `/app/chat` | Main chat interface with sidebar (conversation history, IM channel badges, user profile); sandbox status banner; markdown-rendered message bubbles; typing indicator |
| Integrations | `/app/integrations` | IM integration management — Feishu (App ID + Secret), Telegram (Bot Token), Slack (Bot Token + App Token); connect/disconnect with live status |

**Chat Flow**:
1. User sends message via chat UI
2. Customer Portal → Portal API (`POST /chat`)
3. Portal API → User's sandbox gateway (`POST /v1/chat/completions`)
4. Sandbox gateway → LiteLLM (`POST /v1/chat/completions`)
5. LiteLLM → Azure OpenAI GPT-5.4
6. Response flows back through the same chain

**Root URL Redirect**: Accessing `http://<ip>/` redirects to `/app/login` via nginx `app-root` annotation.

---

## 6. OpenClaw Sandbox Architecture

### 6.1 Sandbox CRD & Manifest

Each user gets a dedicated sandbox defined as a Kubernetes Custom Resource:

```yaml
apiVersion: agents.x-k8s.io/v1alpha1
kind: Sandbox
metadata:
  name: oc-<userId-first-8-chars>     # e.g. oc-fed9c3d3
  namespace: openclaw
  labels:
    openclaw.ai/user-id: <first 8 chars>
    openclaw.ai/user-email: <sanitized email>
    openclaw.ai/managed-by: portal-api
spec:
  podTemplate:
    metadata:
      labels:
        sandbox: oc-<userId>
    spec:
      runtimeClassName: kata-vm-isolation
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      nodeSelector:
        katacontainers.io/kata-runtime: "true"
      tolerations:
        - key: kata
          operator: Equal
          value: "true"
          effect: NoSchedule
      containers:
        - name: openclaw
          image: ghcr.io/openclaw/openclaw:latest
          command: [sh, -c]
          args:
            - |
              mkdir -p /home/node/.openclaw/workspace
              echo '<base64-config>' | base64 -d > /home/node/.openclaw/openclaw.json
              exec node dist/index.js gateway --bind=lan --port 18789 --allow-unconfigured --verbose
          ports:
            - containerPort: 18789   # Gateway HTTP/WebSocket
            - containerPort: 18790   # Control UI
          resources:
            requests: { cpu: "1", memory: "2Gi" }
            limits:   { cpu: "2", memory: "4Gi" }
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: false
            runAsNonRoot: true
            capabilities: { drop: [ALL] }
          volumeMounts:
            - name: workspaces-pvc
              mountPath: /home/node/.openclaw
  volumeClaimTemplates:
    - metadata: { name: workspaces-pvc }
      spec:
        storageClassName: azure-disk-premium
        accessModes: [ReadWriteOnce]
        resources:
          requests: { storage: 2Gi }
```

**OpenClaw Configuration** (injected as base64-encoded JSON):

```json
{
  "models": {
    "providers": {
      "litellm": {
        "baseUrl": "http://litellm.litellm.svc.cluster.local:4000",
        "apiKey": "<LITELLM_API_KEY>",
        "api": "openai-completions",
        "models": [{
          "id": "gpt-5.4",
          "name": "GPT-5.4 (LiteLLM)",
          "reasoning": true,
          "input": ["text", "image"],
          "contextWindow": 200000,
          "maxTokens": 8192
        }]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": { "primary": "litellm/gpt-5.4" },
      "workspace": "/home/node/.openclaw/workspace"
    }
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "lan",
    "auth": { "mode": "token", "token": "<LITELLM_API_KEY>" },
    "controlUi": { "dangerouslyAllowHostHeaderOriginFallback": true },
    "http": {
      "endpoints": {
        "chatCompletions": { "enabled": true }
      }
    }
  },
  "channels": { /* Telegram/Feishu/Slack configs if connected */ },
  "plugins":  { /* Enabled channel plugins */ }
}
```

### 6.2 Provisioning Flow

```
User Registration / Admin Seed
         │
         ▼
  Create sandbox record
  (status: 'provisioning')
         │
         ▼
  Server startup detects
  'provisioning' sandboxes
         │
         ▼
  provisionSandbox(userId, email)
         │
         ├── 1. Generate sandbox name: oc-<userId-8chars>
         ├── 2. Read user's connected IM channels from DB
         ├── 3. Build OpenClaw config JSON
         ├── 4. Build Sandbox CRD manifest
         ├── 5. Write manifest to temp file
         ├── 6. kubectl apply -f <manifest>
         ├── 7. Update DB: endpoint = http://oc-<id>.openclaw.svc.cluster.local:18789
         └── 8. Update DB: status = 'creating'
                  │
                  ▼
         Sandbox Controller creates pod
         on Kata node pool
                  │
                  ▼
         Pod enters 'Running' state
                  │
                  ▼
         getSandboxStatus() detects
         phase=Running, updates DB
         status = 'running'
```

**Status Lifecycle**: `provisioning` → `creating` → `running` (or `failed`)

### 6.3 Chat Routing

Portal API routes chat messages to the user's sandbox via an OpenAI-compatible endpoint:

```
POST http://oc-<userId>.openclaw.svc.cluster.local:18789/v1/chat/completions
Headers:
  Content-Type: application/json
  Authorization: Bearer <LITELLM_API_KEY>
Body:
  {
    "model": "litellm/gpt-5.4",
    "messages": [{ "role": "user", "content": "<message>" }],
    "max_completion_tokens": 8192
  }
```

The sandbox gateway processes the message through the OpenClaw agent pipeline and returns the AI response.

### 6.4 Resource Profile & Capacity Planning

**Per-Sandbox Resources**:

| Resource | Request | Limit |
|----------|---------|-------|
| CPU | 1 core | 2 cores |
| Memory | 2 Gi | 4 Gi |
| Storage (PVC) | 2 Gi | 2 Gi (Azure Premium SSD) |

**Per-Node Capacity** (Standard_D4s_v5):

| Resource | Total | Allocatable | System Reserved |
|----------|-------|-------------|-----------------|
| CPU | 4 cores | ~3.86 cores | ~0.14 cores |
| Memory | 16 Gi | ~11.1 Gi | ~4.9 Gi |

**Sandboxes per Node**:
- CPU bottleneck: 3.86 / 1.0 (request) = **3 sandboxes** (max)
- Memory bottleneck: 11.1 / 2.0 (request) = **5 sandboxes**
- **Effective max: 3 sandboxes per node** (CPU is the limiting factor)

**Scale Capacity**:

| Kata Nodes | Max Sandboxes |
|------------|---------------|
| 1 (min) | 3 |
| 2 | 6 |
| 5 | 15 |
| 10 (max) | 30 |

The cluster autoscaler will add Kata nodes as new sandboxes are provisioned and existing nodes reach capacity.

---

## 7. IM Integrations

Users can connect messaging platform bots to their OpenClaw sandbox, enabling AI conversations directly within their IM tools.

### 7.1 Telegram

**Connection Flow**:
1. User provides Bot Token via Customer Portal integrations page
2. Portal API calls `POST https://api.telegram.org/bot<token>/deleteWebhook` (clears any existing webhook)
3. Bot token stored in DB (`integrations` table, type: `telegram`)
4. `updateSandboxChannels()` re-applies sandbox manifest with Telegram config

**Runtime**: OpenClaw uses **long polling** via grammY runner to receive Telegram updates. No webhook endpoint is needed — the bot connects directly to Telegram Bot API from within the sandbox pod.

> **Critical**: Do NOT call `setWebhook` on a Telegram bot intended for OpenClaw. Setting a webhook disables polling. If a webhook was previously set, the Portal API automatically calls `deleteWebhook` when connecting.

**Sandbox Config Injection**:
```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "<BOT_TOKEN>",
      "dmPolicy": "open",
      "allowFrom": ["*"]
    }
  },
  "plugins": {
    "entries": { "telegram": { "enabled": true } }
  }
}
```

### 7.2 Feishu (飞书)

**Connection Flow**:
1. User provides App ID and App Secret via Customer Portal
2. Credentials stored in DB
3. `updateSandboxChannels()` re-applies sandbox manifest with Feishu config
4. Portal API returns a webhook URL for configuring in the Feishu developer console

**Webhook Endpoint**:
```
POST /api/webhooks/feishu/:integrationId
```
- Handles URL verification challenge (`{ "challenge": body.challenge }`)
- Validates integration exists and is connected
- Acknowledges receipt (OpenClaw handles events via its Feishu plugin)

**Sandbox Config Injection**:
```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "<APP_ID>",
      "appSecret": "<APP_SECRET>",
      "domain": "feishu",
      "dmPolicy": "open",
      "allowFrom": ["*"]
    }
  },
  "plugins": {
    "entries": { "feishu": { "enabled": true } }
  }
}
```

### 7.3 Slack

**Connection Flow**:
1. User provides Bot Token and App Token via Customer Portal
2. Credentials stored in DB
3. `updateSandboxChannels()` re-applies sandbox manifest with Slack config

**Sandbox Config Injection**:
```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "botToken": "<BOT_TOKEN>",
      "appToken": "<APP_TOKEN>",
      "dmPolicy": "open",
      "allowFrom": ["*"]
    }
  },
  "plugins": {
    "entries": { "slack": { "enabled": true } }
  }
}
```

### Integration Lifecycle

All integration operations (connect/disconnect) trigger `updateSandboxChannels()` in the background, which:
1. Reads all connected integrations for the user from DB
2. Rebuilds the OpenClaw config JSON with updated channel configs
3. Re-applies the Sandbox CRD manifest via `kubectl apply`
4. The sandbox controller performs a rolling restart with the new config

> **Note on `dmPolicy: open`**: When using `dmPolicy: "open"`, the config **must** include `allowFrom: ["*"]`. Omitting `allowFrom` causes OpenClaw config validation to fail and the gateway process to crash.

---

## 8. Security

### Multi-Layer Isolation

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| **Hardware** | Kata VM isolation (Microsoft Hypervisor) | Each sandbox runs in its own lightweight VM |
| **Network** | Calico network policies | Pod-to-pod isolation capability |
| **Container** | securityContext hardening | Non-root (UID 1000), drop ALL capabilities, no privilege escalation |
| **Auth** | Token-based gateway auth | Each sandbox gateway requires Bearer token |
| **Scheduling** | Node taints + tolerations | Sandboxes only run on Kata-dedicated nodes |

### Container Security

All sandbox pods enforce:
```yaml
securityContext:
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: false    # Required for OpenClaw workspace
  runAsNonRoot: true
  capabilities:
    drop: [ALL]
```

### Authentication & Authorization

| Component | Auth Method |
|-----------|-------------|
| Portal API ↔ User | JWT (HS256, 24h expiry) |
| Portal API ↔ LiteLLM | API Key (generated via `/key/generate`) |
| Portal API ↔ Sandbox | Bearer token (LITELLM_API_KEY) |
| LiteLLM ↔ Azure OpenAI | API Key (from AI Services account) |
| AKS ↔ ACR | Managed Identity (AcrPull role) |

### RBAC

The `portal-api` ServiceAccount has minimal ClusterRole permissions:
- `agents.x-k8s.io/sandboxes`: Full CRUD (required for sandbox lifecycle)
- `pods`: Read-only (for admin dashboard)
- `nodes`: Read-only (for cluster overview)

---

## 9. Data Persistence

All stateful data is stored on Azure Managed Disks (Premium SSD) via PersistentVolumeClaims.

| Component | PVC | Size | Mount Path | Data |
|-----------|-----|------|------------|------|
| Portal API | `portal-db-pvc` | 1 Gi | `/data` | SQLite database (users, sandboxes, integrations, conversations) |
| Each Sandbox | `workspaces-pvc` | 2 Gi | `/home/node/.openclaw` | OpenClaw config, workspace files, agent data |
| LiteLLM DB | auto-provisioned | — | — | PostgreSQL (API keys, usage tracking) |

**Durability**: All PVCs use `azure-disk-premium` (Azure Managed Disk, Premium SSD). Data survives:
- Pod restarts
- Node failures (disk is re-attached to new node)
- Cluster upgrades

**Access Mode**: All PVCs are `ReadWriteOnce` (single-node mount). During rolling deployments, the old pod must release the PVC before the new pod can mount it. For portal-api, this may require manually scaling down the old ReplicaSet.

---

## 10. Networking & Ingress

### Ingress Architecture

```
Internet → Azure Load Balancer → NGINX Ingress Controller → Backend Services
```

**NGINX Ingress Controller**:
- Deployed via Helm in `ingress-nginx` namespace
- Service type: `LoadBalancer`
- `externalTrafficPolicy: Local` (preserves client source IP)

**Ingress Rules**:

| Path | Backend | Protocol |
|------|---------|----------|
| `/` | Redirect to `/app/login` | HTTP (302) |
| `/admin/*` | admin-portal:3000 | HTTP |
| `/app/*` | customer-portal:3000 | HTTP |
| `/api(/\|$)(.*)` | portal-api:3000 (rewrite to `/$2`) | HTTPS |

**TLS**: Self-signed certificate generated during install for the ingress IP. Used for:
- API endpoint HTTPS (`/api/*`)
- Webhook endpoints that require HTTPS (e.g., Feishu URL verification)

### Internal Service Communication

| From | To | Protocol | DNS |
|------|-----|----------|-----|
| Portal API | LiteLLM | HTTP :4000 | `litellm.litellm.svc.cluster.local` |
| Portal API | Sandbox | HTTP :18789 | `oc-<id>.openclaw.svc.cluster.local` |
| Sandbox | LiteLLM | HTTP :4000 | `litellm.litellm.svc.cluster.local` |
| LiteLLM | Azure OpenAI | HTTPS :443 | `eastus2.api.cognitive.microsoft.com` |
| Sandbox | Telegram API | HTTPS :443 | `api.telegram.org` |

### Outbound Connectivity

| Subnet | Outbound Method | Use Case |
|--------|----------------|----------|
| System | AKS Standard LB SNAT | Portal API, LiteLLM → Azure OpenAI |
| Kata | NAT Gateway (static IP) | Sandbox → Telegram API, package downloads |

---

## 11. Deployment Automation (install.sh)

The entire stack is deployed via a single `install.sh` script with interactive prompts.

### Prerequisites
- `az` (Azure CLI, logged in)
- `kubectl`
- `terraform` (>= 1.3.2)
- `helm`

### Usage

```bash
# Interactive mode (prompts for all settings)
./install.sh

# Non-interactive mode
./install.sh \
  --cluster-name openclaw-kata-aks \
  --location southeastasia \
  --foundry-location eastus2 \
  --yes

# Microsoft internal subscription
./install.sh --microsoft-internal
```

### Deployment Phases

```
Phase 1: Azure Infrastructure (~10-15 min)
├── terraform init + apply (layer1-azure)
├── Creates: RG, VNet, AKS, ACR, AI Foundry
└── Outputs: cluster credentials, ACR name, foundry endpoint, API key

kubectl Configuration
├── az aks get-credentials
└── Wait for all nodes Ready (300s timeout)

Phase 2: Kubernetes Workloads
├── terraform init + apply (layer2-k8s)
└── Deploys: Namespaces, StorageClass, LiteLLM, Sandbox Controller

Phase 3: Portal Deployment
├── Build 3 container images via ACR Tasks (linux/amd64)
├── Apply K8s manifests (namespace, PVC, RBAC)
├── Generate LiteLLM API key for portal-api
├── Deploy portal-api, admin-portal, customer-portal
├── Install NGINX Ingress Controller (Helm)
├── Open NSG ports 80/443
├── Apply Ingress rules
├── Wait for Ingress LoadBalancer IP
├── Generate self-signed TLS certificate
├── Re-deploy portal-api with correct API_BASE_URL
└── Output access URLs + default credentials
```

### Post-Deployment

After `install.sh` completes:
1. Access Admin Portal at `http://<ingress-ip>/admin` (login: `admin@openclaw.ai` / `Admin@123`)
2. Access Customer Portal at `http://<ingress-ip>/app`
3. The admin user's sandbox is automatically provisioned on first startup
4. Additional users register via the Customer Portal signup page
5. IM integrations (Telegram, Feishu, Slack) are configured post-deployment via the Customer Portal integrations page

---

## 12. Appendix: Quick Reference

### Current Deployment

| Item | Value |
|------|-------|
| Ingress IP | `57.158.168.123` |
| Admin Portal | `http://57.158.168.123/admin` |
| Customer Portal | `http://57.158.168.123/app` |
| API | `https://57.158.168.123/api` |
| ACR | `ocaksdemoacr` |
| AKS Region | Southeast Asia |
| Foundry Region | East US 2 |
| System Nodes | 3x Standard_D4as_v7 |
| Kata Nodes | 2x Standard_D4s_v5 |
| Active Sandboxes | 3 |

### Repository Structure

```
openclaw-on-aks/
├── install.sh                          # One-command deployment script
├── terraform/
│   ├── layer1-azure/                   # Azure infrastructure
│   │   ├── main.tf                     # Provider config, resource group, locals
│   │   ├── aks.tf                      # AKS cluster + node pools
│   │   ├── vnet.tf                     # VNet, subnets, NAT gateway, NSG
│   │   ├── azure-openai.tf             # AI Foundry, AI Services, GPT-5.4
│   │   ├── acr.tf                      # Container registry
│   │   ├── passwords.tf                # Generated passwords/secrets
│   │   ├── variables.tf                # Input variables with defaults
│   │   └── outputs.tf                  # Outputs consumed by layer2
│   └── layer2-k8s/                     # Kubernetes workloads
│       ├── main.tf                     # Provider config, layer1 state ref
│       ├── namespaces.tf               # Namespace definitions
│       ├── storage.tf                  # StorageClass (azure-disk-premium)
│       ├── litellm.tf                  # LiteLLM Helm release
│       ├── agent-sandbox.tf            # Sandbox controller installation
│       ├── variables.tf                # Input variables
│       └── outputs.tf                  # Outputs
├── agent-sandbox/                      # Sandbox CRD controller manifests
│   ├── manifest.yaml
│   ├── extensions.yaml
│   ├── subagent-rbac.yaml
│   ├── subagent-sandbox-template.yaml
│   ├── subagent-config.yaml
│   ├── subagent-controller.yaml
│   └── ttl-controller.yaml
├── portals/
│   ├── api/                            # Portal API (Fastify + TypeScript)
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── index.ts                # Server entry + auto-provisioning
│   │       ├── db/client.ts            # SQLite schema + admin seeding
│   │       ├── middleware/auth.ts       # JWT authentication
│   │       ├── routes/
│   │       │   ├── auth.ts             # Login, signup, token refresh
│   │       │   ├── admin.ts            # Cluster overview, user mgmt
│   │       │   ├── chat.ts             # Chat message routing
│   │       │   ├── integrations.ts     # IM integration CRUD
│   │       │   └── webhooks.ts         # Feishu webhook handler
│   │       └── services/
│   │           ├── sandbox.ts          # Sandbox provisioning + config
│   │           ├── openclaw.ts         # Chat forwarding to sandbox
│   │           └── k8s.ts              # kubectl wrapper
│   ├── admin/                          # Admin Portal (Next.js)
│   │   ├── Dockerfile
│   │   └── src/app/
│   │       ├── dashboard/page.tsx
│   │       ├── users/page.tsx
│   │       ├── cluster/page.tsx
│   │       ├── monitoring/page.tsx
│   │       └── models/page.tsx
│   ├── customer/                       # Customer Portal (Next.js)
│   │   ├── Dockerfile
│   │   └── src/app/
│   │       ├── chat/page.tsx
│   │       ├── integrations/page.tsx
│   │       ├── login/page.tsx
│   │       └── signup/page.tsx
│   └── k8s/                            # K8s manifests for portals
│       ├── namespace.yaml
│       ├── pvc.yaml
│       ├── portal-api-rbac.yaml
│       ├── api-deployment.yaml
│       ├── admin-portal-deployment.yaml
│       ├── customer-portal-deployment.yaml
│       └── ingress.yaml
└── docs/
    └── OpenClaw-on-AKS-Architecture.md # This document
```

### Key Operational Notes

1. **Kata nodepool cannot scale from 0**: Always keep `min_count >= 1`.
2. **Kata workload runtime is immutable**: `KataMshvVmIsolation` must be set at nodepool creation.
3. **AKS-managed labels are protected**: Cannot manually add `kubernetes.azure.com/*` labels.
4. **Portal-api PVC contention**: During rollout, manually scale down old ReplicaSet if new pod can't mount PVC.
5. **Sandbox re-provisioning**: After changing LITELLM_API_KEY or config, must call `updateSandboxChannels()` AND delete pods to restart with new config.
6. **OpenClaw workspace directory**: Must `mkdir -p /home/node/.openclaw/workspace` before starting gateway, or agent is skipped.
7. **Telegram uses polling, not webhooks**: Never call `setWebhook` for OpenClaw Telegram bots.
