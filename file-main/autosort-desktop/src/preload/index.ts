import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Dashboard
  getStats: () => ipcRenderer.invoke('stats:dashboard'),

  // Files
  searchFiles: (query: string, limit?: number) =>
    ipcRenderer.invoke('files:search', query, limit),
  listFiles: (filters?: { status?: string; doc_type?: string; limit?: number }) =>
    ipcRenderer.invoke('files:list', filters),
  getFile: (id: number) => ipcRenderer.invoke('files:get', id),

  // Watchers
  listWatchers: () => ipcRenderer.invoke('watchers:list'),
  addWatcher: (path: string, label: string, recursive: boolean) =>
    ipcRenderer.invoke('watchers:add', path, label, recursive),
  removeWatcher: (id: number) => ipcRenderer.invoke('watchers:remove', id),
  toggleWatcher: (id: number, enabled: boolean) =>
    ipcRenderer.invoke('watchers:toggle', id, enabled),
  sweepWatchers: (id?: number) => ipcRenderer.invoke('watchers:sweepAll', id),

  // Quarantine
  listQuarantine: () => ipcRenderer.invoke('quarantine:list'),
  approveQuarantine: (id: number) => ipcRenderer.invoke('quarantine:approve', id),
  reclassifyQuarantine: (
    id: number,
    overrides?: {
      doc_type?: string;
      project?: string;
      vendor?: string;
      tags?: string[];
      reasons?: string[];
    }
  ) => ipcRenderer.invoke('quarantine:reclassify', id, overrides),
  deleteQuarantine: (id: number) => ipcRenderer.invoke('quarantine:delete', id),

  // Ledger
  listLedger: (limit?: number) => ipcRenderer.invoke('ledger:list', limit),

  // Settings
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) =>
    ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),

  // App
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  reloadRules: () => ipcRenderer.invoke('app:reloadRules'),

  // Events
  onFileProcessed: (callback: (data: {
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
    originalName: string;
  }) => void) => {
    const handler = (
      _event: unknown,
      data: {
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
        originalName: string;
      }
    ) => callback(data);
    ipcRenderer.on('file:processed', handler);
    return () => ipcRenderer.removeListener('file:processed', handler);
  },
};

contextBridge.exposeInMainWorld('autosort', api);

export type AutosortAPI = typeof api;
