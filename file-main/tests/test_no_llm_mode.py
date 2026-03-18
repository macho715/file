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


def _last_ledger_entry(ledger_path: Path) -> dict[str, Any]:
    lines = [ln for ln in ledger_path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    assert lines, "expected at least one ledger line"
    return json.loads(lines[-1])


def test_no_llm_pdf_goes_to_quarantine_and_skips_llm(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    rules_cfg = m.load_yaml(Path("rules/rules.yaml"))
    mapping_cfg = m.load_yaml(Path("rules/mapping.yaml"))
    ext_groups, compiled_rules = m.compile_rules(rules_cfg)

    paths = _make_paths(tmp_path)
    cache_path = paths.cache / "cache.json"
    ledger_path = paths.logs / "ledger.jsonl"

    src = tmp_path / "ambiguous_doc.pdf"
    src.write_bytes(b"%PDF-1.4\n%dummy\n")

    monkeypatch.setattr(m, "wait_until_stable", lambda *args, **kwargs: True)

    def _llm_should_not_be_called(*args: Any, **kwargs: Any) -> m.LLMDecision:
        raise AssertionError("llm_classify_with_retry should not be called in --no-llm mode")

    monkeypatch.setattr(m, "llm_classify_with_retry", _llm_should_not_be_called)

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

    entry = _last_ledger_entry(ledger_path)
    assert entry["reason"] == "no_llm_ambiguous_doc"
    assert "quarantine" in entry["after"].lower()


def test_no_llm_docx_goes_to_quarantine_and_skips_llm(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    rules_cfg = m.load_yaml(Path("rules/rules.yaml"))
    mapping_cfg = m.load_yaml(Path("rules/mapping.yaml"))
    ext_groups, compiled_rules = m.compile_rules(rules_cfg)

    paths = _make_paths(tmp_path)
    cache_path = paths.cache / "cache.json"
    ledger_path = paths.logs / "ledger.jsonl"

    src = tmp_path / "ambiguous_doc.docx"
    src.write_bytes(b"dummy-docx-content")

    monkeypatch.setattr(m, "wait_until_stable", lambda *args, **kwargs: True)

    def _llm_should_not_be_called(*args: Any, **kwargs: Any) -> m.LLMDecision:
        raise AssertionError("llm_classify_with_retry should not be called in --no-llm mode")

    monkeypatch.setattr(m, "llm_classify_with_retry", _llm_should_not_be_called)

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

    entry = _last_ledger_entry(ledger_path)
    assert entry["reason"] == "no_llm_ambiguous_doc"
    assert "quarantine" in entry["after"].lower()


def test_no_llm_keeps_rule_based_routing(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    rules_cfg = m.load_yaml(Path("rules/rules.yaml"))
    mapping_cfg = m.load_yaml(Path("rules/mapping.yaml"))
    ext_groups, compiled_rules = m.compile_rules(rules_cfg)

    paths = _make_paths(tmp_path)
    cache_path = paths.cache / "cache.json"
    ledger_path = paths.logs / "ledger.jsonl"

    src = tmp_path / "AGI-TR DPR report.pdf"
    src.write_bytes(b"%PDF-1.4\n%dummy\n")

    monkeypatch.setattr(m, "wait_until_stable", lambda *args, **kwargs: True)

    def _llm_should_not_be_called(*args: Any, **kwargs: Any) -> m.LLMDecision:
        raise AssertionError("llm_classify_with_retry should not be called for high-confidence rules")

    monkeypatch.setattr(m, "llm_classify_with_retry", _llm_should_not_be_called)

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

    entry = _last_ledger_entry(ledger_path)
    assert entry["reason"] == "auto_apply"
    assert "quarantine" not in entry["after"].lower()
