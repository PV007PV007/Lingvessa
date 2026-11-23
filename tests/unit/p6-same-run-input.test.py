"""Fail-closed transport boundaries with artificial bytes; not M01 execution evidence."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import wave
import zipfile

spec = importlib.util.spec_from_file_location('same_run', Path(__file__).resolve().parents[2] / 'tools/p6/same-run-input.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class SameRunInput(unittest.TestCase):
    def setUp(self):
        self.head, self.parent = 'a' * 40, 'b' * 40
        self.q = {'consumer_parent_sha': self.parent}
        self.env = dict(GITHUB_REPOSITORY=m.legacy.REPO, GITHUB_EVENT_NAME='push',
                        GITHUB_REF='refs/heads/' + m.legacy.BRANCH, GITHUB_HEAD_SHA=self.head,
                        GITHUB_RUN_ID='123', GITHUB_RUN_ATTEMPT='1', GITHUB_REPOSITORY_ID='7')
        self.event = dict(ref=self.env['GITHUB_REF'], after=self.head, before=self.parent,
                          head_commit=dict(id=self.head, message=m.MARKER),
                          repository=dict(full_name=m.legacy.REPO, private=False))
        self.identity = m.validate_context(self.q, self.env, self.event, self.head, [self.parent])

    def test_only_exact_authorized_push_and_parent(self):
        for env in [dict(GITHUB_EVENT_NAME='pull_request'), dict(GITHUB_REPOSITORY='fork/repo'),
                    dict(GITHUB_REF='refs/heads/main'), dict(GITHUB_RUN_ATTEMPT='0'), dict(GITHUB_HEAD_SHA=self.parent)]:
            with self.subTest(env=env), self.assertRaises(ValueError):
                m.validate_context(self.q, {**self.env, **env}, self.event, self.head, [self.parent])
        for event in [dict(before=self.head), dict(after=self.parent), dict(repository=dict(full_name='fork/repo', private=False)),
                      dict(head_commit=dict(id=self.head, message='ordinary push'))]:
            with self.subTest(event=event), self.assertRaises(ValueError):
                m.validate_context(self.q, self.env, {**self.event, **event}, self.head, [self.parent])
        for request, parents in [({'consumer_parent_sha': self.head}, [self.parent]),
                                  ({**self.q, 'other': 'extra'}, [self.parent]), (self.q, [self.parent, self.head])]:
            with self.assertRaises(ValueError):
                m.validate_context(request, self.env, self.event, self.head, parents)

    def test_exact_same_run_artifact_digest_and_provenance(self):
        artifact = dict(id=456, expired=False, name='p6-approved-audio-123-1', digest='sha256:' + 'c' * 64,
                        size_in_bytes=1000, workflow_run=dict(id=123, head_sha=self.head,
                        head_branch=m.legacy.BRANCH, repository_id=7))
        m.artifact_identity(self.identity, artifact, 456, 'c' * 64, 7)
        for change in [dict(expired=True), dict(id=457), dict(name='p6-approved-audio-123-2'),
                       dict(digest='sha256:' + 'd' * 64), dict(size_in_bytes=50 * 1024 * 1024),
                       dict(workflow_run={**artifact['workflow_run'], 'head_sha': self.parent}),
                       dict(workflow_run={**artifact['workflow_run'], 'id': 124}),
                       dict(workflow_run={**artifact['workflow_run'], 'repository_id': 8})]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                m.artifact_identity(self.identity, {**artifact, **change}, 456, 'c' * 64, 7)

    def test_members_receipt_and_inner_bytes_even_with_recomputed_outer_digest(self):
        body = io.BytesIO()
        with wave.open(body, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(b'\0' * 4)
        data = body.getvalue()
        item = dict(path='audio/en/FIXTURE.wav', bytes=len(data), sha256=hashlib.sha256(data).hexdigest(),
                    metrics=dict(channels=1, sample_width=2, sample_rate=24000, frames=2))
        expected = {'audio_bytes': len(data), 'identity': self.identity, 'code_bindings': {'fixture': 'e' * 64}}
        for mutation in ['none', 'wav', 'receipt', 'credits', 'original', 'traversal', 'duplicate']:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as tmp:
                base = Path(tmp); archive = base / 'final.zip'; target = base / 'out'
                with zipfile.ZipFile(archive, 'w') as z:
                    z.writestr(item['path'], data if mutation != 'wav' else data[:-1] + b'\1')
                    z.writestr(m.p5.RECEIPT, json.dumps(expected if mutation != 'receipt' else {**expected, 'identity': {}}))
                    z.writestr('ATTRIBUTION.md', 'credits' if mutation != 'credits' else 'changed')
                    if mutation == 'original': z.writestr('original.zip', b'private')
                    if mutation == 'traversal': z.writestr('../outside', b'bad')
                    if mutation == 'duplicate': z.writestr(item['path'], data)
                digest = hashlib.sha256(archive.read_bytes()).hexdigest()
                with patch.object(m.p5, 'catalog', return_value=[item]), patch.object(m.p5, 'attribution', return_value='credits'):
                    if mutation == 'none':
                        m.unpack(archive, target, archive.stat().st_size, digest, expected)
                        self.assertEqual((target / item['path']).read_bytes(), data)
                    else:
                        with self.assertRaises((ValueError, m.p5.InputError)):
                            m.unpack(archive, target, archive.stat().st_size, digest, expected)
                        self.assertFalse(target.exists())
                        self.assertFalse((base.parent / 'outside').exists())


if __name__ == '__main__':
    unittest.main()
