'use client';

import AppLayout from '@/components/layout/app-layout';

const models = [
  { name: 'gpt-5.4', provider: 'Azure OpenAI', region: 'eastus2', status: 'active' },
];

export default function ModelsPage() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Models</h1>
        <p className="text-sm text-gray-500 mt-1">AI models configured in LiteLLM</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map((model) => (
          <div
            key={model.name}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-200">{model.name}</h3>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  model.status === 'active'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-gray-500/10 text-gray-500'
                }`}
              >
                {model.status}
              </span>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">
                Provider: <span className="text-gray-400">{model.provider}</span>
              </p>
              <p className="text-xs text-gray-500">
                Region: <span className="text-gray-400">{model.region}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
