# OpenClaw on AKS with Kata Containers and LiteLLM

## Introduction

This blueprint deploys OpenClaw AI agents with sandbox isolation using Kata Containers on Azure Kubernetes Service (AKS), integrated with LiteLLM proxy for GPT-5.4 (Azure OpenAI). The solution provides secure, isolated agent environments for Slack and Feishu integrations with enterprise-grade security, scalability, and observability.

**Key Features:**

- **Flexible Isolation**: Supports both Kata VM isolation (KataMshvVmIsolation) and Standard Pod deployment — Admin selects runtime type when approving users
- **Approval Workflow**: New user registration requires Admin approval, with runtime type selection (Kata VM or Standard Pod) at approval time
- **Autoscaling**: AKS cluster autoscaler provisions Kata nodes on-demand (1-10 nodes)
- **Observability**: Prometheus and Grafana for metrics, with LiteLLM ServiceMonitor
- **Sandbox Lifecycle**: CRD-based sandbox management with warm pool and template support
- **Secure AI Access**: Workload Identity for Azure OpenAI authentication (no static credentials)
- **Secret Management**: Credentials injected via Kubernetes Secrets with placeholder-based config injection (no secrets baked into manifests)
- **Multi-channel**: Support for Slack, Feishu, and Telegram integrations
- **Persistent Workspaces**: Azure Files Premium-backed storage (ReadWriteMany) for agent state and data
- **Gateway Management Scripts**: Standard Pod sandboxes include start/restart/stop scripts for gateway lifecycle management (documented in AGENTS.md)
- **Self-service Portal**: Customer portal for chat and integration management; Admin portal for cluster monitoring, user approval, and sandbox oversight

## Architecture

- **AKS Cluster**: Managed Kubernetes cluster (v1.32) with system node pool and Kata node pool with autoscaling
- **Kata Containers**: Lightweight VM isolation using AKS-native KataMshvVmIsolation on nested-virtualization capable VMs (for Kata runtime type)
- **LiteLLM Proxy**: OpenAI-compatible API gateway to Azure OpenAI with PostgreSQL backend
- **OpenClaw Sandboxes**: CRD-managed isolated agent environments with persistent storage
- **Storage**: Azure Files CSI driver with Premium file shares (ReadWriteMany) for workspace persistence
- **Networking**: VNet with subnets for system nodes, Kata nodes, and pods; NAT Gateway for outbound connectivity
- **Security**: Workload Identity for Azure OpenAI access (no long-lived credentials), Key Vault for secrets
- **Observability**: Prometheus (50Gi, 15d retention) and Grafana with LiteLLM metrics

## Dynamic Subagent Isolation

OpenClaw supports dynamic subagent isolation where each spawned subagent runs in its own dedicated Kata VM sandbox. This provides full VM-level isolation between the main agent and any subagents it creates.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AKS Cluster                                  │
│                                                                     │
│  ┌──────────────────────────┐    ┌──────────────────────────┐      │
│  │   Main Agent Sandbox     │    │  SubagentController      │      │
│  │   (Kata VM)              │    │  (system node pool)      │      │
│  │                          │    │                          │      │
│  │  openclaw-slack-sandbox  │───▶│  Watches for spawn       │      │
│  │  or                      │    │  requests, creates       │      │
│  │  openclaw-feishu-sandbox │    │  Sandbox CRs via K8s API │      │
│  └──────────────────────────┘    └─────────┬────────────────┘      │
│                                            │                        │
│              ┌─────────────────────────────┼──────────────┐         │
│              │ K8s API: POST Sandbox CR    │              │         │
│              ▼                             ▼              ▼         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │ Subagent Sandbox  │  │ Subagent Sandbox  │  │ Subagent Sandbox│  │
│  │ (Kata VM)         │  │ (Kata VM)         │  │ (Kata VM)       │  │
│  │                   │  │                   │  │                 │  │
│  │ subagent-slack-   │  │ subagent-slack-   │  │ subagent-       │  │
│  │ task-abc123       │  │ task-def456       │  │ feishu-task-..  │  │
│  │                   │  │                   │  │                 │  │
│  │ TTL: 30min        │  │ TTL: 30min        │  │ TTL: 30min      │  │
│  │ Storage: 1Gi      │  │ Storage: 1Gi      │  │ Storage: 1Gi    │  │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘  │
│              ▲                                                      │
│              │                                                      │
│  ┌──────────┴───────────────────────────────────────────────────┐  │
│  │  TTL Controller CronJob (every 5min)                         │  │
│  │  Deletes sandboxes where shutdownTime is past or TTL expired │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow

1. **Main agent receives task**: The parent sandbox (e.g., `openclaw-slack-sandbox`) determines a task requires an isolated subagent
2. **Spawn subagent Sandbox CR**: OpenClaw's `sessions_spawn` with `runtime="sandbox"` triggers the SubagentController to POST a new Sandbox CR to the K8s API
3. **New Kata VM starts**: The agent-sandbox-controller provisions a new pod with `kata-mshv-vm-isolation` runtime class, creating a dedicated Kata VM
4. **Task runs in isolation**: The subagent executes its task inside the isolated VM with its own 1Gi storage volume, CPU/memory limits, and network namespace
5. **Auto-cleanup**: When `shutdownTime` is reached (default: 30 minutes after creation), the TTL controller CronJob deletes the Sandbox CR, and the agent-sandbox-controller cleans up the associated pod and PVC

### RBAC Requirements

The `openclaw-sandbox` ServiceAccount requires permissions to manage Sandbox CRs:

- **Role** (`openclaw-sandbox-manager`): create, delete, get, list, watch on `sandboxes.agents.x-k8s.io`
- **ClusterRole** (`sandbox-ttl-controller`): get, list, watch, delete on `sandboxes.agents.x-k8s.io` (for cross-namespace cleanup)

These are provisioned via `agent-sandbox/subagent-rbac.yaml`.

### Subagent Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| TTL | 1800s (30min) | Time-to-live for subagent sandboxes |
| Max concurrent | 5 | Maximum subagents per parent sandbox |
| Storage | 1Gi | Azure Disk Premium per subagent |
| CPU | 100m-500m | CPU request/limit |
| Memory | 128Mi-512Mi | Memory request/limit |
| Runtime | kata-mshv-vm-isolation | Kata Containers runtime class |

Configuration is stored in the `subagent-config` ConfigMap. The sandbox template is in `subagent-sandbox-template` ConfigMap.

## Deploying the Solution

### Prerequisites

Ensure that you have installed the following tools on your machine:

1. [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
2. [kubectl](https://kubernetes.io/docs/tasks/tools/)
3. [terraform](https://learn.hashicorp.com/tutorials/terraform/install-cli)
4. [helm](https://helm.sh/docs/intro/install/) (v3.x)

### Deploy

Clone the repository:

```bash
git clone https://github.com/jackylam0812/openclaw-on-aks
cd openclaw-on-aks
export OPENCLAW_HOME=$(pwd)
```

If `OPENCLAW_HOME` is ever unset, you can always set it manually using `export OPENCLAW_HOME=$(pwd)` from your openclaw-on-aks directory.

Run the installation script:

```bash
chmod +x install.sh
./install.sh
```

**Deploy to a different region:**

```bash
# Deploy to westus2
./install.sh --location westus2

# Deploy to eastus with custom cluster name
./install.sh --location eastus --cluster-name my-openclaw

# Or use environment variables
AZURE_LOCATION=westus2 ./install.sh
```

**Available options:**
- `--location LOCATION` - Azure region (default: southeastasia)
- `--cluster-name NAME` - AKS cluster name (default: openclaw-kata-aks)
- `--help` - Show help message

The script will:
- Check prerequisites (az cli, kubectl, terraform, helm)
- Verify Azure login status
- Initialize Terraform
- Plan and apply infrastructure
- Configure kubectl via `az aks get-credentials`
- Wait for cluster to be ready
- Display next steps

### Deployment Outputs

After successful deployment, Terraform will display:

```
Outputs:

cluster_endpoint = "https://openclaw-kata-aks-xxxxx.hcp.southeastasia.azmk8s.io:443"
cluster_name = "openclaw-kata-aks"
configure_kubectl = "az aks get-credentials --resource-group openclaw-kata-aks-rg --name openclaw-kata-aks"
resource_group = "openclaw-kata-aks-rg"
key_vault_name = "openclawkataakskv"
acr_login_server = "openclawkataaaksacr.azurecr.io"
kata_namespace = "kata-system"
openclaw_namespace = "openclaw"
```

This deployment creates:

**Infrastructure:**
- AKS cluster (v1.32) with system node pool (Standard_D4as_v7, 1-3 nodes)
- VNet with 3 subnets (system nodes, Kata nodes, pods), NAT Gateway
- Azure Disk CSI driver with default Premium SSD StorageClass
- Azure Files CSI driver with Premium StorageClass

**Compute & Runtime:**
- Kata Containers runtime (KataMshvVmIsolation) on nested-virtualization capable VMs
- Kata node pool with autoscaling (Standard_D4s_v5, 1-10 nodes)
- Standard Pod deployment option (runs on system node pool without Kata isolation)
- Agent sandbox controller with CRDs

**AI & Proxy:**
- LiteLLM proxy with standalone PostgreSQL
- GPT-5.4 model via Azure OpenAI
- Workload Identity for secure Azure OpenAI access

**Monitoring:**
- Prometheus with 50Gi Azure Disk Premium storage (15 day retention)
- Grafana with 10Gi Azure Disk Premium storage (ClusterIP service)
- ServiceMonitor for LiteLLM metrics collection

Configure kubectl:

```bash
az aks get-credentials --resource-group openclaw-kata-aks-rg --name openclaw-kata-aks
```

Verify the deployment:

```bash
# Check cluster
kubectl get nodes

# Check Kata runtime
kubectl get runtimeclass

# Check LiteLLM
kubectl get pods -n litellm

# Check sandboxes
kubectl get sandbox -A
```

## LiteLLM Configuration

### Access Information

LiteLLM is deployed as an internal service accessible within the cluster:

- **Service**: `litellm.litellm.svc.cluster.local:4000`
- **Model**: GPT-5.4 (mapped to Azure OpenAI)
- **Database**: Standalone PostgreSQL

Retrieve the master key:

```bash
kubectl get secret litellm-masterkey -n litellm -o jsonpath='{.data.masterkey}' | base64 -d
```

### Generate API Key for OpenClaw

Generate a dedicated API key for OpenClaw sandboxes:

```bash
MASTER_KEY=$(kubectl get secret litellm-masterkey -n litellm -o jsonpath='{.data.masterkey}' | base64 -d)

LITELLM_API_KEY=$(kubectl run -n litellm gen-key --rm -i --restart=Never --image=curlimages/curl -- \
  curl -s -X POST http://litellm:4000/key/generate \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"models": ["gpt-5.4"], "duration": "30d"}' | grep -o '"key":"[^"]*"' | cut -d'"' -f4)

echo "LiteLLM API Key: $LITELLM_API_KEY"
```

Use this `LITELLM_API_KEY` value as the `apiKey` in OpenClaw's LiteLLM provider configuration.

### Test LiteLLM Connection

Verify that LiteLLM can successfully connect to Azure OpenAI and return responses:

```bash
MASTER_KEY=$(kubectl get secret litellm-masterkey -n litellm -o jsonpath='{.data.masterkey}' | base64 -d)

kubectl run -n litellm test --rm -i --restart=Never --image=curlimages/curl -- \
  curl -s -X POST http://litellm:4000/v1/chat/completions \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-5.4", "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 20}'
```

This test confirms:
- LiteLLM proxy is running and accessible
- Workload Identity authentication to Azure OpenAI is working
- GPT-5.4 model is properly configured
- The proxy can successfully route requests to Azure OpenAI

## OpenClaw Sandbox Deployment

### Slack Integration

#### 1. Create Slack App

Create a Slack app at https://api.slack.com/apps:

- Enable Socket Mode
- Add Bot Token Scopes:
  - `chat:write`
  - `im:write`
  - `im:history`
  - `channels:history`
  - `groups:history`
  - `mpim:history`
- Install app to workspace
- Copy Bot Token (`xoxb-...`) and App Token (`xapp-...`)

#### 2. Configure Sandbox

Update `examples/openclaw-slack-sandbox.yaml` with your credentials:

```bash
cd ${OPENCLAW_HOME}/examples

# Set Slack tokens
export SLACK_BOT_TOKEN="xoxb-..."
export SLACK_APP_TOKEN="xapp-..."

# Replace placeholders (LITELLM_API_KEY already set from previous step)
sed -i.bak \
  -e "s/YOUR_LITELLM_API_KEY/${LITELLM_API_KEY}/g" \
  -e "s/YOUR_BOT_TOKEN/${SLACK_BOT_TOKEN}/g" \
  -e "s/YOUR_APP_TOKEN/${SLACK_APP_TOKEN}/g" \
  openclaw-slack-sandbox.yaml
```

#### 3. Deploy Sandbox

```bash
kubectl apply -f openclaw-slack-sandbox.yaml

# Monitor deployment
kubectl get sandbox openclaw-slack-sandbox
kubectl get pods -l sandbox=openclaw-slack-sandbox -w

# Check logs
kubectl logs -f openclaw-slack-sandbox
```

The sandbox will:
- Create a Kata VM-isolated pod on nested-virtualization capable nodes
- Mount a 2Gi Azure Disk Premium volume for workspace persistence
- Connect to LiteLLM proxy for GPT-5.4 access
- Connect to Slack via Socket Mode

#### 4. Test in Slack

Once deployed, test the integration:

1. Open your Slack workspace
2. Find the bot in the Apps section or direct message it
3. Send a message like "Hello" or "What can you do?"
4. The bot should respond using GPT-5.4 via LiteLLM

**Troubleshooting:**
- If no response, check pod logs: `kubectl logs -f openclaw-slack-sandbox`
- Verify Socket Mode is enabled in Slack app settings
- Ensure bot has correct permissions and is installed to workspace

### Feishu Integration

#### 1. Create Feishu App

Create a Feishu app at https://open.feishu.cn/:

- Get App ID and App Secret
- Configure event subscriptions
- Add required permissions

#### 2. Configure Sandbox

Update `examples/openclaw-feishu-sandbox.yaml` with your credentials:

```bash
cd ${OPENCLAW_HOME}/examples

# Set Feishu credentials
export FEISHU_APP_ID="cli_..."
export FEISHU_APP_SECRET="..."

# Replace placeholders (LITELLM_API_KEY already set from previous step)
sed -i.bak \
  -e "s/YOUR_LITELLM_API_KEY/${LITELLM_API_KEY}/g" \
  -e "s/YOUR_FEISHU_APP_ID/${FEISHU_APP_ID}/g" \
  -e "s/YOUR_FEISHU_APP_SECRET/${FEISHU_APP_SECRET}/g" \
  openclaw-feishu-sandbox.yaml
```

#### 3. Deploy Sandbox

```bash
kubectl apply -f openclaw-feishu-sandbox.yaml

# Monitor deployment
kubectl get sandbox openclaw-feishu-sandbox
kubectl get pods -l sandbox=openclaw-feishu-sandbox -w

# Check logs
kubectl logs -f openclaw-feishu-sandbox
```

The sandbox will:
- Create a Kata VM-isolated pod on nested-virtualization capable nodes
- Mount a 2Gi Azure Disk Premium volume for workspace persistence
- Connect to LiteLLM proxy for GPT-5.4 access
- Connect to Feishu via webhook

#### 4. Test in Feishu

Once deployed, test the integration:

1. Open your Feishu app
2. Find the bot in the app list or direct message it
3. Send a message like "Hello" or "What can you do?"
4. The bot should respond using GPT-5.4 via LiteLLM

**Troubleshooting:**
- If no response, check pod logs: `kubectl logs -f openclaw-feishu-sandbox`
- Verify webhook URL is correctly configured in Feishu app settings
- Ensure app has correct permissions and event subscriptions
- Check that App ID and App Secret are correct

## Monitoring with Prometheus and Grafana

### Access Grafana

Get the admin password:

```bash
# Via Terraform
terraform output -raw grafana_admin_password

# Or via kubectl
kubectl get secret -n monitoring kube-prometheus-stack-grafana -o jsonpath='{.data.admin-password}' | base64 -d && echo
```

Access Grafana via port-forward:

```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
```

Open http://localhost:3000 in your browser:
- Username: `admin`
- Password: Use the password from the command above

### Import LiteLLM Dashboard

A pre-configured Grafana dashboard for LiteLLM is provided in `examples/grafana/grafana_dashboard.json`.

To import:

1. Access Grafana (see above)
2. Navigate to **Dashboards** > **Import**
3. Upload the dashboard file:
   ```bash
   examples/grafana/grafana_dashboard.json
   ```
4. Select the Prometheus data source
5. Click **Import**

The dashboard includes:
- **Proxy Level Metrics**: Total requests, failed requests, request rates
- **Token Metrics**: Input/output tokens, total tokens per model
- **Latency Metrics**: Request latency, LLM API latency, time to first token
- **Deployment Metrics**: Success/failure rates per deployment
- **Budget Metrics**: Spend tracking per team, user, and API key
- **Rate Limit Metrics**: Remaining requests and tokens

### Verify Metrics Collection

Check that Prometheus is scraping LiteLLM metrics:

```bash
# Check ServiceMonitor
kubectl get servicemonitor -n litellm

# Check Prometheus targets (via port-forward)
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
# Open http://localhost:9090/targets and look for litellm
```

Test metrics endpoint directly:

```bash
kubectl run -n litellm test-metrics --rm -i --restart=Never --image=curlimages/curl -- \
  curl -s http://litellm:4000/metrics | head -20
```

## Troubleshooting

### Check Sandbox Status

```bash
# List all sandboxes
kubectl get sandbox -A

# Describe sandbox
kubectl describe sandbox openclaw-slack-sandbox

# Check pod status
kubectl get pods -l sandbox=openclaw-slack-sandbox

# View logs
kubectl logs openclaw-slack-sandbox --tail=50

# Check events
kubectl get events --sort-by='.lastTimestamp' | grep openclaw
```

### Check LiteLLM Status

```bash
# Check pods
kubectl get pods -n litellm

# View LiteLLM logs
kubectl logs -n litellm deployment/litellm --tail=50

# View PostgreSQL logs
kubectl logs -n litellm litellm-postgresql-0 --tail=50

# Test health endpoint
kubectl run -n litellm test --rm -i --restart=Never --image=curlimages/curl -- \
  curl -s http://litellm:4000/health/readiness
```

### Check Kata Runtime

```bash
# Check Kata nodes
kubectl get nodes -l katacontainers.io/kata-runtime=true

# Check Kata runtime class
kubectl get runtimeclass kata-mshv-vm-isolation

# Check node pool scaling
az aks nodepool show --resource-group openclaw-kata-aks-rg --cluster-name openclaw-kata-aks --name kata
```

### Common Issues

#### 1. Pod Stuck in Pending

**Symptom**: Sandbox pod remains in Pending state

**Solution**: Check if Kata node pool has scaled up

```bash
kubectl get nodes
az aks nodepool show --resource-group openclaw-kata-aks-rg --cluster-name openclaw-kata-aks --name kata -o table
kubectl describe pod openclaw-slack-sandbox
```

#### 2. Config Validation Errors

**Symptom**: Pod crashes with "Invalid config" errors

**Solution**: Check OpenClaw logs for specific field errors

```bash
kubectl logs openclaw-slack-sandbox | grep -A 5 "Invalid"
```

Common fixes:
- Ensure `apiKey` (not `auth`) is used for LiteLLM
- Use `openai-completions` API type
- Verify API key is valid and not expired

#### 3. LiteLLM Authentication Errors

**Symptom**: "Authentication Error" or "Invalid API key"

**Solution**: Verify API key and regenerate if needed

```bash
# Check if key exists
MASTER_KEY=$(kubectl get secret litellm-masterkey -n litellm -o jsonpath='{.data.masterkey}' | base64 -d)

# List existing keys
kubectl run -n litellm list-keys --rm -i --restart=Never --image=curlimages/curl -- \
  curl -s http://litellm:4000/key/info \
  -H "Authorization: Bearer $MASTER_KEY"

# Generate new key if needed
kubectl run -n litellm gen-key --rm -i --restart=Never --image=curlimages/curl -- \
  curl -s -X POST http://litellm:4000/key/generate \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"models": ["gpt-5.4"], "duration": "30d"}'
```

#### 4. Azure OpenAI Access Denied

**Symptom**: "AccessDenied" or "AuthorizationFailed" errors when calling Azure OpenAI

**Solution**: Verify Workload Identity configuration

```bash
# Check Managed Identity
az identity show --resource-group openclaw-kata-aks-rg --name openclaw-kata-aks-litellm-identity

# Check Federated Credential
az identity federated-credential list --identity-name openclaw-kata-aks-litellm-identity --resource-group openclaw-kata-aks-rg

# Check role assignment
az role assignment list --assignee <identity-principal-id> --scope /subscriptions/<subscription-id>

# Verify ServiceAccount has Workload Identity annotation
kubectl get sa litellm -n litellm -o yaml
```

#### 5. Persistent Config Issues

**Symptom**: Config changes not taking effect

**Solution**: Delete PVC to force config recreation

```bash
# Delete sandbox and PVC
kubectl delete sandbox openclaw-slack-sandbox
kubectl delete pvc workspaces-pvc-openclaw-slack-sandbox

# Recreate
kubectl apply -f examples/openclaw-slack-sandbox.yaml
```

## Cleanup

Remove all resources:

```bash
chmod +x cleanup.sh
./cleanup.sh
```

Or manually:

```bash
# Delete sandboxes first
kubectl delete sandbox --all

# Wait for pods to terminate
kubectl get pods -A | grep openclaw

# Destroy infrastructure
terraform destroy

# Optionally delete the entire resource group
az group delete --name openclaw-kata-aks-rg --yes --no-wait
```

**Note**: Terraform destroy will remove all resources including Azure Disk volumes and data. Deleting the resource group ensures no orphaned resources remain.

## Cost Optimization

- **Kata node pool** minimum is 1 node (cannot scale to zero); cost is ongoing for the minimum node
- **System node pool** (Standard_D4as_v7) runs continuously
- **Azure Disk Premium** charged per provisioned size
- **LiteLLM PostgreSQL** uses Azure Disk storage
- **Azure OpenAI** charges per token (input/output)
- **NAT Gateway** charged per hour and per GB processed

**Recommendations**:
- Kata node pool autoscales 0-10, so no cost when idle
- Delete unused sandboxes and PVCs to release Azure Disk volumes
- Monitor Azure OpenAI usage via Azure Portal
- Use Azure Cost Management to track spending

## Security Considerations

- **Secrets Management**: Master key and API keys stored in Kubernetes secrets; Azure Key Vault available for additional secrets
- **Identity**: Workload Identity for Azure OpenAI access (no long-lived credentials)
- **Isolation**: Kata VM sandboxes run in VMs with separate kernel (KataMshvVmIsolation); Standard Pod sandboxes run with container-level isolation
- **Network**: Calico network policies, NAT Gateway for controlled egress
- **Tokens**: Rotate Slack/Feishu tokens regularly
- **API Keys**: Set expiration on LiteLLM API keys (default 30 days)
- **Registry**: Azure Container Registry with RBAC (admin access disabled)

## Sandbox Configuration Details

### Runtime Type Selection

When an Admin approves a new user, they select a **Runtime Type** for the user's sandbox:

| Runtime Type | Isolation | Node Pool | Gateway Mode | Use Case |
|---|---|---|---|---|
| **Kata VM** (default) | Hardware-level VM isolation via Microsoft Hypervisor | Kata node pool (Standard_D4s_v5) | PID 1 via `exec` | Production, sensitive workloads |
| **Standard Pod** | Container-level isolation (runc) | System node pool (Standard_D4as_v7) | Background process with restart scripts | Development, testing |

**Standard Pod differences:**
- No `runtimeClassName`, `nodeSelector`, or `tolerations` — runs on system node pool
- Gateway runs as background process (not PID 1), allowing restart without pod recreation
- Includes `/home/node/scripts/` with `start.sh`, `restart.sh`, `stop.sh` for gateway lifecycle
- `AGENTS.md` is auto-appended with gateway management instructions

### Runtime and Isolation

Each OpenClaw sandbox runs with:

- **Runtime**: `kata-vm-isolation` (Kata VM) or default runc (Standard Pod) — selected at user approval time
- **Node Selector**: `katacontainers.io/kata-runtime: "true"` — Kata VM only
- **Tolerations**: `kata=true:NoSchedule` — Kata VM only
- **Service Account**: `openclaw-sandbox` - With Workload Identity for Azure OpenAI access
- **Security Context**:
  - Runs as non-root user (UID 1000, GID 1000)
  - All Linux capabilities dropped
  - Privilege escalation disabled

### Storage and Persistence

- **Volume Type**: Azure Files Premium via CSI driver
- **Size**: 2Gi per sandbox
- **Mount Path**: `/home/node/.openclaw`
- **Access Mode**: ReadWriteMany
- **Lifecycle**: Persists across pod restarts, deleted with sandbox

### LiteLLM Integration

OpenClaw sandboxes connect to LiteLLM proxy with:

```json
{
  "models": {
    "providers": {
      "litellm": {
        "baseUrl": "http://litellm.litellm.svc.cluster.local:4000",
        "apiKey": "<generated-key>",
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
      "model": { "primary": "litellm/gpt-5.4" }
    }
  }
}
```

**Key Points**:
- Uses cluster-internal service DNS (no external network required)
- API key generated via LiteLLM master key
- OpenAI-compatible API format
- LiteLLM handles Azure OpenAI authentication via Workload Identity

### Networking

- **Pod Network**: Azure CNI Overlay (10.244.0.0/16)
- **Service CIDR**: 172.16.0.0/16
- **VNet CIDR**: 10.1.0.0/16
- **Service Discovery**: Kubernetes DNS
- **LiteLLM Access**: ClusterIP service in `litellm` namespace
- **External Access**: None (sandboxes are internal only)
- **Channel Access**: Outbound HTTPS to Slack/Feishu/Telegram APIs via NAT Gateway (Kata pods) or AKS LB SNAT (Standard pods)
- **Network Policy**: Calico

## References

- [OpenClaw Documentation](https://github.com/openclaw/openclaw)
- [LiteLLM Documentation](https://docs.litellm.ai/)
- [Kata Containers](https://katacontainers.io/)
- [AKS Documentation](https://learn.microsoft.com/en-us/azure/aks/)
- [Azure OpenAI](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [AKS Kata Containers](https://learn.microsoft.com/en-us/azure/aks/use-kata-containers)
- [Workload Identity](https://learn.microsoft.com/en-us/azure/aks/workload-identity-overview)
