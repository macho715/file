import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/ipc-client';

export function useFiles(filters?: {
  status?: string;
  doc_type?: string;
  limit?: number;
}) {
  const [files, setFiles] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listFiles(filters);
      setFiles(data);
    } catch (e) {
      console.error('Failed to load files', e);
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.doc_type, filters?.limit]);

  useEffect(() => {
    refresh();
    const dispose = api.onFileProcessed(() => {
      refresh();
    });
    return dispose;
  }, [refresh]);

  return { files, loading, refresh };
}
