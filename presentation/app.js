import {parts} from './parts.js';
const $=id=>document.getElementById(id), byId=new Map(parts.map(p=>[p.id,p]));
let selected=null, pinned=false, hovering=false, forceClosed=false, ready=false, api=null;
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
$('motion').checked=!reduce.matches;
function expanded(){return !!selected||pinned||(hovering&&!forceClosed);}
function update(){
  const open=expanded();$('explode').setAttribute('aria-pressed',String(open));
  $('viewLabel').textContent=selected?'03 / '+byId.get(selected).name:open?'02 / 拆解结构':'01 / 完整装配';
  if(document.body.dataset.viewer==='fallback'){$('viewLabel').textContent='CAD / 保存的装配预览';$('explode').setAttribute('aria-pressed','false');$('detailHint').textContent='当前为静态预览 · 零件目录与说明仍可使用';}
  document.querySelectorAll('.part').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.part===selected)));
  $('close').hidden=!selected;api?.highlight(selected);
}
function select(id){
 selected=id;forceClosed=false;
 const p=byId.get(id),index=parts.indexOf(p)+1;
 $('partCategory').textContent=p.category;$('partNumber').textContent=String(index).padStart(2,'0')+' / 15';
 $('partTitle').textContent=p.name;$('partDescription').textContent=p.description;
 $('principleTitle').textContent=p.principle;$('principleText').textContent=p.detail;
 $('detailHint').textContent='已固定展开 · 关闭说明或点击「完整装配」收拢';update();
}
function clear(){
 selected=null;pinned=false;forceClosed=true;
 $('partCategory').textContent='THE WHOLE PICTURE';$('partNumber').textContent='01 — 15';
 $('partTitle').textContent='小小机身，协同运作。';$('partDescription').textContent='将鼠标移入模型，展开内部结构。点击一个零件，了解它如何参与感知、控制与行动。';
 $('principleTitle').textContent='真实设计，逐层呈现';$('principleText').textContent='几何与位置来自你们的 SolidWorks 文件。功能动画是原理示意，不代表实时传感器数据。';
 $('detailHint').textContent='也可以从下方的零件目录开始。';update();
}
for(const p of parts){const b=document.createElement('button');b.type='button';b.className='part';b.dataset.part=p.id;b.setAttribute('aria-pressed','false');
 const img=document.createElement('img');img.src=`assets/cad/${p.id}.png`;img.alt='';img.loading='lazy';
 const label=document.createElement('span');label.textContent=p.name;const small=document.createElement('small');small.textContent=p.en;label.append(small);b.append(img,label);b.addEventListener('click',()=>{select(p.id);document.querySelector('.explorer').scrollIntoView({behavior:reduce.matches?'instant':'smooth',block:'start'});});$('parts').append(b);}
$('explode').addEventListener('click',()=>{if(expanded())clear();else{pinned=true;forceClosed=false;update();}});
$('assemble').addEventListener('click',clear);$('close').addEventListener('click',clear);$('reset').addEventListener('click',()=>api?.reset());
$('stage').addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&matchMedia('(hover:hover)').matches){hovering=true;forceClosed=false;update();}});
$('stage').addEventListener('pointerleave',()=>{hovering=false;forceClosed=false;update();});
addEventListener('keydown',e=>{if(e.key==='Escape')clear();});
reduce.addEventListener('change',()=>{$('motion').checked=!reduce.matches;});
function fail(message){ready=false;$('fallback').hidden=false;$('loadStatus').hidden=false;$('loadStatus').textContent=message;document.body.dataset.viewer='fallback';$('explode').disabled=true;$('reset').disabled=true;$('motion').disabled=true;$('motion').checked=false;$('assemble').textContent='返回概览';$('rotateHint').textContent='静态装配预览';$('stage').setAttribute('aria-label','保存的 CAD 装配预览');$('stage').querySelector('canvas')?.setAttribute('hidden','');update();}
async function boot(){
 try {
 const [THREE,{GLTFLoader},{OrbitControls}]=await Promise.all([import('three'),import('./vendor/three/examples/jsm/loaders/GLTFLoader.js'),import('./vendor/three/examples/jsm/controls/OrbitControls.js')]);
 const stage=$('stage'),renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;stage.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,1,2200);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;controls.minDistance=250;controls.maxDistance=1100;controls.maxPolarAngle=Math.PI*.88;
 scene.add(new THREE.HemisphereLight(0xffffff,0x536553,1.8));const key=new THREE.DirectionalLight(0xffffff,2.6);key.position.set(200,300,200);scene.add(key);const rim=new THREE.DirectionalLight(0xe5efff,1.5);rim.position.set(-200,100,-100);scene.add(rim);
 const gltf=await new GLTFLoader().loadAsync('assets/cad/carerover.glb');const model=gltf.scene;model.scale.setScalar(1000);scene.add(model);model.updateMatrixWorld(true);
 const meshes=[],instances=[];
 for(const node of model.children){
  node.matrixAutoUpdate=true;node.matrix.decompose(node.position,node.quaternion,node.scale);
  const id=node.userData.partId,p=byId.get(id);if(!p)throw Error('Unknown part');
  const base=node.position.clone(),offset=new THREE.Vector3(...p.offset).multiplyScalar(.001);
  if(id==='wheel'||id==='servo'){const center=new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3());offset.x=(center.x<0?-1:1)*(id==='wheel'?.065:.038);offset.z=(center.z<0?-1:1)*(id==='wheel'?.065:.038);}
  node.traverse(mesh=>{if(!mesh.isMesh)return;mesh.material=mesh.material.clone();mesh.material.transparent=true;mesh.material.depthWrite=true;mesh.userData.partId=id;mesh.userData.baseColor=mesh.material.color.clone();meshes.push(mesh);});
  instances.push({node,base,offset,id});
 }
 const effects=new THREE.Group();scene.add(effects);
 const color=0x477f65,lineMat=new THREE.LineBasicMaterial({color,transparent:true,opacity:.65});
 const poly=pts=>new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(...p))),lineMat.clone());
 const vision=new THREE.Group(),sonar=new THREE.Group(),flow=new THREE.Group();effects.add(vision,sonar,flow);
 const corners=[[-28,-20,65],[28,-20,65],[28,20,65],[-28,20,65]];
 for(const c of corners)vision.add(poly([[0,0,0],c]));vision.add(poly([...corners,corners[0]]));
 const frame=poly([[-10,-13,66],[10,-13,66],[10,13,66],[-10,13,66],[-10,-13,66]]);vision.add(frame);
 const rings=[];for(let i=0;i<3;i++){const r=new THREE.Mesh(new THREE.RingGeometry(12,12.45,64),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.65,depthWrite:false}));sonar.add(r);rings.push(r);}
 const wall=poly([[-20,-20,75],[20,-20,75],[20,20,75],[-20,20,75],[-20,-20,75]]);sonar.add(wall);
 const flows=[];for(let i=0;i<3;i++){const end=new THREE.Vector3((i-1)*35,45,i===1?40:10);const start=new THREE.Vector3();flow.add(poly([[0,0,0],end.toArray()]));const dot=new THREE.Mesh(new THREE.SphereGeometry(1.7,10,8),new THREE.MeshBasicMaterial({color}));flow.add(dot);flows.push({dot,start,end});}
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null,amount=0,last=0;
 renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
 renderer.domElement.addEventListener('pointercancel',()=>{down=null;});
 renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6){down=null;return;}down=null;const r=stage.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(meshes,false);if(hits[0])select(hits[0].object.userData.partId);});
 function reset(){camera.position.set(290,185,340);controls.target.set(0,44,0);controls.update();}reset();
 api={reset,highlight(id){for(const mesh of meshes){const match=!id||mesh.userData.partId===id;mesh.material.opacity=match?1:.22;mesh.material.depthWrite=match;mesh.material.color.copy(mesh.userData.baseColor);if(id&&match)mesh.material.color.lerp(new THREE.Color(0x78a887),.2);}}};
 const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(17))*Math.max(1,1.6/camera.aspect)));camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(stage);resize();
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('3D 显示已中断 · 保留装配预览和零件说明');});
 renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
 ready=true;document.body.dataset.viewer='ready';$('fallback').hidden=true;$('loadStatus').hidden=true;update();
 function render(ms){requestAnimationFrame(render);if(document.hidden||!ready){last=ms;return;}const dt=Math.min((ms-last)/1000,.1);last=ms;const goal=expanded()?1:0;amount=reduce.matches?goal:amount+(goal-amount)*(1-Math.exp(-dt*6));if(Math.abs(amount-goal)<.0001)amount=goal;
 model.position.y=-22*amount;camera.zoom=1-.16*amount;camera.updateProjectionMatrix();
 for(const {node,base,offset} of instances)node.position.copy(base).addScaledVector(offset,amount);
 const kind=byId.get(selected)?.effect;vision.visible=kind==='vision';sonar.visible=kind==='sonar';flow.visible=kind==='flow';effects.visible=!!kind;
 if(kind){model.updateMatrixWorld(true);const item=instances.find(n=>n.id===selected);effects.position.copy(new THREE.Box3().setFromObject(item.node).getCenter(new THREE.Vector3()));const t=$('motion').checked&&!reduce.matches?ms/1000:1;
 frame.position.x=Math.sin(t*.9)*6;
 for(let i=0;i<rings.length;i++){const phase=(t*.45+i/3)%1;const z=phase<.5?phase*150:(1-phase)*150;rings[i].position.z=z;rings[i].scale.setScalar(.4+z/70);rings[i].material.opacity=.2+.5*(1-z/90);}
 for(let i=0;i<flows.length;i++){const f=flows[i];f.dot.position.lerpVectors(f.start,f.end,(t*.5+i/3)%1);}}
 controls.update();renderer.render(scene,camera);
 }
 requestAnimationFrame(render);
 }catch(error){console.error('CAD viewer:',error);fail('当前无法显示 3D · 可继续查看真实装配预览和零件说明');}
}
if(new URLSearchParams(location.search).get('static')==='1')fail('静态展示模式 · 保存的 CAD 装配预览');else boot();
