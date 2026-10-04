# P5 decision inputs — not approvals

Prepared 2026-10-04. The three existing decisions below remain OPEN. This file does not change the locked baseline, approve a provider, enable paid inference, or certify M01 media. Sources of the decision requirement are `docs/baseline/open-decisions.md`, Technical Specification §40.2 / Technical Design §35 and Curriculum §19.2.

## OD-004 — Storage/delivery profile

Concrete existing implementation: private local immutable asset store and a provider-neutral SigV4 S3 adapter; authenticated version-pinned byte delivery; actual S3 protocol/outage/restart gate. No production account/bucket/CDN exists in the evidence.

Proposed integration profile: private Standard-class Cloudflare R2 bucket, server-held least-privilege bucket credentials, platform-owned UUID/version/SHA-256 keys, HTTPS and no provider URL in lessons. Keep public bucket access off; access approved assets through the existing authenticated delivery path. Production geography, CDN distribution and backup policy remain OD-003/P11/P13 as already scheduled.

Before activation, owner/platform owner must confirm the account, intended region/jurisdiction and permitted storage/operation spend. R2 has a limited free allowance and usage-based overage; `monthly_paid_budget=0` is the AI budget and does not itself enforce a cloud-storage spending cap. No paid account/overage is authorized by this proposal. If a zero-cost hard cap cannot be demonstrated, retain local storage for private development and leave hosted delivery approval open. Re-run the existing S3 immutable PUT/HEAD/GET/recovery gate against the approved endpoint before declaring the provider integration passed.

Provider source checked 2026-10-04: https://developers.cloudflare.com/r2/pricing/ . The Standard free tier is not a guarantee of unlimited free storage or requests. Current MinIO use is an ephemeral protocol fixture only; see `storage-protocol-spike.md`.

## OD-005 — Media tooling and voice cast

Reviewable prepared material: `assets/specs/p5/reference-media.source.json` and `.registry.json`; 18 original SVG drafts, 12 flag drafts from 7 pinned geometries, 168 scripts / 420 audio slots, and six fictional recurring voice profiles. Flag source and normalization provenance is in `assets/specs/p5/flags/`. No approval or actual reference audio byte is invented.

Proposed next integration spike: local/offline TTS audition using only authored scripts, no learner data and no paid/cloud calls. Keep the tooling process outside the application runtime and export immutable WAV/derived audio plus provider/model/script/version/checksum records through the existing ingest contract. No voice cloning from an uploaded person sample.

Specific candidates researched, not approved:

| Candidate | Verified source claim | Remaining acceptance |
| --- | --- | --- |
| OHF Piper local tooling | Upstream engine is GPL-3.0; local TTS, engine licence distinct from voice/data licences | Review distribution/tooling obligations, pin release/hash before any adopted integration |
| Piper `en_GB-vctk-medium` | Model card lists en_GB, 109 speakers, 22,050 Hz and a CC-BY-4.0 dataset; fine-tuned from the US lessac voice | Exact three speaker IDs, adult/variety/role fit, attribution chain, licence/consent review and audible M01 pronunciation QA; repo-level MIT badge alone is insufficient |
| Piper `cs_CZ-jirka-medium` | Model card lists cs_CZ, **one** speaker, 22,050 Hz, CC0 dataset; fine-tuned from lessac | Candidate for one audition only; does not meet the three-profile Czech cast by itself. Do not invent extra speakers or treat pitch shifts as approved distinct voices |

Primary sources checked 2026-10-04:
- https://github.com/OHF-Voice/piper1-gpl
- https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/vctk/medium/MODEL_CARD
- https://huggingface.co/rhasspy/piper-voices/blob/main/cs/cs_CZ/jirka/medium/MODEL_CARD

No complete approved Czech cast has been established. Media/speech and language leads must approve exact models/speakers/licence records after an audition; one English/Czech label or a package licence cannot substitute for that decision. Full generation waits for that review. Normal/slow speech must preserve the pedagogical target, carry measured duration/loudness/turn times, and pass script alignment, semantic, accessibility and originality/rights QA. Published references remain blocked until actual bytes and approvals resolve.

## OD-006 — Usable speech calibration

Implemented: versioned policies pinned to language, variety, target, provider and model; independent `pronunciation_target` / `intelligibility` facets; neutral unavailable default; controlled test policies limited to test publications. No calibrated production evaluator is enabled.

Proposed next step: keep production scoring unavailable while collecting an approved evaluation corpus for the chosen evaluator. Define labelled matched/mismatched/low-confidence/silence/noise cases for each intended language/variety/target, evaluate false-positive and false-negative outcomes, then have the curriculum/speech owner approve the versioned threshold policy. Ordinary STT text matching alone is not accepted as proof that a pronunciation feature was correctly evaluated. Numeric cutoffs must come from that calibration, not the fixture's arbitrary test confidence.

Until approval, microphone unavailability remains non-blocking and produces no mastery/mistake/scheduler evidence. This safe default is already implemented, not an exception to the requirement for approved usable evidence. P12 may refine a validated policy; it cannot retroactively fabricate P5 calibration.

## Exit impact

The runtime/DB/CI contract gates can pass while these media decisions remain open. P5 milestone acceptance still requires all M01 required asset IDs to resolve under Plan v1.4 §12 p7. PR #5 stays open, no merge, no P6. Owner decisions are recorded only after explicit approval; no governing document is silently edited.
