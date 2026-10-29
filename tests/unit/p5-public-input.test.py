"""Public final-WAV transport boundaries, using artificial bytes only."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
import wave

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('public_input', ROOT / 'tools/p5/public-m01-input.py')
relay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(relay)


class PublicInputTests(unittest.TestCase):
    def test_only_owner_branch_and_exact_pr_source(self):
        source = 'a' * 40
        cases = [
            ('push', 'refs/heads/implementation/p5-media-speech', {'after': source}, True),
            ('push', 'refs/heads/other', {'after': source}, False),
            ('push', 'refs/heads/implementation/p5-media-speech', {'after': 'b' * 40}, False),
            ('pull_request_target', 'refs/heads/main', {'after': source}, False),
        ]
        pr = {'number': 5, 'pull_request': {'head': {'repo': {'full_name': relay.transport.REPOSITORY},
              'ref': 'implementation/p5-media-speech', 'sha': source}}}
        cases += [('pull_request', 'refs/pull/5/merge', pr, True)]
        foreign = json.loads(json.dumps(pr))
        foreign['pull_request']['head']['repo']['full_name'] = 'external/fork'
        cases += [('pull_request', 'refs/pull/5/merge', foreign, False)]
        for event, ref, data, allowed in cases:
            with self.subTest(event=event, allowed=allowed), tempfile.TemporaryDirectory() as temporary:
                path = Path(temporary) / 'event.json'
                path.write_text(json.dumps(data))
                env = {'GITHUB_EVENT_PATH': str(path), 'GITHUB_REPOSITORY': relay.transport.REPOSITORY,
                       'GITHUB_EVENT_NAME': event, 'GITHUB_REF': ref, 'GITHUB_HEAD_SHA': source,
                       'GITHUB_RUN_ID': '123', 'GITHUB_RUN_ATTEMPT': '2'}
                with patch.dict(os.environ, env), patch.object(relay.subprocess, 'check_output', return_value=source):
                    if allowed:
                        self.assertEqual(relay.context()['source_sha'], source)
                    else:
                        with self.assertRaises(relay.InputError):
                            relay.context()

    def test_anonymous_probe_never_sends_credentials_or_follows_redirects(self):
        for status, allowed in [(404, True), (302, False), (403, False), (500, False)]:
            error = urllib.error.HTTPError('https://example.invalid/fixture', status, 'fixture', {}, None)
            with self.subTest(status=status), patch.object(relay.urllib.request, 'build_opener') as opener:
                opener.return_value.open.side_effect = error
                if allowed:
                    relay.anonymous_denied('https://example.invalid/fixture', binary=True)
                else:
                    with self.assertRaises(relay.InputError):
                        relay.anonymous_denied('https://example.invalid/fixture', binary=True)
                request = opener.return_value.open.call_args.args[0]
                self.assertNotIn('Authorization', request.headers)
                self.assertIsInstance(opener.call_args.args[0], relay.transport.NoRedirect)

    def test_anonymous_success_is_rejected(self):
        with patch.object(relay.urllib.request, 'build_opener'):
            with self.assertRaisesRegex(relay.InputError, 'anonymously accessible'):
                relay.anonymous_denied('https://example.invalid/fixture')

    def preflight(self, *, public=True, assets=None):
        expected = {'filename': 'fixture.zip', 'bytes': 7, 'sha256': 'a' * 64}
        asset = {'id': 2, 'name': 'fixture.zip', 'state': 'uploaded', 'size': 7,
                 'digest': 'sha256:' + expected['sha256'],
                 'browser_download_url': 'https://github.com/PV007PV007/Lingvessa/releases/download/fixture/fixture.zip'}
        with patch.object(relay.transport, 'EXPECTED', expected), patch.object(relay.transport, 'ASSET_ID', 2), \
                patch.object(relay.transport, 'RELEASE_ID', 1), patch.object(relay.transport, 'validate_release') as validate, \
                patch.object(relay.transport, 'api', side_effect=[
                    {'full_name': relay.transport.REPOSITORY, 'private': not public}, {'draft': True},
                    [asset] if assets is None else assets]) as api, patch.object(relay, 'anonymous_denied') as anonymous:
            result = relay.preflight('artificial-token')
            self.assertEqual(result, asset)
            validate.assert_called_once()
            self.assertEqual(anonymous.call_count, 3)
            self.assertEqual(api.call_count, 3)

    def test_existing_draft_is_only_read_and_anonymous_access_is_checked(self):
        self.preflight()

    def test_wrong_repository_profile_missing_or_replaced_input_is_rejected(self):
        for args in [{'public': False}, {'assets': []}, {'assets': [
                {'id': 3, 'name': 'fixture.zip', 'state': 'uploaded', 'size': 7}]}]:
            with self.subTest(args=args), self.assertRaises(relay.InputError):
                self.preflight(**args)

    def fixture(self, directory):
        body = io.BytesIO()
        with wave.open(body, 'wb') as sound:
            sound.setnchannels(1)
            sound.setsampwidth(2)
            sound.setframerate(24000)
            sound.writeframes(b'\0' * 4)
        data = body.getvalue()
        item = {'path': 'audio/en/FIXTURE.wav', 'bytes': len(data),
                'sha256': hashlib.sha256(data).hexdigest(),
                'metrics': {'channels': 1, 'sample_width': 2, 'sample_rate': 24000, 'frames': 2}}
        path = directory / item['path']
        path.parent.mkdir(parents=True)
        path.write_bytes(data)
        (directory / relay.RECEIPT).write_text('{}')
        (directory / 'ATTRIBUTION.md').write_text('fixture credits')
        return item

    def test_extra_archive_changed_wav_and_symlink_are_rejected(self):
        for mutation in ['none', 'extra', 'changed', 'symlink', 'credits', 'missing']:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary)
                item = self.fixture(directory)
                wav = directory / item['path']
                if mutation == 'extra':
                    (directory / 'original.zip').write_bytes(b'private historical input')
                elif mutation == 'changed':
                    wav.write_bytes(wav.read_bytes() + b'changed')
                elif mutation == 'symlink':
                    target = directory / 'target'
                    wav.rename(target)
                    wav.symlink_to(target)
                elif mutation == 'credits':
                    (directory / 'ATTRIBUTION.md').write_text('changed')
                elif mutation == 'missing':
                    wav.unlink()
                with patch.object(relay, 'catalog', return_value=[item]), \
                        patch.object(relay, 'attribution', return_value='fixture credits'):
                    if mutation == 'none':
                        self.assertEqual(relay.verify_wavs(directory), item['bytes'])
                    else:
                        with self.assertRaises(relay.InputError):
                            relay.verify_wavs(directory)

    def test_receipt_is_exact_source_run_attempt_and_code_bound_without_token(self):
        for change in [{}, {'source_sha': 'b' * 40}, {'run_id': '124'}, {'run_attempt': '3'},
                       {'original_archive_in_artifact': True}, {'code_bindings': {}}, {'extra': 'unknown'}]:
            with self.subTest(change=change), tempfile.TemporaryDirectory() as temporary:
                base = Path(temporary)
                directory = base / 'input'
                directory.mkdir()
                item = self.fixture(directory)
                identity = {'source_sha': 'a' * 40, 'run_id': '123', 'run_attempt': '2', 'event': 'push'}
                with patch.object(relay, 'ROOT', base / 'checkout'), patch.object(relay, 'catalog', return_value=[item]), \
                        patch.object(relay, 'code_bindings', return_value={'fixture': 'a' * 64}), \
                        patch.object(relay, 'attribution', return_value='fixture credits'), \
                        patch.object(relay, 'directory', return_value=directory), \
                        patch.object(relay.transport, 'api') as api, patch.object(relay.transport, 'output') as output, \
                        patch('builtins.print'):
                    record = relay.receipt(identity)
                    record.update(change)
                    (directory / relay.RECEIPT).write_text(json.dumps(record))
                    if change:
                        with self.assertRaises(relay.InputError):
                            relay.receive(identity)
                        output.assert_not_called()
                    else:
                        relay.receive(identity)
                        output.assert_called_once_with('P5_M01_AUDIO_ROOT', directory / 'audio', 'GITHUB_ENV')
                        status = json.loads((base / 'checkout/artifacts/p5/m01-input-status.json').read_text())
                        self.assertTrue(status['audio_bytes_verified'])
                    api.assert_not_called()

    def test_staging_cannot_use_checkout_relative_or_symlink_path(self):
        with tempfile.TemporaryDirectory() as temporary:
            link = Path(temporary) / 'link'
            link.symlink_to(ROOT, target_is_directory=True)
            for path in ['relative', str(ROOT / 'artifacts/input'), str(link)]:
                with patch.dict(os.environ, {'P5_M01_TRANSFER_DIR': path}), self.assertRaises(relay.InputError):
                    relay.directory()

    def test_real_manifest_matches_all_immutable_records(self):
        items = relay.catalog()
        self.assertEqual(len(items), 420)
        self.assertEqual(sum(item['bytes'] for item in items), 35876788)

    def test_export_removes_original_and_never_includes_it_in_relay(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            destination = base / 'relay'
            originals = []
            entries = []

            def download(_token, _asset, path):
                originals.append(path)
                path.write_bytes(b'private original fixture')

            def stage(path, target):
                self.assertEqual(path.read_bytes(), b'private original fixture')
                target.mkdir()
                entries.append(self.fixture(target))

            with patch.object(relay, 'preflight', return_value={}) as preflight, \
                    patch.object(relay, 'directory', return_value=destination), \
                    patch.object(relay.transport, 'download_asset', side_effect=download), \
                    patch.object(relay.staging, 'stage', side_effect=stage), \
                    patch.object(relay, 'catalog', side_effect=lambda: entries), \
                    patch.object(relay, 'code_bindings', return_value={}), \
                    patch.object(relay, 'attribution', return_value='fixture credits'), patch('builtins.print'):
                relay.export('artificial-token', {'source_sha': 'a' * 40})
                self.assertEqual(preflight.call_count, 2)
                self.assertFalse(originals[0].exists())
                self.assertEqual(list(base.iterdir()), [destination])
                self.assertFalse(list(destination.rglob('*.zip')))

    def test_failed_export_leaves_nothing_uploadable(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            destination = base / 'relay'

            def stage(_path, target):
                target.mkdir()
                (target / 'partial.wav').write_bytes(b'partial fixture')
                raise relay.InputError('Fixture failure')

            with patch.object(relay, 'preflight', return_value={}), \
                    patch.object(relay, 'directory', return_value=destination), \
                    patch.object(relay.transport, 'download_asset'), \
                    patch.object(relay.staging, 'stage', side_effect=stage):
                with self.assertRaises(relay.InputError):
                    relay.export('artificial-token', {'source_sha': 'a' * 40})
                self.assertEqual(list(base.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
