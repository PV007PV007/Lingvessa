# Real M01 test publication dependency correction

P5 IN PROGRESS / NOT READY; PR #5 OPEN DRAFT; no merge or P6.

**Executed result:** both real M01 jobs and all seven workflows passed on `460aab052115f6fe168d180b4ac44369afaab09d`. Both artifacts and all 78 acceptance references were independently verified: [durable evidence](verified-ci-460aab0.json). See [remaining gates](remaining-gates.md). This reporting revision requires its own exact-HEAD workflow result.

The approved archive is already present as private draft release asset `649769507`. Its exact SHA-256/size and independent release download are retained in the 2026-10-17 transfer receipt. Do not re-upload or regenerate it. Owner audio quality, six-voice and rights approval remains final.

Both real-mode runs on `35dced61a8f9ae36f77379860f414e012de20997` successfully received the archive and checked all 420 WAVs, but failed at test publication with PostgreSQL `23514`: `dialogue character requires its pinned avatar in the activity`. The test had omitted the existing avatar dependencies. [Exact failed source/run/job evidence](prior-real-failure.json). P1 push/PR and P2–P4 passed on that source. No real end-to-end PASS is inferred from the preceding successful steps.

The correction changes only the disposable PostgreSQL/S3 integration fixture and acceptance assertions. Each test activity binds 210 approved WAVs and the three matching immutable avatar versions for its language. PostgreSQL avatar-closure checks must reject the audio-only references and accept the complete references. The unchanged publication guard then validates all pins. Delivery tests compare all 420 WAVs and six avatars byte-for-byte after restart. Foreign-user/activity rejection now uses the actual immutable asset version, so a wrong-version lookup cannot make an authorization test pass accidentally.

Verified on 460aab0 in both PR and push runs: 450 imported versions (420 approved audio + 30 visual drafts), exact replay, immutable UPDATE/DELETE and changed-byte/metadata rejection, denied anonymous S3 read, recreated database pool and S3 process/adapter, 450 stored-byte readbacks, two test publications, 426 matching delivery reads including all 420 original WAVs, six avatar dependencies, and two negative/positive avatar-closure checks. The test inserts 2,556 permission rows (426 pinned assets × six gates), all labelled `DISPOSABLE_TEST_FIXTURE_ONLY`; import itself inserts zero approvals/publications. These rows are deleted with the disposable database and are not new human, visual or production approval.

Current-HEAD workflow results and `artifacts/p5/acceptance-summary.json` in PR #5 determine actual success. Historical synthetic PASS never substitutes for the real report. Rerun the current-source P5 workflow/input chain if interrupted; it reuses the verified private draft asset and downloads it anew. No new service, payment or production profile is selected.

OD-004 production delivery and OD-006 labelled learner calibration remain OPEN. Visual QA/rights, required reference publication and remaining applicable compound clauses remain open. The 402 acoustic results cover single-turn recordings; all 18 final dialogue files are additionally byte-verified. Nothing here authorizes P6.
