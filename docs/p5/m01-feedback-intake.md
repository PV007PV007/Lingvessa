# M01 feedback intake

`tools/p5/validate-m01-feedback.py` accepts the JSON exported by the saved M01
listening form and creates one private JSON report for follow-up work. It uses
the current repository catalog, rebuilt from hash-checked retained metadata.
It never trusts a replacement catalog supplied with the notes.

```sh
python3 tools/p5/validate-m01-feedback.py \
  --input /private/reviews/Lingvessa_M01_Listening_Notes.json \
  --output /private/reviews/M01_feedback_report.json
```

The destination's parent must exist. The report is created with mode 0600;
an existing report, the input file and repository source are never overwritten.
Keep actual reviewer notes outside Git and CI artifacts. Console output contains
counts and an input checksum, not note text. No network, inference or publication
operation is performed.

## Identity and validation

The default accepts only `M01_DRAFT` notes bound to dataset SHA-256
`395cd8dc727afdd632a8d868aefcafcad9714b758dba8aa80bdd38b5f219a0ef`
and audio source `785fff956f7b7c5c017921d96103f7a0ae8f8d44`. All 216 available
asset IDs and WAV hashes must match in their exported order. Each needs exactly
one feedback row; the 204 missing assets cannot acquire an invented review.

The validator checks exact field sets, booleans, language/choice/issue values,
valid millisecond UTC timestamps and the browser's 2,000 UTF-16-unit note limit.
It rejects duplicate JSON keys, non-finite numbers, invalid UTF-8, excessive
nesting and inputs over 2,000,000 bytes. Invalid data creates no report.
The accepted format is the existing form's export; no new HTML is required.

The source input's byte hash is retained. Claimed completion and feedback status
are ignored and recalculated. Self-reported listening plus a non-pending choice
counts toward progress exactly as in the form. A timestamp, proficiency choice
or valid hash is not proof that a person listened or has linguistic authority.

## Follow-up report

The report retains authored text, exact file identity, language, pace, original
feedback and ASR flag. It orders available files into four groups:

| Group | Meaning |
| --- | --- |
| `needs_work` | Listening is attested and the reviewer selected a problem. |
| `clarify` | Listening is attested but the conclusion is uncertain, a `no_issues` conclusion has an issue category, or the reviewer cannot assess that language. |
| `unreviewed` | Listening is not attested or the conclusion remains pending; any draft notes are preserved. |
| `reported_no_issues` | Listening is attested and the reviewer reported no issue; this is not approval. |

ASR flags sort first within a group and remain fallible automatic hints. Missing
files are listed separately with no feedback. The report never edits audio,
automatically regenerates a recording or merges separate reviewers' judgements.
Every report retains `UNVERIFIED_SELF_REPORT`, pending linguistic/rights approval,
`publication_ready=false`, `p5_milestone=NOT_READY` and `p6_authorized=false`.
Even complete feedback is only `RECORDED_UNAPPROVED`.

## Verification boundaries

Ten stdlib tests use explicitly artificial feedback against the real metadata
catalog and the existing four-file UI fixture. They cover complete/partial
feedback, contradictory choices, UTF-16 limits, changed identities, invalid JSON,
scope isolation and non-overwriting private CLI output. No real human feedback
has been received or processed by these tests.

A fifth M01 Playwright test exports JSON from the actual interface and invokes
the intake command with explicit `--test-fixture`. Its output remains
`UI_TEST_FIXTURE`; that option cannot make fixture notes acceptable to the default
real M01 path. The four earlier UI tests and unchanged audio fixtures still run.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 tests/unit/p5-m01-feedback.test.py \
  --report artifacts/p5/m01-feedback-validation.json
```

The CI acceptance summary binds the validator/test/builder hashes and three new
artifacts: test validation, fixture browser export and its intake report. There
are 25 acceptance references. These gates validate the feedback workflow, not
human pronunciation, rights or publication quality. Final results belong to the
new commit's own CI and PR metadata; predecessor PASS is not substituted.
