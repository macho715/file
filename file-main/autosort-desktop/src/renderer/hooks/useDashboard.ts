import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/ipc-client';

export interface DashboardStats {
  total: number;
  byStatus: { status: string; c: number }[];
  byDocType: { doc_type: string; c: number }[];
  recentMoves: Record<string, unknown>[];
}

export function useDashboard(refreshInterval = 5000) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const dispose = api.onFileProcessed(() => {
      refresh();
    });
    const interval = setInterval(refresh, refreshInterval);
    return () => {
      clearInterval(interval);
      dispose();
    };
  }, [refresh, refreshInterval]);

  return { stats, loading, error, refresh };
}
