# Open decisions

No open architecture decision blocks P0. These are only named, deferred decisions present in the locked sources. Close each before its stated trigger; an earlier real deployment/data exposure advances the deadline. The owner acceptance of this P0 batch is an execution approval, not an architecture decision.

## OD-001 — Exact runtime/framework/tooling pins

- Why unresolved: Baseline fixes Node 24 LTS/TypeScript strict/pnpm and framework families; exact compatible versions/lockfile require the P1 compatibility spike.
- Source: TS §40.2 ADR-002 p22; TD §35 p20.
- Latest phase/trigger: P1 / before IMP-P1-001 gate.
- Affected requirements: `TS-TECH-001; TS-TECH-002; TS-TECH-004; TS-REPO-001`.
- Default before decision: No unpinned implementation/toolchain is accepted; keep family/major constraints.
- Owner: Platform foundation / technical owner.
- Status: OPEN, deferred; does not block P0.


## OD-002 — Authentication implementation details

- Why unresolved: Exact implementation/library and benchmarked credential parameters are not chosen by the baseline.
- Source: TS §40.2 ADR-003 p22; TD §35 p20.
- Latest phase/trigger: P2 / before identity acceptance.
- Affected requirements: `TS-AUTH-001; ROLE-001; TD-SEC-001`.
- Default before decision: Secure server sessions and Argon2id remain governing defaults; no public identity deployment before review.
- Owner: Identity/language / security owner.
- Status: OPEN, deferred; does not block P0.


## OD-003 — Production hosting, region, topology and PostgreSQL HA/PITR tier

- Why unresolved: Production geography, capacity, budget and backup tier require actual deployment selection.
- Source: Formal §33.2 p21; TS §40.2 ADR-001/004 p22; TD §35 p20.
- Latest phase/trigger: P13 / before production infrastructure or production data, whichever is earlier.
- Affected requirements: `NFR-DR-001; TS-ENV-003; TS-TECH-003`.
- Default before decision: Local/synthetic environment only; portable OCI + PostgreSQL. Northflank/R2 are development candidates, not production approval.
- Owner: Platform foundation / product owner.
- Status: OPEN, deferred; does not block P0.


## OD-004 — Object storage/CDN provider and production delivery policy

- Why unresolved: Exact S3-compatible storage/CDN profile requires the media integration decision.
- Source: TS §40.2 ADR-006 p22; TD §35 p20.
- Latest phase/trigger: P5 / before media integration.
- Affected requirements: `TS-MEDIA-001; MED-001; TD-CONT-001`.
- Default before decision: Adapter/local fixture storage; platform asset UUID/version/checksum remain canonical.
- Owner: Media/speech / platform owner.
- Status: OPEN, deferred; does not block P0.


## OD-005 — Image/TTS/STT providers, licences and voice cast

- Why unresolved: Provider quality, data use, licence/consent, varieties and voice cast require the approved integration spike.
- Source: TS §40.2 ADR-007 p22; Curriculum §19.2 p16; TD §35 p20.
- Latest phase/trigger: P5 / before generation/scoring integration or media batch.
- Affected requirements: `AUD-001; AUD-003; MED-001; CUR-A1-015; REF-A1-010`.
- Default before decision: Deterministic adapters/fixtures; no unapproved provider payload or production media. Required published media stays pre-generated.
- Owner: Media/speech / language leads.
- Status: OPEN, deferred; does not block P0.


## OD-006 — Versioned speech confidence/target-feature policy and pilot calibration

- Why unresolved: Usability thresholds depend on selected provider/target/language and must not be invented as universal language scores.
- Source: Curriculum §19.2 p16; TD §14.2 p11; Manifest §2.2.
- Latest phase/trigger: P5 before usable provider evidence; refine with P12 pilot before broad rollout.
- Affected requirements: `CUR-A1-010; REF-A1-006; AUD-005; TD-STATE-003`.
- Default before decision: Unusable/unapproved evaluation becomes speech_unavailable with no mastery/mistake/scheduler effect. Use controlled fixtures for contract tests.
- Owner: Media/speech / curriculum lead.
- Status: OPEN, deferred; does not block P0.


## OD-007 — Initial approved local/free text AI provider/model/runtime

- Why unresolved: Exact local/free model choice requires quality/privacy/quota/current-terms spike; no provider is promised permanently free.
- Source: AI §22.2 AI-ADR-001/002 pp19–20; TS §40.2 ADR-008 p22.
- Latest phase/trigger: P8 / before shared foundation provider integration.
- Affected requirements: `AI-PROV-001; AI-PROV-002; AI-COST-001; AIA-02; AIA-14`.
- Default before decision: Provider ports/doubles only until approved. paid_inference_enabled=false; monthly_paid_budget=0; no paid fallback.
- Owner: AI / security and product owner.
- Status: OPEN, deferred; does not block P0.


## OD-008 — Learner conversation retention and provider data-handling policy

- Why unresolved: Exact retention/deletion/downstream handling policy must be approved for actual learner data route.
- Source: AI §22.2 AI-ADR-004 p19; TS §40.2 ADR-009 p22; Formal §33.2 p21.
- Latest phase/trigger: P9 / before public learner AI or retaining conversation payload.
- Affected requirements: `AI-PRIV-001; AI-PRIV-002; AIA-03; AIA-13; TD-AILRN-004`.
- Default before decision: Learner AI off without consent/policy; minimal/off retention and scripted fallback; raw audio remains transient under fixed policy.
- Owner: AI / privacy and product owner.
- Status: OPEN, deferred; does not block P0.


## OD-009 — Observable production backend and operational retention configuration

- Why unresolved: Exact analytics/observability backend and bounded operational retention are deployment choices not made in the baseline.
- Source: TS §40.2 ADR-010 p22; TD §35 p20.
- Latest phase/trigger: P11 / before reference monitoring/restore acceptance; revalidate P13.
- Affected requirements: `TD-OBS-001; TD-OBS-003; TS-PRIV-001`.
- Default before decision: OpenTelemetry-compatible ports, bounded/pseudonymous metadata; no raw answers/audio/secrets in telemetry.
- Owner: QA/security/ops / platform owner.
- Status: OPEN, deferred; does not block P0.


## OD-010 — Launch countries, minors/consent, processors and public privacy approvals

- Why unresolved: Real launch jurisdictions, age policy and actual processors must be approved for the intended public release.
- Source: Formal §33.2 p21; TS §40.2 ADR-011 p23; AI AI-ADR-008 p20.
- Latest phase/trigger: P13 / BEFORE any real-user public registration or public EU AI flow.
- Affected requirements: `SEC-003; LEGAL-003; TS-PRIV-001; AI-PRIV-001`.
- Default before decision: No real-user public registration; synthetic/private testing. No invented universal age or legal retention threshold.
- Owner: Product owner / privacy-legal owner.
- Status: OPEN, deferred; does not block P0.


## OD-011 — Public brand/trademark clearance

- Why unresolved: Lingvessa is approved as a working name; public brand clearance is separate.
- Source: Formal §33.2 p21.
- Latest phase/trigger: P13 / before public brand release.
- Affected requirements: `LEGAL-002; LEGAL-004`.
- Default before decision: Use Lingvessa as working project name; no claim of cleared trademark.
- Owner: Product owner.
- Status: OPEN, deferred; does not block P0.


## OD-012 — M02–M12 module-map approval and lexical inventory calibration

- Why unresolved: 12-module architecture is fixed; authoring approval and lexical targets require full inventory/pilot review before bulk production.
- Source: Curriculum §19.2 p16.
- Latest phase/trigger: P12 / before M02–M12 authoring/production freeze.
- Affected requirements: `CUR-A1-002; CUR-A1-003; CUR-A1-006; CUR-A1-013`.
- Default before decision: Keep locked M01 fixtures; no bulk rollout; ~800–1000 active/250–400 receptive are design targets, not external CEFR mandates.
- Owner: Curriculum/content / language leads and product owner.
- Status: OPEN, deferred; does not block P0.


## OD-013 — Optional Level Test readiness bands

- Why unresolved: Readiness bands require pilot data, item analysis and expert approval.
- Source: Curriculum §§13,19.2 pp13,16.
- Latest phase/trigger: P12 / only before optional Level Test activation.
- Affected requirements: `CUR-A1-014; A1-OUT-01; A1-OUT-08`.
- Default before decision: Optional test inactive until calibrated; it never blocks A2 and makes no external certification claim.
- Owner: Curriculum/content / assessment owner.
- Status: OPEN, deferred; does not block P0.


## OD-014 — Validated writing/conversation rubric before optional AI mastery effect

- Why unresolved: Default AI writing/conversation is advisory; any evidence-bearing path needs approved calibrated evaluator/rubric.
- Source: AI §22.2 AI-ADR-005 p19; Curriculum §19.2 p16.
- Latest phase/trigger: P9 / before enabling such evidence; may remain advisory through P12.
- Affected requirements: `CUR-A1-021; AI-MAST-003; TD-AILRN-005; AIA-07`.
- Default before decision: Free-form AI practice/advice has no direct mastery effect. Only approved structured evaluator contracts may emit bounded evidence.
- Owner: AI / curriculum and assessment owner.
- Status: OPEN, deferred; does not block P0.


## Fixed or outside this decision register

The approved decisions in `decision-log.md` are not reopened. Paid AI stays disabled with budget zero. Modular monolith, PostgreSQL relational graph, shared EN/CS engine, DB isolation, exact facets, async speech, P8 foundation/P9 learner handoff, PWA-first and pre-generated media are fixed. Redis/graph DB/native/full-offline/realtime/payment expansion is not required to close P0; revisit only on the governed future trigger. No provider selection, pricing fact or public legal approval is claimed here.
