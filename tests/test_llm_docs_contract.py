import json
import tempfile
from pathlib import Path

import autosortd_1py as m


def _mk_paths(root: Path) -> m.Paths:
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


def _base_rules_and_mapping():
    rules_cfg = {
        "ignore": {"extensions": [], "globs": []},
        "stability_check": {"enabled": False, "ignore_extensions": []},
    }
    mapping_cfg = {
        "doc_type_map": {"ops_doc": "Docs\\Ops", "other": "Docs\\Other"},
        "rename_policy": {"ops_doc": "keep", "other": "keep"},
        "apply_gate": {
            "quarantine_below": 0.90,
            "quarantine_doc_types": ["other"],
            "allow_auto_apply_doc_types": ["ops_doc"],
        },
    }
    ext_groups = {"docs": [".pdf", ".docx", ".xlsx"]}
    return rules_cfg, mapping_cfg, ext_groups


def test_from_dict_downgrades_invalid_doc_type_to_other():
    dec = m.LLMDecision.from_dict(
        {
            "doc_type": "dev_archive",
            "confidence": 0.99,
            "reasons": ["model_guess"],
        }
    )

    assert dec.doc_type == "other"
    assert m.has_llm_contract_violation(dec)


def test_handle_file_quarantines_llm_contract_violation(monkeypatch):
    with tempfile.TemporaryDirectory(prefix="autosort_llm_contract_") as tmp:
        root = Path(tmp)
        paths = _mk_paths(root)
        rules_cfg, mapping_cfg, ext_groups = _base_rules_and_mapping()

        src = root / "sample.pdf"
        src.write_bytes(b"dummy")

        monkeypatch.setattr(
            m,
            "llm_classify",
            lambda *args, **kwargs: m.LLMDecision.from_dict(
                {
                    "doc_type": "photo",
                    "confidence": 0.95,
                    "reasons": ["bad_contract"],
                }
            ),
        )

        m.handle_file(
            paths=paths,
            llm_base_url="http://127.0.0.1:8080/v1",
            rules_cfg=rules_cfg,
            mapping_cfg=mapping_cfg,
            ext_groups=ext_groups,
            compiled_rules=[],
            cache_path=paths.cache / "cache.json",
            ledger_path=paths.logs / "ledger.jsonl",
            p=src,
        )

        lines = (paths.logs / "ledger.jsonl").read_text(encoding="utf-8").splitlines()
        last = json.loads(lines[-1])
        assert last["reason"] == m.LLM_CONTRACT_VIOLATION_PREFIX
        assert "quarantine" in last["after"]


def test_handle_file_marks_llm_low_confidence_reason(monkeypatch):
    with tempfile.TemporaryDirectory(prefix="autosort_llm_low_conf_") as tmp:
        root = Path(tmp)
        paths = _mk_paths(root)
        rules_cfg, mapping_cfg, ext_groups = _base_rules_and_mapping()

        src = root / "sample2.pdf"
        src.write_bytes(b"dummy")

        monkeypatch.setattr(
            m,
            "llm_classify",
            lambda *args, **kwargs: m.LLMDecision.from_dict(
                {
                    "doc_type": "ops_doc",
                    "confidence": 0.20,
                    "reasons": ["too_uncertain"],
                }
            ),
        )

        m.handle_file(
            paths=paths,
            llm_base_url="http://127.0.0.1:8080/v1",
            rules_cfg=rules_cfg,
            mapping_cfg=mapping_cfg,
            ext_groups=ext_groups,
            compiled_rules=[],
            cache_path=paths.cache / "cache.json",
            ledger_path=paths.logs / "ledger.jsonl",
            p=src,
        )

        lines = (paths.logs / "ledger.jsonl").read_text(encoding="utf-8").splitlines()
        last = json.loads(lines[-1])
        assert last["reason"] == "llm_low_confidence"
        assert "quarantine" in last["after"]
