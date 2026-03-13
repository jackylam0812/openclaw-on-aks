import { execSync } from 'child_process';
import db from '../db/client.js';

export async function provisionSandbox(userId: string, userEmail: string): Promise<void> {
  const sandboxName = `oc-${userId.slice(0, 8)}`;
  const namespace = 'openclaw';

  const manifest = JSON.stringify({
    apiVersion: 'agents.x-k8s.io/v1alpha1',
    kind: 'Sandbox',
    metadata: {
      name: sandboxName,
      namespace: namespace,
      labels: {
        'openclaw.ai/user-id': userId.slice(0, 8),
        'openclaw.ai/user-email': userEmail.replace('@', '-at-').replace(/\./g, '-'),
      }
    },
    spec: {
      runtimeClassName: 'kata-mshv-vm-isolation',
      resources: {
        limits: { cpu: '2', memory: '4Gi' },
        requests: { cpu: '1', memory: '2Gi' }
      },
      ttl: '24h'
    }
  });

  try {
    execSync(`echo '${manifest.replace(/'/g, "\\'")}' | kubectl apply -f -`, {
      encoding: 'utf-8',
      timeout: 30000
    });

    db.prepare('UPDATE sandboxes SET pod_name = ?, status = ? WHERE user_id = ?')
      .run(sandboxName, 'creating', userId);
  } catch (error: any) {
    console.error('Sandbox provisioning failed:', error.message);
    db.prepare('UPDATE sandboxes SET status = ? WHERE user_id = ?')
      .run('failed', userId);
  }
}

export function getSandboxStatus(userId: string) {
  return db.prepare('SELECT * FROM sandboxes WHERE user_id = ?').get(userId);
}
