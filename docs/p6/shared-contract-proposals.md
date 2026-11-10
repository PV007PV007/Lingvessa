# P6 shared contract review — proposed, not approved

These proposals are reviewable implementation decisions for Reference Module Design v1.6. No changed learner policy, migration, owner approval or production publication is implemented here. The [change-control procedure](../governance/change-control.md) applies before changing shared behavior.

## Listening transcript disclosure

Sources: §7 L02.8 p10, §8 L03.6 p11, §9 L04.2 p11 and §10 R01.2 p12. L02 requires an attempt before transcript disclosure; L03 includes a logged accessibility override. The current player and authenticated media API can expose text before an answer. Closing a browser details element is insufficient: inline text, metadata and dialogue turns also carry the answer. The existing support event records use, but does not enforce disclosure order.

Proposed decision: a versioned, language-neutral activity policy distinguishes legacy access, access after a submitted answer, and an explicitly permitted early accessibility override. The server omits answer-bearing inline text, transcripts and turn text until the rule is satisfied. An assisted reveal may disclose text as assistance. Playback, timing, speaker identities and non-answer-bearing alt text remain available. A permitted override is keyboard accessible, requires no diagnosis and records an idempotent support event before returning text.

Evidence must follow server-recorded attempt/support order; the client cannot grant access or claim independence. Disclosure never creates a score. Preserve the accepted conservative evidence rule for old versions; any change to weights requires its own decision. New content pins its policy, old runs keep their previous response/replay behavior, and added API fields must remain backwards compatible.

Acceptance tests: direct API requests and rendered text before/after an answer; wrong/correct first answer; reveal; allowed/disallowed override; duplicate events; reload/resume; keyboard and screen-reader controls; absence of early answer text in every relevant response. No changes to approved WAVs.

## Meaning-correct, target-form-needed feedback

Source: §7 L02.7 p10, requirement `N-REF-P10-T02-R08`. For a contraction objective, “I am” conveys the meaning while “I'm” is the requested form. Current evaluation can enforce the target but returns generic feedback on non-target answers. Accepting every full form would incorrectly complete the contraction objective.

Proposed decision: an optional author-controlled list of recognized non-target forms in the shared, deterministic text policy. Accepted targets match first. A recognized full form receives a distinct feedback code (“The meaning is right; use the contracted form”) and retains retry/reveal. It does not complete the target objective or independently award semantic mastery. An unrelated answer keeps ordinary incorrect feedback. No English-specific evaluator branch, new weights or inference of speech ability.

Pin new schema/policy/evaluator versions. Store new feedback fields additively and preserve historical attempts, publication pins, evidence and replay responses. Verify target/non-target/unrelated responses, apostrophe variants, both English locales, replay, and a separate meaning objective that accepts full forms.

For both proposals, rollback disables new versions for future publication; it never rewrites immutable history. Owner review remains pending. OD-004 production delivery and OD-006 usable speech scoring are separate open decisions.

## Remaining authored-media review

The approved English catalog has 15 visuals: three scenes, three character avatars, three function icons and six flags. Approval remains unchanged.

| Source obligation | Existing material | Work required before acceptance |
| --- | --- | --- |
| L02.1: four recurring profiles with introductions | Three approved avatars and existing name/model audio | Bind four complete profiles; declare the missing avatar and any missing exact introduction recordings as new draft requirements |
| L02.5: student, teacher, engineer illustrations | Three role phrase recordings; no role illustrations | Create three original role-image requirements; audio is not an image substitute |
| L02.8 / L03.6: three listening introductions | Catalog and outline candidates only | Choose complete, objective-matching audio/profile pairs and define transcript policy; do not splice or relabel approved bytes |
| Recap: two new characters and first contact | Existing Maya/Daniel/teacher assets and approved dialogues | Demonstrate genuinely new characters with consistent media; declare additions where existing recordings cannot meet the script |

New draft requirements are additions, not regeneration or replacement of the approved 420 WAVs. Do not invent approvals or call a generic scene, a probe, a cut-up recording or an outline a completed authored stimulus.
