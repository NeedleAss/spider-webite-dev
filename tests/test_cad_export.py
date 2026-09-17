"""Corrupt saved streams must never be silently treated as trusted CAD geometry."""
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
import zlib
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from export_cad import streams, mesh_tables

class CadExportTest(unittest.TestCase):
    def test_stream_crc_and_size_are_enforced(self):
        payload=b'trusted mesh';name=b'Contents/DisplayLists'
        encoder=zlib.compressobj(wbits=-15);packed=encoder.compress(payload)+encoder.flush()
        encoded=bytes((b>>4)|((b&15)<<4) for b in name)
        def container(crc,size):
            return b'ABCD\0\0\0\4'+bytes.fromhex('140006000800')+struct.pack('<5I',0,crc,len(packed),size,len(name))+encoded+packed
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'part.SLDPRT'
            p.write_bytes(container(zlib.crc32(payload),len(payload)))
            self.assertEqual(streams(p)[name.decode()],payload)
            for crc,size in [(0,len(payload)),(zlib.crc32(payload),len(payload)-1)]:
                p.write_bytes(container(crc,size))
                with self.assertRaises(ValueError):streams(p)
    def test_table_is_atomic_not_partial_on_truncation(self):
        pieces=[]
        for w,k,raw in [(4,8,struct.pack('<I',3)),(12,100,struct.pack('<9f',0,0,0,1,0,0,0,1,0)),(12,100,b''),(4,8,b''),(4,8,struct.pack('<I',4)),(1,8,b'')]:
            pieces.append(struct.pack('<4I',w,k,2,len(raw)//w)+raw)
        data=b''.join(pieces)
        self.assertEqual(len(list(mesh_tables(data))),1)
        self.assertEqual(list(mesh_tables(data[:-1])),[])
    def test_delivered_asset_manifest_matches_glb(self):
        import hashlib
        root=Path(__file__).resolve().parents[1]/'presentation/assets/cad'
        manifest=json.loads((root/'cad-manifest.json').read_text())
        data=(root/'carerover.glb').read_bytes()
        self.assertEqual(hashlib.sha256(data).hexdigest(),manifest['glbSha256'])
        magic,version,length=struct.unpack_from('<3I',data)
        self.assertEqual((magic,version,length),(0x46546c67,2,len(data)))
        size=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+size])
        self.assertEqual(len(gltf['nodes']),20);self.assertEqual(len(gltf['meshes']),15)
        self.assertEqual(sum(n['extras']['partId']=='wheel' for n in gltf['nodes']),4)
        self.assertEqual(sum(n['extras']['partId']=='servo' for n in gltf['nodes']),3)
        self.assertEqual(manifest['skippedInstances'][0]['swHidden'],'YES')
        for node,instance in zip(gltf['nodes'],manifest['instances']):self.assertEqual(node['matrix'],instance['matrix'])
