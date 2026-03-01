# Cursor Autosort 사용법 (Subagents + Skills)

DEV-PRESET Autosort용 Cursor Subagent 3개 + Skill 4개 사용 방법입니다.

---

## 1. 설치된 아티팩트

| 구분 | 이름 | 경로 |
|------|------|------|
| Subagent | autosort-research | `.cursor/agents/autosort-research.md` |
| Subagent | autosort-terminal | `.cursor/agents/autosort-terminal.md` |
| Subagent | autosort-verifier | `.cursor/agents/autosort-verifier.md` |
| Skill | autosort-run | `.cursor/skills/autosort-run/SKILL.md` |
| Skill | autosort-policy-check | `.cursor/skills/autosort-policy-check/SKILL.md` |
| Skill | autosort-ledger-audit | `.cursor/skills/autosort-ledger-audit/SKILL.md` |
| Skill | autosort-quarantine-triage | `.cursor/skills/autosort-quarantine-triage/SKILL.md` |

---

## 2. Subagent 사용법

Subagent는 Agent 채팅에서 **트리거 문구**로 호출됩니다. Cursor가 문맥에 맞는 subagent를 선택합니다.

| Subagent | 트리거 예시 | 용도 |
|----------|-------------|------|
| **autosort-research** | "find where classification happens", "scan autosortd.py", "분류/이동/ledger 코드 어디 있어?" | 코드·폴더 탐색, 경로·함수 요약 |
| **autosort-terminal** | "run tests", "smoke run watcher", "show failing command", "드라이런 해줘" | 테스트/스모크/드라이런 실행 결과 요약 |
| **autosort-verifier** | "verify no delete", "confirm no rename dev", "요구사항 검증해줘" | Non-Negotiables PASS/FAIL 검증 |

**사용 절차**
1. Agent 채팅 열기
2. 위 트리거에 가까운 문장으로 요청 입력
3. (선택) 특정 subagent를 지정하고 싶으면 이름을 언급: "autosort-research로 분류 로직 찾아줘"

---

## 3. Skill 사용법

Skill은 **키워드/문맥**에 따라 Cursor가 로드합니다. 채팅에서 아래와 같은 표현을 쓰면 해당 스킬이 적용됩니다.

| Skill | 트리거 키워드/문맥 | 용도 | 비고 |
|-------|---------------------|------|------|
| **autosort-run** | autosort, watcher, organize folder, DEV-PRESET, ledger, "autosortd 실행", "watcher 돌려" | 실행/운영, SSOT 트리 이동, ledger 기록 | **파일 이동 발생** → 필요할 때만 호출 |
| **autosort-policy-check** | policy, safety, SSOT, quarantine, no delete, "정책 위반 있나?" | AGENTS.md 준수 여부 점검 | 읽기 전용 |
| **autosort-ledger-audit** | ledger audit, compliance, move log, "ledger 제대로 남았나?" | ledger.jsonl 무결성·위반 탐지 | 읽기 전용 |
| **autosort-quarantine-triage** | quarantine triage, ambiguous, classify docs, "quarantine 정리" | Quarantine 파일 규칙/키워드/LLM으로 재분류 | 파일 이동 발생, LLM은 문서만 |

---

## 4. 권한·위험 요약

| 아티팩트 | 파일 삭제 | 파일 이동 | 읽기 전용 권장 |
|----------|-----------|-----------|----------------|
| autosort-research | 없음 | 없음 | ✅ |
| autosort-terminal | 없음 | 없음 | ✅ |
| autosort-verifier | 없음 | 없음 | ✅ |
| autosort-policy-check | 없음 | 없음 | ✅ |
| autosort-ledger-audit | 없음 | 없음 | ✅ |
| **autosort-run** | 없음 | **있음** | 수동 호출 권장 |
| **autosort-quarantine-triage** | 없음 | **있음** | 필요 시만 호출 |

---

## 5. 권장 워크플로우

1. **설계/탐색**  
   → "autosort-research로 분류/이동/ledger 지점 찾아줘"  
2. **코드 수정 후 검증**  
   → "autosort-verifier로 요구사항 검증해줘"  
3. **테스트/스모크**  
   → "autosort-terminal로 테스트 돌려줘" / "smoke run watcher"  
4. **정책 점검**  
   → "autosort-policy-check로 SSOT 준수 확인해줘"  
5. **ledger 점검**  
   → "autosort-ledger-audit로 ledger 감사해줘"  
6. **실제 정리 실행** (필요 시)  
   → autosort-run 스킬 로드 후 watcher 경로·옵션 지정  
7. **Quarantine 재분류** (필요 시)  
   → autosort-quarantine-triage 스킬 로드 후 triage 요청  

---

## 6. Cursor 재시작 후 확인

- Subagent: Agent 채팅에서 위 트리거로 호출해 응답이 오는지 확인
- Skill: 해당 키워드로 채팅 시 스킬이 적용되는지 확인

전역 설치(모든 프로젝트에서 사용)를 원하면 다음 경로에 동일 구조로 복사합니다.

- Subagents: `~/.cursor/agents/`
- Skills: `~/.cursor/skills/<skill-name>/SKILL.md`

---

## 7. 참고

- SSOT: `AGENTS.md`
- 검증 체크리스트: 삭제 0%, Dev 리네임 0%, Rule-first, Ledger 100%, Temp 안정성, Quarantine/dup 라우팅
