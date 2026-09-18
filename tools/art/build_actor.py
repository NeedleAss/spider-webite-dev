"""Build a dressed, rigged CC0 adult and detailed hands from MakeHuman core assets.
Run with Blender 4.5 LTS -b --python tools/art/build_actor.py.
Inputs are pinned by build/art-source/makehuman/SOURCE.json. No online requests.
"""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parents[2];SRC=ROOT/'build/art-source/makehuman';OUT=ROOT/'presentation/assets/actors';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
verts=[];faces=[];groups=[];uvs=[];faceuv={};group=''
for line in (SRC/'base.obj').read_text().splitlines():
    if line.startswith('v '):verts.append(Vector(tuple(map(float,line.split()[1:]))))
    elif line.startswith('vt '):uvs.append(tuple(map(float,line.split()[1:3])))
    elif line.startswith('g '):group=line[2:]
    elif line.startswith('f '):
        f=tuple(int(x.split('/')[0])-1 for x in line.split()[1:]);faces.append(f);groups.append(group);faceuv[f]=[int(x.split('/')[1])-1 for x in line.split()[1:]]
rig=json.loads((SRC/'default.mhskel').read_text());weights=json.loads((SRC/'default_weights.mhw').read_text())['weights']
bodyids={v for f,g in zip(faces,groups) if g=='body' for v in f};floor=min(verts[v].y for v in bodyids);height=max(verts[v].y for v in bodyids)-floor
scale=1.70/height
# MakeHuman Y-up decimetres -> Blender Z-up metres. Front is Blender -Y.
def point(v):return Vector((v.x*scale,-v.z*scale,(v.y-floor)*scale))
coords=[point(v) for v in verts]
joints={n:sum((coords[i] for i in ids),Vector())/len(ids) for n,ids in rig['joints'].items()}
armdata=bpy.data.armatures.new('adult-skeleton');arm=bpy.data.objects.new('Adult',armdata);bpy.context.collection.objects.link(arm);bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,spec in rig['bones'].items():
    b=armdata.edit_bones.new(name);b.head=joints[spec['head']];b.tail=joints[spec['tail']]
    plane=rig['planes'].get(spec.get('rotation_plane'))
    if plane:
        a,c,d=(joints[x] for x in plane);normal=(c-a).cross(d-a)
        if normal.length>1e-8:b.align_roll(normal.normalized())
for name,spec in rig['bones'].items():
    if spec.get('parent'):armdata.edit_bones[name].parent=armdata.edit_bones[spec['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
weightmap={i:[] for i in range(len(verts))}
for name,pairs in weights.items():
    for i,w in pairs:weightmap[i].append((name,w))
kd=KDTree(len(bodyids))
for i in bodyids:kd.insert(coords[i],i)
kd.balance()
def material(name,color,roughness=.5,subsurface=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=roughness;p.inputs['Subsurface Weight'].default_value=subsurface
    return m
skin=material('Skin · warm neutral',(.43,.26,.175),.48,.12)
knit=material('Sweater · warm chalk',(.53,.51,.46),.93)
pants=material('Trousers · charcoal',(.055,.068,.081),.84)
hair=material('Hair · dark brown',(.023,.017,.014),.75)
shoes=material('Shoes · slate suede',(.034,.040,.046),.85)
def make(name,selected,mat,expand=0):
    ids=sorted({i for f in selected for i in f});index={i:j for j,i in enumerate(ids)}
    mesh=bpy.data.meshes.new(name);mesh.from_pydata([coords[i] for i in ids],[],[[index[i] for i in f] for f in selected]);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap')
    for poly,f in zip(mesh.polygons,selected):
        for loop,tex in zip(poly.loop_indices,faceuv[f]):uv.data[loop].uv=uvs[tex]
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat)
    if expand:
        # Expand along local smooth normals before pose; clothing never scales the person.
        for v in mesh.vertices:v.co+=v.normal*expand
        mesh.update()
    for poly in mesh.polygons:poly.use_smooth=True
    for bone in weights:obj.vertex_groups.new(name=bone)
    for local,original in enumerate(ids):
        pairs=weightmap[original] or weightmap[kd.find(coords[original])[1]]
        total=sum(w for _,w in pairs)
        if total:
            for bone,w in pairs:obj.vertex_groups[bone].add([local],w/total,'REPLACE')
    obj.parent=arm;mod=obj.modifiers.new('Pose','ARMATURE');mod.object=arm
    sub=obj.modifiers.new('Surface refinement','SUBSURF');sub.levels=1;sub.render_levels=1
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=sub.name)
    obj['source']='MakeHuman core mesh; CC0';return obj
SYSTEM=ROOT/'build/art-source/system'
used_assets=[];deleted=set()
def load_material(folder,name,rough=.65):
    m=material(name,(.8,.8,.8),rough);nodes=m.node_tree.nodes;links=m.node_tree.links;bsdf=nodes.get('Principled BSDF')
    params={}
    for line in (folder/(name+'.mhmat')).read_text().splitlines():
        parts=line.split(maxsplit=1)
        if len(parts)==2 and not line.startswith('#'):params[parts[0]]=parts[1]
    for key,socket in [('diffuseTexture','Base Color'),('normalmapTexture','Normal')]:
        path=folder/params.get(key,'missing')
        if not path.is_file():continue
        img=bpy.data.images.load(str(path));
        limit=2048 if name=='young_asian_male' else 1024
        if max(img.size)>limit:img.scale(int(img.size[0]*limit/max(img.size)),int(img.size[1]*limit/max(img.size)))
        tex=nodes.new('ShaderNodeTexImage');tex.image=img
        if key=='normalmapTexture':
            img.colorspace_settings.name='Non-Color';normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.35;links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bsdf.inputs[socket])
        else:
            links.new(tex.outputs['Color'],bsdf.inputs[socket])
            if params.get('transparent')=='True':links.new(tex.outputs['Alpha'],bsdf.inputs['Alpha']);m.surface_render_method='DITHERED';m.use_backface_culling=False
    return m

def accessory(kind,name):
    folder=SYSTEM/kind/name;config=folder/(name+'.mhclo');rows=[];mode='';ratios=[1.,1.,1.]
    for line in config.read_text().splitlines():
        a=line.split()
        if not a or a[0].startswith('#'):continue
        if a[0] in ['x_scale','y_scale','z_scale']:
            axis='xyz'.index(a[0][0]);ratios[axis]=abs(verts[int(a[1])][axis]-verts[int(a[2])][axis])/float(a[3]);continue
        if a[0]=='verts':mode='verts';continue
        if a[0]=='delete_verts':mode='delete';continue
        if not a[0].lstrip('-').isdigit():mode='';continue
        if mode=='verts':rows.append(a)
        elif mode=='delete':
            j=0
            while j<len(a):
                if j+2<len(a) and a[j+1]=='-':deleted.update(range(int(a[j]),int(a[j+2])+1));j+=3
                else:deleted.add(int(a[j]));j+=1
    av=[];af=[];at=[];auv=[]
    for line in (folder/(name+'.obj')).read_text().splitlines():
        a=line.split()
        if not a:continue
        if a[0]=='v':av.append(Vector(tuple(map(float,a[1:4]))))
        elif a[0]=='vt':at.append(tuple(map(float,a[1:3])))
        elif a[0]=='f':af.append([int(x.split('/')[0])-1 for x in a[1:]]);auv.append([int(x.split('/')[1])-1 for x in a[1:]])
    assert len(av)==len(rows),(name,len(av),len(rows))
    positions=[];vertexweights=[]
    for a in rows:
        if len(a)==1:refs=[int(a[0])];factors=[1.];v=verts[refs[0]].copy()
        else:
            refs=list(map(int,a[:3]));factors=list(map(float,a[3:6]));v=sum((verts[i]*w for i,w in zip(refs,factors)),Vector())+Vector(tuple(float(x)*r for x,r in zip(a[6:9],ratios)))
        positions.append(point(v));combined={}
        for i,factor in zip(refs,factors):
            for bone,w in weightmap[i] or weightmap[kd.find(coords[i])[1]]:combined[bone]=combined.get(bone,0)+max(0,factor)*w
        vertexweights.append(combined)
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(positions,[],af);mesh.update();uv=mesh.uv_layers.new(name='UVMap')
    for poly,indices in zip(mesh.polygons,auv):
        poly.use_smooth=True
        for loop,tex in zip(poly.loop_indices,indices):uv.data[loop].uv=at[tex]
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(load_material(folder,name,.8 if kind=='clothes' else .55))
    for bone in weights:obj.vertex_groups.new(name=bone)
    for i,combined in enumerate(vertexweights):
        total=sum(combined.values())
        if total:
            for bone,w in combined.items():obj.vertex_groups[bone].add([i],w/total,'REPLACE')
    obj.parent=arm;mod=obj.modifiers.new('Pose','ARMATURE');mod.object=arm
    obj['source']='MakeHuman system assets, CC0';used_assets.append(str(config.relative_to(SYSTEM)))
    return obj
accessory('clothes','male_casualsuit01');accessory('clothes','shoes04');accessory('hair','short02')
skin=load_material(SYSTEM/'skins/young_asian_male','young_asian_male',.5);skin.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.12
bodyfaces=[f for f,g in zip(faces,groups) if g=='body' and not all(i in deleted for i in f)]
body=make('Face neck and hands',bodyfaces,skin)
# Real eye openings from the authored face mesh, inset sclera and iris geometry.
white=material('Sclera',(.52,.49,.43),.3);iris=material('Iris',(.05,.031,.02),.3);pupil=material('Pupil',(.003,.004,.006),.17)
for side in ['L','R']:
    b=rig['bones']['eye.'+side];center_eye=joints[b['head']]
    for name,offset,radius,mat in [('Eye',0,.011,white),('Iris',.0093,.0053,iris),('Pupil',.0108,.0026,pupil)]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=radius,location=center_eye+Vector((0,-offset,0)))
        o=bpy.context.object;o.name=name+'.'+side;o.data.materials.append(mat)
        if name!='Eye':o.scale.y=.20
        for f in o.data.polygons:f.use_smooth=True
        # Fixed rest transform, all vertices move with the head bone through armature.
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        vg=o.vertex_groups.new(name='head');vg.add(list(range(len(o.data.vertices))),1,'REPLACE');o.parent=arm;mod=o.modifiers.new('Pose','ARMATURE');mod.object=arm
# Keep a rest rig. Runtime poses share the exact film evaluator and are reversible.
arm['heightMetres']=1.70;arm['front']='+Z after glTF export';arm['license']='CC0';arm['sourceCommit']=json.loads((SRC/'SOURCE.json').read_text())['commit']
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'build/art-source/adult-authoring.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'adult.glb'),export_format='GLB',export_apply=False,export_animations=False,export_extras=True,export_yup=True,export_image_format='JPEG',export_jpeg_quality=88)
metadata={'heightMetres':1.70,'source':json.loads((SRC/'SOURCE.json').read_text()),'license':'CC0','geometry':'MakeHuman core body, rig, skin weights, system casual suit, shoes04, short02 and young_asian_male skin; authored eyes. Not a scanned team member.','accessories':used_assets,'assetPack':'https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip','bones':{n:{'head':list(b.head_local),'tail':list(b.tail_local)} for n,b in armdata.bones.items()},'bytes':(OUT/'adult.glb').stat().st_size}
(OUT/'adult-source.json').write_text(json.dumps(metadata,indent=2)+'\n')
(OUT/'LICENSE-CC0.txt').write_text((SRC/'LICENSE.ASSETS.md').read_text())
print('Actor asset:',OUT/'adult.glb',metadata['bytes'])
