"""Offline CC0 porcelain head and gesture hands from the same pinned hand topology."""
from pathlib import Path
import sys
kind=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'head'
if kind=='head':
 exec(compile(Path(__file__).with_name('build_actor.py').read_text().split('SYSTEM=ROOT/')[0],str(Path(__file__).with_name('build_actor.py')),'exec'))
 OUT=ROOT/'presentation/assets/interaction';OUT.mkdir(exist_ok=True)
 mat=material('Porcelain',(.58,.62,.65),.58)
 head=make('Mannequin head', [f for f,g in zip(faces,groups) if g=='body' and all(coords[i].z>1.405 for i in f)],mat)
 bpy.context.view_layer.objects.active=head;bpy.ops.object.modifier_apply(modifier='Pose');head.parent=None
 import bmesh
 bm=bmesh.new();bm.from_mesh(head.data)
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,1.455),plane_no=(0,0,1),clear_inner=True,dist=.00001)
 boundary=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z-1.455)<.0001 for v in e.verts)]
 bmesh.ops.holes_fill(bm,edges=boundary,sides=0);bm.to_mesh(head.data);bm.free()
 # Blank inset eyes, no iris or skin textures.
 for side in ['L','R']:
  loc=joints[rig['bones']['eye.'+side]['head']]
  bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=.0115,location=loc);eye=bpy.context.object;eye.name='Porcelain eye '+side;eye.data.materials.append(mat)
  for p in eye.data.polygons:p.use_smooth=True
 bpy.data.objects.remove(arm,do_unlink=True)
 # Set neck base to origin. The runtime fits the authored bust as one object.
 for o in list(bpy.context.scene.objects):
  if o.type=='MESH':o.location.z-=1.405
else:
 source=Path(__file__).with_name('build_hand.py').read_text().split('# Bake the offline pose')[0]
 exec(compile(source,str(Path(__file__).with_name('build_hand.py')),'exec'))
 OUT=ROOT/'presentation/assets/interaction';OUT.mkdir(exist_ok=True)
 # Pose flexion in anatomical finger planes offline, then export baked geometry.
 for f in range(2,6):
  extended=kind=='two' and f in [2,3]
  for j in range(1,4):
   if extended:direction=(1,.13 if f==2 else -.13,0)
   else:direction=[(.40,0,-.92),(-.72,0,-.69),(-.98,0,.15)][j-1]
   aim(f'finger{f}-{j}.R',direction)
 for j in range(1,4):aim(f'finger1-{j}.R',(.40,.90,.08) if kind!='two' else [(.25,.30,-.92),(-.45,-.5,-.74),(-.7,-.6,-.35)][j-1])
 bpy.context.view_layer.objects.active=hand;bpy.ops.object.modifier_apply(modifier='Pose');hand.parent=None;bpy.data.objects.remove(arm,do_unlink=True)
 # Forearm remains part of the source; a dark cuff closes its cropped boundary.
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=(-.135,0,0));cuff=bpy.context.object;cuff.name='Graphite cuff';cuff.scale=(.022,.036,.027);cuff.data.materials.append(material('Graphite',(.035,.045,.06),.85))
 for p in cuff.data.polygons:p.use_smooth=True
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/(kind+'.glb')),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
(OUT/'LICENSE.txt').write_text((SRC/'LICENSE.ASSETS.md').read_text())
(OUT/'SOURCE.json').write_text(json.dumps({'source':json.loads((SRC/'SOURCE.json').read_text()),'license':'CC0','tool':bpy.app.version_string,'assets':['head.glb','two.glb','like.glb'],'note':'Offline cropped neutral head; gesture meshes baked from the same anatomical right hand as contact study. DISLIKE rotates the thumbs-up pose. No skin textures.'},indent=2))
