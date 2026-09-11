# Requirement trace methodology

The CSV is the editable repository trace required by Implementation Plan v1.4 Appendix D p27. It covers the six normative specifications; Plan is the sole execution-order authority and is recorded separately in `milestones.json`. The manifest is the architecture/context authority.

## Scope and IDs

- Every explicit governing requirement ID retains its source ID and priority. TAC, TDA, REF T01–T32 and A1-OUT acceptance/outcome IDs are included. All CUR-A1 and AIA-01…AIA-16 are individually traced.
- Required schema fields, API/state/evidence rows, publication/media gates and executable fixture rows without IDs receive stable local `N-<doc>-P<page>-T<table>-R<row>` or `...-B<block>-C<clause>` trace IDs. Independent commands/DDL guards use `-Snn` subclauses. These IDs index the locked source; they do not amend it.
- Repeated BL-* source IDs are document-namespaced (e.g. `TD-BL-005`). The original source ID is retained separately. Mirrored contracts in different governing sources stay separately located; they are not duplicate trace IDs.
- Counts are **source-located obligations/contract rows**, not the number of unique product features. Explicit IDs and granular required contract details are reported separately. Recommended SHOULD items are separately counted; MAY/optional features are conditional, never mandatory enabled defaults.
- Metadata, source lists, example labels, historical execution tables and open-choice tables are not promoted to requirements. Extraction decisions and continued PDF rows are recorded. Canonical annexes resolve historical machine names/versions, abbreviated facet labels and API/persistence mappings.

## Meaning of a trace row

`requirement → implementation_task → planned_code_schema → test_or_gate → milestone_evidence` is populated. In P0, actual code/schema and product-test evidence are explicitly unimplemented/planned. Later PRs must replace those markers with actual paths, test command/results and immutable milestone evidence. A trace never proves a product feature has passed.

`requirement-catalog.json` retains source excerpts, locators and canonical context. `validation-gates.json` assigns every row an acceptance oracle, negative/failure strategy and fixture family; implementation tasks refine those into actual tests without changing the governing behavior. Required fields of one object and each fixture activity are separate rows, rather than a vague “build backend” requirement.

## Phase interpretation

Implementation phases come from Plan §§7–20 and its ordered backlog, not earlier descriptive phase labels or AI0–AIx. Broad Appendix D coverage ranges are coverage/gate ranges; main milestone boundaries determine first implementation. P8 creates shared AI foundation and Admin Assist, keeping learner exposure and Auto activation OFF; P9 reuses it. P11 hardens/freezes reference modules after P10, P12 scales A1/pilots, P13 decides launch. Regression obligations continue beyond a row's initial implementation phase.

## Validation

Run `python3 tools/governance/validate_p0.py --sources --write-report`. The source check reads the locked PDFs with Poppler and independently checks explicit requirement/acceptance IDs. Structural checks enforce complete matrix columns, unique IDs, task/gate/ADR links, named requirement families, exact versions and the nine original lock hashes using the preserved initial handoff. Source/contract review is recorded separately; no P1/product test is represented as executed.
