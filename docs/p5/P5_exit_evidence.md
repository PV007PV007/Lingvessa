# P5 exit evidence

Status: IN PROGRESS / NOT READY for owner acceptance.

P4 owner accepted; PR #4 merge `5027f001237b6451237d87343ebeca58cd0af007` has the tested P4 source tree. P5 branch `implementation/p5-media-speech`; PR #5 OPEN DRAFT. P6 is not authorized.

IMP-P5-001: media identities, versioned voices/characters, requirements/jobs, immutable asset versions, human QA and publication pins; actual byte preflight and S3-compatible adapter. Hosted `789f0d400144012ae663635c343f38940167a822` passed standalone S3 protocol/auth/integrity/outage/restart gates. This verifies the portable adapter, not a production provider approval. Real PostgreSQL bootstrap passed; integration exposed a trigger variable/alias collision, corrected in this follow-up and awaiting rerun.

IMP-P5-002: authenticated run-scoped media delivery with byte ranges; normal/slow playback, visible speaker clock/transcript and outage alternatives. Approved slow versions pin their exact normal script/voice. Tests use original synthetic tones, not reference speech or linguistic QA. API/Chromium checks are prepared and need hosted execution.

IMP-P5-003: pending. Required async speech lifecycle, microphone UX, exact Pronunciation evidence, bounded retries, late-callback/cancellation/TTL cleanup and worker recovery have not passed acceptance.

Remaining: green PostgreSQL and P1–P4 regression/OCI on the exact final SHA; media/audio/speech browser/runtime checks; required M01 asset registry and approved QA resolution. 356 P5 trace rows are retained; no pending requirement is counted verified.

OD-004/005/006 remain open under their documented safe defaults. Paid inference false, paid budget zero; no provider/voice/calibration approval invented. No governing specification change.

EXC-P1-001: main is not technically protected; implementation branch, PR, green hosted CI and explicit owner milestone acceptance are process controls. PR #5 stays open. Stop before P6.
