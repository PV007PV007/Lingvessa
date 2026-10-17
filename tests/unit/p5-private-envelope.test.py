import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('envelope', Path(__file__).resolve().parents[2] / 'tools/p5/private-m01-envelope.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class EnvelopeTests(unittest.TestCase):
    def test_unchanged_bytes_and_replay(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'input.zip'
            source.write_bytes(b'artificial transport fixture; not M01')
            target = root / 'envelope.zip'
            plan = {'archive': {'filename': 'input.zip', 'bytes': source.stat().st_size,
                                'sha256': hashlib.sha256(source.read_bytes()).hexdigest()}}
            # Establish expected deterministic envelope independently with ZIP metadata.
            info = zipfile.ZipInfo('input.zip', (1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100600 << 16
            with zipfile.ZipFile(root / 'expected.zip', 'x') as archive:
                archive.writestr(info, source.read_bytes())
            expected = (root / 'expected.zip').read_bytes()
            plan['envelope'] = {'bytes': len(expected), 'sha256': hashlib.sha256(expected).hexdigest()}
            module.pack(source, target, plan)
            module.pack(source, target, plan)
            module.unpack(target, root / 'restored.zip', plan)
            self.assertEqual(source.read_bytes(), (root / 'restored.zip').read_bytes())
            target.write_bytes(expected[:-1] + b'!')
            with self.assertRaises(ValueError):
                module.unpack(target, root / 'tampered.zip', plan)
            self.assertFalse((root / 'tampered.zip').exists())

    def test_extra_entries_cannot_escape_envelope(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / 'bad.zip'
            with zipfile.ZipFile(path, 'x') as archive:
                archive.writestr('../escape', b'fixture')
            plan = {'archive': {'filename': 'input.zip', 'bytes': 7},
                    'envelope': {'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}}
            with self.assertRaises(ValueError):
                module.unpack(path, root / 'output.zip', plan)
            self.assertFalse((root / 'output.zip').exists())


if __name__ == '__main__':
    unittest.main()
