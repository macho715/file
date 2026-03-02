# Phase 2: Multi-Folder Watching + SQLite Indexing Integration

## 현재 상태 (Phase 1 완료 기준)

Phase 1에서 Python 데몬의 핵심 로직을 TypeScript로 포팅하고 Electron 앱 셸을 생성했다.
그러나 **classifier와 database가 연결되지 않은 상태**이다.

### 핵심 갭 분석

| 영역 | 현재 상태 | 문제 |
|---|---|---|
| **파일 분류 결과** | `cache.json`에만 저장 | DB `files` 테이블 비어있음 |
| **Ledger** | `ledger.jsonl`에만 기록 | DB `ledger` 테이블 비어있음 |
| **file_tags/file_reasons** | 테이블 존재, 데이터 없음 | classifier가 DB에 쓰지 않음 |
| **dedup_cache** | `cache.json` 사용 | DB `dedup_cache` 테이블 미사용 |
| **UI 실시간 피드백** | `file:processed`에 `{path, filename}`만 전송 | 분류 결과(doc_type, confidence 등) 미포함 |
| **Quarantine 워크플로우** | 버튼 존재, 핸들러 없음 | 승인/재분류 불가 |
| **Watcher 폴더 추가** | IPC 핸들러 존재 | 기존 파일 스캔(sweepExisting) 미연동 |
| **설정 변경** | LLM URL/Type만 저장 | 규칙 핫리로드, 감시 토글 없음 |

---

## Phase 2 목표

1. classifier 출력을 SQLite에 기록하여 **DB가 단일 진실 원천(single source of truth)**이 되도록 통합
2. **다중 폴더 감시 완전 작동** — 추가/제거/토글/초기 스캔
3. **실시간 UI 피드백** — 파일 처리 즉시 대시보드/파일 목록 갱신
4. **Quarantine 워크플로우** — 승인(이동) + 수동 재분류 + 삭제(안전)
5. **기존 데이터 마이그레이션** — cache.json + ledger.jsonl → SQLite 일회성 임포트

---

## Step 1: database.ts — 파일 CRUD 함수 추가

### 추가할 함수

```
insertFile(db, data) → number (file_id)
  INSERT INTO files (filename, extension, size_bytes, sha256, original_path, current_path,
    doc_type, confidence, rule_id, classification_source, project, vendor, file_date,
    suggested_name, source_folder_id, status, classified_at, moved_at)
  VALUES (...)
  + INSERT INTO file_tags (file_id, tag)  — decision.tags 순회
  + INSERT INTO file_reasons (file_id, reason) — decision.reasons 순회
  → persistDb()
  → return last_insert_rowid

updateFileStatus(db, fileId, status, currentPath?) → void
  UPDATE files SET status = ?, current_path = ?, updated_at = datetime('now') WHERE id = ?
  → persistDb()

insertLedgerEntry(db, entry) → void
  INSERT INTO ledger (ts, run_id, action, sha256, reason, before_path, after_path,
    file_id, decision_json) VALUES (...)
  → persistDb()

upsertDedupCache(db, sha256, fileId, runId, firstSeenPath, currentPath) → void
  INSERT OR REPLACE INTO dedup_cache (...) VALUES (...)

checkDedupCache(db, sha256) → { file_id, first_seen_path, current_path } | null
  SELECT * FROM dedup_cache WHERE sha256 = ?

getFileByPath(db, originalPath) → file row | null
  SELECT * FROM files WHERE original_path = ?

bulkInsertFiles(db, files[]) → void
  BEGIN TRANSACTION; INSERT ...; COMMIT;
  (마이그레이션용 벌크 삽입)
```

### 변경 포인트

- `database.ts`에 위 함수 추가
- 모든 write 함수는 `persistDb()` 호출하여 파일 저장
- 트랜잭션 래퍼 `withTransaction(db, fn)` 헬퍼 추가 (bulkInsert용)

---

## Step 2: classifier.ts — DB 통합

### handleFile() 수정 흐름

현재 흐름에 DB 기록을 추가한다. classifier.ts의 `ClassifierConfig`에 `db: DatabaseInstance` 필드 추가.

```
handleFile(config, filePath)
  │
  ├─ [기존] 무시/안정성 체크
  │   └─ 불안정 → moveWithLedger + ★ insertFile(status='quarantined') + insertLedgerEntry
  │
  ├─ SHA256 계산
  │
  ├─ [변경] Dedup 체크: cache.json → ★ checkDedupCache(db)
  │   └─ 중복 → moveWithLedger + ★ insertFile(status='duplicate') + insertLedgerEntry
  │
  ├─ [기존] Rule matching → LLM fallback
  │
  ├─ [기존] Routing resolution
  │
  ├─ [기존] moveWithLedger (파일 이동 + JSONL)
  │
  └─ ★ DB 기록 (신규):
      ├─ insertFile(db, { filename, ext, size, sha256, original_path, current_path,
      │   doc_type, confidence, rule_id, classification_source, project, vendor,
      │   file_date, suggested_name, status, tags, reasons })
      ├─ insertLedgerEntry(db, { ts, run_id, action, sha256, reason,
      │   before_path, after_path, file_id, decision_json })
      ├─ upsertDedupCache(db, sha256, fileId, runId, originalPath, finalPath)
      └─ [변경] cache.json 저장은 유지 (하위 호환)
```

### classification_source 필드 값

| 소스 | 값 |
|---|---|
| 규칙 매치 | `"rule:{rule_id}"` |
| LLM 분류 | `"llm"` |
| 불안정 파일 | `"unstable"` |
| 중복 | `"duplicate"` |
| LLM 실패 | `"llm_error"` 또는 `"llm_timeout"` |

### status 필드 값

| 상태 | 의미 |
|---|---|
| `pending` | 스캔됨, 아직 미처리 |
| `moved` | 정상 분류 후 이동 완료 |
| `quarantined` | 격리됨 (낮은 confidence / 에러) |
| `duplicate` | 중복 해시로 이동 |
| `error` | 처리 중 예외 발생 |
| `approved` | 격리 후 수동 승인 이동 |

### 반환 타입 추가

`handleFile()` 반환을 `Promise<void>` → `Promise<FileProcessResult | null>`로 변경:

```typescript
interface FileProcessResult {
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
}
```

이 결과를 index.ts에서 받아 renderer에 전송.

---

## Step 3: index.ts — 배선(Wiring) 수정

### 변경 사항

```typescript
// ClassifierConfig에 db 추가
classifierConfig = {
  ...기존,
  db,  // ★ 추가
};

// file 이벤트 핸들러 수정
fileWatcher.on('file', async (filePath) => {
  try {
    const result = await handleFile(classifierConfig!, filePath);
    if (result) {
      // ★ 분류 결과 전체를 renderer에 전달
      mainWindow?.webContents.send('file:processed', result);
    }
  } catch (e) {
    console.error(`Error processing file: ${filePath}`, e);
  }
});
```

### 초기 스캔 연동

`startWatching()` 수정 — 폴더 감시 시작 후 기존 파일 스캔:

```typescript
for (const folder of folders) {
  if (folder.enabled) {
    await fileWatcher.addFolder(folder);
    // ★ 감시 시작 시 기존 파일 스캔
    const shouldSweep = getSetting(db, `sweep_done_${folder.id}`) !== 'true';
    if (shouldSweep) {
      await fileWatcher.sweepExisting(folder.path);
      setSetting(db, `sweep_done_${folder.id}`, 'true');
    }
  }
}
```

---

## Step 4: IPC 핸들러 확장

### 신규 IPC 채널

| 채널 | 용도 | 입력 | 출력 |
|---|---|---|---|
| `quarantine:approve` | 격리 파일 승인 후 정상 이동 | `fileId: number` | `{ success, newPath }` |
| `quarantine:reclassify` | 수동 doc_type 지정 후 이동 | `fileId: number, doc_type: string` | `{ success, newPath }` |
| `watchers:toggle` | 감시 폴더 활성/비활성 | `id: number, enabled: boolean` | `void` |
| `watchers:sweep` | 특정 폴더 수동 스캔 | `id: number` | `{ scannedCount }` |
| `files:reprocess` | 파일 재분류 요청 | `fileId: number` | `FileProcessResult` |
| `app:reloadRules` | YAML 규칙 핫리로드 | 없음 | `{ rulesCount }` |

### quarantine:approve 구현 로직

```
1. DB에서 파일 조회 (files.id = fileId, status = 'quarantined')
2. current_path에서 실제 파일 존재 확인
3. 기존 decision 복원 (decision_json from ledger 또는 DB)
4. resolveDestination() 재실행 → 강제 quarantine 플래그 무시
5. moveWithLedger(quarantine_path → dest_dir)
6. updateFileStatus(db, fileId, 'approved', newPath)
7. insertLedgerEntry(db, { action: 'approve', ... })
```

### quarantine:reclassify 구현 로직

```
1. DB에서 파일 조회
2. 새 doc_type으로 createLLMDecision({ doc_type, confidence: 1.0 })
3. resolveDestination() 실행
4. moveWithLedger()
5. updateFileStatus(db, fileId, 'moved', newPath)
6. 기존 tags/reasons 삭제 후 재삽입
7. insertLedgerEntry(db, { action: 'reclassify', ... })
```

---

## Step 5: preload + ipc-client 확장

### preload/index.ts 추가

```typescript
approveQuarantine: (fileId: number) =>
  ipcRenderer.invoke('quarantine:approve', fileId),
reclassifyFile: (fileId: number, docType: string) =>
  ipcRenderer.invoke('quarantine:reclassify', fileId, docType),
toggleWatcher: (id: number, enabled: boolean) =>
  ipcRenderer.invoke('watchers:toggle', id, enabled),
sweepFolder: (id: number) =>
  ipcRenderer.invoke('watchers:sweep', id),
reprocessFile: (fileId: number) =>
  ipcRenderer.invoke('files:reprocess', fileId),
reloadRules: () =>
  ipcRenderer.invoke('app:reloadRules'),
```

### ipc-client.ts AutosortAPI 인터페이스 확장

동일한 메서드 타입 추가 + mock 구현 추가.

### file:processed 이벤트 페이로드 확장

```typescript
onFileProcessed: (callback: (data: FileProcessResult) => void) => () => void;
```

---

## Step 6: Renderer UI 수정

### 6-1. DashboardView — 실시간 반영

```
변경: useDashboard 훅에 onFileProcessed 이벤트 리스너 추가
→ 파일 처리 시 stats 즉시 refetch (5초 폴링 + 이벤트 기반 즉시 갱신)
→ 최근 활동 피드에 새 항목 prepend (애니메이션)
```

### 6-2. FileBrowser — DB 데이터 표시

```
현재: DB가 비어 있어 아무것도 표시 안 됨
변경: classifier가 DB에 기록하면 자동으로 데이터 표시
추가: 파일 클릭 → 상세 패널 (doc_type, confidence, tags, reasons, 이동 이력)
```

### 6-3. QuarantineView — 워크플로우 연결

```
Approve 버튼:
  → api.approveQuarantine(fileId)
  → 성공 시 목록에서 제거 + 토스트 알림

Reclassify 버튼:
  → 드롭다운 모달 (doc_type 선택: dev_code, dev_note, ops_doc, photo, ...)
  → api.reclassifyFile(fileId, selectedDocType)
  → 성공 시 목록에서 제거 + 토스트 알림
```

### 6-4. SettingsView — 감시 폴더 토글 + 스캔

```
각 감시 폴더에 토글 스위치 추가 (enabled/disabled)
  → api.toggleWatcher(id, enabled)

"Scan Now" 버튼 추가
  → api.sweepFolder(id)
  → 스캔 결과 카운트 표시

"Reload Rules" 버튼 추가
  → api.reloadRules()
  → 결과 rulesCount 표시
```

### 6-5. 토스트 알림 시스템

```
간단한 Toast 컴포넌트 (Tailwind 기반)
  - 성공(초록) / 에러(빨강) / 정보(파랑)
  - 3초 후 자동 사라짐
  - 파일 처리 완료, 격리 승인, 에러 등에 사용
```

---

## Step 7: 마이그레이션 — 기존 데이터 임포트

### 대상

1. **cache.json** → `files` + `file_tags` + `dedup_cache` 테이블
2. **ledger.jsonl** → `ledger` 테이블

### 마이그레이션 로직 (services/migrator.ts 신규 파일)

```typescript
export async function migrateFromLegacy(db, cachePath, ledgerPath): Promise<MigrationResult>

// cache.json 마이그레이션:
//   각 entry에 대해:
//     sha256 key → dedup_cache INSERT
//     decision 객체 → files INSERT (status='moved')
//     decision.tags → file_tags INSERT
//     decision.reasons → file_reasons INSERT

// ledger.jsonl 마이그레이션:
//   각 줄 JSON parse → ledger INSERT
//   file_id는 sha256로 files 테이블 lookup하여 연결

// 실행 조건:
//   settings 테이블에 'migration_v1_done' 키가 없을 때만 실행
//   완료 후 setSetting(db, 'migration_v1_done', utcIsoNow())
```

### 실행 시점

`index.ts`의 `initApp()` 내 DB 초기화 직후:

```typescript
db = await initDatabase(dbPath);
await migrateFromLegacy(db, cachePath, ledgerPath);  // ★ 추가
```

---

## Step 8: watcher.ts — 감시 폴더 토글 지원

### 변경 사항

```typescript
// 폴더 활성/비활성 토글
async toggleFolder(folderPath: string, enabled: boolean): Promise<void> {
  if (enabled) {
    // addFolder 호출 (이미 있으면 무시)
  } else {
    // removeFolder 호출 (watcher 정지)
  }
}
```

### sweepExisting 개선

현재 `readdirSync` → 재귀 지원 추가 (recursive 플래그 반영):

```typescript
async sweepExisting(folderPath: string, recursive: boolean): Promise<number> {
  let count = 0;
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isFile()) {
        this.emit('file', full);
        count++;
      } else if (entry.isDirectory() && recursive && !entry.name.startsWith('.')) {
        walk(full);
      }
    }
  }
  walk(folderPath);
  return count;
}
```

---

## 파일 변경 요약

| 파일 | 변경 유형 | 설명 |
|---|---|---|
| `src/main/services/database.ts` | **수정** | insertFile, updateFileStatus, insertLedgerEntry, upsertDedupCache, checkDedupCache, getFileByPath, bulkInsertFiles, withTransaction 추가 |
| `src/main/services/classifier.ts` | **수정** | ClassifierConfig에 db 추가, handleFile 내부에 DB 기록 로직, 반환 타입 FileProcessResult |
| `src/main/services/watcher.ts` | **수정** | toggleFolder(), sweepExisting 재귀 지원, count 반환 |
| `src/main/services/migrator.ts` | **신규** | cache.json + ledger.jsonl → SQLite 마이그레이션 |
| `src/main/index.ts` | **수정** | classifierConfig에 db 전달, file:processed에 전체 결과 전송, 초기 스캔 연동, 마이그레이션 호출 |
| `src/main/ipc-handlers.ts` | **수정** | quarantine:approve/reclassify, watchers:toggle/sweep, files:reprocess, app:reloadRules 추가 |
| `src/preload/index.ts` | **수정** | 신규 IPC 메서드 6개 추가 |
| `src/renderer/lib/ipc-client.ts` | **수정** | AutosortAPI 인터페이스 + mock 확장 |
| `src/renderer/components/quarantine/QuarantineView.tsx` | **수정** | Approve/Reclassify 버튼 핸들러 연결 |
| `src/renderer/components/settings/SettingsView.tsx` | **수정** | 감시 토글, Scan Now, Reload Rules 추가 |
| `src/renderer/components/dashboard/DashboardView.tsx` | **수정** | onFileProcessed 이벤트 기반 즉시 갱신 |
| `src/renderer/components/common/Toast.tsx` | **신규** | 토스트 알림 컴포넌트 |
| `src/renderer/hooks/useDashboard.ts` | **수정** | 이벤트 리스너 추가 |
| `tests/unit/database.test.ts` | **신규** | insertFile, updateFileStatus, checkDedupCache 등 테스트 |
| `tests/unit/migrator.test.ts` | **신규** | 마이그레이션 로직 테스트 |
| `tests/integration/classifier-db.test.ts` | **신규** | classifier → DB 기록 통합 테스트 |

---

## 구현 순서 (의존성 기반)

```
Step 1: database.ts CRUD 함수 추가
  └─ tests/unit/database.test.ts 작성 + 통과

Step 2: classifier.ts DB 통합
  ├─ 의존: Step 1 (database 함수)
  └─ tests/integration/classifier-db.test.ts 작성 + 통과

Step 3: index.ts 배선 수정
  ├─ 의존: Step 2 (classifier 변경)
  └─ ClassifierConfig.db 전달, file:processed 페이로드 확장

Step 4: IPC 핸들러 확장
  ├─ 의존: Step 1 (database 함수), Step 3 (index.ts)
  └─ 신규 6개 채널 등록

Step 5: preload + ipc-client 확장
  ├─ 의존: Step 4 (IPC 채널)
  └─ 신규 메서드 노출

Step 6: Renderer UI 수정
  ├─ 의존: Step 5 (API 노출)
  └─ 병렬 작업 가능:
      ├─ 6-1: DashboardView 실시간 갱신
      ├─ 6-2: FileBrowser 상세 패널
      ├─ 6-3: QuarantineView 워크플로우
      ├─ 6-4: SettingsView 토글/스캔
      └─ 6-5: Toast 컴포넌트

Step 7: 마이그레이션 (migrator.ts)
  ├─ 의존: Step 1 (database 함수)
  └─ 독립 작업 (Step 1 이후 병렬 가능)

Step 8: watcher.ts 개선
  └─ 독립 작업 (언제든 가능)
```

---

## 검증 계획

### 단위 테스트

- `database.test.ts`: insertFile → queryOne으로 검증, updateFileStatus, checkDedupCache, bulkInsertFiles
- `migrator.test.ts`: 더미 cache.json + ledger.jsonl → DB 임포트 후 레코드 수 검증

### 통합 테스트

- `classifier-db.test.ts`: handleFile 호출 후 DB files 테이블에 레코드 존재 확인
  - 정상 분류 → status='moved'
  - 중복 → status='duplicate'
  - 격리 → status='quarantined'
  - tags/reasons 정상 기록

### 수동 테스트

1. Downloads 폴더에 `.py` 파일 드롭 → 대시보드에 즉시 반영 확인
2. 감시 폴더 2개 추가 → 양쪽 모두 감시 동작 확인
3. 격리 파일 Approve → 정상 폴더로 이동 확인
4. 격리 파일 Reclassify → 선택한 doc_type 폴더로 이동 확인
5. "Scan Now" → 기존 파일 일괄 분류 확인
6. 앱 재시작 → DB 데이터 유지 확인
7. "Reload Rules" → 변경된 rules.yaml 즉시 반영 확인

### 빌드 검증

```bash
npm run test          # 모든 테스트 통과
npm run build:main    # TypeScript 컴파일 에러 없음
npm run build:renderer # Vite 빌드 에러 없음
```

---

## Phase 2 구현 완료 요약 (2026-03-02)

### 구현 결정 요약

| 영역 | 변경 |
|------|------|
| **Watcher** | `sweepExisting(path, recursive?)` 재귀 스윕 + 처리 건수 반환. `watcher.ts`, `ipc-handlers.ts`, `index.ts` 반영. |
| **IPC** | `app:reloadRules` 구현. main/preload/ipc-client + SettingsView "Reload Rules" 연동. |
| **Quarantine** | 재분류 UX를 prompt → 모달 폼 전환. Toast 피드백 추가. `QuarantineView.tsx`, `Toast.tsx`. |
| **DB** | `insertFile` ID 조회: `last_insert_rowid()` → `MAX(id)` (sql.js 대응). `withTransaction` 내 `persistDb` 일시 지연으로 트랜잭션 일관성. |
| **테스트** | `database.test.ts`, `migration.test.ts`, `classifier-db.test.ts` 등 DB/마이그레이션/Classifier 통합 보강. |

### 리스크/안전 체크

- **No-delete**: `quarantine:delete` → `quarantine/deleted` 이동만.
- **Dev 리네임 금지**: resolve/mapping 로직 유지.
- **Temp 파일**: `.crdownload`/`.part`/`.tmp` → 기존 불안정성 처리 후 quarantine 유지.
- **DB·ledger**: 파일 이동/상태 변경 시 연계 유지.

### 검증 결과

- `npm run build:main` ✅
- `npm run build:renderer` ✅
- `npm run build` ✅
- `npm test` ✅ — 7개 테스트 파일, 52개 테스트 통과

### 다음 단계

런타임 스모크 3개 우선 시나리오: (1) 폴더 add/remove/toggle/sweep, (2) .py 분류+duplicate / .crdownload quarantine, (3) Quarantine approve/reclassify/delete. 체크리스트는 `docs/RUNTIME-SMOKE-CHECKLIST.md` 참고.
