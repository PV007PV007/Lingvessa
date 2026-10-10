---
license: cc-by-4.0
language:
- cs
library_name: pocket-tts
pipeline_tag: text-to-speech
tags:
- text-to-speech
- tts
- pocket-tts
- czech
---

# Pocket TTS — Czech (6 layers)

A Czech voice-cloning TTS model for [Pocket TTS](https://github.com/kyutai-labs/pocket-tts).
Six transformer layers, runs faster than realtime on CPU.

## Usage

```bash
uvx pocket-tts generate \
  --config hf://vvolhejn/pocket-tts-czech/czech.yaml@7c1fbd0acba765617749dd17f3dbddc2be791cc7 \
  --voice your_voice.wav \
  --text "Dobrý den, toto je český model."
```

The voice must be an audio file (or a state exported with `pocket-tts export-voice`
from these weights). The named catalog voices — `alba`, `cosette`, … — are
conditioning states precomputed with the released English weights and will not work here.

Sample voices cut from held-out ParCzech speakers are in `voices/`:

```bash
uvx pocket-tts generate \
  --config hf://vvolhejn/pocket-tts-czech/czech.yaml@7c1fbd0acba765617749dd17f3dbddc2be791cc7 \
  --voice https://huggingface.co/vvolhejn/pocket-tts-czech/resolve/main/voices/cs_m_zenisek.wav \
  --text "Dobrý den, toto je český model."
```

## Training

| | |
|---|---|
| corpus | [ParCzech4Speech](https://huggingface.co/datasets/ufal/parczech4speech) (Czech parliamentary speech, CC-BY 4.0) |
| training data | 976 h, 547,597 utterances, 524 speakers |
| tokenizer | sentencepiece fitted on the ParCzech transcripts, vocab 3999 |
| teacher | 24 layers, LSD from scratch, 250k steps, lr 2e-4 constant, `flow_batch_multiplier` 4 |
| student | 6 layers, depth-distilled from the teacher's EMA weights, 100k steps, lr 4e-4 cosine, `distill_cfg_coef` 2.0 |
| weights | EMA (decay 0.9999) |
| recommended | `--temperature 0.3`, cfg 1 (the default; guidance is baked into the student) |

Trained with the [Pocket TTS training code](https://github.com/kyutai-labs/pocket-tts/tree/main/training),
following the [non-English recipe](https://github.com/kyutai-labs/pocket-tts/blob/main/training/README.md#non-english-training).

## Evaluation

The Pocket TTS eval pipeline (WER / speaker similarity / UTMOS) is English-only, so no
comparable numbers are reported here.

## Limitations

Parliamentary speech is the whole training distribution: formal, adult, mostly male
speakers, read/spoken in a plenary setting. Expect the model to be weaker on
conversational speech, children's voices, and text formatted unlike parliamentary
transcripts (the tokenizer is case- and punctuation-sensitive).

## License

Weights: CC-BY 4.0. Derived from ParCzech4Speech (CC-BY 4.0) — attribution to the
ÚFAL, Charles University corpus authors.
