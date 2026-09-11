# P0 exit checklist

Status is determined by `p0-validation.json` plus the source/contract review below. Product tests remain planned. P0 PASS does not authorize P1; owner acceptance remains pending.

| Check | Evidence |
|---|---|
| Exact seven-document owner-locked baseline, versions, lock date and authority | baseline.yml; original SHA256 manifest; validator |
| Nine original lock hashes verify, including preserved initial handoff | owner-lock snapshot and SHA resolution report |
| Fixed decisions materialized without reopening approved architecture | decision-log.md; ADR-D01…ADR-D20 |
| Complete source-located MUST/acceptance trace, including Curriculum and AIA | requirements-trace.csv; source-coverage.json; PDF ID coverage |
| Every requirement links to task, planned code/schema, test/gate and milestone | validator; implementation-backlog.json; validation-gates.json |
| Only actual deferred choices in open decisions | open-decisions.md/.json with source, deadline and safe default |
| PR, issue taxonomy, change-control and DoR exist | .github templates/labels; docs/governance |
| P1 packets link to governing requirements and remain unstarted | p1-task-packets.md; backlog |
| No unresolved data/state/mastery/speech/AI authority contradiction encountered | source/contract review below; conflicts.json |
| Updated operational handoff and explicit P1 hard stop | 00_CONTEXT/01_implementation_state_and_handoff.md |

## Source and contract review

Read manifest first in full, then original handoff, then all seven PDFs (184 pages). Checked all nine supplied lock hashes before operational handoff update. This is implementation readiness/materialization, not a new architecture redesign audit.

- DB isolation and ownership: fixed composite PostgreSQL guards, approved trigger allowance, negative foreign-user/cross-language fixtures and facet→knowledge rule retained (Manifest §2.1; TD pp22,24).
- Mastery/evidence: canonical six skills and exact permitted facets/pairs govern source labels; selection/typed tasks never create unassessed Speaking/Pronunciation (Manifest §2.4; FS p26; TD pp12,22).
- Speech: idempotent cancellation settlement, exact Pronunciation facet including intelligibility, retry/new attempt distinction, terminal/late callback handling and transient cleanup are fixed (Manifest §2.2; TD p23).
- Identity/publication: UUID vs stable_code vs version_code, immutable publications/evidence and checksum-specific runtime Approval retained (Manifest §3; TD §§8–11 and p22).
- AI: shared P8 foundation/Admin Assist precedes P9 learner/Auto; opt-in/data-policy precede dispatch; free/local-first, paid OFF, budget zero and human publication authority remain fixed (Manifest §2.3; Plan §§15–16; AI canonical annex).
- Execution: Plan v1.4 alone controls P0–P13; P11 reference hardening precedes P12 bulk A1/pilot and P13 launch. No legacy phase table authorizes implementation.
- Reference fixtures and M01 lesson coverage remain locked inputs; they are traced to P2–P7 contracts and P11 regression. They are not claimed executable or tested in P0.

No unresolved contradiction requiring owner architecture decision was encountered while materializing this P0 scope. No contract change. Future implementation discovery follows the mandatory STOP protocol.
