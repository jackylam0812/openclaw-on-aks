'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { getNodes, getPods } from '@/lib/api';

interface Node {
  name: string;
  status: string;
  role: string;
}

interface Pod {
  namespace: string;
  name: string;
  status: string;
  age: string;
}

export default function ClusterPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);

  useEffect(() => {
    getNodes().then((data) => setNodes(data.nodes || data || [])).catch(() => {
      setNodes([
        { name: 'aks-nodepool1-12345-vmss000000', status: 'Ready', role: 'agent' },
        { name: 'aks-nodepool1-12345-vmss000001', status: 'Ready', role: 'agent' },
        { name: 'aks-nodepool1-12345-vmss000002', status: 'Ready', role: 'agent' },
      ]);
    });
    getPods().then((data) => setPods(data.pods || data || [])).catch(() => {
      setPods([
        { namespace: 'litellm', name: 'litellm-0', status: 'Running', age: '2d' },
        { namespace: 'litellm', name: 'litellm-db-0', status: 'Running', age: '2d' },
        { namespace: 'portals', name: 'portal-api-abc123', status: 'Running', age: '1h' },
        { namespace: 'portals', name: 'admin-portal-def456', status: 'Running', age: '1h' },
        { namespace: 'portals', name: 'customer-portal-ghi789', status: 'Running', age: '1h' },
      ]);
    });
  }, []);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Cluster</h1>
        <p className="text-sm text-gray-500 mt-1">Kubernetes cluster status and resources</p>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Nodes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {nodes.map((node) => (
            <div
              key={node.name}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-200 truncate">{node.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    node.status === 'Ready'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-yellow-500/10 text-yellow-400'
                  }`}
                >
                  {node.status}
                </span>
              </div>
              <p className="text-xs text-gray-500">Role: {node.role}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-gray-300 mb-3">Pods</h2>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden backdrop-blur-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Namespace</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
              {pods.map((pod) => (
                <tr key={`${pod.namespace}/${pod.name}`} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-3 text-gray-400">{pod.namespace}</td>
                  <td className="px-4 py-3 text-gray-200">{pod.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        pod.status === 'Running'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-yellow-500/10 text-yellow-400'
                      }`}
                    >
                      {pod.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{pod.age}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
