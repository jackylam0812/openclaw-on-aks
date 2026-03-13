'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/app-layout';
import { getNodes, getPods } from '@/lib/api';

interface Node {
  name: string;
  status: string;
  roles: string;
  cpu: string;
  memory: string;
  kubeletVersion: string;
}

interface Pod {
  namespace: string;
  name: string;
  status: string;
  restarts: number;
  age: string;
}

export default function ClusterPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getNodes().then((data) => setNodes(data.nodes || data || [])).catch(() => {});
    getPods().then((data) => setPods(data.pods || data || [])).catch(() => {});
  }, []);

  const namespaces = [...new Set(pods.map((p) => p.namespace))].sort();
  const filteredPods = filter ? pods.filter((p) => p.namespace === filter) : pods;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Cluster</h1>
        <p className="text-sm text-gray-500 mt-1">Kubernetes cluster status and resources</p>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Nodes ({nodes.length})</h2>
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
              <div className="space-y-1 text-xs text-gray-500">
                <p>Role: {node.roles || 'worker'}</p>
                <p>CPU: {node.cpu} | Memory: {node.memory}</p>
                <p>Kubelet: {node.kubeletVersion}</p>
              </div>
            </div>
          ))}
          {nodes.length === 0 && (
            <p className="text-sm text-gray-600 col-span-3">No node data available</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-300">Pods ({filteredPods.length})</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-gray-300 focus:outline-none focus:border-purple-500/50"
          >
            <option value="">All namespaces</option>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden backdrop-blur-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Namespace</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Restarts</th>
              </tr>
            </thead>
            <tbody>
              {filteredPods.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-600">
                    No pods found
                  </td>
                </tr>
              ) : (
                filteredPods.map((pod) => (
                  <tr key={`${pod.namespace}/${pod.name}`} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-3 text-gray-400">{pod.namespace}</td>
                    <td className="px-4 py-3 text-gray-200">{pod.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          pod.status === 'Running'
                            ? 'bg-green-500/10 text-green-400'
                            : pod.status === 'Succeeded'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-yellow-500/10 text-yellow-400'
                        }`}
                      >
                        {pod.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{pod.restarts ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
