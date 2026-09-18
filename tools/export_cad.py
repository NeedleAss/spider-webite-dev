#!/usr/bin/env python3
"""Read saved SolidWorks display meshes; never modify CAD or contact a service.

Modern block envelope / six-descriptor display-table grammar documented by
cadmpeg (CC BY 4.0): https://github.com/cadmpeg/cadmpeg/blob/main/docs/formats/sldprt.md
Independent minimal reader for this asset pipeline, not a B-rep/CAD translator.
Only CRC-checked streams and completely validated tables are admitted.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import xml.etree.ElementTree as ET
import zlib

IDS = dict(zip(['底盘','电池','舵机','全向轮','主板','主板支架','摄像头','摄像头架',
               '加速度计','心率血氧计','顶盖','屏幕','主板外骨骼','外骨骼','超声模块'],
              ['chassis','battery','servo','wheel','controller','board-mount','camera','camera-mount',
               'imu','health','lid','display','board-frame','shell','ultrasonic']))


def streams(path):
    data = path.read_bytes()
    if len(data)>50_000_000 or data[4:8]!=b'\0\0\0\4':
        raise ValueError(f'{path.name}: unsupported container')
    found = {}
    for match in re.finditer(re.escape(bytes.fromhex('140006000800')), data):
        start=match.start()
        if start+26>len(data): continue
        _,crc,packed,size,namesize=struct.unpack_from('<5I',data,start+6)
        if namesize>512 or packed>len(data) or size>64_000_000: continue
        end=start+26+namesize
        if end+packed>len(data): continue
        try:
            name=bytes((b>>4)|((b&15)<<4) for b in data[start+26:end]).decode('utf-8')
            decoder=zlib.decompressobj(-15)
            value=decoder.decompress(data[end:end+packed],size+1)
        except (UnicodeError,zlib.error): continue
        if not decoder.eof or decoder.unused_data or len(value)!=size or zlib.crc32(value)!=crc: continue
        if name in found and found[name]!=value: raise ValueError(f'ambiguous stream: {name}')
        found[name]=value
    if not found: raise ValueError(f'{path.name}: no validated streams')
    return found


def mesh_tables(data):
    signature=struct.pack('<3I',4,8,2)
    at=0
    while True:
        at=data.find(signature,at)
        if at<0: return
        begin=at;cursor=at;arrays=[]
        try:
            for width,kind in [(4,8),(12,100),(12,100),(4,8),(4,8),(1,8)]:
                w,k,flags,count=struct.unpack_from('<4I',data,cursor)
                if (w,k,flags)!=(width,kind,2) or count>1_000_000: raise ValueError()
                cursor+=16;end=cursor+width*count
                if end>len(data): raise ValueError()
                arrays.append(data[cursor:end]);cursor=end
            strips=list(struct.unpack('<%dI'%(len(arrays[0])//4),arrays[0]))
            vertices=len(arrays[1])//12
            if not strips or min(strips)<3 or sum(strips)!=vertices: raise ValueError()
            if len(arrays[2]) not in (0,len(arrays[1])): raise ValueError()
            edges=sum(2*n-2 for n in strips)
            list_c=list(struct.unpack('<%dI'%(len(arrays[4])//4),arrays[4]))
            if list_c!=[2*n-2 for n in strips]: raise ValueError()
            if (len(arrays[3]),len(arrays[5])) not in [(0,0),(edges*4,edges)]: raise ValueError()
            positions=list(struct.iter_unpack('<3f',arrays[1]))
            if not all(math.isfinite(v) and abs(v)<10 for p in positions for v in p): raise ValueError()
        except (ValueError,struct.error): at=begin+1;continue
        yield strips,positions,arrays[2]
        at=cursor


def part_mesh(parts):
    positions=[];normals=bytearray();indices=[];tables=0;complete_normals=True
    for strips,points,normal_bytes in mesh_tables(parts.get('Contents/DisplayLists',b'')):
        tables+=1;base=len(positions);positions.extend(points);normals.extend(normal_bytes)
        complete_normals &= bool(normal_bytes)
        cursor=base
        for count in strips:
            for k in range(2,count):
                a,b,c=(cursor+k-2,cursor+k-1,cursor+k)
                if k%2: a,b=b,a
                if positions[a]==positions[b] or positions[b]==positions[c] or positions[a]==positions[c]: continue
                indices.extend((a,b,c))
            cursor+=count
    if not positions or not indices: raise ValueError('No complete saved display tables')
    bounds=[[min(p[i] for p in positions) for i in range(3)],[max(p[i] for p in positions) for i in range(3)]]
    return positions,bytes(normals) if complete_normals else b'',indices,bounds,tables


def export(source,destination):
    destination.mkdir(parents=True,exist_ok=True)
    assembly=source/'小车.SLDASM';assembly_streams=streams(assembly)
    tree=ET.fromstring(assembly_streams['swXmlContents/COMPINSTANCETREE'])
    models={e.attrib['id']:e for e in tree.iter() if e.tag.split('}')[-1]=='swModel'}
    references=[e for e in tree.iter() if e.tag.split('}')[-1]=='swReference']
    blob=bytearray();views=[];accessors=[];meshes=[];nodes=[];materials=[];mesh_ids={};manifest=[]
    def accessor(raw,count,kind,component,lo=None,hi=None):
        while len(blob)%4:blob.append(0)
        view=len(views);views.append({'buffer':0,'byteOffset':len(blob),'byteLength':len(raw),'target':34963 if kind=='SCALAR' else 34962})
        blob.extend(raw)
        a={'bufferView':view,'componentType':component,'count':count,'type':kind}
        if lo is not None:a.update(min=lo,max=hi)
        accessors.append(a);return len(accessors)-1
    for name,identifier in IDS.items():
        file=source/(name+'.SLDPRT');part=streams(file)
        points,normals,indices,bounds,tables=part_mesh(part)
        pos=accessor(b''.join(struct.pack('<3f',*p) for p in points),len(points),'VEC3',5126,*bounds)
        idx=accessor(struct.pack('<%dI'%len(indices),*indices),len(indices),'SCALAR',5125)
        attrs={'POSITION':pos}
        if normals:attrs['NORMAL']=accessor(normals,len(points),'VEC3',5126)
        # Neutral presentation materials; geometry remains the saved CAD mesh.
        color=[.24,.32,.30,1] if identifier in ['controller','camera','imu','health','ultrasonic'] else [.22,.24,.25,1] if identifier in ['wheel','servo','battery'] else [.73,.76,.74,1]
        materials.append({'name':identifier,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':.12,'roughnessFactor':.5},'doubleSided':True})
        mesh_ids[name]=len(meshes)
        meshes.append({'name':identifier,'primitives':[{'attributes':attrs,'indices':idx,'material':len(materials)-1}]})
        if 'PreviewPNG' in part:(destination/(identifier+'.png')).write_bytes(part['PreviewPNG'])
        manifest.append({'id':identifier,'name':name,'source':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'vertices':len(points),'triangles':len(indices)//3,'tables':tables,'bounds_m':bounds})
    instance_manifest=[]; skipped=[]
    for ref in references:
        a=ref.attrib
        if a.get('swSuppressed')=='YES' or a.get('swHidden')=='YES':
            skipped.append({k:a.get(k) for k in ['swName','swReferenceNumber','swSuppressed','swHidden']});continue
        model=models[a['swModelRef']];name=model.attrib['swName']
        if name not in mesh_ids:raise ValueError(f'Unresolved assembly model {name}')
        matrix=list(map(float,a['swTransform'].split()))
        if len(matrix)!=16 or not all(math.isfinite(x) for x in matrix):raise ValueError('Invalid placement')
        identifier=IDS[name]+'-'+a['swReferenceNumber']
        nodes.append({'name':identifier,'mesh':mesh_ids[name],'matrix':matrix,'extras':{'partId':IDS[name],'label':name,'instanceId':a['swID']}})
        instance_manifest.append({'id':identifier,'part':IDS[name],'matrix':matrix})
    while len(blob)%4:blob.append(0)
    gltf={'asset':{'version':'2.0','generator':'CareRover saved-CAD display exporter'},'scene':0,
          'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,'materials':materials,
          'buffers':[{'byteLength':len(blob)}],'bufferViews':views,'accessors':accessors}
    header=json.dumps(gltf,ensure_ascii=False,separators=(',',':')).encode()
    header+=b' '*((-len(header))%4)
    glb=struct.pack('<3I',0x46546c67,2,12+8+len(header)+8+len(blob))+struct.pack('<2I',len(header),0x4e4f534a)+header+struct.pack('<2I',len(blob),0x004e4942)+blob
    (destination/'carerover.glb').write_bytes(glb)
    (destination/'assembly.png').write_bytes(assembly_streams['PreviewPNG'])
    report={'sourceAssembly':assembly.name,'sourceSha256':hashlib.sha256(assembly.read_bytes()).hexdigest(),
            'geometry':'saved display tessellation; not regenerated B-rep','units':'metres',
            'materials':'neutral presentation palette, not source appearance','parts':manifest,'instances':instance_manifest,
            'glbBytes':len(glb),'glbSha256':hashlib.sha256(glb).hexdigest(),
            'skippedInstances':skipped,'nativeCadValidation':'NOT RUN','formatReference':'https://github.com/cadmpeg/cadmpeg/blob/main/docs/formats/sldprt.md'}
    (destination/'cad-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'parts':len(meshes),'instances':len(nodes),'triangles':sum(x['triangles'] for x in manifest),'glbBytes':len(glb)},ensure_ascii=False))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path);parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();export(args.source,args.output)
