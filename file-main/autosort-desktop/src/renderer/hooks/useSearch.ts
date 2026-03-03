import { useState, useCallback } from 'react';
import { api } from '../lib/ipc-client';

export function useSearch() {
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.searchFiles(q);
      setResults(data);
    } catch (e) {
      console.error('Search failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, query, search };
}
