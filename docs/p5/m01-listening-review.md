# M01 offline listening review

An offline reviewer now exposes the saved **216 M01 draft WAVs in 108 normal/slow pairs**.
It also retains all **204 unavailable slots in 102 pairs**, separately from playable recordings.
The builder reads the 420 authored asset identities and 216 ASR records from
`m01-audio-draft-20261011/`; it does not synthesize, retry, edit or publish audio.

## Reviewer workflow

Save `Lingvessa_M01_Listening_Review_2026-10-12.html` and open it in a browser.
All available audio is embedded. Search authored text or filter language, words,
dialogue turns, whole dialogues, unreviewed recordings, ASR flags or missing recordings.
The two speeds have independent listened attestations, conclusions, issue categories
and timestamped notes. Dialogue cue buttons use the retained measured turn offsets.

The default list includes every available pair. ASR transcripts are collapsed:
listen first, then inspect the automatic hint if useful. The 109 ASR flags remain
fallible discrepancy screens, not confirmed pronunciation defects. All recordings,
including the 107 without flags, require human review. Reviewer language proficiency
is optional; “cannot assess” and “unsure” are explicit choices.

Progress counts a file only when the reviewer attests listening and selects a
non-pending conclusion. No playback event creates a human review. Missing audio
has neither a player nor a feedback row.

Notes autosave locally when permitted. Download JSON before closing the browser;
the import flow validates the dataset identity, every exact asset ID/WAV hash,
language values, feedback fields and length limits before asking to replace notes.
An invalid import preserves the current state; cancellation also preserves it.
Untrusted notes are rendered as text. Imported completion claims are ignored;
counts are recalculated from validated feedback. The file makes no network requests.

Every export remains `publication_ready=false`, `p5_milestone=NOT_READY`,
`p6_authorized=false`. A complete set of notes is `RECORDED_UNAPPROVED`.
It is not final cast, rights, linguistic/publication acceptance or permission to merge.

The [feedback intake command](m01-feedback-intake.md) now checks an exported JSON
against the trusted repository catalog and creates a private follow-up report.
It preserves exact audio bindings and notes, recalculates progress, separates
missing files and retains all approval gates. The already saved HTML remains
compatible and unchanged; no actual human feedback is invented by this addition.

## Reproduction and byte evidence

From the repository root:

```sh
python3 tools/p5/build-m01-review.py --mode full \
  --audio-zip /absolute/path/Lingvessa_M01_Audio_Draft_2026-10-11_v2.zip \
  --output-dir /absolute/path/review-output
```

The builder checks the exact retained ZIP digest and size, hashed source shards,
normal/slow identities, ASR bindings, all 216 embedded WAV hashes, PCM format,
frame-derived duration and retained cue bounds. WAV bytes are copied unchanged.
`m01-listening-review/local-byte-validation.json` records the actual local build.
The local source is a verified subset; source SHA and working-tree state are null,
not a claim of a complete local checkout or full local regression.

The complete saved HTML is about 18 MB. Neither it nor the external M01 audio ZIP
is uploaded to Git. Final durable delivery identity and exact-source hosted results
are recorded in PR #5 metadata after validation.

## Hosted validation boundaries

CI builds the real **420-slot catalog without external audio bytes** and emits
`m01-review-catalog-validation.json` with `scope=CATALOG_ONLY_EXTERNAL_AUDIO`,
`m01_audio_bytes_verified=false`, `m01_wavs_verified=0`.

The same template is browser-tested using a clearly labelled `UI_TEST_FIXTURE`:
four unchanged, already committed Piper audition WAVs, distinct fixture IDs,
two deliberately missing fixture slots and artificial ASR flags/cue positions.
This tests playback, exclusive players, cue seeking, filters, partial/complete
feedback, reload, guarded import, eight invalid payloads, safe note rendering,
mobile keyboard use and unavailable local storage. It does not claim browser
playback or human listening of the 216 external M01 WAVs. The attempted local
Chromium download returned unusable archive bytes; no local browser PASS is asserted.

```sh
python3 tools/p5/build-m01-review.py --mode catalog
python3 tools/p5/build-m01-review.py --mode fixture
pnpm exec playwright test --config tools/p5/m01-review.playwright.config.ts
```

The four original browser tests use no retries. Source
`38ca31f0dcda7ac267893a4eb81b93a398624611` passed all seven workflows; both P5
archives and all 22 acceptance references were independently verified. The full
HTML was saved as `libfile_0604983dd6148191869f82f1ab91cfcf`, version 0, unchanged
at SHA-256 `31390589234c35c49ce52f56bcc6d8a9c78c2b84cf8392d7634fa70e9fba275e`.

The feedback intake follow-up adds ten stdlib tests and a fifth browser test
using a real fixture export, with 25 acceptance references. It needs its own
exact-source hosted PASS. The earlier 216-file byte validation and unchanged
four-audition-file playback scope remain separate.

Source authoring metadata, 216 WAVs, 109 ASR flags, 204 blocked files and production
registry stay as recorded. Approved publication assets remain zero. No requirement
promotion, provider change, paid inference, merge or P6 authorization.
