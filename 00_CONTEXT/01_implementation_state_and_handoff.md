# Lingvessa implementation state and handoff

Updated: 2026-10-11. **P5 IN PROGRESS / NOT READY. P0–P4 ACCEPTED; P6 NOT AUTHORIZED.**
Branch `implementation/p5-media-speech`; [PR #5](https://github.com/PV007PV007/Lingvessa/pull/5) OPEN DRAFT. Accepted main/P4: `5027f001237b6451237d87343ebeca58cd0af007`.

## Current M01 authoring follow-up

The owner delegated working choices on 2026-10-11. Working cast: Maya A, Daniel B, Alex C; Klára C, Adam A, Oksana B. Original capitalization is retained. **104 unique Piper turns / 216 final draft files** are complete, with 216 blind ASR screens and 109 discrepancy flags; human review remains PENDING. The remaining 97 Pocket turns / 204 files are blocked by HTTP 403 for pinned PyTorch. Approved publication assets remain 0.

The saved audio ZIP and all 532 WAV hashes were locally verified. The authoring record includes the initial native telemetry auto-review rejection, kernel-enforced offline continuation, two infrastructure replacements and one processing-journal repair without further synthesis. Exact scope, files and limitations: `docs/p5/m01-audio-draft-20261011/README.md`. CI checks metadata only for this external audio package and cannot claim byte-level audio QA. No application provider, dependency, schema, registry publication or trace-status change.

Latest completed predecessor evidence is source `411493f095345bee3d018556c8c25f8b5698a4dc`, tree `7194729547f5fea81de1c39c6b2b73aeb1d49b3c`: all seven workflows PASS. P5 PR run 38129696671 / push 38129694015; both archive digests, all 16 acceptance references and all 18 worksheet playback clocks/hashes verified. This M01 follow-up requires its own hosted checks; final unchanged-source results belong in PR metadata and CI artifacts.

## Exact-source runtime evidence

Latest verified complete source: `6cdc635b55da0a8d38cd94a9b14d48f80640942e`, tree `39dbf682ae90ff162a13abf75d02feec3d4b3365`. All seven workflows passed. P5 PR run 38112197835 / job 114389895234; push run 38112195591 / job 114389887420. Both archive digests, all thirteen acceptance references and all original/Pocket/paired/held-out audio validators were independently verified. Both new batch validators report 20 raw turns, eight clips and fourteen ASR bindings per batch, a clean checkout and no inference during CI. Runtime PASS; milestone NOT_READY; human listening PENDING. Machine-readable record: `docs/p5/evidence/ci-case-20261011.json`.

Current follow-up: an offline human-review worksheet with eight masked X/Y comparisons and two Czech A anchors. It embeds the same 18 unchanged WAVs, accepts timestamped notes/preferences, and exports/restores audio-bound feedback without approving voices. Three new browser checks exercise playback and the feedback workflow; the P5 acceptance summary binds their reports. See `docs/p5/listening-review.md`. This source needs its own hosted run; final current-source results belong in immutable CI artifacts and PR metadata.

Historical predecessor evidence follows.

Last inspected full runtime PASS: `c21a2a0aa65924c091a7c464094ff3de4aa2c2ee`, tree `bdd794e7b883e423eb625dfce3f6e1bd03bf6219`. All seven hosted workflows passed. P5 PR run 38049540964 / job 114205709344; push run 38049537327 / job 114205699606. Both final artifact archives were downloaded and verified against their SHA-256 digests; their acceptance summaries bind twelve runtime reports and the repository requirement-evidence hash to the exact tested source.

PR artifact 11669156689 SHA-256 `f704c3b09b578f890292ba14963c3dd54dbd2dcebfb8a8e2911f03bc4c844b61`; push artifact 11668981926 SHA-256 `dd52cd5f836dd2ae8274d236fce1aedf7460e4381ef32d515d65335dfa577c06`. Exact final results remain in PR metadata and immutable workflow artifacts.

Executed there: frozen install; baseline 76/76; 54 unit + 4 smoke; audit zero findings; reference/flag checks; signed-S3 restart/immutable bytes/outage; PostgreSQL 18.6 and six migrations with clean/replay/seed/reseed/recreation/isolation; 16 integration and 17 Chromium cases; four OCI build/start/health/DB-outage/recovery gates. No failed or skipped tests.

P5-DEP-002 is resolved at that source by sharp 0.35.5 and libvips 1.3.4 within Next 16.3.8's existing range. The failed parent audit is preserved in `docs/p5/evidence/ci-pocket-audit-failure.json`; local remediation evidence is in `sharp-patch-validation.json`. P5-DEP-001 was resolved at historical source `81e6ddac` by compatible proxy-addr 2.0.8 / source-map-js 1.2.2 patches; historical full runtime evidence is in `ci-batch-013.json`. No audit waiver or suppression.

**A parent PASS does not certify a later source.** Current PR checks and `artifacts/p5/acceptance-summary.json` bind runtime results to checked-out HEAD. Separate audition validators bind retained bytes/provenance to the same SHA. Final immutable CI artifacts and PR metadata record the result; do not create an endless evidence-only descendant cycle to record a commit's own SHA.

## Retained auditions and the new controlled comparison

OD-005 authorizes bounded local audition from project-authored text, with zero paid inference, no learner data, no uploaded person's voice reference, no production adoption and no cast/publication approval. The original eight Piper WAVs and 2026-10-09 Pocket batch remain unchanged. The earlier Pocket recovery boundary, including missing historical generation/ASR scripts, remains documented in `docs/p5/voice-audition/pocket-20261009/recovery.json`.

The 2026-10-10 paired case trial used the same pinned Pocket Czech weights, all 58 isolated dependency versions, existing synthetic Piper EN A/C references, paired seeds and authored M01 Czech text. It explicitly disabled automatic capitalization for the lowercase condition. Twenty initial turns, no retries: ASR edits per ten words improve B normal/slow 5→3 / 5→4 and C 4→1 / 3→2.

A separately predeclared twenty-turn check used five disjoint authored phrases. Every pair ties at 1/13 edits: the strict held-out improvement criterion is NOT MET. No more seeds or parameter tuning. Total: **40 raw turns, 16 normal/slow PCM16 clips, 28 fresh ASR bindings, zero generation failures or paid calls**. All planned conditions, final prepared text/token IDs, source/model/tooling provenance, actual scripts and execution logs are retained:
- `docs/p5/voice-audition/pocket-case-20261010/README.md`
- `docs/p5/voice-audition/pocket-case-holdout-20261010/README.md`

ASR is a fallible discrepancy screen, not a human pronunciation judgment. Initial controls have equal frame counts but are not bit-identical to historical synthesis (maximum PCM16 deltas B=4, C=55). Fresh ASR of unchanged historical C slow audio gives four edits; its archived screen had three. Historical bytes/reports are not overwritten.

Both candidates remain **HOLD_FOR_REVIEW**; human Czech listening/linguistic review is **PENDING**. The initial improvement does not establish a reliable normalization policy or approved cast. These are synthetic-reference Pocket voices, not reference-free MOSS-designed voices. The self-contained comparison document contains sixteen new clips and two unchanged Czech A anchors. All eighteen embedded WAVs and archive entries were verified. Chromium installation failed locally, so browser playback/rendering is not claimed.

## Recovery, authorization and upload boundary

The new archive `Lingvessa_Czech_Trial_2026-10-10.zip` was successfully saved for review. SHA-256 `18c61165bb97038a37f04a40af2e2b980e1341025e7aa60aa40647bacd2e7818`; all 98 entry hashes matched on restoration on 2026-10-11. All 77 new repository files, including the complete generation/ASR scripts and 56 WAVs, were restored byte-for-byte. Twenty shared base files also matched. No inference or ASR was repeated. Prior local commits and unsaved handoff/workflow edits did not survive; the CI step and current handoff are reconstructed explicitly. `docs/p5/evidence/case-recovery.json` records this boundary and the prior blob identities.

Automatic approval review stopped the earlier upload after 35 unreferenced blobs because the visible messages did not explicitly authorize this new payload/destination. No tree, remote commit or branch ref was created then. The concrete permission request named all 56 WAVs, accompanying changes, private `PV007PV007/Lingvessa`, `implementation/p5-media-speech`, PR #5 and exact-source CI. The owner responded **“продовжуй” on 2026-10-11**, authorizing completion of that request. Repository owner/private visibility/push permission and unchanged remote head `c21a2a0a` were reverified. Exact scope: `docs/p5/evidence/case-upload-authorization.json`.

That upload completed: all 56 WAV identities and the full 81-file change tree matched locally verified bytes; the branch advanced from the expected c21a2a0a head to 6cdc635b. P5 CI ran both new stdlib validators with bytecode writes disabled and all seven workflows passed. Inference never runs in CI. PR remains OPEN DRAFT; merge, cast acceptance, publication and P6 are not authorized.

## Scope and phase gates

IMP-P5-001/002/003 remain IN_PROGRESS. Trace is unchanged: 356 source rows, **174 PASS / 30 PARTIAL / 152 PENDING**. No requirement is promoted or waived by audition or green CI. No contract, schema, API, migration, direct application dependency or production provider change. Full phase inventory: `docs/p5/evidence/changed-files.json`.

Plan v1.4 §12 p7 requires all M01 required asset IDs to resolve. Prepared: 18 original SVG drafts, 12 flag drafts, 168 scripts / 420 audio slots and six voice profiles. **Approved publication assets = 0.** Complete approved cast/rights, full media generation and human linguistic/semantic/accessibility/publication QA remain open.

OD-004 delivery profile OPEN. OD-005 audition executed; final tooling/cast/full generation OPEN. OD-006 usable real-provider speech calibration OPEN; default stays neutral `speech_unavailable`. Paid inference=false; monthly paid budget=0. No P6/P7/P8 runtime starts. EXC-P1-001 remains: main lacks technical branch protection; implementation branch, PR, CI and owner review apply.

Next: complete this authoring change's exact-source CI, retain the saved 216-file draft, restore the exact Pocket dependency for the 204 remaining draft files, and complete human/rights/publication QA. Keep P5 NOT_READY and PR #5 OPEN DRAFT.
