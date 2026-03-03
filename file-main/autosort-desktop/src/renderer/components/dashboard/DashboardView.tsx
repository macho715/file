import React from 'react';
import { useDashboard } from '../../hooks/useDashboard';

function StatsCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function CategoryBar({
  items,
}: {
  items: { doc_type: string; c: number }[];
}) {
  const total = items.reduce((acc, i) => acc + i.c, 0) || 1;
  const colors: Record<string, string> = {
    dev_code: 'bg-blue-500',
    dev_note: 'bg-blue-300',
    dev_archive: 'bg-blue-700',
    ops_doc: 'bg-amber-500',
    photo: 'bg-green-500',
    other: 'bg-gray-400',
    temp: 'bg-red-400',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Category Distribution
      </h3>
      <div className="flex h-6 rounded-full overflow-hidden mb-3">
        {items.map((item) => (
          <div
            key={item.doc_type}
            className={`${colors[item.doc_type] || 'bg-gray-300'}`}
            style={{ width: `${(item.c / total) * 100}%` }}
            title={`${item.doc_type}: ${item.c}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {items.map((item) => (
          <div key={item.doc_type} className="flex items-center gap-1.5 text-xs">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                colors[item.doc_type] || 'bg-gray-300'
              }`}
            />
            <span className="text-gray-600">
              {item.doc_type}: {item.c}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentActivity({
  moves,
}: {
  moves: Record<string, unknown>[];
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Recent Activity
      </h3>
      <div className="space-y-2 max-h-80 overflow-auto">
        {moves.length === 0 && (
          <p className="text-sm text-gray-400">No recent activity</p>
        )}
        {moves.map((move, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">
                {String(move.before_path ?? move.before ?? '').split(/[\\/]/).pop()}
              </p>
              <p className="text-xs text-gray-400 truncate">
                → {String(move.after_path ?? move.after ?? '')}
              </p>
            </div>
            <div className="ml-3 flex-shrink-0">
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  move.reason === 'auto_apply'
                    ? 'bg-green-100 text-green-700'
                    : move.reason === 'duplicate_hash'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                }`}
              >
                {String(move.reason ?? '')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardView() {
  const { stats, loading, error } = useDashboard();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!stats) return null;

  const statusMap = Object.fromEntries(
    stats.byStatus.map((s) => [s.status, s.c])
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">Dashboard</h2>

      <div className="grid grid-cols-4 gap-4">
        <StatsCard label="Total Files" value={stats.total} color="text-gray-900" />
        <StatsCard
          label="Moved"
          value={statusMap['moved'] ?? 0}
          color="text-green-600"
        />
        <StatsCard
          label="Quarantined"
          value={statusMap['quarantined'] ?? 0}
          color="text-amber-600"
        />
        <StatsCard
          label="Duplicates"
          value={statusMap['duplicate'] ?? 0}
          color="text-blue-600"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <CategoryBar items={stats.byDocType} />
        <RecentActivity moves={stats.recentMoves} />
      </div>
    </div>
  );
}
