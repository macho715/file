"""
dashboard.py — AUTOSORT 상황판

ledger.jsonl과 cache.json을 읽어 터미널에 현황을 출력합니다.

사용법:
  python dashboard.py --root C:\\_AUTOSORT
  python dashboard.py --root C:\\_AUTOSORT --refresh 5   # 5초마다 자동 갱신
  python dashboard.py --ledger logs/ledger.jsonl --cache cache/cache.json
  python dashboard.py --root C:\\_AUTOSORT --no-color > report.txt
"""
import argparse
import collections
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# ------------------------------------
# ANSI color helpers (disabled if not a TTY or NO_COLOR is set)
# ------------------------------------
_USE_COLOR = sys.stdout.isatty() and "NO_COLOR" not in os.environ


def _c(code: str, text: str) -> str:
    if not _USE_COLOR:
        return text
    return f"\033[{code}m{text}\033[0m"


def _bold(t: str) -> str:
    return _c("1", t)


def _green(t: str) -> str:
    return _c("32", t)


def _yellow(t: str) -> str:
    return _c("33", t)


def _red(t: str) -> str:
    return _c("31", t)


def _cyan(t: str) -> str:
    return _c("36", t)


def _dim(t: str) -> str:
    return _c("2", t)


def _clear_screen() -> None:
    if _USE_COLOR:
        sys.stdout.write("\033[2J\033[H")
        sys.stdout.flush()


def _move_to_top() -> None:
    if _USE_COLOR:
        sys.stdout.write("\033[H")
        sys.stdout.flush()


# ------------------------------------
# Data loading
# ------------------------------------
def load_ledger(ledger_path: Path) -> List[Dict[str, Any]]:
    """JSONL 파일을 읽어 항목 목록을 반환합니다. 오류 행은 무시합니다."""
    if not ledger_path.exists():
        return []
    entries: List[Dict[str, Any]] = []
    try:
        text = ledger_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            if isinstance(obj, dict):
                entries.append(obj)
        except json.JSONDecodeError:
            pass
    return entries


def load_cache(cache_path: Path) -> Dict[str, Any]:
    """cache.json을 읽어 딕셔너리를 반환합니다."""
    if not cache_path.exists():
        return {}
    try:
        data = json.loads(cache_path.read_text(encoding="utf-8", errors="ignore"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


# ------------------------------------
# Analytics
# ------------------------------------
def _infer_category(after_path: str) -> str:
    """이동 경로에서 카테고리 레이블을 추출합니다."""
    norm = after_path.replace("\\", "/")
    parts = [p for p in norm.split("/") if p]
    special = {"quarantine", "dup", "staging", "temp"}
    for part in parts:
        if part.lower() in special:
            return part.lower()
    # 'out' 세그먼트 이후 1~2개 구성 요소를 반환
    try:
        idx = next(i for i, p in enumerate(parts) if p.lower() == "out")
        sub = parts[idx + 1: idx + 3]
        return "/".join(sub) if sub else "out"
    except StopIteration:
        return "unknown"


def compute_stats(
    entries: List[Dict[str, Any]],
    cache: Dict[str, Any],
) -> Dict[str, Any]:
    """ledger 항목과 캐시로부터 통계를 계산합니다."""
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    total_all_time = len(entries)
    total_today = 0
    by_reason: collections.Counter = collections.Counter()
    by_dest_category: collections.Counter = collections.Counter()
    quarantine_count = 0
    dup_count = 0
    llm_call_count = 0
    llm_success_count = 0

    _llm_reasons = {
        "auto_apply", "not_in_allowlist_doc_type", "low_confidence",
        "llm_timeout", "llm_error", "llm_parse_fail",
    }

    for e in entries:
        ts = str(e.get("ts", ""))
        if ts.startswith(today_str):
            total_today += 1

        reason = str(e.get("reason", "unknown"))
        by_reason[reason] += 1

        after_path = str(e.get("after", ""))
        cat = _infer_category(after_path)
        by_dest_category[cat] += 1

        norm_after = after_path.replace("\\", "/").lower()
        if "/quarantine/" in norm_after or norm_after.endswith("/quarantine"):
            quarantine_count += 1
        if reason == "duplicate_hash":
            dup_count += 1
        if reason in _llm_reasons:
            llm_call_count += 1
            if reason == "auto_apply":
                llm_success_count += 1

    # 캐시에서 rule:* 이외의 항목 수 = LLM을 통해 처리된 파일
    llm_cache_count = 0
    for v in cache.values():
        if not isinstance(v, dict):
            continue
        decision = v.get("decision") or {}
        reasons = decision.get("reasons") or []
        if not any(str(r).startswith("rule:") for r in reasons):
            llm_cache_count += 1

    recent_moves = sorted(
        entries, key=lambda e: e.get("ts", ""), reverse=True
    )[:10]

    error_rate = (quarantine_count + dup_count) / total_all_time if total_all_time else 0.0

    return {
        "total_all_time": total_all_time,
        "total_today": total_today,
        "by_reason": dict(by_reason.most_common()),
        "by_dest_category": dict(by_dest_category.most_common(12)),
        "recent_moves": recent_moves,
        "error_rate": error_rate,
        "quarantine_count": quarantine_count,
        "dup_count": dup_count,
        "llm_call_count": llm_call_count,
        "llm_success_count": llm_success_count,
        "llm_cache_count": llm_cache_count,
    }


# ------------------------------------
# Rendering
# ------------------------------------
_SEP = "─" * 62
_BOX_W = 64


def _bar(count: int, max_count: int, width: int = 30) -> str:
    if max_count <= 0:
        return ""
    filled = int(round(count / max_count * width))
    return "█" * filled + "░" * (width - filled)


def render_dashboard(
    stats: Dict[str, Any],
    ledger_path: Path,
    cache_path: Path,
    refresh_s: Optional[int] = None,
) -> str:
    """전체 대시보드 문자열을 빌드하여 반환합니다."""
    lines: List[str] = []
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    # 헤더
    lines.append(_bold("┌" + "─" * (_BOX_W - 2) + "┐"))
    title = f"  AUTOSORT 상황판  │  {now}"
    lines.append(_bold("│") + _bold(f" {title:<{_BOX_W - 3}}") + _bold("│"))
    if refresh_s:
        hint = f"  자동 갱신: {refresh_s}초마다  │  종료: Ctrl-C"
        lines.append(_bold("│") + _dim(f" {hint:<{_BOX_W - 3}}") + _bold("│"))
    lines.append(_bold("└" + "─" * (_BOX_W - 2) + "┘"))
    lines.append("")

    # 요약
    lines.append(_bold("[ 요약 ]") + "  " + _SEP[:46])
    lines.append(f"  전체 처리 (누적)   : {_green(str(stats['total_all_time']))} 건")
    lines.append(f"  전체 처리 (오늘)   : {_green(str(stats['total_today']))} 건")
    lines.append(f"  격리(quarantine)  : {_yellow(str(stats['quarantine_count']))} 건")
    lines.append(f"  중복(dup)         : {_yellow(str(stats['dup_count']))} 건")
    er = stats["error_rate"]
    er_str = f"{er:.1%}"
    er_colored = _red(er_str) if er > 0.15 else _yellow(er_str) if er > 0.05 else _green(er_str)
    lines.append(f"  오류율(격리+중복)  : {er_colored}")
    lines.append("")

    # LLM 통계
    lines.append(_bold("[ LLM 통계 ]") + "  " + _SEP[:44])
    lines.append(f"  LLM 호출(추정)    : {stats['llm_call_count']} 건")
    lines.append(f"  LLM 성공          : {stats['llm_success_count']} 건")
    lines.append(f"  캐시 내 LLM 파일  : {stats['llm_cache_count']} 건")
    lines.append("")

    # 목적지 카테고리별
    lines.append(_bold("[ 목적지 카테고리별 (상위 12) ]") + "  " + _SEP[:28])
    by_dest = stats["by_dest_category"]
    max_cnt = max(by_dest.values(), default=1)
    for cat, cnt in by_dest.items():
        bar = _bar(cnt, max_cnt, width=24)
        lines.append(f"  {cat:<28} {cnt:>5}  {_dim(bar)}")
    lines.append("")

    # 라우팅 사유별
    lines.append(_bold("[ 라우팅 사유별 ]") + "  " + _SEP[:42])
    for reason, cnt in stats["by_reason"].items():
        lines.append(f"  {reason:<35} {cnt:>5} 건")
    lines.append("")

    # 최근 이동 내역
    lines.append(_bold("[ 최근 이동 내역 (최대 10건) ]") + "  " + _SEP[:30])
    recent = stats["recent_moves"]
    if recent:
        for e in recent:
            ts = str(e.get("ts", "?"))[:19]
            rsn = str(e.get("reason", "?"))[:18]
            src_name = Path(str(e.get("before", "?"))).name[:32]
            dst_name = Path(str(e.get("after", "?"))).name[:32]
            lines.append(
                f"  {_dim(ts)}  {_cyan(f'{rsn:<18}')}  {src_name} → {dst_name}"
            )
    else:
        lines.append("  (이동 내역 없음)")
    lines.append("")

    # 데이터 파일 위치
    lines.append(_bold("[ 데이터 파일 ]") + "  " + _SEP[:44])
    lines.append(f"  Ledger : {ledger_path}")
    lines.append(f"  Cache  : {cache_path}")
    lines.append(_dim(_SEP))

    return "\n".join(lines)


# ------------------------------------
# Main
# ------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(
        description="AUTOSORT 대시보드: ledger.jsonl과 cache.json을 읽어 현황을 출력합니다.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument(
        "--root",
        default=r"C:\_AUTOSORT",
        help="Autosort 루트 디렉토리 (logs/와 cache/ 포함). 기본값: C:\\_AUTOSORT",
    )
    ap.add_argument(
        "--ledger",
        default=None,
        help="ledger.jsonl 명시 경로 (--root보다 우선 적용)",
    )
    ap.add_argument(
        "--cache",
        default=None,
        help="cache.json 명시 경로 (--root보다 우선 적용)",
    )
    ap.add_argument(
        "--refresh",
        metavar="SECONDS",
        type=int,
        default=None,
        help="자동 갱신 간격(초). 예: --refresh 5. 미지정 시 1회 출력 후 종료",
    )
    ap.add_argument(
        "--no-color",
        action="store_true",
        help="ANSI 색상 출력 비활성화",
    )
    args = ap.parse_args()

    if args.no_color:
        global _USE_COLOR
        _USE_COLOR = False

    root = Path(args.root)
    ledger_path = Path(args.ledger) if args.ledger else root / "logs" / "ledger.jsonl"
    cache_path = Path(args.cache) if args.cache else root / "cache" / "cache.json"

    if not ledger_path.exists():
        print(
            f"오류: ledger 파일을 찾을 수 없습니다: {ledger_path}\n"
            f"  --root 또는 --ledger 옵션을 확인하세요.",
            file=sys.stderr,
        )
        sys.exit(1)

    refresh_s = args.refresh

    if refresh_s and refresh_s > 0:
        _clear_screen()
        while True:
            try:
                entries = load_ledger(ledger_path)
                cache = load_cache(cache_path)
                stats = compute_stats(entries, cache)
                output = render_dashboard(stats, ledger_path, cache_path, refresh_s)
                _move_to_top()
                print(output, end="", flush=True)
                time.sleep(refresh_s)
            except KeyboardInterrupt:
                print("\n대시보드 종료.")
                sys.exit(0)
    else:
        entries = load_ledger(ledger_path)
        cache = load_cache(cache_path)
        stats = compute_stats(entries, cache)
        output = render_dashboard(stats, ledger_path, cache_path, refresh_s=None)
        print(output)


if __name__ == "__main__":
    main()
