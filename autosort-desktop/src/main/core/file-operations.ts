import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export function atomicWriteJson(filePath: string, data: unknown): void {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}

export function loadCache(cachePath: string): Record<string, unknown> {
  if (!fs.existsSync(cachePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveCache(
  cachePath: string,
  cache: Record<string, unknown>
): void {
  atomicWriteJson(cachePath, cache);
}

export function logJsonl(
  logPath: string,
  obj: Record<string, unknown>
): void {
  fs.appendFileSync(logPath, JSON.stringify(obj) + '\n', 'utf-8');
}

export function sha256File(filePath: string, chunkSize = 1024 * 1024): string {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(chunkSize);
  let bytesRead: number;
  while ((bytesRead = fs.readSync(fd, buffer, 0, chunkSize, null)) > 0) {
    hash.update(buffer.subarray(0, bytesRead));
  }
  fs.closeSync(fd);
  return hash.digest('hex');
}

export function safeFilename(name: string, maxLen = 140): string {
  name = name.replace(/[\\/:*?"<>|]+/g, '_').trim();
  name = name.replace(/\s+/g, ' ').trim();
  if (name.length > maxLen) {
    name = name.substring(0, maxLen).trimEnd();
  }
  return name;
}

export function waitUntilStable(
  filePath: string,
  timeoutS = 20
): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let lastSize = -1;
    let stableHits = 0;

    const check = () => {
      if (Date.now() - startTime > timeoutS * 1000) {
        resolve(false);
        return;
      }
      try {
        const stats = fs.statSync(filePath);
        const sz = stats.size;
        if (sz === lastSize && sz > 0) {
          stableHits++;
        } else {
          stableHits = 0;
        }
        if (stableHits >= 2) {
          resolve(true);
          return;
        }
        lastSize = sz;
      } catch {
        resolve(false);
        return;
      }
      setTimeout(check, 1000);
    };

    check();
  });
}

export function ensureDirSync(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function generateRunId(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

export function utcIsoNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
