# Offline Czech listening worksheet

This worksheet makes the outstanding human audition review concrete. It does not synthesize audio or approve a cast. P5 remains NOT_READY and PR #5 stays OPEN DRAFT.

## Use

Download `Lingvessa_Czech_Listening_Review_2026-10-11.html` from the P5 workflow artifact and open the saved file in a browser. Its 18 WAV players work offline: eight X/Y comparisons from the initial and held-out batches, plus the two unchanged Czech A anchors. The same deliverable can be provided directly to the reviewer.

Listen to both clips in each pair, select a preference (including no preference, both need work, or unable to assess), explicitly mark whether both were heard fully, and note specific words/timestamps. Czech proficiency is self-reported; no name or personal recording is requested. Exact word completeness, vowel length, stress, naturalness, pace and voice continuity need a competent Czech listener. No human review result exists merely because the form was generated or tested.

The visible page masks control/lowercase condition names and omits ASR scores. Its fixed counterbalanced X/Y mapping is inspectable in the file and exported bindings; it is not a randomized or securely blinded study. Previous exposure to the comparison page may reveal conditions. This form cannot establish a new statistical benefit, and the predeclared held-out improvement criterion remains NOT MET.

Use **Завантажити нотатки** at any time, including with partial feedback. **Відновити з файлу** restores compatible feedback after an explicit replacement confirmation. Browser autosave is best effort; file-origin/browser restrictions may prevent it, so export before closing. Nothing is submitted automatically. Return the JSON file in the chat for review.

## Evidence boundary

- Build with `python3 tools/p5/build-listening-review.py`; no ML environment or model download is needed.
- The builder verifies the original SHA-256 of every WAV, reads PCM durations and embeds the unchanged bytes. Older generating scripts, trials, ASR reports and the original comparison document are unchanged.
- The manifest records source SHA, checkout cleanliness, builder/template hashes, pair mapping and all 18 audio hashes. A deterministic review-set digest binds the mapping and anchors. The artifact's HTML hash is bound by the manifest and playback report.
- Import rejects an unrelated set, changed clip bindings, invalid fields and oversized files. It imports only validated feedback as plain control values, recomputes completeness and never trusts claimed approvals or progress. A hash is a content binding, not proof of reviewer identity or honest listening.
- Completion means eight explicit responses plus eight listening declarations. Choosing “unable to assess” can complete the form but cannot establish linguistic quality. Export stays PARTIAL or RECORDED_UNAPPROVED; publication_ready=false, p5_milestone=NOT_READY and p6_authorized=false are fixed.
- Three dedicated Playwright tests exercise actual decoding and advancing playback for all 18 WAVs, exclusive playback, offline requests, export/import/reload, wrong-set rejection, literal notes, mobile keyboard use and unavailable storage. They are separate from the 17 existing application browser cases and do not claim human audibility or pronunciation acceptance.
- P5 hosted CI builds the worksheet, runs these tests and binds its three JSON reports into the acceptance summary (16 hash references in total). The HTML and browser diagnostics are retained with the normal P5 artifact. The earlier 6cdc635b source passed all seven workflows; this follow-up requires its own CI.

Human notes require subsequent review against the source WAVs and explicit final cast/rights decisions before full M01 generation. OD-004 delivery and OD-006 usable speech calibration remain open. No runtime provider, database, API, dependency, paid inference, publication or later phase is changed.
