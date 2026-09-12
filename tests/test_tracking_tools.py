import json
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
from tools.tracking import crc8, analyze, cam_profile, cam_flash
from tools import carerover
import hashlib
class TrackingToolTests(unittest.TestCase):
    def test_archive_provenance_without_git_and_after_edit(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);source=root/'example.cpp';source.write_text('original')
            (root/'EXPORT_INFO.json').write_text(json.dumps({'source_commit':'exported-commit','source_dirty':False}))
            (root/'SOURCE_MANIFEST.json').write_text(json.dumps({'example.cpp':hashlib.sha256(source.read_bytes()).hexdigest()}))
            with patch.object(carerover,'ROOT',root),patch.object(carerover,'capture') as git:
                info=carerover.source_info()
                self.assertEqual(info['source_commit'],'exported-commit')
                self.assertFalse(info['source_dirty']);self.assertFalse(info['archive_modified'])
                source.write_text('edited')
                self.assertTrue(carerover.source_info()['archive_modified'])
                self.assertTrue(carerover.source_info()['source_dirty'])
                git.assert_not_called()

    def test_crc_and_capture_summary(self):
        self.assertEqual(crc8('123456789'),0xf4)
        body='P,1,100,1,900,100,60,180,140,40'
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'serial.jsonl'
            p.write_text('\n'.join(json.dumps({'elapsed_ms':t,'text':s}) for t,s in [(10,f'@{body}*{crc8(body):02X}'),(210,'@P,2,200,0,0,0,0,0,0,10*00')]))
            r=analyze(p);self.assertEqual(r['uart_valid'],1);self.assertEqual(r['uart_bad_crc'],1);self.assertEqual(r['person_found'],1)
    def test_main_profile_cannot_be_used_as_cam(self):
        with self.assertRaises(ValueError):cam_profile('config/tracking-development.json')
        p=cam_profile('config/cam-board.example.json');self.assertEqual(p['verification'],'compile_only')
    def test_compile_cam_package_rejected_before_any_serial_call(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);(p/'manifest.json').write_text(json.dumps({'target':'cam','verification':'compile_only','flash_size':'8MB'}))
            with patch('tools.tracking.run') as execute:
                with self.assertRaises(ValueError):cam_flash(type('Args',(),{'package':d,'port':'COM6'})())
                execute.assert_not_called()
if __name__=='__main__':unittest.main()
