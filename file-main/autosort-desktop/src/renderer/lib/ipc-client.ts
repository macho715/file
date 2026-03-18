type DashboardStats = {
  total: number;
  byStatus: { status: string; c: number }[];
  byDocType: { doc_type: string; c: number }[];
  recentMoves: Record<string, unknown>[];
};

type FileRow = Record<string, unknown>;

type FileProcessResult = {
  fileId: number;
  filename: string;
  originalPath: string;
  currentPath: string;
  doc_type: string;
  confidence: number;
  status: string;
  rule_id: string | null;
  classification_source: string;
  tags: string[];
  reasons: string[];
  sha256: string;
  originalName?: string;
};

type API = {
  getStats: () => Promise<DashboardStats>;
  searchFiles: (query: string, limit?: number) => Promise<FileRow[]>;
  listFiles: (filters?: {
    status?: string;
    doc_type?: string;
    limit?: number;
  }) => Promise<FileRow[]>;
  getFile: (id: number) => Promise<FileRow | null>;
  listWatchers: () => Promise<
    { id: number; path: string; enabled: number | boolean; recursive: number | boolean; label: string }[]
  >;
  addWatcher: (path: string, label: string, recursive: boolean) => Promise<unknown>;
  removeWatcher: (id: number) => Promise<boolean>;
  toggleWatcher: (id: number, enabled: boolean) => Promise<boolean>;
  sweepWatchers: (id?: number) => Promise<number>;
  listQuarantine: () => Promise<FileRow[]>;
  approveQuarantine: (id: number) => Promise<boolean>;
  reclassifyQuarantine: (
    id: number,
    overrides?: {
      doc_type?: string;
      project?: string;
      vendor?: string;
      tags?: string[];
      reasons?: string[];
    }
  ) => Promise<boolean>;
  deleteQuarantine: (id: number) => Promise<boolean>;
  listLedger: (limit?: number) => Promise<unknown[]>;
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<boolean>;
  getAllSettings: () => Promise<{ key: string; value: string }[]>;
  getAppInfo: () => Promise<{
    root: string;
    watchedFolders: string[];
    rulesCount: number;
    llmUrl: string;
    llmType: string;
  }>;
  reloadRules: () => Promise<{ success: boolean; rulesCount: number }>;
  onFileProcessed: (
    callback: (data: FileProcessResult) => void
  ) => () => void;
};

interface PreloadAPI extends API {}

export const api = (window as unknown as { autosort: PreloadAPI }).autosort;
