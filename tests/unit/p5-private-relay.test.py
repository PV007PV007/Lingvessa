"""Artificial-byte relay checks; no claim of executing real M01 integration."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('private_relay', ROOT / 'tools/p5/private-m01-transfer.py')
relay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(relay)


class RelayTests(unittest.TestCase):
    def exercise(self, *, data=b'fixture', changed=None, head='a' * 40, status='ARCHIVE_VERIFIED', asset_id=84):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / 'checkout'
            directory = Path(temporary) / 'input'
            directory.mkdir()
            expected = {'filename': 'fixture.zip', 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
            report = {'release_id': 42, 'asset_id': asset_id, 'source_sha': head, 'status': status,
                      'repository_private_verified': True, 'release_draft_verified': True,
                      'draft_asset_access_verified': True, 'expected_archive_sha256': expected['sha256'],
                      'expected_archive_bytes': expected['bytes']}
            (directory / 'm01-private-transfer.json').write_text(json.dumps(report))
            if status == 'ARCHIVE_VERIFIED' or changed is not None:
                (directory / 'fixture.zip').write_bytes(changed if changed is not None else data)
            with patch.object(relay, 'ROOT', root), patch.object(relay, 'EXPECTED', expected), \
                    patch.object(relay, 'RELEASE_ID', 42), patch.object(relay, 'ASSET_ID', 84), \
                    patch.dict(os.environ, {'P5_M01_TRANSFER_DIR': str(directory), 'P5_M01_RELEASE_ID': '42',
                                           'GITHUB_HEAD_SHA': 'a' * 40}), patch.object(relay, 'output') as output, \
                    patch('builtins.print'), patch.object(relay, 'api') as api:
                relay.receive()
                api.assert_not_called()
                result = json.loads((root / 'artifacts/p5/m01-private-transfer.json').read_text())
                self.assertTrue(result['relay_received_and_source_bound'])
                if status == 'ARCHIVE_VERIFIED':
                    output.assert_called_once_with('P5_M01_ARCHIVE_PATH', directory / 'fixture.zip', 'GITHUB_ENV')
                else:
                    output.assert_not_called()

    def test_exact_source_and_bytes_received_without_release_token(self):
        self.exercise()

    def test_wrong_source_rejected(self):
        with self.assertRaisesRegex(relay.TransferError, 'provenance/identity'):
            self.exercise(head='b' * 40)

    def test_changed_archive_rejected(self):
        with self.assertRaisesRegex(relay.TransferError, 'checksum/length'):
            self.exercise(changed=b'changed')

    def test_missing_input_is_rejected_for_pinned_approved_archive(self):
        with self.assertRaisesRegex(relay.TransferError, 'provenance/identity'):
            self.exercise(status='AWAITING_PRIVATE_UPLOAD')

    def test_replaced_asset_is_rejected(self):
        with self.assertRaisesRegex(relay.TransferError, 'provenance/identity'):
            self.exercise(asset_id=85)

    def test_unexpected_archive_with_missing_status_rejected(self):
        with self.assertRaisesRegex(relay.TransferError, 'provenance/identity'):
            self.exercise(status='AWAITING_PRIVATE_UPLOAD', changed=b'fixture')

    def test_checkout_or_relative_staging_rejected(self):
        for value in ['relative', str(ROOT / 'artifacts/input')]:
            with patch.dict(os.environ, {'P5_M01_TRANSFER_DIR': value}), self.assertRaises(relay.TransferError):
                relay.transfer_directory()


if __name__ == '__main__':
    unittest.main()
