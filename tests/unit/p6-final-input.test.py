"""Boundary tests only; no audio corpus is present in Git or exported by this test."""
import importlib.util
from pathlib import Path
import stat
import unittest
from zipfile import ZipInfo

spec = importlib.util.spec_from_file_location('p6_input', Path(__file__).resolve().parents[2] / 'tools/p6/receive-final-wavs.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class InputBoundary(unittest.TestCase):
    def setUp(self):
        self.q = m.pin(dict(producer_run_attempt=2, artifact_id=123, zip_bytes=1000, zip_sha256='a' * 64,
                            consumer_parent_sha='b' * 40))
        self.run = dict(id=m.RUN, head_sha=m.PRODUCER, event='push', head_branch='implementation/p5-media-speech',
                        conclusion='success', run_attempt=2, repository=dict(full_name=m.REPO, id=7))
        self.art = dict(id=123, expired=False, name=f'p5-approved-audio-{m.RUN}-2', size_in_bytes=1000,
                        digest='sha256:' + 'a' * 64, workflow_run=dict(id=m.RUN, head_sha=m.PRODUCER, repository_id=7))

    def test_only_pinned_completed_producer_and_final_artifact(self):
        m.api_identity(self.q, self.run, self.art)
        for change in [dict(expired=True), dict(name='p5-private-input'), dict(digest='sha256:' + '0' * 64),
                       dict(id=1), dict(workflow_run=dict(id=999, head_sha=m.PRODUCER, repository_id=7))]:
            with self.assertRaises(ValueError):
                m.api_identity(self.q, self.run, {**self.art, **change})
        for change in [dict(conclusion='failure'), dict(run_attempt=1), dict(event='pull_request'), dict(head_sha='d' * 40)]:
            with self.assertRaises(ValueError):
                m.api_identity(self.q, {**self.run, **change}, self.art)

    def test_request_is_one_explicit_same_repo_push(self):
        head = 'c' * 40
        env = dict(GITHUB_REPOSITORY=m.REPO, GITHUB_EVENT_NAME='push', GITHUB_REF='refs/heads/' + m.BRANCH, GITHUB_HEAD_SHA=head)
        event = dict(ref=env['GITHUB_REF'], after=head, before=self.q['consumer_parent_sha'], repository=dict(full_name=m.REPO),
                     head_commit=dict(id=head, message='P6 approved test [p6:verify-final-l01]'))
        m.hosted_context(self.q, env, event, head, [event['before']])
        for change in [dict(before=head), dict(repository=dict(full_name='fork/repo')),
                       dict(head_commit=dict(id=head, message='ordinary push'))]:
            with self.assertRaises(ValueError):
                m.hosted_context(self.q, env, {**event, **change}, head, [event['before']])
        with self.assertRaises(ValueError):
            m.hosted_context(self.q, {**env, 'GITHUB_EVENT_NAME': 'pull_request'}, event, head, [event['before']])

    def test_exact_zip_members_before_extracting(self):
        def item(name, mode=stat.S_IFREG, size=2):
            z = ZipInfo(name)
            z.file_size = size
            z.external_attr = mode << 16
            return z
        lengths = {'audio/en/FINAL.wav': 2, 'ATTRIBUTION.md': 2}
        ok = [item(k) for k in lengths]
        m.validate_members(ok, lengths)
        for bad in [ok[:1], ok + ok[:1], [ok[0], ok[0]], [item('../elsewhere'), ok[1]],
                    [item('original.zip'), ok[1]], [item(ok[0].filename, stat.S_IFLNK), ok[1]],
                    [item(ok[0].filename, size=3), ok[1]]]:
            with self.assertRaises(ValueError):
                m.validate_members(bad, lengths)


if __name__ == '__main__':
    unittest.main()
