import { execSync } from 'child_process';

function kubectl(args: string): string {
  try {
    return execSync(`kubectl ${args}`, { encoding: 'utf-8', timeout: 10000 });
  } catch (e: any) {
    console.error('kubectl error:', e.message);
    throw new Error(`kubectl failed: ${e.message}`);
  }
}

export async function getNodes() {
  const output = kubectl('get nodes -o json');
  const data = JSON.parse(output);
  return data.items.map((node: any) => ({
    name: node.metadata.name,
    status: node.status.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
    roles: Object.keys(node.metadata.labels || {})
      .filter(l => l.startsWith('node-role.kubernetes.io/'))
      .map(l => l.replace('node-role.kubernetes.io/', ''))
      .join(', ') || 'worker',
    cpu: node.status.capacity?.cpu || 'N/A',
    memory: node.status.capacity?.memory || 'N/A',
    kubeletVersion: node.status.nodeInfo?.kubeletVersion || 'N/A',
  }));
}

export async function getPods() {
  const output = kubectl('get pods -A -o json');
  const data = JSON.parse(output);
  return data.items.map((pod: any) => ({
    namespace: pod.metadata.namespace,
    name: pod.metadata.name,
    status: pod.status.phase,
    restarts: pod.status.containerStatuses?.[0]?.restartCount || 0,
    age: pod.metadata.creationTimestamp,
  }));
}
