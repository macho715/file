import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AutosortPaths, LedgerEntry } from './types';
import {
  safeFilename,
  logJsonl,
  ensureDirSync,
  utcIsoNow,
} from './file-operations';

export function moveWithLedger(
  paths: AutosortPaths,
  src: string,
  dstDir: string,
  newName: string,
  ledgerPath: string,
  runId: string,
  sha: string,
  reason: string
): string {
  ensureDirSync(dstDir);

  newName = safeFilename(newName);
  if (!newName) {
    newName = safeFilename(path.parse(src).name);
  }

  const srcExt = path.extname(src).toLowerCase();
  if (!newName.toLowerCase().endsWith(srcExt)) {
    newName = `${newName}${srcExt}`;
  }

  let dst = path.join(dstDir, newName);

  // Collision handling: append __<hash> suffix
  if (fs.existsSync(dst)) {
    const base = path.parse(dst).name;
    const ext = path.extname(dst);
    for (let i = 1; i < 20; i++) {
      const suffix = crypto
        .createHash('sha256')
        .update(`${dst}${Date.now()}:${i}`)
        .digest('hex')
        .substring(0, 8);
      const candidate = path.join(dstDir, `${base}__${suffix}${ext}`);
      if (!fs.existsSync(candidate)) {
        dst = candidate;
        break;
      }
    }
  }

  // Two-phase atomic move via staging
  const stagingTarget = path.join(paths.staging, `${runId}__${path.basename(src)}`);
  ensureDirSync(paths.staging);

  fs.renameSync(src, stagingTarget);
  fs.renameSync(stagingTarget, dst);

  const entry: LedgerEntry = {
    ts: utcIsoNow(),
    run_id: runId,
    action: 'move',
    sha256: sha,
    reason,
    before: src,
    after: dst,
  };
  logJsonl(ledgerPath, entry as unknown as Record<string, unknown>);

  return dst;
}

export function dryRunLog(
  src: string,
  dstDir: string,
  dstName: string,
  reason: string
): void {
  console.log(
    `[DRY-RUN] ${path.basename(src)} -> ${path.join(dstDir, dstName)} | reason=${reason}`
  );
}
