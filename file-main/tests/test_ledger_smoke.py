"""
Smoke test: one move writes one ledger line with required keys.
Run from repo root: pytest tests/test_ledger_smoke.py -v
"""
import json
import sys
import tempfile
from pathlib import Path

# project root (parent of tests/) on path for import autosortd_1py
_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import pytest

import autosortd_1py as m


def test_one_move_writes_ledger_with_required_keys():

    required_keys = {"ts", "run_id", "action", "sha256", "reason", "before", "after"}

    with tempfile.TemporaryDirectory(prefix="autosort_ledger_smoke_") as tmp:
        root = Path(tmp)
        staging = root / "staging"
        out = root / "out"
        quarantine = root / "quarantine"
        dup = root / "dup"
        logs = root / "logs"
        cache = root / "cache"
        rules_dir = root / "rules"
        for d in (staging, out, quarantine, dup, logs, cache, rules_dir):
            d.mkdir(parents=True, exist_ok=True)

        paths = m.Paths(
            root=root,
            staging=staging,
            out=out,
            quarantine=quarantine,
            dup=dup,
            logs=logs,
            cache=cache,
            rules_dir=rules_dir,
        )
        ledger_path = paths.logs / "ledger.jsonl"
        dst_dir = out / "Dev" / "Repos"
        dst_dir.mkdir(parents=True, exist_ok=True)

        src = root / "smoke_source.txt"
        src.write_text("smoke", encoding="utf-8")

        run_id = "20260101-120000"
        sha = m.sha256_file(src)
        m.move_with_ledger(
            paths,
            src,
            dst_dir,
            "smoke_source.txt",
            ledger_path,
            run_id,
            sha,
            "smoke_test",
        )

        assert ledger_path.exists(), "ledger.jsonl should exist"
        lines = [ln.strip() for ln in ledger_path.read_text(encoding="utf-8").splitlines() if ln.strip()]
        assert len(lines) >= 1, "at least one ledger entry"
        entry = json.loads(lines[-1])
        missing = required_keys - set(entry.keys())
        assert not missing, f"ledger entry missing keys: {missing}"
