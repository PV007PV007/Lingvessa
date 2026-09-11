# Issue taxonomy

Labels are prepared in `.github/labels.yml`; no remote issues or labels were created in P0.

Use one `phase:P0`…`phase:P13`, one primary `workstream:*`, one `type:*`, and one `status:*`. Add `severity:BLOCKER|IMPORTANT|MINOR` to defects. Requirement IDs belong in the issue fields and trace matrix, not thousands of labels.

- BLOCKER: prevents safe/unambiguous execution of the currently authorized phase or violates an approved invariant. Stop affected work and follow change control.
- IMPORTANT: material implementation/gate gap needing resolution by its named phase; do not waive it by preference.
- MINOR: editorial or bounded debt with no invariant/gate violation.
- `contract-change` flags mandatory ADR/spec review; `owner-decision` marks a real unresolved approval/decision; `language:en`, `language:cs`, `language:shared` identify fixtures without authorizing engine forks.

Issue/task packets require governing refs, dependencies, goal, files/modules, acceptance and negative test, fixture, migration/compatibility, observability and rollback. See Definition of Ready and the prepared issue template.
