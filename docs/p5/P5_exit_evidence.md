# P5 exit evidence

**IN PROGRESS / NOT READY. PR #5 OPEN DRAFT; no merge or P6 authorization.**

## Current M01 review follow-up — 2026-10-12

Predecessor source 785fff956f7b7c5c017921d96103f7a0ae8f8d44 passed all seven workflows; both P5 archives and 17 acceptance references were verified. The new [offline M01 reviewer](m01-listening-review.md) adds paired listening, per-file notes, filtering, cue seeking and guarded feedback restore for the saved 216-file draft. Local verification checks exact embedded WAV bytes. Hosted UI checks use explicit four-WAV audition fixtures and a separate real 420-slot metadata catalog; external M01 audio bytes remain outside CI. Five new hash references bring acceptance evidence to 22. This change needs its own hosted results. All 216 recordings still require actual human QA; the 204 unavailable files, final cast/rights and publication remain open.

## Exact-source hosted evidence

Last observed full runtime PASS: `81e6ddacb839abf2473630c889521442193d1d21`. P5 PR run 37449893245 / job 112223635448 and push run 37449888853 / job 112223620056, plus P1–P4 regression: all seven runs green. `evidence/ci-batch-013.json` retains actual steps, commands, artifact checksums and runtime summary. PR artifact 11405148602 SHA-256 `c6fb696f77024cdec9cd4763c1f9cb4009e969720d66f2f2f165f45d27c1fc1a` was downloaded and its report bindings verified.

| Gate | Result on that exact historical source |
| --- | --- |
| Frozen install / baseline / full check | PASS; 76/76 baseline, 54 unit, 4 smoke |
| Dependency audit | PASS; zero findings; P5-DEP-001 resolved |
| Original audition | 8 WAVs / 4 model-text-speaker pairs verified |
| Reference media/flags | Structural/source-geometry PASS; no publication approval |
| PostgreSQL | 18.6; six migrations, clean/replay/seed/reseed/recreation/isolation |
| P5 contracts | 3 S3 + 8 media + 4 audio + 12 speech gates PASS |
| Integration / Chromium | 16 integration / 17 browser cases; no failures or skips |
| OCI | Four images ready; DB outage gives API/worker 503, liveness 200; recovery 200 |

Every later revision requires its own CI. Current PR checks and `artifacts/p5/acceptance-summary.json` provide the final exact-source runtime result. The new Pocket validator also emits its checked-out SHA. Parent PASS does not certify this new audition/evidence revision. Runtime PASS never constitutes milestone, merge or P6 approval.

## Audition evidence and limits

The owner-authorized 2026-10-09 Pocket TTS experiment adds four Czech normal/slow candidate files, ten raw generated turns and two continuous diagnostics to the unchanged eight Piper samples. Retained byte/provenance checks pass. See [the batch README and WAV links](voice-audition/pocket-20261009/README.md), immutable reports and `recovery.json`. Both new Czech candidates are HOLD_FOR_REVIEW; human listening is PENDING. ASR discrepancies are not verified human pronunciation judgements. The owner explicitly authorized uploading this batch to private PR #5 on 2026-10-10 (`evidence/pocket-upload-authorization.json`).

All retained audio/report bytes were restored from the saved archive and not regenerated. Original ephemeral generation/ASR scripts, execution logs and YAML were absent; the current validator was reconstructed. Historical validation reports do not claim reexecution or recovery of missing scripts. Browser playback/rendering of the standalone audition page was not executed.

No new direct application dependency, schema, API, migration or production provider change is made. The follow-up below updates an existing transitive dependency. No model weights, learner data, human-uploaded reference, paid inference or later-phase runtime is introduced. The separate earlier transitive dependency correction is resolved on 81e6ddac; its failed parent and remediation evidence remain intact.

## Open exit conditions

Plan v1.4 §12 p7 requires all M01 required asset IDs to resolve. Current drafts: 18 SVGs, 12 flags, 168 scripts / 420 audio slots, six voice profiles. Audition bytes remain outside the approved publication registry. Approved assets = 0. Complete cast and rights review, full media generation, human linguistic/semantic/accessibility/publication QA and remaining compound requirements are open.

OD-004 delivery OPEN; OD-005 final cast/full generation OPEN; OD-006 usable real-provider calibration OPEN with neutral speech_unavailable fallback. Trace remains **174 PASS / 30 PARTIAL / 152 PENDING**, all 356 source rows. No requirement promotion or waiver. EXC-P1-001 remains operational controls without technical main protection. Keep PR #5 OPEN DRAFT; no merge or P6.

## Exact-source follow-up: P5-DEP-002

The uploaded audition source `cab5af5e080c92b7607ea05f24396fbd02052cd0` passed baseline, full check/build and both audition verification steps in hosted P5 push/PR runs. All seven workflows then failed the unchanged dependency audit on sharp 0.35.4 (GHSA-wq5f-xc86-pv6w). Database/browser/OCI gates after audit did not execute on that source, so it is not a full runtime PASS. Actual run/job steps: `docs/p5/evidence/ci-pocket-audit-failure.json` (repository-root path).

Remediation updates only sharp and matching platform packages 0.35.4→0.35.5, libvips packages 1.3.3→1.3.4, within Next 16.3.8's existing ^0.35.4 optional range. Direct dependencies, unrelated lock entries and audit policy are unchanged. Frozen install, zero-advisory audit, native SVG decoding with project sharp 0.35.5 / librsvg 2.63.2, baseline 76/76 and retained-audio checks pass locally. Exact evidence and the native probe's initial resolution correction: `docs/p5/evidence/sharp-patch-validation.json`.

This child source still requires its own full hosted run. PR metadata and exact-source CI artifacts will record the final result without a self-referential evidence commit. P5 remains NOT READY, PR OPEN DRAFT, no merge, publication, cast acceptance or P6.

## Unpublished M01 working authoring — 2026-10-11

Owner-delegated selection now yields 104 unique available turns and 216 final drafts (210 EN / 6 CS), with 216 blind ASR screens; 109 are flagged. The remaining 204 Czech files are blocked by pinned PyTorch HTTP 403. All 532 retained WAV hashes and exact final dialogue timing/PCM relationships passed local validation. The saved archive remains outside the publication registry and outside GitHub. The new hosted gate validates metadata only and explicitly does not claim audio-byte validation. See [complete authoring and recovery evidence](m01-audio-draft-20261011/README.md).

The initial telemetry-related automatic rejection, safer kernel-isolated continuation, two infrastructure replacements and one processing-journal repair remain explicit. Zero quality retries or paid calls. Working cast choice is delegated; human QA, final rights/cast approval, full generation and publication remain open. Trace and milestone status are unchanged; PR #5 remains OPEN DRAFT.
