# Remaining P5 gates after real M01 execution

P5 IN PROGRESS / NOT READY. P0–P4 ACCEPTED. PR #5 OPEN DRAFT; no merge/P6.

Current continuation: [2026-10-20 owner acceptance and HTTP delivery](../integration-20261020/README.md). b9c34fa passed all seven workflows and both audits (86 references); the expanded real HTTP gate requires its own exact-source evidence. The owner accepted the presented 30 visuals on 2026-10-20; historical preflight and review worksheet remain intact.

The real input/import blocker is resolved on `460aab052115f6fe168d180b4ac44369afaab09d`: both runs, all seven workflows and all 78 acceptance references passed independent verification. [Evidence](verified-ci-460aab0.json). The approved ZIP is already private draft release asset `649769507`; reruns reuse it. No user ZIP, regeneration, public upload or Git media storage is needed.

| Severity | Remaining condition | Evidence needed / permitted next action |
| --- | --- | --- |
| BLOCKER | Required M01 reference media/publication gate | Resolve all required reference asset IDs through the appropriate publication manifest, with the retained audio and visual set decisions and completed activity-specific accessibility gates. The two disposable lesson publications prove storage/repository behavior, not complete course publication. Keep any preparatory work in P5; do not author P6 learner content. |
| BLOCKER | OD-004 production delivery profile | A recorded owner decision identifying the permitted production storage/delivery profile. Current testing uses disposable private S3-compatible storage; it does not select production hosting/CDN, introduce cost or close OD-004. |
| BLOCKER | OD-006 usable learner speech calibration | Valid labelled learner-error evidence and a versioned approved target-feature policy. The 402 acoustic reference recordings are not learner-error labels. Keep neutral `speech_unavailable` fallback; no new data collection, inference or provider adoption is implied. |
| IMPORTANT | Applicable compound clauses | Retain 174 PASS / 30 PARTIAL / 152 PENDING until each entire applicable clause has evidence. Separate P5 storage/playback/speech contracts from later P6/P8/P9 content/AI clauses. Do not start later phases to inflate P5 completion. |
| MINOR | Preproduction-report ambiguity | Corrected by reading the exact immutable owner approval into the current report. Old registry placeholders remain explicitly historical. Final CI for this reporting revision belongs in PR #5 and source-bound artifacts. |

The next technical action is to verify authenticated HTTP delivery of all 450 exact assets on this new commit, then map remaining activity-specific publication/accessibility evidence within P5. The owner decision covers the presented set, including the recorded semantic observations; no corrections or per-item feedback are invented. It does not create production permissions or resolve OD-004/006. Approved audio quality, six voices and rights remain final from 2026-10-14.

For interrupted CI: read `implementation/p5-media-speech` and its workflow runs first. Download and verify completed exact-HEAD evidence; retry only a failed required job when its cause is addressed. The workflow input chain independently checks the existing draft-release asset and runs `verify-m01-s3-import.ts --real-m01` using the documented development/test settings. Never repeat the old WAV-blob upload plan or the historical 204-file generation instructions.

Ordinary CI evidence artifacts expire on 2026-11-01 for the verified 460aab0 runs; their digest/reference/results records are retained in Git. One-day input relays are disposable. The original archive remains in the private draft release, which must not be published.
