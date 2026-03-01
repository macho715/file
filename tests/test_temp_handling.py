"""tmp/part/crdownload handling should always pass stability gate and write ledger. / tmp/part/crdownload 안정성 게이트 및 ledger를 항상 기록한다."""

import json
import sys
import tempfile
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import autosortd_1py as m


def _build_context(root: Path):
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
    m.ensure_dirs(paths)

    rules_cfg = m.load_yaml(_root / "rules" / "rules.yaml")
    mapping_cfg = m.load_yaml(_root / "rules" / "mapping.yaml")
    ext_groups, compiled_rules = m.compile_rules(rules_cfg)
    cache_path = paths.cache / "seen_sha256.json"
    ledger_path = paths.logs / "ledger.jsonl"

    return (
        paths,
        rules_cfg,
        mapping_cfg,
        ext_groups,
        compiled_rules,
        cache_path,
        ledger_path,
    )


def test_tmp_unstable_routes_to_quarantine_and_writes_ledger(monkeypatch):
    with tempfile.TemporaryDirectory(prefix="autosort_tmp_unstable_") as tmp:
        root = Path(tmp)
        (
            paths,
            rules_cfg,
            mapping_cfg,
            ext_groups,
            compiled_rules,
            cache_path,
            ledger_path,
        ) = _build_context(root)

        tmp_file = root / "partial_download.tmp"
        tmp_file.write_text("incomplete", encoding="utf-8")

        monkeypatch.setattr(m, "wait_until_stable", lambda *_args, **_kwargs: False)

        m.handle_file(
            paths,
            "http://127.0.0.1:8080/v1",
            rules_cfg,
            mapping_cfg,
            ext_groups,
            compiled_rules,
            cache_path,
            ledger_path,
            tmp_file,
        )

        moved = list(paths.quarantine.glob("UNSTABLE__partial_download*.tmp"))
        assert moved, "unstable .tmp should be quarantined"
        assert ledger_path.exists(), "ledger.jsonl should be created"
        lines = [
            ln.strip()
            for ln in ledger_path.read_text(encoding="utf-8").splitlines()
            if ln.strip()
        ]
        assert lines, "ledger should include at least one entry"
        last = json.loads(lines[-1])
        assert last["reason"] == "unstable_file"
        assert "quarantine" in last["after"].lower()


def test_tmp_stable_routes_to_temp_and_writes_ledger(monkeypatch):
    with tempfile.TemporaryDirectory(prefix="autosort_tmp_stable_") as tmp:
        root = Path(tmp)
        (
            paths,
            rules_cfg,
            mapping_cfg,
            ext_groups,
            compiled_rules,
            cache_path,
            ledger_path,
        ) = _build_context(root)

        tmp_file = root / "download_ready.tmp"
        tmp_file.write_text("complete-content", encoding="utf-8")

        monkeypatch.setattr(m, "wait_until_stable", lambda *_args, **_kwargs: True)

        m.handle_file(
            paths,
            "http://127.0.0.1:8080/v1",
            rules_cfg,
            mapping_cfg,
            ext_groups,
            compiled_rules,
            cache_path,
            ledger_path,
            tmp_file,
        )

        moved = list((paths.out / "Temp").glob("download_ready*.tmp"))
        assert (
            moved
        ), "stable .tmp should be routed by TEMP__INCOMPLETE_DOWNLOAD into out/Temp"
        assert ledger_path.exists(), "ledger.jsonl should be created"
        lines = [
            ln.strip()
            for ln in ledger_path.read_text(encoding="utf-8").splitlines()
            if ln.strip()
        ]
        assert lines, "ledger should include at least one entry"
        last = json.loads(lines[-1])
        assert last["reason"] in {
            "auto_apply",
            "low_confidence",
            "not_in_allowlist_doc_type",
        }
        assert "out" in last["after"].lower() and "temp" in last["after"].lower()
