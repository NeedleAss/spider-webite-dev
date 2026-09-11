import copy
import json
from pathlib import Path
import struct
import tempfile
import unittest
from tools.carerover import check_partition_binary, validate_profile, runtime_files

class BuildGuardTests(unittest.TestCase):
    def test_compile_profile_cannot_be_flashed(self):
        p=json.loads(Path('config/development.json').read_text())
        validate_profile(p)
        with self.assertRaisesRegex(ValueError,'forbidden'): validate_profile(p,flashing=True)
        p['verification']='windows_baseline_confirmed'; validate_profile(p,flashing=True)
        p['flash_size']='8MB'
        with self.assertRaises(ValueError): validate_profile(p,flashing=True)

    def test_pending_baseline_never_silently_uses_development_defaults(self):
        p=json.loads(Path('config/board.example.json').read_text())
        with self.assertRaisesRegex(ValueError,'pending'): validate_profile(p)

    def test_real_binary_partition_offsets_and_sizes_are_checked(self):
        entries=[('nvs',1,2,0x9000,0x5000),('otadata',1,0,0xe000,0x2000),
                 ('app0',0,16,0x10000,0x300000),('app1',0,17,0x310000,0x300000),
                 ('ffat',1,129,0x610000,0x9e0000),('coredump',1,3,0xff0000,0x10000)]
        def binary(es): return b''.join(struct.pack('<HBBII16sI',0x50aa,t,s,o,n,name.encode(),0) for name,t,s,o,n in es)
        with tempfile.TemporaryDirectory() as d:
            f=Path(d)/'partitions.bin'; f.write_bytes(binary(entries)); check_partition_binary(f)
            bad=copy.copy(entries); bad[4]=('ffat',1,129,0x620000,0x9d0000); f.write_bytes(binary(bad))
            with self.assertRaisesRegex(ValueError,'differs'): check_partition_binary(f)

    def test_payload_excludes_dev_bridge_tests_secrets_and_recordings(self):
        files=runtime_files()
        self.assertTrue(any(p.name=='index.html' for p in files))
        self.assertFalse(any(p.suffix in {'.py','.log','.h','.txt'} for p in files))
        self.assertFalse(any('DELIVERY' in p.parts or 'hardware' in p.parts for p in files))

if __name__=='__main__': unittest.main()
