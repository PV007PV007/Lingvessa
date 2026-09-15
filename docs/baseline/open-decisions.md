# Open owner decisions

Only genuinely unresolved decisions are listed. OD-001 is recorded in `docs/p1/resolved-decisions.json`; OD-002 is implemented in `docs/p2/resolved-decisions.json` and becomes accepted with the P2 milestone. No listed decision blocks P2.

## OD-003 — Production hosting, region, topology and PostgreSQL HA/PITR tier

- Source: Formal §33.2 p21; TS §40.2 ADR-001/004 p22; TD §35 p20
- Why unresolved: Production geography, capacity, budget and backup tier require actual deployment selection.
- Latest phase: P13 / before production infrastructure or production data, whichever is earlier
- Affected requirements: NFR-DR-001, TS-ENV-003, TS-TECH-003
- Default behavior: Local/synthetic environment only; portable OCI + PostgreSQL. Northflank/R2 are development candidates, not production approval.
- Owner: Platform foundation / product owner

## OD-004 — Object storage/CDN provider and production delivery policy

- Source: TS §40.2 ADR-006 p22; TD §35 p20
- Why unresolved: Exact S3-compatible storage/CDN profile requires the media integration decision.
- Latest phase: P5 / before media integration
- Affected requirements: TS-MEDIA-001, MED-001, TD-CONT-001
- Default behavior: Adapter/local fixture storage; platform asset UUID/version/checksum remain canonical.
- Owner: Media/speech / platform owner

## OD-005 — Image/TTS/STT providers, licences and voice cast

- Source: TS §40.2 ADR-007 p22; Curriculum §19.2 p16; TD §35 p20
- Why unresolved: Provider quality, data use, licence/consent, varieties and voice cast require the approved integration spike.
- Latest phase: P5 / before generation/scoring integration or media batch
- Affected requirements: AUD-001, AUD-003, MED-001, CUR-A1-015, REF-A1-010
- Default behavior: Deterministic adapters/fixtures; no unapproved provider payload or production media. Required published media stays pre-generated.
- Owner: Media/speech / language leads

## OD-006 — Versioned speech confidence/target-feature policy and pilot calibration

- Source: Curriculum §19.2 p16; TD §14.2 p11; Manifest §2.2
- Why unresolved: Usability thresholds depend on selected provider/target/language and must not be invented as universal language scores.
- Latest phase: P5 before usable provider evidence; refine with P12 pilot before broad rollout
- Affected requirements: CUR-A1-010, REF-A1-006, AUD-005, TD-STATE-003
- Default behavior: Unusable/unapproved evaluation becomes speech_unavailable with no mastery/mistake/scheduler effect. Use controlled fixtures for contract tests.
- Owner: Media/speech / curriculum lead

## OD-007 — Initial approved local/free text AI provider/model/runtime

- Source: AI §22.2 AI-ADR-001/002 pp19–20; TS §40.2 ADR-008 p22
- Why unresolved: Exact local/free model choice requires quality/privacy/quota/current-terms spike; no provider is promised permanently free.
- Latest phase: P8 / before shared foundation provider integration
- Affected requirements: AI-PROV-001, AI-PROV-002, AI-COST-001, AIA-02, AIA-14
- Default behavior: Provider ports/doubles only until approved. paid_inference_enabled=false; monthly_paid_budget=0; no paid fallback.
- Owner: AI / security and product owner

## OD-008 — Learner conversation retention and provider data-handling policy

- Source: AI §22.2 AI-ADR-004 p19; TS §40.2 ADR-009 p22; Formal §33.2 p21
- Why unresolved: Exact retention/deletion/downstream handling policy must be approved for actual learner data route.
- Latest phase: P9 / before public learner AI or retaining conversation payload
- Affected requirements: AI-PRIV-001, AI-PRIV-002, AIA-03, AIA-13, TD-AILRN-004
- Default behavior: Learner AI off without consent/policy; minimal/off retention and scripted fallback; raw audio remains transient under fixed policy.
- Owner: AI / privacy and product owner

## OD-009 — Observable production backend and operational retention configuration

- Source: TS §40.2 ADR-010 p22; TD §35 p20
- Why unresolved: Exact analytics/observability backend and bounded operational retention are deployment choices not made in the baseline.
- Latest phase: P11 / before reference monitoring/restore acceptance; revalidate P13
- Affected requirements: TD-OBS-001, TD-OBS-003, TS-PRIV-001
- Default behavior: OpenTelemetry-compatible ports, bounded/pseudonymous metadata; no raw answers/audio/secrets in telemetry.
- Owner: QA/security/ops / platform owner

## OD-010 — Launch countries, minors/consent, processors and public privacy approvals

- Source: Formal §33.2 p21; TS §40.2 ADR-011 p23; AI AI-ADR-008 p20
- Why unresolved: Real launch jurisdictions, age policy and actual processors must be approved for the intended public release.
- Latest phase: P13 / BEFORE any real-user public registration or public EU AI flow
- Affected requirements: SEC-003, LEGAL-003, TS-PRIV-001, AI-PRIV-001
- Default behavior: No real-user public registration; synthetic/private testing. No invented universal age or legal retention threshold.
- Owner: Product owner / privacy-legal owner

## OD-011 — Public brand/trademark clearance

- Source: Formal §33.2 p21
- Why unresolved: Lingvessa is approved as a working name; public brand clearance is separate.
- Latest phase: P13 / before public brand release
- Affected requirements: LEGAL-002, LEGAL-004
- Default behavior: Use Lingvessa as working project name; no claim of cleared trademark.
- Owner: Product owner

## OD-012 — M02–M12 module-map approval and lexical inventory calibration

- Source: Curriculum §19.2 p16
- Why unresolved: 12-module architecture is fixed; authoring approval and lexical targets require full inventory/pilot review before bulk production.
- Latest phase: P12 / before M02–M12 authoring/production freeze
- Affected requirements: CUR-A1-002, CUR-A1-003, CUR-A1-006, CUR-A1-013
- Default behavior: Keep locked M01 fixtures; no bulk rollout; ~800–1000 active/250–400 receptive are design targets, not external CEFR mandates.
- Owner: Curriculum/content / language leads and product owner

## OD-013 — Optional Level Test readiness bands

- Source: Curriculum §§13,19.2 pp13,16
- Why unresolved: Readiness bands require pilot data, item analysis and expert approval.
- Latest phase: P12 / only before optional Level Test activation
- Affected requirements: CUR-A1-014, A1-OUT-01, A1-OUT-08
- Default behavior: Optional test inactive until calibrated; it never blocks A2 and makes no external certification claim.
- Owner: Curriculum/content / assessment owner

## OD-014 — Validated writing/conversation rubric before optional AI mastery effect

- Source: AI §22.2 AI-ADR-005 p19; Curriculum §19.2 p16
- Why unresolved: Default AI writing/conversation is advisory; any evidence-bearing path needs approved calibrated evaluator/rubric.
- Latest phase: P9 / before enabling such evidence; may remain advisory through P12
- Affected requirements: CUR-A1-021, AI-MAST-003, TD-AILRN-005, AIA-07
- Default behavior: Free-form AI practice/advice has no direct mastery effect. Only approved structured evaluator contracts may emit bounded evidence.
- Owner: AI / curriculum and assessment owner
