let T,OrbitControls,loadRobot;
import {parts} from './parts.js';
import {chapters,storyState,clamp,motionPose,wheelAngles} from './story/timeline.js';

const $=id=>document.getElementById(id), sections=[...document.querySelectorAll('.chapter')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let renderer,scene,camera,controls,robot,observer,scheduled=false,ready=false,mode='story';
let index=0,progress=0,paused=reduced.matches,clock=0,lastTime=0,lastChapter=-1,lastPose='',selected=null;
let lost=false,restoring=false,draws=0,lastInfo=null,savedScroll=0;
let lastBeat='';
document.body.dataset.enhanced='true';
const stage=$('stage'),poster=$('poster'),links=[...document.querySelectorAll('#chapterLinks a')];
const captions=['CAD 装配 · 实物外观重建','目标装配 · 连接关系示意','人脸检测原理 · 非实时图像','前方测距原理 · 非标定波束','运动学演示 · 无实测轮速','接触式健康原型 · OLED 演示状态','团队实物记录 · 尚未完成装配'];
function request(){if(!scheduled&&!document.hidden){scheduled=true;requestAnimationFrame(frame);}}
function measure(){
  if(mode==='inspect')return;
  const y=scrollY+2;index=sections.reduce((a,s,i)=>y>=s.offsetTop?i:a,0);
  progress=clamp((y-sections[index].offsetTop)/(sections[index].offsetHeight));
  document.body.dataset.chapter=chapters[index];
  if(index!==lastChapter){clock=0;lastChapter=index;lastPose='';}
  sections.forEach((s,i)=>s.toggleAttribute('data-active',i===index));
  links.forEach((a,i)=>i===index?a.setAttribute('aria-current','step'):a.removeAttribute('aria-current'));
  $('previous').disabled=index===0;$('next').disabled=index===6;$('sceneCaption').textContent=captions[index];
  if(!ready)showPoster();request();
}
function go(i,behavior=reduced.matches?'instant':'smooth'){i=clamp(i,0,6);const s=sections[i];window.scrollTo({top:s.offsetTop+(i?s.offsetHeight*.34:0),behavior});history.replaceState(null,'',`#${chapters[i]}`);}
links.forEach((a,i)=>a.addEventListener('click',e=>{e.preventDefault();go(i);}));
function showPoster(){const suffix=innerWidth<=850&&innerHeight>520?'-mobile':'';poster.src=`assets/appearance/${chapters[index]}${suffix}.png`;poster.hidden=false;}
function fallback(message){ready=false;document.body.dataset.viewer='fallback';if(renderer)renderer.domElement.hidden=true;showPoster();$('loadStatus').hidden=false;$('loadStatus').textContent=message;$('inspect').disabled=true;request();}
function setPaused(value){paused=value;$('pause').setAttribute('aria-pressed',String(paused));$('pause').setAttribute('aria-label',paused?'播放原理动画':'暂停原理动画');$('pause').textContent=paused?'▷':'Ⅱ';lastTime=0;request();}
$('pause').addEventListener('click',()=>setPaused(!paused));$('previous').addEventListener('click',()=>go(index-1));$('next').addEventListener('click',()=>go(index+1));
$('restart').addEventListener('click',()=>{clock=0;lastTime=0;setPaused(false);request();});
$('showPhoto').addEventListener('click',()=>$('photoDialog').showModal());$('closePhoto').addEventListener('click',()=>$('photoDialog').close());
$('photoDialog').addEventListener('close',()=>{lastTime=0;request();});
$('photoDialog').addEventListener('click',e=>{if(e.target===$('photoDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
window.addEventListener('scroll',measure,{passive:true});
window.addEventListener('resize',()=>{
  // Viewport height changes chapter pixel lengths; preserve the semantic position.
  const y=Math.max(0,sections[index].offsetTop+progress*sections[index].offsetHeight-2);
  if(mode==='inspect')savedScroll=y;else window.scrollTo({top:y,behavior:'instant'});
  resize();measure();
});
document.addEventListener('visibilitychange',()=>{lastTime=0;if(!document.hidden)request();});
reduced.addEventListener('change',()=>{setPaused(reduced.matches);lastPose='';measure();});
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&mode==='inspect'){leaveInspect();return;}
  if(mode!=='story'||$('photoDialog').open||e.target.closest('button,a,input,select,textarea'))return;
  if(e.key==='PageDown'||e.key==='ArrowRight'){e.preventDefault();go(index+1);}
  if(e.key==='PageUp'||e.key==='ArrowLeft'){e.preventDefault();go(index-1);}
});
function environment(){
  const env=new T.Scene();env.background=new T.Color('#242a33');
  for(const [pos,scale,power] of [[[-2,3,1],[2,3,2],7],[[1,2,-2],[1,4,2],4],[[0,4,0],[4,.1,4],3]]){
    const panel=new T.Mesh(new T.BoxGeometry(...scale),new T.MeshBasicMaterial({color:new T.Color(power,power,power)}));panel.position.fromArray(pos);env.add(panel);
  }
  const pmrem=new T.PMREMGenerator(renderer);const map=pmrem.fromScene(env,.025);scene.userData.environmentTarget?.dispose();scene.userData.environmentTarget=map;scene.environment=map.texture;scene.environmentIntensity=.5;pmrem.dispose();
  env.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
}
function lighting(){
  scene.add(new T.HemisphereLight(0xb8d8ff,0x12161d,1.5));
  const key=new T.DirectionalLight(0xfff4e6,3.4);key.position.set(-.3,.45,.25);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-.25,right:.25,top:.30,bottom:-.15,near:.01,far:1});key.shadow.bias=-.00006;key.shadow.normalBias=.0005;key.shadow.radius=4;scene.add(key);
  const rim=new T.DirectionalLight(0xb5d8ff,2.8);rim.position.set(.18,.3,-.3);scene.add(rim);
  const fill=new T.DirectionalLight(0xffffff,.7);fill.position.set(-.1,.05,-.3);scene.add(fill);
  const ground=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShadowMaterial({color:0,opacity:.28}));ground.rotation.x=-Math.PI/2;ground.position.y=-.0212;ground.receiveShadow=true;scene.add(ground);
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),grad=ctx.createRadialGradient(64,64,8,64,64,64);grad.addColorStop(0,'rgba(0,0,0,.72)');grad.addColorStop(.5,'rgba(0,0,0,.35)');grad.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const shadow=new T.Mesh(new T.PlaneGeometry(.22,.18),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.021;scene.add(shadow);scene.userData.contactShadow=shadow;
  const person=new T.Group(),personMaterial=new T.MeshStandardMaterial({color:0xa5cbd4,roughness:.65});
  const head=new T.Mesh(new T.SphereGeometry(.005,20,12),personMaterial);head.position.y=.036;person.add(head);
  const body=new T.Mesh(new T.CapsuleGeometry(.0055,.012,4,16),personMaterial);body.position.y=.017;person.add(body);
  for(const x of [-.003,.003]){const leg=new T.Mesh(new T.CapsuleGeometry(.002,.010,4,12),personMaterial);leg.position.set(x,.002,0);person.add(leg);}
  person.position.set(-.14,-.016,.035);person.visible=false;scene.add(person);scene.userData.person=person;
}
function resize(){
  if(!renderer)return;const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;
  camera.fov=camera.aspect<.8?39:32;camera.updateProjectionMatrix();lastPose='';request();
}
function positionCamera(state){camera.position.fromArray(state.eye);controls.target.fromArray(state.target);camera.lookAt(controls.target);}
function updateMotion(time,state){
  robot.root.position.set(0,0,0);robot.root.rotation.y=0;scene.userData.contactShadow.position.x=0;scene.userData.contactShadow.position.z=0;
  for(const item of robot.instances){const rotor=item.appearance.userData.rotor;if(rotor)rotor.rotation.z=0;}
  scene.userData.person.visible=state.chapter==='vision'&&state.response===1;
  if(scene.userData.person.visible){
    const phase=Math.min(time,8), turn=clamp((phase-1)/1.5)*.20, travel=clamp((phase-3)/2)*.026;
    scene.userData.person.visible=phase<6.6;
    scene.userData.person.position.z=.035+Math.max(0,1-phase)*.04;
    robot.root.rotation.y=turn;robot.root.position.set(-travel*Math.cos(turn),0,travel*Math.sin(turn));
    const angles=wheelAngles(travel,0,-turn);for(const item of robot.instances){if(item.appearance.userData.rotor)item.appearance.userData.rotor.rotation.z=angles[item.node.name];}
    scene.userData.contactShadow.position.copy(robot.root.position);scene.userData.contactShadow.position.y=-.021;
  }
  if(state.chapter!=='motion'||!state.effect)return;
  const pose=motionPose(time);robot.root.position.fromArray(pose.position);robot.root.rotation.y=pose.yaw;
  scene.userData.contactShadow.position.x=pose.position[0];scene.userData.contactShadow.position.z=pose.position[2];
  document.querySelectorAll('[data-move]').forEach(el=>el.toggleAttribute('data-active',Number(el.dataset.move)===pose.phase));
  // Integral wheel angles for the two straight segments; rotation uses each axle's geometric sign.
  const forward=pose.phase===0?pose.distance:pose.phase===3?.060*(1-pose.distance):.060;
  const lateral=pose.phase===1?pose.distance:pose.phase>=2?.060*(pose.phase===3?1-pose.distance:1):0;
  const angles=wheelAngles(forward,lateral,-pose.yaw);
  for(const item of robot.instances){
    const rotor=item.appearance.userData.rotor;if(!rotor)continue;
    rotor.rotation.z=angles[item.node.name];
    for(const roller of item.appearance.userData.rollers)roller.rotation.y=(pose.phase===0?forward:lateral)/.0028;
  }
}
function frame(ms){
  scheduled=false;if(document.hidden)return;
  const dt=lastTime?Math.min((ms-lastTime)/1000,.05):0;lastTime=ms;
  const state=storyState(index,progress,reduced.matches);
  const beat=`${index}/${state.response===1?'response':'close'}/${state.screen===1?'screen':'body'}`;
  if(beat!==lastBeat){clock=0;lastBeat=beat;}
  const finished=state.chapter==='vision'&&clock>=8||state.chapter==='motion'&&clock>=16;
  const animating=ready&&mode==='story'&&state.effect&&['vision','range','motion','care'].includes(state.chapter)&&!paused&&!reduced.matches&&!$('photoDialog').open&&!finished&&!(state.chapter==='care'&&state.screen===1);
  if(animating)clock+=dt;
  if(ready){
    if(mode==='story'){
      const key=`${index}/${progress.toFixed(5)}/${reduced.matches}/${camera.aspect}`;
      if(key!==lastPose){robot.apply(state);positionCamera(state);lastPose=key;}
      const t=reduced.matches?2:clock;
      robot.effects.camera.update(t,state.chapter==='vision'&&state.effect);
      if(state.response===1)robot.effects.camera.content.visible=false;
      robot.effects.ultrasonic.update(t,state.chapter==='range'&&state.effect);
      robot.effects.health.update(t,state.chapter==='care'&&state.effect&&state.focus==='health');
      updateMotion(t,state);
      if(state.chapter==='vision')$('visionStatus').textContent=t<1?'目标进入视域':t<3?'检测到目标位置':t<6.6?'位置有效 · 先朝向，再跟随':'目标离开 · 停止等待';
      if(state.chapter==='range')$('sonarStatus').textContent=t%4<2?'声波向前 · 遇到障碍':'回波返回 · 形成距离依据';
    }else controls.update();
    renderer.render(scene,camera);draws++;lastInfo={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};
  }
  if(animating)request();
}
function selectPart(id,instanceId){
  const matches=robot.instances.filter(n=>n.id===id);let item=matches.find(n=>n.node.name===instanceId)||matches[0];if(!item)return;
  if(!instanceId&&selected?.id===id){const old=matches.findIndex(n=>n.node.name===selected.instanceId);item=matches[(old+1)%matches.length];}
  selected={id,instanceId:item.node.name};robot.select(item.node.name);
  const p=parts.find(p=>p.id===id);$('partTitle').textContent=p.name;$('partDescription').textContent=p.description;$('instanceLabel').textContent=`${item.node.name} · ${matches.length>1?'再次点击切换实例':'独立实例'}`;
  document.querySelectorAll('[data-part]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.part===id)));
  const bounds=new T.Box3().setFromObject(item.appearance),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()).length();
  controls.target.copy(center);const direction=new T.Vector3(-1,.5,.55).normalize();camera.position.copy(center).addScaledVector(direction,Math.max(.055,size*2.3));controls.update();request();
}
for(const p of parts){const b=document.createElement('button');b.type='button';b.textContent=p.name;b.dataset.part=p.id;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>selectPart(p.id));$('parts').append(b);}
function inspectReset(){for(const item of robot.instances){if(item.appearance.userData.rotor)item.appearance.userData.rotor.rotation.z=0;}scene.userData.contactShadow.position.set(0,-.021,0);robot.root.position.set(0,0,0);robot.root.rotation.set(0,0,0);robot.apply(storyState(1,.6,true));robot.select(null);selected=null;positionCamera(storyState(1,.6,true));controls.update();$('partTitle').textContent='选择一个部件';$('partDescription').textContent='原 CAD 安装位置，实物参考外观。';$('instanceLabel').textContent='';document.querySelectorAll('[data-part]').forEach(b=>b.setAttribute('aria-pressed','false'));request();}
function enterInspect(){if(!ready)return;mode='inspect';savedScroll=scrollY;document.body.dataset.mode=mode;document.body.style.overflow='hidden';controls.enabled=true;$('inspectDialog').show();for(const effect of Object.values(robot.effects))effect.content.visible=false;scene.userData.person.visible=false;resize();inspectReset();$('leaveInspect').focus();}
function leaveInspect(){mode='story';document.body.dataset.mode=mode;document.body.style.overflow='';controls.enabled=false;$('inspectDialog').close();window.scrollTo({top:savedScroll,behavior:'instant'});lastPose='';resize();measure();$('inspect').focus();}
$('inspect').addEventListener('click',enterInspect);$('leaveInspect').addEventListener('click',leaveInspect);$('inspectReset').addEventListener('click',inspectReset);
function picking(){
  const canvas=renderer.domElement,ray=new T.Raycaster(),pointer=new T.Vector2(),active=new Set();let down=null;
  canvas.addEventListener('pointerdown',e=>{active.add(e.pointerId);down=active.size===1?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;});
  canvas.addEventListener('pointercancel',e=>{active.delete(e.pointerId);down=null;});
  canvas.addEventListener('pointerup',e=>{
    active.delete(e.pointerId);if(mode!=='inspect'||!down||down.id!==e.pointerId||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5){down=null;return;}down=null;
    const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);
    const targets=[];for(const item of robot.instances)if(item.node.visible)item.appearance.traverse(n=>{if(n.isMesh&&n.visible)targets.push(n);});
    const hit=ray.intersectObjects(targets,false)[0];if(hit)selectPart(hit.object.userData.partId,hit.object.userData.instanceId);
  });
}
function projectedRobotBounds(){
  const box=new T.Box3();for(const item of robot.instances)if(item.node.visible)box.union(new T.Box3().setFromObject(item.appearance));
  const min=[Infinity,Infinity],max=[-Infinity,-Infinity];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const v=new T.Vector3(x,y,z).project(camera);min[0]=Math.min(min[0],v.x);min[1]=Math.min(min[1],v.y);max[0]=Math.max(max[0],v.x);max[1]=Math.max(max[1],v.y);
  }
  return {min,max};
}
async function boot(){
  try{
    [T,{OrbitControls},{loadRobot}]=await Promise.all([import('three'),import('./vendor/three/examples/jsm/controls/OrbitControls.js'),import('./scene/robot.js')]);
    renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(max-width:850px)').matches?1.5:1.75));renderer.setClearColor(0,0);
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
    stage.append(renderer.domElement);scene=new T.Scene();camera=new T.PerspectiveCamera(32,1,.001,5);
    controls=new OrbitControls(camera,renderer.domElement);controls.enabled=false;controls.enableDamping=false;controls.enablePan=false;controls.minDistance=.025;controls.maxDistance=.9;controls.maxPolarAngle=Math.PI*.88;controls.addEventListener('change',request);
    environment();lighting();robot=await loadRobot();scene.add(robot.root);picking();
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;if(mode==='inspect')leaveInspect();fallback('3D 暂时中断 · 继续浏览章节海报');});
    renderer.domElement.addEventListener('webglcontextrestored',()=>{environment();lost=false;ready=true;restoring=true;document.body.dataset.viewer='ready';renderer.domElement.hidden=false;poster.hidden=true;$('loadStatus').hidden=true;$('inspect').disabled=false;lastPose='';request();});
    ready=true;$('inspect').disabled=false;document.body.dataset.viewer='ready';document.body.dataset.mode='story';poster.hidden=true;$('loadStatus').hidden=true;
    observer=new ResizeObserver(resize);observer.observe(stage);resize();measure();
    // Read-only diagnostic surface for reproducible evidence; never references robot transport.
    window.__careRover={snapshot:()=>({index,progress,mode,paused,clock,ready,lost,restoring,draws,render:lastInfo,
      camera:camera.position.toArray(),target:controls.target.toArray(),projectedRobotBounds:projectedRobotBounds(),
      instances:robot.instances.map(n=>({id:n.id,instanceId:n.node.name,position:n.node.position.toArray(),rotation:n.node.quaternion.toArray(),visible:n.node.visible})),
      sensors:Object.fromEntries(Object.entries(robot.effects).filter(([,e])=>e.anchor).map(([k,e])=>[k,{position:e.anchor.getWorldPosition(new T.Vector3()).toArray(),forward:new T.Vector3(0,0,1).transformDirection(e.anchor.matrixWorld).toArray()}]))}),
      loseContext:()=>renderer.forceContextLoss(),restoreContext:()=>renderer.forceContextRestore()};
  }catch(error){console.error('CareRover presentation:',error);fallback('3D 未能载入 · 继续浏览章节海报');}
}
setPaused(paused);measure();
// Initial deep links select a composed shot; reload/back preserve the browser's exact scroll restoration.
const navigationType=performance.getEntriesByType('navigation')[0]?.type;
if(navigationType==='navigate'&&location.hash&&chapters.includes(location.hash.slice(1)))go(chapters.indexOf(location.hash.slice(1)),'instant');
window.addEventListener('pageshow',()=>requestAnimationFrame(measure));
if(new URLSearchParams(location.search).get('static')==='1')fallback('静态展示 · 章节海报与文字');else boot();
