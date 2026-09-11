# Lingvessa P0 governance package

This is a repository-ready P0 artifact set built from the owner-locked 2026-09-10 package. Governing PDFs and architecture manifest are unchanged. Start with `docs/baseline/baseline.yml`, `docs/baseline/p0-exit-checklist.md` and the updated `00_CONTEXT/01_implementation_state_and_handoff.md`.

The baseline YAML and label/issue YAML use JSON-compatible YAML for deterministic standard-library validation. The requirement matrix is UTF-8 RFC4180 CSV; richer source, task and gate records are JSON.

Run from this directory:

```sh
python3 tools/governance/validate_p0.py --sources --write-report
```

Python 3 standard library validates governance; `--sources` additionally requires Poppler `pdftotext` for independent checks of the unchanged PDFs. No product framework, provider key or domain database is needed. The validator is a P0 governance utility, not P1 feature implementation.

No Git repository/branch/commit/PR exists in the supplied package. Private monorepo creation belongs to IMP-P1-001 after owner acceptance. Labels and issue/PR templates are prepared locally; none was published to an external service.

**HARD STOP: do not begin P1 until the owner explicitly writes “P0 accepted. Proceed to P1.”**
