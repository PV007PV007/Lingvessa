# P5 async speech implementation contract

Authority: manifest §2.2; Technical Design v1.7 speech lifecycle; Plan v1.4 §12 / IMP-P5-003. This implements the approved contract; no governing contract change.

- `speech-target-1.0.0` measures only a published Pronunciation target. Both `pronunciation_target` and `intelligibility` retain their exact evidence_map facet. No Speaking, Grammar or Vocabulary credit from this evaluator.
- Create reserves one opaque attempt UUID, keyed by authenticated owner + Idempotency-Key. Semantic payload changes conflict. Terminal settlement appends the immutable attempt exactly once, plus evidence/projection/outbox atomically only when speech is evaluable.
- The job pins a human-approved language/variety/target/provider/model/calibration policy. Synthetic calibration is restricted to test publications. Missing policy or disabled adapter settles unavailable; production scoring remains disabled under OD-005/006.
- Raw upload is single-use, authenticated, CSRF protected, HMAC scoped, at most 5 MiB. Formats: WebM/Ogg/MP4/WAV audio. Transient storage is private tmpfs, AES-256-GCM with job/expiry binding. No microphone bytes in PostgreSQL, permanent assets, logs or offline queues.
- Retention maximum is 14 minutes (inside the locked <=15 minute limit). Settlement attempts deletion immediately; durable cleanup is retried by the worker. Tmpfs expiry pruning handles orphans. Worker iterations run every second, claim 15-second leases and retry a provider at most three times with bounded backoff. A callback from an old execution cannot settle the retried job.
- `/submit` accepts `{}` after upload. Before upload, optional `client_unavailable_reason` is exactly `mic_denied`, `mic_absent` or `unsupported_audio`; it can produce only neutral unavailable. `/cancel` is idempotent, settles `speech_unavailable / user_cancelled`, and never fabricates incorrect pronunciation.
- Internal callbacks are disabled by default. A configured adapter must authenticate exact body/origin/timestamp within five minutes; DB receipt validates owner/profile/language/provider/model/policy/execution and records late/stale events. Duplicate event IDs cannot create duplicate evidence and produce a redacted duplicate audit event.
- Terminal result retains the current lesson item so the learner can Retry with a new attempt/job. Normal LessonPlayer `POST /lesson-runs/{id}/next` consumes the latest terminal job with an immutable idempotent receipt. Next does not increment attempt count/client sequence or create evidence. All three speech outcomes are non-blocking.
- A pending job after explicit reset or expired Review settles neutral. Immutable history survives; no late mastery credit crosses the reset boundary.

Schemas and paths: `infra/contracts/p5-speech.openapi.json`. New implementation migration: `202609270001_p5_speech_contract`. Earlier accepted migrations are unchanged.

Current verification scope: deterministic synthetic adapter proves lifecycle/isolation/transport/cleanup, not linguistic quality or production calibration. Browser microphone/reduced-motion gates and reference asset completion remain separate acceptance evidence.
