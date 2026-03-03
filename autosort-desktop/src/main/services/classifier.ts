import * as fs from 'fs';
import * as path from 'path';
import {
  AutosortPaths,
  FileProcessResult,
  LLMDecision,
  createLLMDecision,
  llmDecisionToDict,
} from '../core/types';
import { CompileResult, firstMatchRule } from '../core/rule-engine';
import { resolveDestination, shouldAutoApply } from '../core/mapping-resolver';
import {
  generateRunId,
  loadCache,
  saveCache,
  sha256File,
  utcIsoNow,
  waitUntilStable,
} from '../core/file-operations';
import { moveWithLedger, dryRunLog } from '../core/move-engine';
import { extractSnippet } from '../core/snippet-extractor';
import { DatabaseInstance, checkDedupCache, insertFile, insertLedgerEntry, upsertDedupCache } from './database';
import { FileProcessStatus } from '../core/types';
import { llmClassifyWithRetry } from '../core/llm-client';

export interface ClassifierConfig {
  paths: AutosortPaths;
  llmBaseUrl: string;
  llmType: 'llama_cpp' | 'ollama';
  rulesCfg: Record<string, unknown>;
  mappingCfg: Record<string, unknown>;
  compileResult: CompileResult;
  cachePath: string;
  ledgerPath: string;
  dryRun: boolean;
  db: DatabaseInstance;
}

type DecisionSource = 'rule' | 'llm' | 'unknown';

export async function handleFile(
  config: ClassifierConfig,
  filePath: string
): Promise<FileProcessResult | null> {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return null;
  }

  const filename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // Ignore rules
  const ignoreExts = new Set(
    ((config.rulesCfg.ignore as Record<string, unknown>)?.extensions as string[]) ??
      []
  );
  const ignoreGlobs =
    ((config.rulesCfg.ignore as Record<string, unknown>)?.globs as string[]) ?? [];

  if (ignoreExts.has(ext.toLowerCase())) return null;
  for (const g of ignoreGlobs) {
    if (matchGlob(filename, g)) return null;
  }

  // Stability check
  const stCfg = (config.rulesCfg.stability_check as Record<string, unknown>) ?? {};
  const stIgnoreExts = new Set(
    ((stCfg.ignore_extensions as string[]) ?? []).map((x) => x.toLowerCase())
  );
  if (stIgnoreExts.has(ext.toLowerCase())) return null;

  let fileSize = 0;
  try {
    fileSize = fs.statSync(filePath).size;
  } catch {
    return null;
  }

  const sha = (() => {
    try {
      return sha256File(filePath);
    } catch {
      return '';
    }
  })();

  if (stCfg.enabled !== false) {
    const timeoutS = Number(stCfg.timeout_seconds ?? 20);
    const stable = await waitUntilStable(filePath, timeoutS);
    if (!stable) {
      const runId = generateRunId();
      if (config.dryRun) {
        dryRunLog(
          filePath,
          config.paths.quarantine,
          `UNSTABLE__${path.parse(filePath).name}`,
          'unstable_file'
        );
        return null;
      }

      const movedPath = moveWithLedger(
        config.paths,
        filePath,
        config.paths.quarantine,
        `UNSTABLE__${path.parse(filePath).name}`,
        config.ledgerPath,
        runId,
        sha,
        'unstable_file'
      );

      return recordResult({
        config,
        filePath,
        movedPath,
        runId,
        sha256: sha,
        decision: createLLMDecision({
          doc_type: 'other',
          suggested_name: filename,
          confidence: 0,
          reasons: ['unstable_file'],
          tags: [],
        }),
        sourceFolderId: null,
        status: 'quarantined',
        ruleId: null,
        classification_source: 'unstable',
        reason: 'unstable_file',
        sizeBytes: fileSize,
      });
    }
  }

  const runId = generateRunId();

  const dedup = sha ? checkDedupCache(config.db, sha) : null;
  if (dedup) {
    if (config.dryRun) {
      dryRunLog(
        filePath,
        config.paths.dup,
        `DUP__${path.parse(filePath).name}`,
        'duplicate_hash'
      );
      return null;
    }

    const movedPath = moveWithLedger(
      config.paths,
      filePath,
      config.paths.dup,
      `DUP__${path.parse(filePath).name}`,
      config.ledgerPath,
      runId,
      sha,
      'duplicate_hash'
    );

    return recordResult({
      config,
      filePath,
      movedPath,
      runId,
      sha256: sha,
      decision: createLLMDecision({
        doc_type: 'other',
        suggested_name: filename,
        confidence: 0,
        reasons: ['duplicate_hash'],
        tags: [],
      }),
      sourceFolderId: null,
      status: 'duplicate',
      ruleId: null,
      classification_source: 'duplicate',
      reason: 'duplicate_hash',
      sizeBytes: fileSize,
      fileId: dedup.file_id ?? null,
    });
  }

  // Rule matching
  let decision = firstMatchRule(
    filename,
    filePath,
    ext,
    config.compileResult.ext_groups,
    config.compileResult.compiled_rules
  );

  let decisionSource: DecisionSource = decision ? 'rule' : 'unknown';
  const docsExts = new Set(
    (config.compileResult.ext_groups['docs'] ?? []).map((x) => String(x).toLowerCase())
  );

  // LLM fallback for document types
  if (decision === null || decision.confidence < 0.92) {
    if (docsExts.has(ext)) {
      const snippet = await extractSnippet(filePath);
      const meta = { name: filename, ext, size: fileSize };
      try {
        const llmDec = await llmClassifyWithRetry(
          config.llmBaseUrl,
          meta,
          snippet,
          config.llmType
        );
        if (llmDec === null) {
          if (config.dryRun) {
            dryRunLog(
              filePath,
              config.paths.quarantine,
              `PARSEFAIL__${path.parse(filePath).name}`,
              'llm_parse_fail'
            );
            return null;
          }
          const movedPath = moveWithLedger(
            config.paths,
            filePath,
            config.paths.quarantine,
            `PARSEFAIL__${path.parse(filePath).name}`,
            config.ledgerPath,
            runId,
            sha,
            'llm_parse_fail'
          );
          return recordResult({
            config,
            filePath,
            movedPath,
            runId,
            sha256: sha,
            decision: createLLMDecision({
              doc_type: 'other',
              suggested_name: filename,
              confidence: 0,
              reasons: ['llm_parse_fail'],
              tags: [],
            }),
            sourceFolderId: null,
            status: 'quarantined',
            ruleId: null,
            classification_source: 'llm_error',
            reason: 'llm_parse_fail',
            sizeBytes: fileSize,
          });
        }
        if (decision !== null && decision.tags.length > 0 && llmDec.tags.length === 0) {
          llmDec.tags = decision.tags;
        }
        decision = llmDec;
        decisionSource = 'llm';
      } catch (e) {
        const msg = (e as Error).message ?? '';
        const errorType = msg.includes('LLM_TIMEOUT') ? 'llm_timeout' : 'llm_error';
        const prefix = msg.includes('LLM_TIMEOUT') ? 'LLMTIMEOUT' : 'LLMERROR';
        if (config.dryRun) {
          dryRunLog(
            filePath,
            config.paths.quarantine,
            `${prefix}__${path.parse(filePath).name}`,
            errorType
          );
          return null;
        }
        const movedPath = moveWithLedger(
          config.paths,
          filePath,
          config.paths.quarantine,
          `${prefix}__${path.parse(filePath).name}`,
          config.ledgerPath,
          runId,
          sha,
          errorType
        );
        return recordResult({
          config,
          filePath,
          movedPath,
          runId,
          sha256: sha,
          decision: createLLMDecision({
            doc_type: 'other',
            suggested_name: filename,
            confidence: 0,
            reasons: [errorType],
            tags: [],
          }),
          sourceFolderId: null,
          status: 'quarantined',
          ruleId: null,
          classification_source: errorType,
          reason: errorType,
          sizeBytes: fileSize,
        });
      }
    } else {
      decision = createLLMDecision({
        doc_type: 'other',
        suggested_name: filename,
        confidence: 0.0,
        reasons: ['no_rule_non_doc'],
      });
      decisionSource = 'llm';
    }
  }

  const routing = resolveDestination(config.paths, config.mappingCfg, decision);
  const renamePolicy =
    decision.doc_type.startsWith('dev_') ||
    ['dev_code', 'dev_repo', 'dev_config'].includes(decision.doc_type)
      ? 'keep'
      : routing.rename_policy || 'keep';

  let dstDir: string;
  let reason: string;

  if (routing.forced_quarantine) {
    dstDir = config.paths.quarantine;
    reason = routing.forced_reason || 'forced_quarantine';
  } else if (routing.forced_action === 'quarantine') {
    dstDir = config.paths.quarantine;
    reason = routing.forced_reason || 'forced_action_quarantine';
  } else {
    const gate = shouldAutoApply(config.mappingCfg, decision);
    if (gate.ok) {
      dstDir = routing.dest_dir;
      reason = gate.reason;
    } else {
      dstDir = config.paths.quarantine;
      reason = gate.reason;
    }
  }

  const newName =
    renamePolicy === 'keep' ? filename : (decision.suggested_name || filename);

  if (config.dryRun) {
    dryRunLog(filePath, dstDir, newName, reason);
    return null;
  }

  const final = moveWithLedger(
    config.paths,
    filePath,
    dstDir,
    newName,
    config.ledgerPath,
    runId,
    sha,
    reason
  );

  const status: FileProcessStatus =
    dstDir === config.paths.quarantine ? 'quarantined' : 'moved';
  const classificationSource =
    decisionSource === 'rule'
      ? `rule:${decision.rule_id ?? 'rule_match'}`
      : 'llm';

  const result = recordResult({
    config,
    filePath,
    movedPath: final,
    runId,
    sha256: sha,
    decision,
    sourceFolderId: null,
    status,
    ruleId: decision.rule_id ?? null,
    classification_source: classificationSource,
    reason,
    sizeBytes: fileSize,
  });

  const cache = loadCache(config.cachePath);
  cache[sha] = {
    run_id: runId,
    after: final,
    decision: llmDecisionToDict(decision),
    reason,
    dest_dir: dstDir,
  };
  saveCache(config.cachePath, cache);

  return result;
}

function recordResult(params: {
  config: ClassifierConfig;
  filePath: string;
  movedPath: string;
  runId: string;
  sha256: string;
  decision: LLMDecision;
  sourceFolderId: number | null;
  status: FileProcessStatus;
  ruleId: string | null;
  classification_source: string;
  reason: string;
  sizeBytes: number;
  fileId?: number | null;
}) {
  const fileId = params.fileId ?? insertFile(
      params.config.db,
      {
        filename: path.basename(params.filePath),
        extension: path.extname(params.filePath).toLowerCase(),
        size_bytes: params.sizeBytes,
        sha256: params.sha256,
        original_path: params.filePath,
        current_path: params.movedPath,
        doc_type: params.decision.doc_type,
        confidence: params.decision.confidence,
        rule_id: params.ruleId,
        classification_source: params.classification_source,
        project: params.decision.project ?? null,
        vendor: params.decision.vendor ?? null,
        file_date: params.decision.date ?? null,
        suggested_name:
          params.decision.suggested_name || path.basename(params.filePath),
        source_folder_id: params.sourceFolderId,
        status: params.status,
        classified_at: utcIsoNow(),
        moved_at: params.status === 'moved' ? utcIsoNow() : null,
        tags: params.decision.tags ?? [],
        reasons: params.decision.reasons ?? [],
      }
    );

  if (params.sha256) {
    upsertDedupCache(
      params.config.db,
      params.sha256,
      fileId,
      params.runId,
      params.filePath,
      params.movedPath
    );
  }

  insertLedgerEntry(params.config.db, {
    ts: utcIsoNow(),
    run_id: params.runId,
    action: 'move',
    sha256: params.sha256,
    reason: params.reason,
    before_path: params.filePath,
    after_path: params.movedPath,
    file_id: fileId,
    decision_json: llmDecisionToDict(params.decision),
  });

  return {
    fileId,
    filename: path.basename(params.filePath),
    originalPath: params.filePath,
    currentPath: params.movedPath,
    doc_type: params.decision.doc_type,
    confidence: params.decision.confidence,
    status: params.status,
    rule_id: params.ruleId,
    classification_source: params.classification_source,
    tags: params.decision.tags ?? [],
    reasons: params.decision.reasons ?? [],
    sha256: params.sha256,
    originalName: params.decision.suggested_name || path.basename(params.filePath),
  };
}

function matchGlob(filename: string, pattern: string): boolean {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regex}$`, 'i').test(filename);
}
