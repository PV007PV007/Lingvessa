# Lingvessa implementation state and handoff

Updated: 2026-10-10. **P5 IN PROGRESS / NOT READY. P0–P4 ACCEPTED; P6 NOT AUTHORIZED.**
Branch `implementation/p5-media-speech`; [PR #5](https://github.com/PV007PV007/Lingvessa/pull/5) OPEN DRAFT. Accepted main/P4: `5027f001237b6451237d87343ebeca58cd0af007`.

## Exact-source runtime evidence

Last inspected full runtime PASS: `81e6ddacb839abf2473630c889521442193d1d21`, tree `404e80bd9e871311f08d22453e12bb9237843328`. P5 PR run [37449893245](https://github.com/PV007PV007/Lingvessa/actions/runs/37449893245), job 112223635448; push run 37449888853, job 112223620056. All seven hosted workflows succeeded. Exact jobs, commands, artifact verification and summaries: `docs/p5/evidence/ci-batch-013.json`.

That evidence resolves P5-DEP-001 on the exact patched source (proxy-addr 2.0.8, source-map-js 1.2.2). Historical failed-source reports remain intact. PR artifact 11405148602 SHA-256 `c6fb696f77024cdec9cd4763c1f9cb4009e969720d66f2f2f165f45d27c1fc1a`; runtime report and requirement-evidence hashes were verified.

This new audition/evidence revision must pass its own hosted CI. A parent PASS never certifies a descendant. Current PR Checks and `artifacts/p5/acceptance-summary.json` bind runtime results to checked-out HEAD; `pocket-audition-validation.json` independently binds the new byte/provenance verification to the same source. Do not create an endless evidence-only commit cycle to record a commit's own SHA; final immutable CI artifacts and PR metadata carry that result.

Executed prior exact-source gates: frozen install; baseline 76/76; 54 unit + 4 smoke; audit 0; reference/flag checks; signed-S3 restart/immutable bytes/outage; PostgreSQL 18.6 and six migrations with clean/replay/seed/reseed/recreation/isolation; 16 integration and 17 Chromium cases; four OCI build/start/health/DB-outage/recovery gates. No test failures/skips. These are historical runtime results until the new revision completes its own run.

## Retained Czech audition and recovery

The owner authorized a bounded local audition on 2026-10-05. The earlier eight Piper WAVs remain unchanged. The 2026-10-09 Pocket TTS batch adds Czech B/C conditioned on those synthetic English A/C references: four normal/slow PCM16 files, ten unmodified float32 generated turns and two continuous-text diagnostics. No uploaded human reference, learner data, paid inference, model weights or application dependency is introduced.

`docs/p5/voice-audition/pocket-20261009/README.md` links the audio and records exact source/script/model/tooling provenance. Main normal/slow files pass technical checks, but ASR has 5/5 edits for B and 4/3 for C per ten expected words. Continuous retries each have four edits. ASR can misrecognize Czech; these are not human-confirmed pronunciation errors or omissions. Both new candidates remain HOLD_FOR_REVIEW; human listening and final cast selection are pending. These are not MOSS-designed voices or approved M01 assets.

After scratch recovery, all 46 archive-entry hashes matched. Retained audio/reports were restored byte-for-byte, without generation. The previous local commit, generation/ASR scripts, execution logs and upstream YAML were absent from the saved archive. `recovery.json` explicitly lists this boundary. The byte/provenance validator and requirements were reconstructed; historical `local-validation.json` and `archive-README.md` are preserved as past records. No new inference, ASR run or browser listening-page playback is claimed.

The previous GitHub upload was blocked by automatic review. The owner's explicit “Так” on 2026-10-10 now authorizes this batch's upload to this private repository/branch/PR, exact-source CI and PR metadata update. Verified repository owner and push permission; `docs/p5/evidence/pocket-upload-authorization.json` records scope. Merge, publication, final cast and P6 remain unauthorized.

## Scope and phase gates

IMP-P5-001/002/003 remain IN_PROGRESS. Trace is unchanged: 356 source rows, **174 PASS / 30 PARTIAL / 152 PENDING**. No requirement is promoted or waived by this audition. No contract, schema, API, migration, application dependency or production provider change. Full phase inventory: `docs/p5/evidence/changed-files.json`.

Plan v1.4 §12 p7 requires all M01 required asset IDs to resolve. Prepared: 18 original SVG drafts, 12 flag drafts, 168 scripts / 420 audio slots and six voice profiles. Twelve audition files do not resolve the full media set. Approved publication assets = 0. Human linguistic/semantic/accessibility/rights QA and complete cast/full generation remain open.

OD-004 delivery profile OPEN. OD-005 bounded audition executed; final tooling/cast/full generation OPEN. OD-006 usable real-provider speech calibration OPEN; default remains neutral speech_unavailable. Paid inference=false; monthly paid budget=0. No P6/P7/P8 runtime starts.

BLOCKER: none newly identified; exact new-source CI is required before claiming its runtime PASS. IMPORTANT: full M01 media, held Czech candidates, human QA and remaining compound requirement closure. MINOR: inherited Actions Node, Argon2id and pg concurrent-client-query notices. EXC-P1-001 remains: main is not technically protected; implementation branch, PR, CI and owner review apply.

Next: upload this explicitly authorized batch, verify its exact-source CI, and record final result in PR metadata. Then human audition review and candidate improvement/selection precede full generation. Keep PR #5 OPEN DRAFT; no merge; no P6.
