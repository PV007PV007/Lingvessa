#!/usr/bin/env python3
"""Validate one M01 listening export and prepare a private, unapproved follow-up report."""
import argparse
from datetime import datetime
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
MAX_BYTES = 2_000_000
LEVELS = ('unspecified', 'native_or_fluent', 'learning', 'cannot_assess')
CHOICES = ('pending', 'no_issues', 'needs_work', 'unsure')
ISSUES = ('none', 'text', 'pronunciation', 'pace', 'noise', 'voice', 'other')
HEADER_KEYS = {'schema_version', 'tool', 'scope', 'dataset_sha256', 'audio_source_sha',
               'saved_at', 'bindings', 'feedback', 'completed_files', 'feedback_status',
               'publication_ready', 'p5_milestone', 'p6_authorized'}
ROW_KEYS = {'asset_id', 'listened', 'choice', 'issue', 'notes', 'updated_at'}


class FeedbackError(ValueError):
    pass


def require(condition, reason):
    if not condition:
        raise FeedbackError(reason)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def load_builder():
    spec = importlib.util.spec_from_file_location('m01_review_builder', ROOT / 'tools/p5/build-m01-review.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def exact(value, keys):
    return type(value) is dict and set(value) == keys


def timestamp(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z', value):
        return False
    try:
        datetime.strptime(value, '%Y-%m-%dT%H:%M:%S.%fZ')
        return True
    except ValueError:
        return False


def utf16_length(value):
    # Match the browser's 2,000 UTF-16 code-unit limit, including emoji.
    try:
        return len(value.encode('utf-16-le')) // 2
    except UnicodeEncodeError:
        raise FeedbackError('invalid-unicode') from None


def decode(raw):
    require(len(raw) <= MAX_BYTES, 'input-too-large')
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'duplicate-json-key')
            result[key] = value
        return result
    def constant(_):
        raise FeedbackError('non-finite-json-number')
    def decimal(value):
        number = float(value)
        require(math.isfinite(number), 'non-finite-json-number')
        return number
    try:
        value = json.loads(raw.decode('utf-8'), object_pairs_hook=pairs, parse_constant=constant, parse_float=decimal)
        pending = [(value, 0)]
        while pending:
            item, depth = pending.pop()
            require(depth <= 12, 'json-nesting-too-deep')
            if type(item) is dict:
                pending.extend((v, depth + 1) for v in item.values())
            elif type(item) is list:
                pending.extend((v, depth + 1) for v in item)
        return value
    except FeedbackError:
        raise
    except (UnicodeDecodeError, ValueError, RecursionError):
        raise FeedbackError('invalid-json') from None


def validate(value, manifest):
    """Use the trusted repository catalog, never a catalog supplied with the notes."""
    require(exact(value, HEADER_KEYS), 'invalid-header')
    require(type(value['schema_version']) is int and value['schema_version'] == 1, 'unsupported-schema')
    require(value['tool'] == 'lingvessa-m01-listening', 'wrong-tool')
    for field in ['scope', 'dataset_sha256', 'audio_source_sha']:
        require(value[field] == manifest[field], 'wrong-' + field)
    require(value['publication_ready'] is False and value['p5_milestone'] == 'NOT_READY'
            and value['p6_authorized'] is False, 'approval-claim-rejected')
    require(timestamp(value['saved_at']), 'invalid-saved-at')
    slots = [s for p in manifest['pairs'] for s in p['slots'] if s['available']]
    expected = [{'asset_id': s['id'], 'sha256': s['sha256']} for s in slots]
    require(value['bindings'] == expected, 'wrong-bindings')
    feedback = value['feedback']
    require(exact(feedback, {'levels', 'records'}), 'invalid-feedback')
    require(exact(feedback['levels'], {'en', 'cs'})
            and all(v in LEVELS for v in feedback['levels'].values()), 'invalid-language-levels')
    rows = feedback['records']
    require(type(rows) is list and len(rows) == len(slots), 'wrong-record-count')
    for row, slot in zip(rows, slots):
        require(exact(row, ROW_KEYS), 'invalid-record-fields')
        require(row['asset_id'] == slot['id'], 'wrong-record-id-or-order')
        require(type(row['listened']) is bool, 'invalid-listened')
        require(row['choice'] in CHOICES and row['issue'] in ISSUES, 'invalid-choice-or-issue')
        require(type(row['notes']) is str and utf16_length(row['notes']) <= 2000, 'invalid-notes')
        require(row['updated_at'] is None or timestamp(row['updated_at']), 'invalid-updated-at')
    # Neither a timestamp nor an asserted language level authenticates a human review.
    # Ignore completed_files and feedback_status; derive progress from validated rows.
    return feedback


def summarize(raw, manifest):
    value = decode(raw)
    feedback = validate(value, manifest)
    by_id = {row['asset_id']: row for row in feedback['records']}
    records, missing = [], []
    buckets = {key: 0 for key in ['needs_work', 'clarify', 'unreviewed', 'reported_no_issues']}
    completed = 0
    for pair in manifest['pairs']:
        for slot in pair['slots']:
            identity = {'asset_id': slot['id'], 'stable_code': slot['code'], 'pair_id': pair['id'],
                        'language': pair['language'], 'kind': pair['kind'], 'pace': slot['pace'],
                        'authored_text': pair['text']}
            if not slot['available']:
                missing.append(identity)
                continue
            row = by_id[slot['id']]
            done = row['listened'] and row['choice'] != 'pending'
            completed += int(done)
            level = feedback['levels'][pair['language']]
            if not done:
                bucket = 'unreviewed'
            elif row['choice'] == 'needs_work':
                bucket = 'needs_work'
            elif row['choice'] == 'unsure' or row['issue'] != 'none' or level == 'cannot_assess':
                bucket = 'clarify'
            else:
                bucket = 'reported_no_issues'
            buckets[bucket] += 1
            records.append({**identity, 'sha256': slot['sha256'], 'review_bucket': bucket,
                            'reviewer_language_level': level, 'asr_flag': slot['asr']['flagged'],
                            'feedback': dict(row)})
    order = {bucket: i for i, bucket in enumerate(buckets)}
    records.sort(key=lambda row: (order[row['review_bucket']], not row['asr_flag']))
    return {'schema_version': 1, 'tool': 'lingvessa-m01-feedback-intake', 'status': 'VALID',
            'scope': manifest['scope'], 'dataset_sha256': manifest['dataset_sha256'],
            'audio_source_sha': manifest['audio_source_sha'], 'input_sha256': sha(raw),
            'input_bytes': len(raw), 'self_reported_saved_at': value['saved_at'],
            'review_provenance': 'UNVERIFIED_SELF_REPORT',
            'counts': {'available_files': len(records), 'missing_files': len(missing),
                       'completed_attestations': completed, 'buckets': buckets},
            'feedback_status': 'RECORDED_UNAPPROVED' if completed == len(records) else 'PARTIAL',
            'records': records, 'missing': missing,
            'human_linguistic_approval': 'PENDING', 'rights_approval': 'PENDING',
            'publication_ready': False, 'p5_milestone': 'NOT_READY', 'p6_authorized': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path, help='Private JSON exported from the listening form')
    parser.add_argument('--output', required=True, type=Path, help='New private report file; existing files are never overwritten')
    scope = parser.add_mutually_exclusive_group()
    scope.add_argument('--test-fixture', action='store_true', help='Explicit UI_TEST_FIXTURE mode, for automated tests only')
    scope.add_argument('--complete-batch', action='store_true', help='Use the completed 420-file M01 draft catalog')
    args = parser.parse_args()
    try:
        with args.input.open('rb') as stream:
            raw = stream.read(MAX_BYTES + 1)
        builder = load_builder()
        catalog_path = ROOT / 'tools/p5/build-m01-review.py'
        if args.complete_batch:
            catalog_path = ROOT / 'tools/p5/complete-m01-audio.py'
            spec = importlib.util.spec_from_file_location('m01_complete', catalog_path)
            complete = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(complete)
            manifest = complete.catalog()[0]
        else:
            manifest = builder.fixture()[0] if args.test_fixture else builder.catalog()[0]
        result = summarize(raw, manifest)
        result.update(**builder.source_state(),
                      validator_sha256=sha(Path(__file__).read_bytes()),
                      catalog_builder_sha256=sha(catalog_path.read_bytes()))
        encoded = json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + '\n'
        # Validate everything before opening the destination. No input or catalog mutation.
        descriptor = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
            stream.write(encoded)
        print(json.dumps({key: result[key] for key in ['status', 'scope', 'input_sha256', 'counts',
                                                      'feedback_status', 'publication_ready', 'p5_milestone', 'p6_authorized']}))
    except FeedbackError as error:
        print(json.dumps({'status': 'REJECTED', 'reason': str(error)}), file=sys.stderr)
        return 2
    except FileExistsError:
        print(json.dumps({'status': 'REJECTED', 'reason': 'output-already-exists'}), file=sys.stderr)
        return 2
    except OSError:
        print(json.dumps({'status': 'REJECTED', 'reason': 'file-read-or-write-failed'}), file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
