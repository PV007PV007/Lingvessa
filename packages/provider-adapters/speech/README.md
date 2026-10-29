# speech adapters

P5 implements the provider boundary used by the API/worker speech lifecycle. The default `unavailableSpeechEvaluator` produces neutral `speech_unavailable`; it never invents usable pronunciation evidence. `LocalAcousticEvaluator` is an explicitly configured local evaluation candidate, not an approved production scorer. `infra/config/speech.ts` rejects that candidate outside local scope and requires its separate pinned runtime/model paths.

`transient.ts` supplies encrypted tmpfs storage with job/expiry binding and bounded reads. The worker and repository perform terminal/TTL cleanup, bounded retries and idempotent settlement. `callback.ts` verifies authenticated callback bodies. Domain IDs, language/variety/target policy, lifecycle and exact evidence facets remain under the application/repository contract, not provider authority.

See [the speech contract](../../../docs/p5/speech-contract.md) and [P5 exit review](../../../docs/p5/exit-review-20261028/README.md). Controlled integration/browser fixtures prove correct/mismatch/unavailable, microphone/reduced-motion, failure/retry/cancel/expiry and cleanup behavior. OD-006 remains open for labelled learner-error calibration and approved target policies before usable learner scoring. No raw microphone bytes are stored as permanent media.
