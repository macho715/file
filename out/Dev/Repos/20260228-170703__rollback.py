# C:\_AUTOSORT\rollback.py (or run from repo root with --ledger)
import argparse
import json
import shutil
from pathlib import Path


def load_ops(ledger_path: Path, run_id: str):
    ops = []
    for line in ledger_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        obj = json.loads(line)
        if obj.get("run_id") == run_id and obj.get("action") == "move":
            ops.append(obj)
    return ops


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ledger", default=r"C:\_AUTOSORT\logs\ledger.jsonl")
    ap.add_argument("--run_id", required=True)
    ap.add_argument("--dry_run", action="store_true")
    args = ap.parse_args()

    ledger = Path(args.ledger)
    if not ledger.exists():
        raise SystemExit(f"ledger not found: {ledger}")

    ops = load_ops(ledger, args.run_id)
    if not ops:
        raise SystemExit(f"no ops for run_id={args.run_id}")

    # reverse for safe rollback
    moved = 0
    missing = 0
    for obj in reversed(ops):
        src = Path(obj["after"])
        dst = Path(obj["before"])
        if not src.exists():
            missing += 1
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)

        if args.dry_run:
            print(f"DRY_RUN move: {src} -> {dst}")
        else:
            shutil.move(str(src), str(dst))
        moved += 1

    print(f"OK run_id={args.run_id} moved={moved} missing_after={missing} total={len(ops)}")


if __name__ == "__main__":
    main()
