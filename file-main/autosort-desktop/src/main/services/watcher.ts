import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

// chokidar is imported dynamically to avoid issues in test environments
let chokidar: typeof import('chokidar') | null = null;

async function getChokidar() {
  if (!chokidar) {
    chokidar = await import('chokidar');
  }
  return chokidar;
}

export interface WatchedFolder {
  id: number;
  path: string;
  enabled: boolean;
  recursive: boolean;
  label: string;
}

export class FileWatcher extends EventEmitter {
  private watchers: Map<string, unknown> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private debounceMs: number;

  constructor(debounceMs = 2000) {
    super();
    this.debounceMs = debounceMs;
  }

  async addFolder(folder: WatchedFolder): Promise<void> {
    if (this.watchers.has(folder.path)) return;
    if (!fs.existsSync(folder.path)) return;

    const chok = await getChokidar();
    const watcher = chok.watch(folder.path, {
      depth: folder.recursive ? undefined : 0,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 },
      ignored: /(^|[/\\])\../, // ignore dotfiles
    });

    watcher.on('add', (filePath: string) => {
      this.debouncedEmit(filePath);
    });

    watcher.on('change', (filePath: string) => {
      this.debouncedEmit(filePath);
    });

    this.watchers.set(folder.path, watcher);
  }

  async removeFolder(folderPath: string): Promise<void> {
    const watcher = this.watchers.get(folderPath) as {
      close: () => Promise<void>;
    } | undefined;
    if (watcher) {
      await watcher.close();
      this.watchers.delete(folderPath);
    }
  }

  private debouncedEmit(filePath: string): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      this.emit('file', filePath);
    }, this.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  async sweepExisting(folderPath: string, recursive = false): Promise<number> {
    if (!fs.existsSync(folderPath)) return 0;

    let count = 0;
    const walk = (currentPath: string): void => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          if (recursive) {
            walk(fullPath);
          }
          continue;
        }
        if (entry.isFile()) {
          count += 1;
          this.emit('file', fullPath);
        }
      }
    };

    walk(folderPath);
    return count;
  }

  async close(): Promise<void> {
    for (const [, watcher] of this.watchers) {
      await (watcher as { close: () => Promise<void> }).close();
    }
    this.watchers.clear();
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  get watchedPaths(): string[] {
    return Array.from(this.watchers.keys());
  }
}
