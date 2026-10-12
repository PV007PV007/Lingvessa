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

The four new browser tests use no retries. Their reports bind source, template,
builder, fixture bytes and open gates. Five new P5 acceptance references bring
the total to 22. Final current-source PASS must be obtained from that commit's CI;
the all-seven PASS on predecessor `785fff956f7b7c5c017921d96103f7a0ae8f8d44`
does not certify a later revision.

Source authoring metadata, 216 WAVs, 109 ASR flags, 204 blocked files and production
registry stay as recorded. Approved publication assets remain zero. No requirement
promotion, provider change, paid inference, merge or P6 authorization.
