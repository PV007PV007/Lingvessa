"""Transport security checks use artificial bytes; they are not real M01 ingestion evidence."""
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

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('private_transfer', ROOT / 'tools/p5/private-m01-transfer.py')
transfer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transfer)


class PrivateTransferTests(unittest.TestCase):
    def test_private_repository_required_before_mutation(self):
        with patch.dict(os.environ, {'GH_TOKEN': 'artificial-token'}), patch('sys.argv', ['transfer', 'prepare']), \
                patch.object(transfer, 'api', return_value={'private': False, 'full_name': transfer.REPOSITORY}), \
                patch.object(transfer, 'prepare') as prepare:
            with self.assertRaisesRegex(transfer.TransferError, 'Private repository'):
                transfer.main()
            prepare.assert_not_called()

    def test_foreign_branch_cannot_create_container(self):
        with patch.dict(os.environ, {'GITHUB_REPOSITORY': transfer.REPOSITORY,
                        'GITHUB_EVENT_NAME': 'push', 'GITHUB_REF': 'refs/heads/untrusted'}), \
                patch.object(transfer, 'api') as api:
            with self.assertRaisesRegex(transfer.TransferError, 'authorized P5'):
                transfer.prepare('artificial-token', {})
            api.assert_not_called()

    def test_published_or_unrelated_release_rejected(self):
        valid = {'id': transfer.RELEASE_ID, 'draft': True, 'prerelease': True, 'tag_name': transfer.TAG,
                 'name': transfer.TITLE, 'body': transfer.MARKER}
        transfer.validate_release(valid)
        for changed in [{'draft': False}, {'id': 420910401}, {'tag_name': 'accepted-p2'}, {'body': 'unrelated'}]:
            with self.subTest(changed=changed), self.assertRaises(transfer.TransferError):
                transfer.validate_release({**valid, **changed})

    def test_redirect_allowlist(self):
        for url in ['http://release-assets.githubusercontent.com/a', 'https://attacker.invalid/a',
                    'https://user:password@objects.githubusercontent.com/a', 'https://objects.githubusercontent.com:444/a']:
            with self.subTest(url=url), self.assertRaises(transfer.TransferError):
                transfer.redirect_url(url)
        transfer.redirect_url('https://release-assets.githubusercontent.com/a?signature=artificial')
        self.assertIsNone(transfer.NoRedirect().redirect_request(None, None, None, None, None, None))

    def test_redirect_does_not_forward_authorization_and_checks_bytes(self):
        body = b'not-real-m01'
        expected = {'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}
        redirect = urllib.error.HTTPError('https://api.github.com/redacted', 302, '',
                                         {'Location': 'https://release-assets.githubusercontent.com/fixture'}, None)
        with tempfile.TemporaryDirectory() as directory, patch.object(transfer, 'EXPECTED', expected), \
                patch.object(transfer, 'request', side_effect=redirect), \
                patch.object(transfer.urllib.request, 'build_opener') as opener:
            opener.return_value.open.return_value = io.BytesIO(body)
            target = Path(directory) / 'input.zip'
            transfer.download_asset('must-not-reach-cdn', {'id': 1}, target)
            self.assertEqual(target.read_bytes(), body)
            opener.return_value.open.assert_called_once_with('https://release-assets.githubusercontent.com/fixture', timeout=60)

    def test_bad_bytes_leave_no_file_and_no_secret_in_error(self):
        for body in [b'wrong', b'oversized']:
            with tempfile.TemporaryDirectory() as directory, patch.object(transfer, 'EXPECTED', {'bytes': 5, 'sha256': '0' * 64}), \
                    patch.object(transfer, 'request', return_value=io.BytesIO(body)):
                target = Path(directory) / 'input.zip'
                with self.assertRaisesRegex(transfer.TransferError, '^Private archive download/verification failed; credentials and response suppressed$'):
                    transfer.download_asset('secret', {'id': 1}, target)
                self.assertFalse(target.exists())

    def test_network_failure_is_sanitized(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(transfer, 'request', side_effect=RuntimeError('secret URL and token')):
            with self.assertRaises(transfer.TransferError) as caught:
                transfer.download_asset('secret', {'id': 1}, Path(directory) / 'input.zip')
            self.assertNotIn('secret URL', str(caught.exception))

    def test_existing_container_is_reused_without_write(self):
        release = {'id': transfer.RELEASE_ID, 'draft': True, 'prerelease': True, 'tag_name': transfer.TAG,
                   'name': transfer.TITLE, 'body': transfer.MARKER}
        with patch.dict(os.environ, {'GITHUB_REPOSITORY': transfer.REPOSITORY,
                        'GITHUB_EVENT_NAME': 'push', 'GITHUB_REF': 'refs/heads/implementation/p5-media-speech'}), \
                patch.object(transfer, 'api', return_value=release) as api, \
                patch.object(transfer, 'output'), patch('builtins.print'):
            transfer.prepare('artificial-token', {'default_branch': 'main'})
            api.assert_called_once_with('/releases/' + str(transfer.RELEASE_ID), 'artificial-token')

    def test_missing_draft_does_not_create_replacement(self):
        with patch.dict(os.environ, {'GITHUB_REPOSITORY': transfer.REPOSITORY,
                        'GITHUB_EVENT_NAME': 'push', 'GITHUB_REF': 'refs/heads/implementation/p5-media-speech'}), \
                patch.object(transfer, 'api', side_effect=transfer.TransferError('GitHub API request failed: HTTP 404')) as api:
            with self.assertRaisesRegex(transfer.TransferError, 'HTTP 404'):
                transfer.prepare('artificial-token', {'default_branch': 'main'})
            api.assert_called_once_with('/releases/' + str(transfer.RELEASE_ID), 'artificial-token')

    def test_missing_or_replaced_asset_cannot_become_missing_input_success(self):
        release = {'id': transfer.RELEASE_ID, 'draft': True, 'prerelease': True, 'tag_name': transfer.TAG,
                   'name': transfer.TITLE, 'body': transfer.MARKER}
        replaced = {'id': transfer.ASSET_ID + 1, 'name': transfer.EXPECTED['filename'],
                    'state': 'uploaded', 'size': transfer.EXPECTED['bytes'],
                    'digest': 'sha256:' + transfer.EXPECTED['sha256']}
        for assets, message in [([], 'Pinned approved archive unavailable'), ([replaced], 'metadata mismatch')]:
            with self.subTest(assets=bool(assets)), tempfile.TemporaryDirectory() as directory, \
                    patch.object(transfer, 'transfer_directory', return_value=Path(directory)), \
                    patch.object(transfer, 'api', side_effect=[release, assets]) as api, \
                    patch.object(transfer, 'download_asset') as download:
                with self.assertRaisesRegex(transfer.TransferError, message):
                    transfer.download('artificial-token', str(transfer.RELEASE_ID))
                download.assert_not_called()
                self.assertFalse((Path(directory) / 'm01-private-transfer.json').exists())
                self.assertEqual(api.call_count, 2)

    def test_duplicate_release_id_rejected_before_api(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(transfer, 'transfer_directory', return_value=Path(directory)), \
                patch.object(transfer, 'api') as api:
            with self.assertRaisesRegex(transfer.TransferError, 'Pinned input container'):
                transfer.download('artificial-token', '420910401')
            api.assert_not_called()


if __name__ == '__main__':
    unittest.main()
