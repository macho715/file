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


def _load_cfgs() -> tuple[dict[str, Any], dict[str, Any], dict[str, list[str]], list[m.CompiledRule]]:
    rules_cfg = m.load_yaml(Path("rules/rules.yaml"))
    mapping_cfg = m.load_yaml(Path("rules/mapping.yaml"))
    ext_groups, compiled_rules = m.compile_rules(rules_cfg)
    return rules_cfg, mapping_cfg, ext_groups, compiled_rules


def _ledger_entries(ledger_path: Path) -> list[dict[str, Any]]:
    if not ledger_path.exists():
        return []
    return [
        json.loads(ln)
        for ln in ledger_path.read_text(encoding="utf-8").splitlines()
        if ln.strip()
    ]


def test_no_llm_docx_or_xlsx_routes_to_quarantine(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    rules_cfg, mapping_cfg, ext_groups, compiled_rules = _load_cfgs()
    paths = _make_paths(tmp_path)

    src = tmp_path / "unknown_invoice.xlsx"
    src.write_text("dummy", encoding="utf-8")
    cache_path = paths.cache / "cache.json"
    ledger_path = paths.logs / "ledger.jsonl"

    def _llm_called(*_args: Any, **_kwargs: Any) -> m.LLMDecision:
        raise AssertionError("LLM must not be called in --no-llm mode")

    monkeypatch.setattr(m, "llm_classify_with_retry", _llm_called)

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
        no_llm=True,
    )

    assert not src.exists()
    assert paths.quarantine.exists()
    entries = _ledger_entries(ledger_path)
    assert entries, "ledger entry should be written"
    entry = entries[-1]
    assert entry["reason"] == "no_llm_ambiguous_doc"
    assert "quarantine" in entry["after"].lower()


def test_no_llm_keeps_rule_only_py_without_llm(tmp_path: Path) -> None:
    rules_cfg, mapping_cfg, ext_groups, compiled_rules = _load_cfgs()
    paths = _make_paths(tmp_path)

    src = tmp_path / "script.py"
    src.write_text("print('hello')", encoding="utf-8")
    cache_path = paths.cache / "cache.json"
    ledger_path = paths.logs / "ledger.jsonl"

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
        no_llm=True,
    )

    assert not src.exists()
    entries = _ledger_entries(ledger_path)
    assert entries, "ledger entry should be written"
    entry = entries[-1]
    assert entry["reason"] in {"auto_apply", "forced_quarantine_doc_type"}
    assert "Dev\\Repos" in entry["after"] or "Dev/Repos" in entry["after"]


def test_no_llm_sweep_runs_without_llm_calls(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    rules_cfg, mapping_cfg, ext_groups, compiled_rules = _load_cfgs()
    paths = _make_paths(tmp_path)

    watch_dir = tmp_path / "watch"
    watch_dir.mkdir()
    (watch_dir / "invoice_candidate.pdf").write_text("pdf bytes", encoding="utf-8")
    (watch_dir / "project.py").write_text("import os", encoding="utf-8")

    cache_path = paths.cache / "cache.json"
    ledger_path = paths.logs / "ledger.jsonl"

    called = {"llm": 0}

    def _llm_called(*_args: Any, **_kwargs: Any) -> m.LLMDecision:
        called["llm"] += 1
        raise AssertionError("LLM must not be called in no_llm sweep mode")

    monkeypatch.setattr(m, "llm_classify_with_retry", _llm_called)

    h = m.Handler(
        paths=paths,
        llm_base_url="http://127.0.0.1:8080/v1",
        rules_cfg=rules_cfg,
        mapping_cfg=mapping_cfg,
        ext_groups=ext_groups,
        compiled_rules=compiled_rules,
        cache_path=cache_path,
        ledger_path=ledger_path,
        no_llm=True,
    )
    m.sweep_existing(watch_dir, h)

    assert called["llm"] == 0
    entries = _ledger_entries(ledger_path)
    assert any(e["reason"] == "no_llm_ambiguous_doc" for e in entries)
    assert any("quarantine" in e["after"].lower() for e in entries)
    assert any("Dev\\Repos" in e["after"] or "Dev/Repos" in e["after"] for e in entries)
