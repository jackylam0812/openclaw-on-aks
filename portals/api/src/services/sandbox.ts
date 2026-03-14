import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import db from '../db/client.js';

const LITELLM_URL = process.env.OPENCLAW_API_URL || 'http://litellm.litellm.svc.cluster.local:4000';
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || 'sk-1234';

interface ChannelConfig {
  feishu?: { appId: string; appSecret: string };
  slack?: { botToken: string; appToken: string };
  telegram?: { botToken: string };
}

function buildOpenClawConfig(channels: ChannelConfig = {}) {
  const config: any = {
    models: {
      providers: {
        litellm: {
          baseUrl: LITELLM_URL,
          apiKey: LITELLM_API_KEY,
          api: 'openai-completions',
          models: [
            {
              id: 'gpt-5.4',
              name: 'GPT-5.4 (LiteLLM)',
              reasoning: true,
              input: ['text', 'image'],
              contextWindow: 200000,
              maxTokens: 8192,
            },
          ],
        },
      },
    },
    agents: {
      defaults: {
        model: { primary: 'litellm/gpt-5.4' },
        workspace: '/home/node/.openclaw/workspace',
      },
    },
    gateway: {
      port: 18789,
      mode: 'local',
      bind: 'lan',
      auth: { mode: 'token', token: LITELLM_API_KEY },
      controlUi: { dangerouslyAllowHostHeaderOriginFallback: true },
      http: {
        endpoints: {
          chatCompletions: { enabled: true },
        },
      },
    },
  };

  const channelSection: any = {};
  const plugins: any = { entries: {} };

  if (channels.feishu) {
    channelSection.feishu = {
      enabled: true,
      appId: channels.feishu.appId,
      appSecret: channels.feishu.appSecret,
      domain: 'feishu',
      dmPolicy: 'open',
      allowFrom: ['*'],
    };
    plugins.entries.feishu = { enabled: true };
  }

  if (channels.slack) {
    channelSection.slack = {
      enabled: true,
      botToken: channels.slack.botToken,
      appToken: channels.slack.appToken,
      dmPolicy: 'open',
      allowFrom: ['*'],
    };
    plugins.entries.slack = { enabled: true };
  }

  if (channels.telegram) {
    channelSection.telegram = {
      enabled: true,
      botToken: channels.telegram.botToken,
      dmPolicy: 'open',
      allowFrom: ['*'],
    };
    plugins.entries.telegram = { enabled: true };
  }

  if (Object.keys(channelSection).length > 0) {
    config.channels = channelSection;
    config.plugins = plugins;
  }

  return config;
}

function buildSandboxManifest(sandboxName: string, namespace: string, userId: string, userEmail: string, channels: ChannelConfig = {}): object {
  const openclawConfig = buildOpenClawConfig(channels);
  const configJson = JSON.stringify(openclawConfig);
  const configBase64 = Buffer.from(configJson).toString('base64');

  return {
    apiVersion: 'agents.x-k8s.io/v1alpha1',
    kind: 'Sandbox',
    metadata: {
      name: sandboxName,
      namespace,
      labels: {
        'openclaw.ai/user-id': userId.slice(0, 8),
        'openclaw.ai/user-email': userEmail.replace('@', '-at-').replace(/\./g, '-'),
        'openclaw.ai/managed-by': 'portal-api',
      },
    },
    spec: {
      podTemplate: {
        metadata: {
          labels: {
            sandbox: sandboxName,
            'azure.workload.identity/use': 'true',
          },
        },
        spec: {
          runtimeClassName: 'kata-vm-isolation',
          serviceAccountName: 'openclaw-sandbox',
          automountServiceAccountToken: true,
          securityContext: {
            runAsUser: 1000,
            runAsGroup: 1000,
            fsGroup: 1000,
          },
          nodeSelector: {
            'katacontainers.io/kata-runtime': 'true',
          },
          tolerations: [
            {
              key: 'kata',
              operator: 'Equal',
              value: 'true',
              effect: 'NoSchedule',
            },
          ],
          containers: [
            {
              name: 'openclaw',
              image: 'ghcr.io/openclaw/openclaw:latest',
              imagePullPolicy: 'IfNotPresent',
              securityContext: {
                allowPrivilegeEscalation: false,
                readOnlyRootFilesystem: false,
                runAsNonRoot: true,
                capabilities: { drop: ['ALL'] },
              },
              command: [
                'sh',
                '-c',
                [
                  'mkdir -p /home/node/.openclaw/workspace',
                  `echo '${configBase64}' | base64 -d > /home/node/.openclaw/openclaw.json`,
                  'exec node dist/index.js gateway --bind=lan --port 18789 --allow-unconfigured --verbose',
                ].join('\n'),
              ],
              ports: [
                { containerPort: 18789 },
                { containerPort: 18790 },
              ],
              resources: {
                requests: { cpu: '1', memory: '2Gi' },
                limits: { cpu: '2', memory: '4Gi' },
              },
              volumeMounts: [
                {
                  name: 'workspaces-pvc',
                  mountPath: '/home/node/.openclaw',
                },
              ],
            },
          ],
          volumes: [
            { name: 'config-volume', emptyDir: {} },
          ],
        },
      },
      volumeClaimTemplates: [
        {
          metadata: { name: 'workspaces-pvc' },
          spec: {
            storageClassName: 'azure-disk-premium',
            accessModes: ['ReadWriteOnce'],
            resources: {
              requests: { storage: '2Gi' },
            },
          },
        },
      ],
    },
  };
}

function applyManifest(manifest: object, sandboxName: string): void {
  const manifestJson = JSON.stringify(manifest, null, 2);
  const tmpFile = join(tmpdir(), `sandbox-${sandboxName}.json`);
  try {
    writeFileSync(tmpFile, manifestJson, 'utf-8');
    execSync(`kubectl apply -f ${tmpFile}`, {
      encoding: 'utf-8',
      timeout: 30000,
    });
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

/**
 * Get the current IM channel configs for a user from the integrations table.
 */
function getUserChannels(userId: string): ChannelConfig {
  const integrations = db.prepare(
    'SELECT type, config FROM integrations WHERE user_id = ? AND status = ?'
  ).all(userId, 'connected') as { type: string; config: string }[];

  const channels: ChannelConfig = {};
  for (const integration of integrations) {
    const cfg = JSON.parse(integration.config);
    if (integration.type === 'feishu' && cfg.appId && cfg.appSecret) {
      channels.feishu = { appId: cfg.appId, appSecret: cfg.appSecret };
    } else if (integration.type === 'slack' && cfg.botToken && cfg.appToken) {
      channels.slack = { botToken: cfg.botToken, appToken: cfg.appToken };
    } else if (integration.type === 'telegram' && cfg.botToken) {
      channels.telegram = { botToken: cfg.botToken };
    }
  }
  return channels;
}

export async function provisionSandbox(userId: string, userEmail: string): Promise<void> {
  const sandboxName = `oc-${userId.slice(0, 8)}`;
  const namespace = 'openclaw';

  const channels = getUserChannels(userId);
  const manifest = buildSandboxManifest(sandboxName, namespace, userId, userEmail, channels);

  try {
    applyManifest(manifest, sandboxName);

    const endpoint = `http://${sandboxName}.${namespace}.svc.cluster.local:18789`;
    db.prepare('UPDATE sandboxes SET pod_name = ?, endpoint = ?, status = ? WHERE user_id = ?')
      .run(sandboxName, endpoint, 'creating', userId);

    console.log(`Sandbox ${sandboxName} created for user ${userEmail}`);
  } catch (error: any) {
    console.error('Sandbox provisioning failed:', error.message);
    db.prepare('UPDATE sandboxes SET status = ? WHERE user_id = ?')
      .run('failed', userId);
  }
}

/**
 * Re-apply sandbox manifest to update IM channel config (e.g. after connecting Feishu).
 * This triggers a rolling restart of the sandbox pod with the new config.
 */
export async function updateSandboxChannels(userId: string): Promise<void> {
  const sandbox = db.prepare('SELECT * FROM sandboxes WHERE user_id = ?').get(userId) as any;
  if (!sandbox || !sandbox.pod_name) {
    console.warn(`No sandbox found for user ${userId}, skipping channel update`);
    return;
  }

  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as any;
  if (!user) return;

  const channels = getUserChannels(userId);
  const manifest = buildSandboxManifest(sandbox.pod_name, 'openclaw', userId, user.email, channels);

  try {
    applyManifest(manifest, sandbox.pod_name);
    console.log(`Sandbox ${sandbox.pod_name} updated with new channel config`);
  } catch (error: any) {
    console.error(`Failed to update sandbox channels for ${sandbox.pod_name}:`, error.message);
  }
}

export function getSandboxStatus(userId: string) {
  const sandbox = db.prepare('SELECT * FROM sandboxes WHERE user_id = ?').get(userId) as any;
  if (!sandbox) return null;

  if (sandbox.pod_name && (sandbox.status === 'creating' || sandbox.status === 'provisioning')) {
    try {
      const result = execSync(
        `kubectl get pod -n openclaw -l sandbox=${sandbox.pod_name} -o jsonpath='{.items[0].status.phase}'`,
        { encoding: 'utf-8', timeout: 10000 }
      ).trim().replace(/'/g, '');

      if (result === 'Running') {
        db.prepare('UPDATE sandboxes SET status = ?, ready_at = CURRENT_TIMESTAMP WHERE user_id = ?')
          .run('running', userId);
        sandbox.status = 'running';
        sandbox.ready_at = new Date().toISOString();
      } else if (result === 'Failed') {
        db.prepare('UPDATE sandboxes SET status = ? WHERE user_id = ?')
          .run('failed', userId);
        sandbox.status = 'failed';
      }
    } catch {
      // kubectl not available or pod not found yet, keep DB status
    }
  }

  return sandbox;
}
