# Czech Pocket TTS audition — retained 2026-10-09 batch

**Technical verification PASS; two new Czech candidates HOLD_FOR_REVIEW. Human listening PENDING. P5 NOT READY.**

This bounded OD-005 experiment used Pocket TTS 3.3.0 and the pinned Czech checkpoint on CPU, conditioned on the existing synthetic Piper English A (p225) and C (p228) recordings. These are corpus-derived synthetic references, not reference-free MOSS-designed voices. No uploaded human recording, learner data, paid inference, application dependency or provider activation was used. The owner explicitly authorized uploading this batch to private PR #5 on 2026-10-10; see `../../evidence/pocket-upload-authorization.json`. That authorization does not approve the cast, publication, merge or P6.

Expected authored Czech text: **Dobrý den. Jak se jmenujete? Těší mě. Mluvím česky. Děkuji.**

| Candidate | Normal | Slow | Blind ASR word edits / 10 |
| --- | --- | --- | --- |
| B, synthetic EN A reference | [9.72 s](samples/cs-B-pocket-A-normal.wav) | [12.13 s](samples/cs-B-pocket-A-slow.wav) | 5 normal / 5 slow |
| C, synthetic EN C reference | [9.40 s](samples/cs-C-pocket-C-normal.wav) | [11.73 s](samples/cs-C-pocket-C-slow.wav) | 4 normal / 3 slow |

Five separately generated utterances are joined with 350 ms gaps. `results.json` retains authored script UUIDs, text, seeds, references, ten unmodified float32 turn WAVs, turn boundaries, PCM gain, checksums and measured audio properties. Final files are mono PCM16, 24 kHz, with no clipped samples. Slow versions use ffmpeg `atempo=0.8` on the same voice. Historical synthesis took 9.79 seconds with peak RSS 1,256,672 KiB.

One targeted continuous-text retry is retained separately: [B, 3.76 s](continuous/cs-B-pocket-A-continuous.wav) and [C, 3.20 s](continuous/cs-C-pocket-C-continuous.wav). Each produced 4 ASR word edits / 10; the last two phrases are absent from C's transcription. Neither trial is selected for full generation. ASR can misrecognize Czech: absence from a transcript is not a human-confirmed omission from the audio.

## Diagnostic and approval boundary

`asr-screen.json` binds all 12 main files to a blind faster-whisper-small diagnostic: pinned model, CPU int8, beam 5, temperature 0, explicit language, no initial text prompt, no VAD or previous-text conditioning. Diacritics are retained during normalization. All six English files match 12 normalized words; the earlier Czech A has 1 normal / 2 slow edits out of 10. These are diagnostic discrepancies, not pronunciation grades or approval thresholds. Human review must assess Czech stress, vowel length, consonants, script completeness, naturalness and voice separation; English still needs en-GB variety and role-fit review.

The first ASR attempt failed before transcription because PyAV 19.0.1 rejected `metadata_errors`. The recorded successful run used scipy PCM16 decoding and resample_poly to 16 kHz before passing float32 arrays to faster-whisper. `local-diagnostics.json` preserves that boundary. Earlier Nano failures mentioned in conversation have no recovered audio/log evidence and are not counted as verified results.

## Recovery and verification

The original WAVs, model cards, locks and result reports were recovered byte-for-byte from `Lingvessa_Voice_Test_2026-10-09.zip`. All 46 archive-entry hashes were checked; `recovery.json` maps the 29 retained files to archive paths and hashes. Audio was not regenerated. `archive-README.md`, `local-validation.json`, `archive-write-status.json` and `archive-listening-validation.json` are historical records, not current execution claims. The former upload block is superseded by the owner's explicit upload authorization.

The ephemeral local commit, generation/ASR scripts, execution logs and upstream YAML were not in the archive and could not be recovered. References to those files in historical records do not imply they are present. The current verification tool and pinned `requirements-local.txt` were reconstructed from the retained evidence. No fresh inference run or complete executable generation pipeline is claimed.

Verify without downloading any model or installing ML packages:

```sh
python3 tools/p5/voice-audition.py --verify-only
python3 tools/p5/pocket-audition.py --verify-only
```

The second command checks retained-file hashes, authored texts, synthetic-reference bindings, PCM format/metrics, raw-turn format/timing/seeds, slow duration ratio, diagnostic calculations, scope flags and the CI source SHA. It performs no inference. The P5 workflow retains its report. The standalone listening page was checked for embedded WAV integrity and JavaScript syntax; browser rendering/playback was not executed because Chromium was unavailable.

## Provenance and rights

- `models.lock.json`: Czech config revision `7b7760dd0fe994a0800f2fdbc837dc4b8f219d1c`; weights/tokenizer revision `b7eead893ec18b1f493c1c044e1b3e8b2a46b863`; exact hashes and sizes.
- `tooling-lock.json`: all 58 isolated package versions, distribution URLs and hashes. Requirements are historical Python 3.12 Linux x86_64 tooling; no ML dependency or weights enter the application runtime.
- `MODEL_CARD.md`: retained [vvolhejn Czech model card](https://huggingface.co/vvolhejn/pocket-tts-czech), claiming CC BY 4.0 weights derived from [ParCzech4Speech](https://huggingface.co/datasets/ufal/parczech4speech), ÚFAL / Charles University. Parliamentary training material may limit conversational suitability.
- [Kyutai Pocket TTS](https://github.com/kyutai-labs/pocket-tts) engine MIT claim is distinct from weights/data rights. Piper/VCTK ancestry remains documented in [the earlier audition](../README.md) and its model cards. Synthetic references do not erase attribution obligations.
- `asr-model.lock.json`: pinned diagnostic model revision and file hashes. Weights are not distributed with this batch.

Final cast and production rights review remain OPEN under OD-005. OD-004 delivery and OD-006 usable evaluator calibration are unchanged. Approved publication assets = 0; no requirement is promoted or waived by this audition.
