# P0 exit evidence

Batch timestamp: 2026-09-10T17:31:39+00:00. Status: **PASS — governance exit validation complete; owner acceptance pending**.

## Evidence

- Read owner manifest first, then original handoff, then all seven governing PDFs (184 pages).
- Original lock verified: 9/9 SHA-256 entries. All seven PDFs and manifest remain byte-identical. Original handoff preserved under `owner-lock/01_implementation_state_and_handoff.initial.md`; current operational handoff updated under the owner's explicit instruction.
- Exact baseline: Formal 1.7; Technical 1.7; Design 1.7; Curriculum 1.6; Reference 1.6; AI 1.4; Plan 1.4. Owner lock 2026-09-10.
- Fixed decisions: 20 accepted ADR transcriptions; no new architecture decision or accepted exception.
- Trace: 2453 source-located MUST rows; 2453 traced; 0 untraced; 0 duplicate trace IDs; 0 ambiguous trace IDs. Includes 507 explicit/named MUST requirements and acceptance items; remaining rows are granular required contract/fixture clauses. 22 SHOULD rows are counted separately.
- 31 bounded task packets span P0–P13; all four prepared P1 tasks have governing requirement/gate links. P8 Admin Assist depends on shared foundation; P9 reuses it. P11 precedes P12 rollout/P13 launch.
- 14 source-backed future decisions have phase deadlines and safe defaults; none blocks P0.
- PR/issue templates, labels/taxonomy, change-control, Definition of Ready and P0 checklist are present.
- Validation: PASS (26/26 checks). Machine evidence: `p0-validation.json`. CSV authored via artifact-tool; exact workbook-to-CSV round-trip passed; representative trace preview inspected.
- Product code/schema/API/migrations/AI/speech implementation: **No contract change**. No product tests executed. No P1 work started.

## Reproduce validation

From repository-ready root:

```sh
python3 tools/governance/validate_p0.py --sources --write-report
```

The validator uses Python standard library and Poppler `pdftotext`, checks unchanged locked sources independently from the CSV, and does not require a provider key or application database.

## Acceptance and next action

BLOCKER: 0. IMPORTANT: 0. No architecture owner decision required for P0. Owner acceptance of this batch remains pending. A repository-ready archive is supplied because no Git repository/branch/commit/PR exists in the input; private repository creation belongs to P1.

**STOP. Await “P0 accepted. Proceed to P1.”** The next task after that instruction is **IMP-P1-001** (private pnpm monorepo and exact compatible toolchain lock). Do not execute it now.
