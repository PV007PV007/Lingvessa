# Definition of Ready

Authority: Implementation Plan v1.4 §23 p10. A task is ready only when every applicable item below has concrete evidence in its task packet. A planned trace row is not implementation evidence and does not make a later phase authorized.

- Exact governing requirement IDs, document versions and contract sections/pages are linked.
- Phase is from Plan P0–P13; prior phase/owner authorization and task dependencies are satisfied.
- Goal is one verifiable behavior; code/module ownership boundary is explicit.
- Contract/schema is versioned and known, or its creation is explicitly included in this task within its authorized phase.
- Acceptance test/gate and applicable negative/failure/retry case are defined before or with implementation; expected result is stated.
- Required reference/synthetic fixture exists or its creation is included in the task.
- External provider dependency has an internal adapter contract, approved data route and deterministic fallback; CI uses doubles without production secrets. No hidden paid fallback.
- Migration, compatibility, immutable history and rollback implications are documented, or explicitly marked not applicable.
- Required observability/correlation and privacy restrictions are identified.
- No unresolved owner decision blocks the task at its decision deadline. Fixed manifest decisions are not marked open.

P1 task packets are prepared in `docs/baseline/p1-task-packets.md`. They cannot be started until the owner writes: **P0 accepted. Proceed to P1.** Exact toolchain pins are a deliverable inside IMP-P1-001, not a missing P0 architecture contract.

## Definition of Done

Commit code and required tests/schema/migrations together, pass clean-checkout gates, verify failures/retries and applicable bilingual regression, attach actual code/test/milestone evidence to the trace, and update the operational handoff. A future test path or a checked task box is not proof of a passed test.
