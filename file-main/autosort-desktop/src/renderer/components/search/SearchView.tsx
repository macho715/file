import React, { useEffect } from 'react';
import { useSearch } from '../../hooks/useSearch';

const DOC_TYPE_COLORS: Record<string, string> = {
  dev_code: 'bg-blue-100 text-blue-700',
  dev_note: 'bg-sky-100 text-sky-700',
  dev_archive: 'bg-indigo-100 text-indigo-700',
  ops_doc: 'bg-amber-100 text-amber-700',
  photo: 'bg-green-100 text-green-700',
  other: 'bg-gray-100 text-gray-600',
};

interface SearchViewProps {
  initialQuery?: string;
}

export default function SearchView({ initialQuery }: SearchViewProps) {
  const { results, loading, query, search } = useSearch();

  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      search(initialQuery);
    }
  }, [initialQuery]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Search</h2>

      <div className="flex gap-3">
        <input
          type="text"
          defaultValue={initialQuery}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              search((e.target as HTMLInputElement).value);
            }
          }}
          placeholder="Search by filename, type, project, vendor..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading && (
        <div className="text-gray-400 py-8 text-center">Searching...</div>
      )}

      {!loading && results.length === 0 && query && (
        <div className="text-gray-400 py-8 text-center">
          No results for "{query}"
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            {results.length} result{results.length !== 1 ? 's' : ''} for "
            {query}"
          </p>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
            {results.map((file, i) => (
              <div
                key={i}
                className="p-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800">
                    {String(file.filename ?? '')}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      DOC_TYPE_COLORS[String(file.doc_type ?? '')] ??
                      'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {String(file.doc_type ?? '')}
                  </span>
                  {file.project && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
                      {String(file.project)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1 truncate">
                  {String(file.current_path ?? file.original_path ?? '')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
