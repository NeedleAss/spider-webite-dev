import * as T from 'three';
import {mergeGeometries} from '../vendor/three/examples/jsm/utils/BufferGeometryUtils.js';

// Authored geometry and textures. Reference photos guide silhouettes; no listing imagery is used as texture.
const canvasTexture=(w,h,paint)=>{const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;};
export function makeMaterials() {
  const grain=canvasTexture(128,128,(c,w,h)=>{const im=c.createImageData(w,h);let s=923;for(let i=0;i<im.data.length;i+=4){s=(1664525*s+1013904223)>>>0;const n=121+(s%14);im.data.set([n,n,n,255],i);}c.putImageData(im,0,0);});
  grain.colorSpace=T.NoColorSpace;grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(8,8);
  const m=(color,roughness=.5,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
  const white=m('#d5d7d6',.74);white.bumpMap=grain;white.bumpScale=.000025;
  white.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vPrintPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPrintPosition = position;');
    shader.fragmentShader='varying vec3 vPrintPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat layer = sin(vPrintPosition.y * 41887.9);\ndiffuseColor.rgb *= 0.994 + 0.006 * layer;');
  };
  white.customProgramCacheKey=()=> 'carerover-print-layer-v1';
  return {white, rubber:m('#171b20',.79),frame:m('#242b33',.42),servo:m('#26282e',.38),
    blue:m('#174678',.48),black:m('#11191d',.49),cream:m('#e0e2d9',.64),
    silver:m('#b7c2ca',.29,1),darkMetal:m('#53606a',.37,.85),gold:m('#b19855',.32,.8),
    chip:m('#17191d',.59),glass:new T.MeshPhysicalMaterial({color:'#111820',roughness:.10,metalness:.25,clearcoat:1,clearcoatRoughness:.1}),
    lens:new T.MeshPhysicalMaterial({color:'#113746',roughness:.09,metalness:.4,clearcoat:1}),
    orange:m('#ae642c',.52),red:m('#b33133',.52),yellow:m('#b7a255',.55),green:m('#467e68',.57),
    pink:m('#963e78',.54),oled:new T.MeshBasicMaterial({color:'#a7efff',toneMapped:false})};
}

function add(group,geometry,material,position=[0,0,0],rotation=[0,0,0]) {
  const mesh=new T.Mesh(geometry,material);mesh.position.fromArray(position);mesh.rotation.set(...rotation);
  mesh.castShadow=true;mesh.receiveShadow=false;group.add(mesh);return mesh;
}
const box=(g,m,size,p,r)=>add(g,new T.BoxGeometry(...size),m,p,r);
const cylinder=(g,m,r,h,p,axis='z',segments=24)=>add(g,new T.CylinderGeometry(r,r,h,segments),m,p,axis==='z'?[Math.PI/2,0,0]:axis==='x'?[0,0,Math.PI/2]:[0,0,0]);
const ring=(g,m,r,t,p,axis='z')=>add(g,new T.TorusGeometry(r,t,6,32),m,p,axis==='y'?[Math.PI/2,0,0]:[0,0,0]);
function screw(g,m,x,y,z,axis='z',r=.0012) {
  cylinder(g,m.silver,r,.0006,[x,y,z],axis,12);
  if(axis==='z')box(g,m.darkMetal,[r*1.4,.00023,.00008],[x,y,z+.00032]);
  else box(g,m.darkMetal,[r*1.4,.00008,.00023],[x,y+.00032,z]);
}
function label(g,text,w,h,p,axis='z',bg='#11191d',fg='#c4c9c9',font=20) {
  const tex=canvasTexture(512,256,(c,W,H)=>{c.fillStyle=bg;c.fillRect(0,0,W,H);c.fillStyle=fg;c.font=`500 ${font}px monospace`;c.textAlign='center';c.textBaseline='middle';text.split('\n').forEach((s,i,a)=>c.fillText(s,W/2,H/2+(i-(a.length-1)/2)*font*1.5));});
  const mat=new T.MeshStandardMaterial({map:tex,roughness:.66});
  return add(g,new T.PlaneGeometry(w,h),mat,p,axis==='y'?[-Math.PI/2,0,0]:[0,0,0]);
}
function boardDetails(g,m,orientation='z') {
  // Small components share geometry/material batches; positions describe appearance, not a schematic.
  for(let i=0;i<10;i++) {
    const x=-.011+(i%5)*.005, y=-.007+Math.floor(i/5)*.014;
    if(orientation==='z') {box(g,m.chip,[.0022,.0011,.0007],[x,y,.0012]);box(g,m.silver,[.00045,.0011,.00075],[x+.0011,y,.00125]);}
  }
}

function wheel(g,m) {
  const rotor=new T.Group();rotor.name='wheel-rotor';g.add(rotor);
  cylinder(rotor,m.frame,.0081,.011,[0,0,.0048]);
  ring(rotor,m.darkMetal,.0073,.0007,[0,0,-.0006]);ring(rotor,m.darkMetal,.0073,.0007,[0,0,.0102]);
  const profile=[];for(let i=0;i<=8;i++){const y=(i/8-.5)*.0076;const radius=.00125+.00155*Math.sin(Math.PI*i/8);profile.push(new T.Vector2(radius,y));}
  const rollerGeo=new T.LatheGeometry(profile,12);const rollers=[];
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4, p=[Math.cos(a)*.0092,Math.sin(a)*.0092,.0048];
    const roller=add(rotor,rollerGeo,m.rubber,p,[0,0,a]);
    // Lathe's local Y is tangent to the main wheel, allowing transverse passive rolling.
    roller.rotation.z=a;rollers.push(roller);
    cylinder(rotor,m.silver,.00055,.0084,p,'y',8).rotation.z=a;
    const arm=box(rotor,m.frame,[.005,.0011,.010],[Math.cos(a)*.0057,Math.sin(a)*.0057,.0048],[0,0,a]);
    arm.name='roller-carrier';
  }
  cylinder(rotor,m.cream,.00415,.0043,[0,0,.0123]);
  cylinder(rotor,m.darkMetal,.0018,.0044,[0,0,.0124]);
  for(let i=0;i<20;i++){const a=i*Math.PI/10;box(rotor,m.cream,[.00035,.00055,.002],[Math.cos(a)*.0019,Math.sin(a)*.0019,.014], [0,0,a]);}
  screw(rotor,m,0,0,.0147,'z',.0011);
  // Axisymmetric rollers retain their tangent axes; merge their static surface geometry.
  batch(rotor);g.userData.rotor=rotor;g.userData.rollers=[];
}
function servo(g,m) {
  box(g,m.servo,[.0228,.024,.0118],[.0113,.012,-.0059]);
  box(g,m.frame,[.0232,.0038,.012],[.0113,.025,-.0059]);
  for(const x of [-.0028,.0254]){box(g,m.servo,[.004,.003,.0118],[x,.006,-.0059]);cylinder(g,m.darkMetal,.0008,.0031,[x,.006,-.0059],'y',10);}
  cylinder(g,m.frame,.0057,.003,[.0167,.028,-.0059],'y');
  cylinder(g,m.gold,.0024,.004,[.0167,.0305,-.0059],'y');
  box(g,m.pink,[.013,.011,.00012],[.012,.013,.0001]);
  label(g,'MG90S\n360°',.012,.010,[.012,.013,.0002],'z','#84386a','#eee3ed',34);
  for(const x of [.002,.021])screw(g,m,x,.022,.0002,'z',.00075);
  box(g,m.black,[.005,.003,.002],[-.001,.002,-.006]);
  for(let i=0;i<3;i++)box(g,[m.orange,m.red,m.rubber][i],[.007,.0007,.0007],[-.005,.001,-.0048-i*.001]);
}
function controller(g,m) {
  // Replace the entire semantic controller appearance: original mesh contains the two user-confirmed wire proxies.
  // Original GLB remains immutable; no positional triangle deletion is used.
  box(g,m.black,[.056,.0016,.02794],[.031,.0008,-.01397]);
  box(g,m.silver,[.018,.0027,.017],[.043,.003,-.014]);
  label(g,'ESP32-S3\nN16R8',.015,.013,[.043,.0044,-.014],'y','#9ca7ad','#353b3e',38);
  box(g,m.black,[.011,.001,.017],[.056,.0022,-.014]);
  for(let i=0;i<6;i++)box(g,m.gold,[.0004,.0001,.011],[.0515+i*.0012,.0028,-.014]);
  for(const z of [-.0256,-.0023])for(let i=0;i<18;i++){
    const x=.007+i*.0025;box(g,m.black,[.0022,.0021,.0022],[x,-.0014,z]);
    cylinder(g,m.gold,.00028,.006,[x,-.002,z],'y',6);
  }
  for(const z of [-.0075,-.0205]){
    box(g,m.silver,[.0068,.0032,.008],[.0035,.0032,z]);
    box(g,m.chip,[.0001,.0018,.0056],[.00004,.0032,z]);
  }
  for(let i=0;i<9;i++){const x=.013+(i%3)*.006,z=-.006-Math.floor(i/3)*.007;box(g,m.chip,[.0035,.0012,.0035],[x,.0026,z]);}
  for(const z of [-.006,-.022])box(g,m.silver,[.0025,.001,.0025],[.011,.0024,z]);
}
function camera(g,m) {
  box(g,m.black,[.063,.0286,.0013],[.0115,0,-.00065]);
  box(g,m.silver,[.017,.016,.0018],[.027,0,.001]);
  label(g,'ESP32\nVISION',.014,.012,[.027,0,.002],'z','#a4afb4','#30383c',38).rotation.z=Math.PI/2;
  box(g,m.black,[.018,.018,.002],[-.011,0,.003]);
  box(g,m.orange,[.004,.010,.0003],[-.011,-.010,.004]);
  cylinder(g,m.frame,.007,.009,[-.011,0,.008]);
  cylinder(g,m.chip,.0057,.009,[-.011,0,.0155]);
  for(let i=0;i<4;i++)ring(g,m.darkMetal,.00572,.00017,[-.011,0,.013+i*.0017]);
  cylinder(g,m.lens,.0042,.0006,[-.011,0,.0204]);
  ring(g,m.silver,.00435,.0002,[-.011,0,.0206]);
  cylinder(g,m.glass,.0021,.0001,[-.011,0,.0208]);
  for(const y of [-.012,.012])for(let i=0;i<12;i++)box(g,m.gold,[.001,.001,.0015],[.003+i*.0028,y,.001]);
  for(const x of [-.017,.040])for(const y of [-.011,.011])screw(g,m,x,y,.001,'z',.0009);
}
function ultrasonic(g,m) {
  box(g,m.blue,[.045,.020,.0016],[0,0,-.0008]);
  for(const x of [-.013,.013]){
    cylinder(g,m.silver,.008,.012,[x,0,.006]);
    cylinder(g,m.darkMetal,.0069,.0004,[x,0,.0122]);
    ring(g,m.silver,.00745,.00055,[x,0,.0125]);
    // Actual fine grid silhouette, not painted opaque disks.
    for(let i=-7;i<=7;i++) {const v=i*.0008,len=2*Math.sqrt(Math.max(0,.0065**2-v*v));
      box(g,m.silver,[len,.00013,.00012],[x,v,.01255]);box(g,m.silver,[.00013,len,.00012],[x+v,0,.0126]);}
  }
  for(let i=0;i<4;i++){box(g,m.black,[.0022,.003,.0022],[-.0038+i*.00254,-.011,-.001]);box(g,m.gold,[.0005,.006,.0005],[-.0038+i*.00254,-.014,-.001]);}
  label(g,'HC-SR04',.015,.0025,[0,-.0085,.0001],'z','#174678','#eee9d4',36);
  for(const x of [-.020,.020])screw(g,m,x,-.007,.0005,'z',.0008);
}
function display(g,m) {
  box(g,m.blue,[.0259,.0013,.0259],[0,0,0]);
  box(g,m.glass,[.023,.0012,.014],[0,.0016,0]);
  const texture=canvasTexture(256,128,(c,w,h)=>{
    c.fillStyle='#03080c';c.fillRect(0,0,w,h);c.fillStyle='#59cfe7';c.font='18px monospace';c.fillText('CARE ROVER',12,26);
    c.fillRect(12,36,232,1);c.font='34px monospace';c.fillText('DEMO',12,77);c.font='13px monospace';c.fillText('READY  /  PROTOTYPE',12,109);
    c.globalCompositeOperation='destination-out';for(let y=0;y<h;y+=3)c.clearRect(0,y,w,1);
  });texture.magFilter=T.NearestFilter;
  g.userData.setOLED=value=>{const key=JSON.stringify(value);if(g.userData.oledKey===key)return;g.userData.oledKey=key;const c=texture.image.getContext('2d');c.clearRect(0,0,256,128);c.globalCompositeOperation='source-over';c.fillStyle='#02080c';c.fillRect(0,0,256,128);c.fillStyle='#59cfe7';c.font='16px monospace';c.fillText(value.line1,10,25);c.fillRect(10,34,236,1);c.font='bold 28px monospace';c.fillText(value.line2,10,76);c.font='14px monospace';c.fillText(value.line3,10,110);texture.needsUpdate=true;};
  add(g,new T.PlaneGeometry(.020,.010),new T.MeshBasicMaterial({map:texture,toneMapped:false}),[0,.00225,0],[-Math.PI/2,0,0]);
  for(const x of [-.0105,.0105])for(const z of [-.0105,.0105])screw(g,m,x,.0018,z,'y',.0011);
}
function health(g,m) {
  box(g,m.cream,[.030,.0016,.032],[0,0,.007]);
  box(g,m.black,[.009,.0018,.011],[0,.0017,0]);
  box(g,m.glass,[.006,.0008,.008],[0,.003,0]);
  box(g,m.red,[.0015,.0002,.0015],[-.0016,.0035,0]);
  box(g,m.lens,[.0016,.0002,.002],[.0014,.0035,0]);
  box(g,m.cream,[.010,.004,.006],[0,.003,.025]);
  for(const x of [-.012,.012])for(const z of [-.006,.020])screw(g,m,x,.0014,z,'y',.0008);
  label(g,'MAX30102',.022,.004,[0,.0011,.015],'y','#e0e2d9','#46545c',38);
}
function imu(g,m) {
  box(g,m.blue,[.0203,.0016,.0156],[0,0,0]);
  box(g,m.chip,[.004,.001,.004],[0,.0015,0]);
  for(let i=0;i<8;i++){box(g,m.black,[.0022,.0022,.0022],[-.0089+i*.00254,-.0018,.005]);cylinder(g,m.gold,.00025,.005,[-.0089+i*.00254,-.003,.005],'y',6);}
  for(const x of [-.0075,.0075])screw(g,m,x,.0012,-.005,'y',.001);
  label(g,'GY-521',.014,.003,[0,.001,-.005],'y','#174678','#d7e4e7',42);
}
function battery(g,m) {
  box(g,m.frame,[.0516,.022,.0468],[.0179,.011,-.0234]);
  box(g,m.black,[.049,.0016,.044],[.0179,.024,-.0234]);
  for(let i=0;i<8;i++){box(g,m.red,[.0043,.005,.0043],[.001+i*.0047,.027,-.007]);cylinder(g,m.gold,.00035,.003,[.001+i*.0047,.031,-.007],'y',6);}
  box(g,m.silver,[.009,.003,.006],[.0179,.027,-.043]);
  box(g,m.chip,[.008,.002,.010],[.01,.026,-.022]);
  for(const x of [-.004,.039])for(const z of [-.043,-.004])screw(g,m,x,.026,z,'y',.0015);
  label(g,'POWER MODULE\n18650',.026,.014,[.025,.025,-.023],'y','#11191d','#c4c9c9',29);
}

function batch(group,keep=new Set()) {
  const buckets=new Map();
  for(const mesh of [...group.children]){
    if(!mesh.isMesh||keep.has(mesh))continue;
    mesh.updateMatrix();const geo=mesh.geometry.clone().applyMatrix4(mesh.matrix);
    // All primitives carry position/normal/UV; merge compatible indexed geometry.
    if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);buckets.get(mesh.material).push(geo);group.remove(mesh);
  }
  for(const [mat,geos] of buckets){const merged=mergeGeometries(geos,false);if(!merged)throw Error('Appearance batching failed');add(group,merged,mat);geos.forEach(g=>g.dispose());}
}
export function createAppearance(id,original,materials) {
  const g=new T.Group();g.name=`${id}-appearance`;
  const builders={wheel,servo,controller,camera,ultrasonic,display,health,imu,battery};
  if(builders[id]){builders[id](g,materials);batch(g);}
  else {
    const mesh=new T.Mesh(original.geometry,materials.white);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
  }
  if(id==='display')g.position.y=.0025;
  // Saved mount and PCB face are coplanar. A 0.5 mm appearance clearance avoids z-fighting; rest matrix is untouched.
  if(id==='camera')g.position.z=.0005;
  g.userData.appearanceVersion='v4.1';return g;
}
