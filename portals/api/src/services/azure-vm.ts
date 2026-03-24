import { execSync } from 'child_process';
import db from '../db/client.js';

// Azure resource configuration for VM sandboxes
const RESOURCE_GROUP = process.env.AZURE_VM_RESOURCE_GROUP || 'oc-kata-aks-ext01-rg';
const LOCATION = process.env.AZURE_VM_LOCATION || 'southeastasia';
const VNET_NAME = process.env.AZURE_VM_VNET || 'oc-kata-aks-ext01-vnet';
const SUBNET_NAME = process.env.AZURE_VM_SUBNET || 'oc-kata-aks-ext01-vm-subnet';
const VM_SIZE = process.env.AZURE_VM_SIZE || 'Standard_B2ats_v2';
const VM_IMAGE = process.env.AZURE_VM_IMAGE || 'Ubuntu2404';
const NSG_NAME = process.env.AZURE_VM_NSG || 'oc-openclaw-vm-nsg';

const LITELLM_URL = process.env.OPENCLAW_API_URL || 'http://litellm.litellm.svc.cluster.local:4000';
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || 'sk-1234';

// Azure SP authentication
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;

let azLoggedIn = false;

function ensureAzLogin(): void {
  if (azLoggedIn) return;
  if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_TENANT_ID) {
    throw new Error('Azure SP credentials not configured (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID)');
  }
  try {
    execSync(
      `az login --service-principal -u "${AZURE_CLIENT_ID}" -p "${AZURE_CLIENT_SECRET}" --tenant "${AZURE_TENANT_ID}" -o none`,
      { encoding: 'utf-8', timeout: 30000 }
    );
    azLoggedIn = true;
    console.log('Azure CLI: logged in with service principal');
  } catch (e: any) {
    throw new Error(`Azure login failed: ${e.stderr || e.message}`);
  }
}

function azCmd(args: string, timeoutMs: number = 120000): string {
  ensureAzLogin();
  try {
    return execSync(`az ${args}`, { encoding: 'utf-8', timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });
  } catch (e: any) {
    console.error('az cli error:', e.message);
    throw new Error(`az cli failed: ${e.stderr || e.message}`);
  }
}

/**
 * Ensure the VM subnet exists in the VNet.
 */
function ensureSubnet(): void {
  try {
    azCmd(`network vnet subnet show --resource-group ${RESOURCE_GROUP} --vnet-name ${VNET_NAME} --name ${SUBNET_NAME} -o none`, 30000);
  } catch {
    console.log(`Creating VM subnet ${SUBNET_NAME}...`);
    azCmd(`network vnet subnet create --resource-group ${RESOURCE_GROUP} --vnet-name ${VNET_NAME} --name ${SUBNET_NAME} --address-prefixes 10.1.2.0/24`, 60000);
  }
}

/**
 * Ensure the NSG exists with required rules.
 */
function ensureNSG(): void {
  try {
    azCmd(`network nsg show --resource-group ${RESOURCE_GROUP} --name ${NSG_NAME} -o none`, 30000);
  } catch {
    console.log(`Creating NSG ${NSG_NAME}...`);
    azCmd(`network nsg create --resource-group ${RESOURCE_GROUP} --name ${NSG_NAME} --location ${LOCATION}`, 60000);
    // Allow SSH (22) for management
    azCmd(`network nsg rule create --resource-group ${RESOURCE_GROUP} --nsg-name ${NSG_NAME} --name AllowSSH --priority 1000 --access Allow --direction Inbound --protocol Tcp --destination-port-ranges 22`, 30000);
    // Allow OpenClaw Gateway (18789)
    azCmd(`network nsg rule create --resource-group ${RESOURCE_GROUP} --nsg-name ${NSG_NAME} --name AllowGateway --priority 1010 --access Allow --direction Inbound --protocol Tcp --destination-port-ranges 18789`, 30000);
  }
}

/**
 * Build the cloud-init script to install and configure OpenClaw on the VM.
 */
function buildCloudInit(litellmUrl: string, litellmApiKey: string): string {
  return `#!/bin/bash
set -e

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install OpenClaw
npm install -g openclaw@latest

# Create openclaw user home
useradd -m -s /bin/bash ocuser || true
mkdir -p /home/ocuser/.openclaw/workspace

# Write OpenClaw config
cat > /home/ocuser/.openclaw/openclaw.json << 'OCEOF'
{
  "models": {
    "providers": {
      "litellm": {
        "baseUrl": "${litellmUrl}",
        "apiKey": "${litellmApiKey}",
        "api": "openai-completions",
        "models": [
          {
            "id": "gpt-5.4",
            "name": "GPT-5.4 (LiteLLM)",
            "reasoning": true,
            "input": ["text", "image"],
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": { "primary": "litellm/gpt-5.4" },
      "models": { "litellm/gpt-5.4": {} },
      "workspace": "/home/ocuser/.openclaw/workspace"
    }
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "lan",
    "auth": { "mode": "token", "token": "${litellmApiKey}" },
    "controlUi": { "dangerouslyAllowHostHeaderOriginFallback": true },
    "http": {
      "endpoints": {
        "chatCompletions": { "enabled": true }
      }
    }
  }
}
OCEOF

chown -R ocuser:ocuser /home/ocuser/.openclaw

# Create systemd service
cat > /etc/systemd/system/openclaw-gateway.service << 'SVCEOF'
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
User=ocuser
WorkingDirectory=/home/ocuser/.openclaw
ExecStart=/usr/bin/openclaw gateway run --bind=lan --port 18789 --verbose
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable openclaw-gateway
systemctl start openclaw-gateway
`;
}

/**
 * Provision an Azure VM with OpenClaw installed.
 */
export async function provisionAzureVM(
  userId: string,
  userEmail: string
): Promise<{ vmName: string; vmResourceId: string; publicIp: string }> {
  const vmName = `oc-vm-${userId.slice(0, 8)}`;

  console.log(`Provisioning Azure VM ${vmName} for user ${userEmail}...`);

  // Ensure infrastructure
  ensureSubnet();
  ensureNSG();

  // Write cloud-init to temp file
  const cloudInit = buildCloudInit(LITELLM_URL, LITELLM_API_KEY);
  const tmpFile = `/tmp/cloud-init-${vmName}.sh`;
  const { writeFileSync, unlinkSync } = await import('fs');
  writeFileSync(tmpFile, cloudInit, 'utf-8');

  try {
    // Create VM
    const createResult = azCmd(
      `vm create ` +
      `--resource-group ${RESOURCE_GROUP} ` +
      `--name ${vmName} ` +
      `--location ${LOCATION} ` +
      `--size ${VM_SIZE} ` +
      `--image ${VM_IMAGE} ` +
      `--admin-username ocadmin ` +
      `--generate-ssh-keys ` +
      `--vnet-name ${VNET_NAME} ` +
      `--subnet ${SUBNET_NAME} ` +
      `--nsg ${NSG_NAME} ` +
      `--public-ip-sku Standard ` +
      `--custom-data ${tmpFile} ` +
      `--tags openclaw-sandbox=true user-id=${userId.slice(0, 8)} user-email=${userEmail.replace('@', '_at_')} ` +
      `--output json`,
      300000 // 5 min timeout for VM creation
    );

    const vmInfo = JSON.parse(createResult);
    const publicIp = vmInfo.publicIpAddress || '';
    const vmResourceId = vmInfo.id || '';

    console.log(`Azure VM ${vmName} created. IP: ${publicIp}, ID: ${vmResourceId}`);

    return { vmName, vmResourceId, publicIp };
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

/**
 * Delete an Azure VM and all associated resources (NIC, Disk, Public IP).
 */
export async function deleteAzureVM(vmName: string): Promise<void> {
  console.log(`Deleting Azure VM ${vmName}...`);

  try {
    // Delete VM with associated resources (NIC, OS disk, data disks)
    azCmd(
      `vm delete --resource-group ${RESOURCE_GROUP} --name ${vmName} --force-deletion yes --yes`,
      180000
    );
    console.log(`VM ${vmName} deleted`);
  } catch (e: any) {
    console.warn(`Failed to delete VM ${vmName}: ${e.message}`);
  }

  // Clean up NIC
  try {
    azCmd(`network nic delete --resource-group ${RESOURCE_GROUP} --name ${vmName}VMNic --no-wait`, 30000);
  } catch {}

  // Clean up Public IP
  try {
    azCmd(`network public-ip delete --resource-group ${RESOURCE_GROUP} --name ${vmName}PublicIP --no-wait`, 30000);
  } catch {}

  // Clean up OS Disk
  try {
    azCmd(`disk delete --resource-group ${RESOURCE_GROUP} --name ${vmName}OSDisk --yes --no-wait`, 30000);
  } catch {}
}

/**
 * Get Azure VM status (power state).
 */
export async function getAzureVMStatus(vmName: string): Promise<string> {
  try {
    const result = azCmd(
      `vm get-instance-view --resource-group ${RESOURCE_GROUP} --name ${vmName} --query "instanceView.statuses[?starts_with(code,'PowerState/')].displayStatus" -o tsv`,
      30000
    );
    return result.trim() || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

/**
 * List all OpenClaw Azure VMs.
 */
export async function listAzureVMs(): Promise<any[]> {
  try {
    const result = azCmd(
      `vm list --resource-group ${RESOURCE_GROUP} --query "[?tags.\"openclaw-sandbox\"=='true'].{name:name, vmSize:hardwareProfile.vmSize, location:location, resourceId:id}" -o json`,
      30000
    );
    const vms = JSON.parse(result);

    // Enrich with power state and public IP from DB
    const enriched = [];
    for (const vm of vms) {
      const status = await getAzureVMStatus(vm.name);
      const sandbox = db.prepare('SELECT vm_public_ip, user_id FROM sandboxes WHERE vm_name = ?').get(vm.name) as any;
      let userEmail = '';
      if (sandbox?.user_id) {
        const user = db.prepare('SELECT email FROM users WHERE id = ?').get(sandbox.user_id) as any;
        userEmail = user?.email || '';
      }
      enriched.push({
        ...vm,
        status,
        publicIp: sandbox?.vm_public_ip || '',
        userEmail,
      });
    }
    return enriched;
  } catch (e: any) {
    console.error('Failed to list Azure VMs:', e.message);
    return [];
  }
}
