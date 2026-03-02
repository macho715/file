import json
import sys
from pathlib import Path
from typing import Any

import pytest

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import autosortd_1py as m


def _make_paths(root: Path) -> m.Paths:
    paths = m.Paths(
        root=root,
        staging=root / "staging",
        out=root / "out",
        quarantine=root / "quarantine",
        dup=root / "dup",
        logs=root / "logs",
        cache=root / "cache",
        rules_dir=root / "rules",
    )
    m.ensure_dirs(paths)
    return paths


def test_xlsm_does_not_call_llm_and_routes_without_llm(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    rules_cfg = m.load_yaml(Path("rules/rules.yaml"))
    mapping_cfg = m.load_yaml(Path("rules/mapping.yaml"))
    ext_groups, compiled_rules = m.compile_rules(rules_cfg)

    paths = _make_paths(tmp_path)
    cache_path = paths.cache / "cache.json"
    ledger_path = paths.logs / "ledger.jsonl"

    src = tmp_path / "unknown_sheet.xlsm"
    src.write_text("dummy-content", encoding="utf-8")

    def _llm_should_not_be_called(*args: Any, **kwargs: Any) -> m.LLMDecision:
        raise AssertionError("llm_classify should not be called for .xlsm")

    monkeypatch.setattr(m, "llm_classify", _llm_should_not_be_called)

    m.handle_file(
        paths=paths,
        llm_base_url="http://127.0.0.1:8080/v1",
        rules_cfg=rules_cfg,
        mapping_cfg=mapping_cfg,
        ext_groups=ext_groups,
        compiled_rules=compiled_rules,
        cache_path=cache_path,
        ledger_path=ledger_path,
        p=src,
    )

    assert ledger_path.exists()
    lines = [
        ln for ln in ledger_path.read_text(encoding="utf-8").splitlines() if ln.strip()
    ]
    assert lines
    entry = json.loads(lines[-1])
    assert entry["reason"] in {"low_confidence", "not_in_allowlist_doc_type"}
    assert "quarantine" in entry["after"].lower()
