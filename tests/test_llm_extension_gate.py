import sys
import tempfile
from pathlib import Path
from typing import Any

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


def _base_mapping() -> dict[str, Any]:
    return {
        "doc_type_map": {"ops_doc": "Docs\\Ops", "other": "Docs\\Other"},
        "rename_policy": {"ops_doc": "keep", "other": "keep"},
        "apply_gate": {
            "quarantine_below": 0.90,
            "quarantine_doc_types": [],
            "allow_auto_apply_doc_types": ["ops_doc", "other"],
        },
    }


def test_llm_called_only_for_allowed_doc_extensions(monkeypatch: Any) -> None:
    with tempfile.TemporaryDirectory(prefix="autosort_llm_allowed_") as tmp:
        root = Path(tmp)
        paths = _make_paths(root)
        p = root / "sample.xlsx"
        p.write_text("xlsx-content", encoding="utf-8")

        called = {"count": 0}

        def fake_llm(*args: Any, **kwargs: Any) -> m.LLMDecision:
            called["count"] += 1
            return m.LLMDecision(
                doc_type="ops_doc",
                suggested_name="sample.xlsx",
                confidence=0.95,
                reasons=["fake"],
            )

        monkeypatch.setattr(m, "llm_classify", fake_llm)

        m.handle_file(
            paths=paths,
            llm_base_url="http://127.0.0.1:8080/v1",
            rules_cfg={"stability_check": {"enabled": False}, "ignore": {}},
            mapping_cfg=_base_mapping(),
            ext_groups={"docs": [".pdf", ".docx", ".xlsx", ".xlsm"]},
            compiled_rules=[],
            cache_path=paths.cache / "cache.json",
            ledger_path=paths.logs / "ledger.jsonl",
            p=p,
        )

        assert called["count"] == 1


def test_xlsm_processed_without_llm(monkeypatch: Any) -> None:
    with tempfile.TemporaryDirectory(prefix="autosort_xlsm_rule_only_") as tmp:
        root = Path(tmp)
        paths = _make_paths(root)
        p = root / "macro.xlsm"
        p.write_text("xlsm-content", encoding="utf-8")

        called = {"count": 0}

        def fake_llm(*args: Any, **kwargs: Any) -> None:
            called["count"] += 1
            return None

        monkeypatch.setattr(m, "llm_classify", fake_llm)

        m.handle_file(
            paths=paths,
            llm_base_url="http://127.0.0.1:8080/v1",
            rules_cfg={"stability_check": {"enabled": False}, "ignore": {}},
            mapping_cfg=_base_mapping(),
            ext_groups={"docs": [".pdf", ".docx", ".xlsx", ".xlsm"]},
            compiled_rules=[],
            cache_path=paths.cache / "cache.json",
            ledger_path=paths.logs / "ledger.jsonl",
            p=p,
        )

        assert called["count"] == 0
