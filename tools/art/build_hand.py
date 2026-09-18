"""CC0 right hand/forearm study. Blender 4.5; baked rigid approach, stable pad contact.
Uses pinned MakeHuman base geometry and original skin weights, no adult runtime.
"""
from pathlib import Path
# Reuse the checked source parser and rig builder, before any adult assets are loaded.
bootstrap=Path(__file__).with_name('build_actor.py').read_text().split('SYSTEM=ROOT/')[0]
exec(compile(bootstrap,str(Path(__file__).with_name('build_actor.py')),'exec'))
from mathutils import Matrix,Quaternion
import hashlib,shutil
OUT=ROOT/'presentation/assets/hand';OUT.mkdir(parents=True,exist_ok=True)
wrist=joints[rig['bones']['wrist.R']['head']]
along=(joints[rig['bones']['finger3-1.R']['head']]-wrist).normalized()
across=(joints[rig['bones']['finger2-1.R']['head']]-joints[rig['bones']['finger5-1.R']['head']]).normalized()
up=along.cross(across).normalized();across=up.cross(along).normalized()
# Proper orthonormal transform, never negative-scale mirroring.
rotation=Matrix((along,across,up));transform=rotation.to_4x4();transform.translation=-(rotation@wrist)
chosen=[f for f,g in zip(faces,groups) if g=='body' and all(coords[i].x<-.30 and (coords[i]-wrist).dot(along)>-.145 for i in f)]
mat=material('Porcelain · neutral hand',(.57,.59,.61),.58,.015)
hand=make('Right hand and forearm',chosen,mat)
# Prune non-hand deformation groups and bones. The proximal forearm is rigid.
keep={n for n in rig['bones'] if n.endswith('.R') and any(n.startswith(x) for x in ['lowerarm02','wrist','finger','metacarpal'])}
for v in hand.data.vertices:
 pairs=[(hand.vertex_groups[g.group].name,g.weight) for g in v.groups];valid=[(n,w) for n,w in pairs if n in keep]
 for n,w in pairs:hand.vertex_groups[n].remove([v.index])
 if not valid:valid=[('lowerarm02.R',1)]
 total=sum(w for _,w in valid)
 for n,w in valid:hand.vertex_groups[n].add([v.index],w/total,'REPLACE')
for g in list(hand.vertex_groups):
 if g.name not in keep:hand.vertex_groups.remove(g)
bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
for b in list(armdata.edit_bones):
 if b.name not in keep:armdata.edit_bones.remove(b)
armdata.transform(transform);bpy.ops.object.mode_set(mode='OBJECT');hand.data.transform(transform);hand.data.update()
# Offline anatomical pose: each digit has its own direction and flexion plane.
# Index is the contact finger, other fingertips remain above it.
def aim(name,direction):
 b=arm.pose.bones[name];current=(b.tail-b.head).normalized();q=current.rotation_difference(Vector(direction).normalized());b.matrix=Matrix.Translation(b.head)@q.to_matrix().to_4x4()@Matrix.Translation(-b.head)@b.matrix;bpy.context.view_layer.update()
for f in range(2,6):
 for j in range(1,4):
  side={2:.07,3:-.04,4:-.20,5:-.38}[f];rise={2:0,3:.14,4:.24,5:.32}[f]
  aim(f'finger{f}-{j}.R',(1,side,rise))
# Bake the offline pose into the rest mesh/rig. No browser bone angle synthesis.
bpy.context.view_layer.objects.active=hand
bpy.ops.object.modifier_apply(modifier='Pose')
bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='POSE');bpy.ops.pose.armature_apply(selected=False);bpy.ops.object.mode_set(mode='OBJECT')
mod=hand.modifiers.new('Baked skin','ARMATURE');mod.object=arm
# Identify distal index pad directly on the evaluated mesh.
bone=arm.data.bones['finger2-3.R'];tip=bone.tail_local;axis=(bone.tail_local-bone.head_local).normalized()
candidates=[v.co.copy() for v in hand.data.vertices if (v.co-tip).length<.018 and (v.co-bone.head_local).dot(axis)>.012]
pad=min(candidates,key=lambda v:v.z).copy()
marker=bpy.data.objects.new('IndexPad',None);bpy.context.collection.objects.link(marker);marker.location=pad;marker.parent=arm
# Forearm cuff hides the open crop perimeter, maintaining a natural sleeve end.
# Tailored sleeve follows the forearm centreline and covers the open crop edge.
sleeve_verts=[];sleeve_faces=[]
for j in range(10):
 x=-.23+j*.014
 probe=max(-.125,min(-.105,x));near=[v.co for v in hand.data.vertices if abs(v.co.x-probe)<.008]
 cy=sum(v.y for v in near)/len(near);cz=sum(v.z for v in near)/len(near)
 ry=(max(v.y for v in near)-min(v.y for v in near))/2+.003
 rz=(max(v.z for v in near)-min(v.z for v in near))/2+.003
 for i in range(48):
  a=2*math.pi*i/48;sleeve_verts.append((x,cy+ry*math.cos(a),cz+rz*math.sin(a)))
for j in range(9):
 for i in range(48):sleeve_faces.append((j*48+i,j*48+(i+1)%48,(j+1)*48+(i+1)%48,(j+1)*48+i))
mesh=bpy.data.meshes.new('Sleeve mesh');mesh.from_pydata(sleeve_verts,[],sleeve_faces);mesh.update();cuff=bpy.data.objects.new('Sleeve cuff',mesh);bpy.context.collection.objects.link(cuff);cuff.data.materials.append(material('Cuff · graphite',(.043,.054,.070),.9));cuff.parent=arm
for p in cuff.data.polygons:p.use_smooth=True
# Per-frame baked translation, with an exactly stationary hold. Rest pad is contact origin.
arm.name='HandRig';arm.animation_data_create();action=bpy.data.actions.new('Contact');arm.animation_data.action=action
for frame in range(151):
 t=frame/30
 def smooth(x):x=max(0,min(1,x));return x*x*x*(x*(x*6-15)+10)
 lift=1-smooth(t/1.25) if t<1.25 else smooth((t-3.75)/1.25) if t>3.75 else 0
 arm.location=Vector((-.025*lift,0,.05*lift))-pad
 arm.keyframe_insert(data_path='location',frame=frame)
 for b in arm.pose.bones:
  b.rotation_mode='QUATERNION';b.keyframe_insert(data_path='rotation_quaternion',frame=frame);b.keyframe_insert(data_path='location',frame=frame)
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=0;scene.frame_end=150;scene.frame_set(60)
bpy.ops.object.select_all(action='DESELECT')
for o in [arm,hand,cuff,marker]:o.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'hand_source.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'hand_demo.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_yup=True,export_skins=True)
# Reimport the exported file for the neutral views and GLB round-trip validation.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(OUT/'hand_demo.glb'));scene.frame_set(60)
world=bpy.data.worlds.new('Neutral studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.18,.21,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6;scene.world=world
for pos,power,size in [((.1,-.3,.5),22,.35),((-.2,.2,.25),12,.25),((-.1,0,-.4),18,.4)]:
 bpy.ops.object.light_add(type='AREA',location=pos);lamp=bpy.context.object;lamp.data.energy=power;lamp.data.shape='DISK';lamp.data.size=size;lamp.rotation_euler=(Vector((-.08,0,0))-lamp.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.resolution_x=1200;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=.53
for name,pos in [('back',(-.06,-.12,.46)),('palm',(-.06,.12,-.46)),('side',(-.06,-.46,.04))]:
 camera.location=pos;camera.rotation_euler=(Vector((-.16,0,0))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/f'{name}.png');bpy.ops.render.render(write_still=True)
license=(SRC/'LICENSE.ASSETS.md').read_text();(OUT/'LICENSE.txt').write_text(license)
meta={'status':'INDEPENDENT VISUAL STUDY','source':json.loads((SRC/'SOURCE.json').read_text()),'license':'CC0','tool':bpy.app.version_string,'units':'metres','hand':'right','clip':'Contact','seconds':5,'fps':30,'contactHold':[1.25,3.75],'padRestBlender':list(pad),'rigBones':len(keep),'notes':'Cropped original CC0 topology and weights; offline digit-specific pose; baked approach/hold/retract; no adult or runtime IK. User hand approval pending.'}
(OUT/'SOURCE.json').write_text(json.dumps(meta,indent=2)+'\n')
print('HAND COMPLETE',meta)
