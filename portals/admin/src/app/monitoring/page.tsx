'use client';

import AppLayout from '@/components/layout/app-layout';
import { BarChart2 } from 'lucide-react';

export default function MonitoringPage() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Monitoring</h1>
        <p className="text-sm text-gray-500 mt-1">Platform metrics and observability</p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-12 backdrop-blur-sm flex flex-col items-center justify-center">
        <BarChart2 size={48} className="text-gray-600 mb-4" />
        <h2 className="text-lg font-medium text-gray-300 mb-2">Coming Soon</h2>
        <p className="text-sm text-gray-500 text-center max-w-md">
          Monitoring dashboards with Prometheus and Grafana integration will be available in a future release.
        </p>
      </div>
    </AppLayout>
  );
}
