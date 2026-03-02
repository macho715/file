import React, { useState } from 'react';
import { useFiles } from '../../hooks/useFiles';

const DOC_TYPE_COLORS: Record<string, string> = {
  dev_code: 'bg-blue-100 text-blue-700',
  dev_note: 'bg-sky-100 text-sky-700',
  dev_archive: 'bg-indigo-100 text-indigo-700',
  ops_doc: 'bg-amber-100 text-amber-700',
  photo: 'bg-green-100 text-green-700',
  other: 'bg-gray-100 text-gray-600',
  temp: 'bg-red-100 text-red-700',
};

export default function FileBrowser() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [docTypeFilter, setDocTypeFilter] = useState<string | undefined>();
  const { files, loading, refresh } = useFiles({
    status: statusFilter,
    doc_type: docTypeFilter,
    limit: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Files</h2>
        <button
          onClick={refresh}
          className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={statusFilter ?? ''}
          onChange={(e) => setStatusFilter(e.target.value || undefined)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
        >
          <option value="">All Status</option>
          <option value="moved">Moved</option>
          <option value="quarantined">Quarantined</option>
          <option value="duplicate">Duplicate</option>
          <option value="pending">Pending</option>
          <option value="error">Error</option>
        </select>
        <select
          value={docTypeFilter ?? ''}
          onChange={(e) => setDocTypeFilter(e.target.value || undefined)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
        >
          <option value="">All Types</option>
          <option value="dev_code">Dev Code</option>
          <option value="dev_note">Dev Note</option>
          <option value="dev_archive">Dev Archive</option>
          <option value="ops_doc">Ops Doc</option>
          <option value="photo">Photo</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* File Table */}
      {loading ? (
        <div className="text-gray-400 py-8 text-center">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Filename
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Confidence
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Path
                </th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No files found
                  </td>
                </tr>
              )}
              {files.map((file, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-gray-800 truncate max-w-xs">
                    {String(file.filename ?? '')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        DOC_TYPE_COLORS[String(file.doc_type ?? '')] ??
                        'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {String(file.doc_type ?? 'unknown')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {String(file.status ?? '')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            Number(file.confidence ?? 0) >= 0.9
                              ? 'bg-green-500'
                              : Number(file.confidence ?? 0) >= 0.7
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                          style={{
                            width: `${Number(file.confidence ?? 0) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {(Number(file.confidence ?? 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 truncate max-w-xs text-xs">
                    {String(file.current_path ?? '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
