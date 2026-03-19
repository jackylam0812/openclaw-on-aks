import { execSync } from 'child_process';

function kubectl(args: string): string {
  try {
    return execSync(`kubectl ${args}`, { encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
  } catch (e: any) {
    console.error('kubectl error:', e.message);
    throw new Error(`kubectl failed: ${e.message}`);
  }
}

export async function getNodes() {
  const output = kubectl('get nodes -o json');
  const data = JSON.parse(output);
  return data.items.map((node: any) => {
    const labels = node.metadata.labels || {};
    const isKata = labels['katacontainers.io/kata-runtime'] === 'true' || (labels['agentpool'] || '').includes('kata');
    return {
      name: node.metadata.name,
      status: node.status.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
      roles: Object.keys(labels)
        .filter(l => l.startsWith('node-role.kubernetes.io/'))
        .map(l => l.replace('node-role.kubernetes.io/', ''))
        .join(', ') || 'worker',
      pool: isKata ? 'kata' : 'system',
      cpu: node.status.capacity?.cpu || 'N/A',
      memory: node.status.capacity?.memory || 'N/A',
      kubeletVersion: node.status.nodeInfo?.kubeletVersion || 'N/A',
    };
  });
}

export async function getPods(namespace?: string) {
  const nsArg = namespace ? `-n ${namespace}` : '-A';
  const output = kubectl(`get pods ${nsArg} -o json`);
  const data = JSON.parse(output);
  return data.items.map((pod: any) => ({
    namespace: pod.metadata.namespace,
    name: pod.metadata.name,
    status: pod.status.phase,
    restarts: pod.status.containerStatuses?.[0]?.restartCount || 0,
    age: pod.metadata.creationTimestamp,
    nodeName: pod.spec.nodeName || '',
  }));
}
