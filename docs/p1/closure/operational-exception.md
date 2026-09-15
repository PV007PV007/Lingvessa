# EXC-P1-001 — private-repository branch protection limitation

**OWNER APPROVED — current solo-development phase.** Approval: explicit owner instruction, 2026-09-14.

The repository remains **PRIVATE**. **Main is not technically protected.** The current plan does not enforce branch protection/rulesets for this private repository. The owner declines purchasing Pro/Team solely for that feature at this stage. `.github/repository-rules.json` is a desired configuration template; its presence does not prove enforcement.

Affected governing clauses:

- Implementation Plan v1.4 §4.1, p4: protected main and reviewed PRs/commits (unnumbered clause).
- Technical Specification v1.7 §7, p8: protected main and reviewed pull requests (unnumbered clause); related trace/task TS-REPO-001 / IMP-P1-001.

This is a recorded deviation from technical enforcement, not a claim that process controls implement branch protection. Plan §8 p6 and Appendix B p12 do not make enforcement a non-waivable hard P1 exit condition; its approval record on p13 explicitly includes accepted exceptions. The owner has supplied the required decision. The owner-locked specifications, architecture and P0–P13 semantics are unchanged.

Compensating controls:

- All implementation work uses implementation/* branches.
- Changes enter main through Pull Requests.
- Merge only after green hosted CI.
- No direct push to main by process.
- No force-push to main.
- Do not delete main.
- Owner reviews each milestone PR before merge.

Residual risk: GitHub cannot technically stop a direct/force push or deletion under this plan. These are owner-enforced process rules, not tested platform denials. PR #1 is OPEN; neither review approval nor merge is claimed. Reassess the exception with the owner when solo development ends, repository plan/access changes, or before production release review. No automatic production exception is created.
