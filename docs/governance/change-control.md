# Change control

Authority: manifest §§3.6–3.7; Implementation Plan v1.4 §§23–24 (pp10–11); Technical Design change control p21. This rule materializes approved governance.

Any behavior-changing change to language isolation; UUID/identity/versioning; lesson state/completion; mastery/evidence; Review; speech; publication/asset immutability; AI authority/permissions; AI paid-budget policy; privacy/retention; or P0–P13 milestone semantics requires **ADR/spec review first, then implementation/migration/test update**.

1. Identify exact locked source, version, requirement and affected invariant. Describe the behavioral diff and why existing contracts cannot serve the task.
2. Stop the affected implementation when the change conflicts with an approved invariant or an unresolved contract. No language-specific workaround may silently override a shared contract.
3. Record an ADR proposal and necessary controlled specification revision. Include data/API/event/state/evidence/privacy implications, compatibility window, migration/recompute/replay effects, tests/fixtures, rollback and affected release gates.
4. Obtain the product owner's explicit decision before implementing the changed behavior. The implementation model cannot grant itself an exception. No automatic reviewer or AI Assist/Auto action can substitute for owner or publication authority.
5. After approval, link the decision/revised baseline to the requirement, task, code/schema/migration, test/gate and milestone evidence in the same PR. Update generated clients and retained old/new fixtures where relevant.
6. Run targeted regression plus required phase gates. Preserve immutable historical attempts/evidence/publications. Operational handoff records the accepted change and validation.

Editing wording, links or formatting without a behavior change requires source/trace review but is not a new architecture decision. Locked PDFs are never silently overwritten; preserve their checksums/history. An operational handoff update uses the preserved original lock snapshot and is explicitly not a contract revision.

## Conflict record (use only for a real conflict)

- Source documents, versions, sections/pages and requirement IDs.
- Exact contradictory statements and the approved invariant affected.
- Implementation impact: why the requirement cannot be implemented safely/unambiguously.
- Minimum proposed ADR/spec change; alternatives only if necessary for the owner decision.
- Affected tests/fixtures, migrations/recompute and compatibility/rollback.
- Status: STOPPED pending owner decision; owner decision and timestamp once received.

No active conflict or accepted exception exists in this P0 batch.
