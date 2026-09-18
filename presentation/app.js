import * as T from 'three';
import {OrbitControls} from './vendor/three/examples/jsm/controls/OrbitControls.js';
import {loadRobot} from './scene/robot.js';
import {loadActor} from './scene/actor.js';
import {makeStudio} from './scene/studio.js';
import {makeInspection} from './scene/inspection.js';
import {parts} from './parts.js';
import {Director,evaluate,scenes,DURATION,ROBOT_Y} from './story/director.js';
import {clamp,ease} from './story/timeline.js';
const $=id=>document.getElementById(id),stage=$('stage'),director=new Director(),reduced=matchMedia('(prefers-reduced-motion:reduce)');
const params=new URLSearchParams(location.search),exporting=params.get('export')==='1';
let renderer,scene,camera,controls,robot,actor,studio,inspection,ready=false,lost=false,mode='scroll',scheduled=false,last=0,draws=0;
let selected=null,inspectOpen=0,inspectGoal=0,cameraFlight=null,hoverTimer=null,exitTimer=null,saved=null,lastIndex=-1,external=false;
let state=evaluate(0),sonarWaves=[],inspectStart=0;
document.body.dataset.mode=mode;document.body.dataset.export=String(exporting);if(exporting)$('consolePreview').src='about:blank';
const stamp=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function request(){if(!scheduled&&!document.hidden){scheduled=true;requestAnimationFrame(frame);}}
function scrollTime(){return clamp(scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight))*DURATION;}
function syncScroll(){window.scrollTo({top:director.time/DURATION*Math.max(1,document.documentElement.scrollHeight-innerHeight),behavior:'instant'});}
function setMode(next){if(mode==='inspect')leaveInspect();mode=next;director.setMode(next);external=false;document.body.dataset.mode=mode;
 document.querySelectorAll('[data-mode]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
 if(mode==='scroll')syncScroll();else if(mode==='film'){director.hold=DURATION;director.play();}else{director.hold=scenes[state.index].end;}
 last=0;resize();request();}
function chapter(i){external=false;i=clamp(i,0,scenes.length-1);director.chapter(i);if(mode==='scroll'){director.seek(scenes[i].start+.02);syncScroll();}request();}
function copy(){document.body.dataset.chapter=state.chapter;const s=state.copy;if(state.index!==lastIndex){lastIndex=state.index;$('kicker').textContent=s.kicker;const lines=s.title.split('\n');$('title').replaceChildren(document.createTextNode(lines[0]),document.createElement('br'));const span=document.createElement('span');span.textContent=lines[1]||'';$('title').append(span);$('description').textContent=s.body;$('chapterCount').textContent=String(state.index+1).padStart(2,'0');}
 $('sceneCaption').textContent=s.note;$('watch').hidden=state.index!==0;$('scrollCue').hidden=state.index!==0;
 let beat='';if(state.chapter==='motion')beat=state.pose.label;if(state.chapter==='gesture')beat=state.gesture.label==='NONE'?'松手 · 准备新的动作':`${state.gesture.label}  /  ${state.gesture.accepted?'指令已接受':'识别确认中'}`;
 if(state.chapter==='follow'||state.chapter==='range')beat=state.pose.label;
 if(state.chapter==='care')beat=state.care.hr?'72 BPM   ·   SpO₂ 98%\n模拟读数':state.care.contact?'手指接触 · 采集中':'等待接触';
 $('beat').textContent=beat;$('scrub').value=director.time;$('time').value=`${stamp(director.time)} / 2:30`;$('pause').textContent=director.playing?'Ⅱ':'▷';$('pause').setAttribute('aria-pressed',String(director.playing));$('pause').setAttribute('aria-label',director.playing?'暂停':'播放');$('previous').disabled=state.index===0;$('next').disabled=state.index===scenes.length-1;
 $('consoleShot').hidden=!state.console||mode==='inspect';
 if(state.console&&!exporting&&$('consolePreview').getAttribute('src')==='about:blank')$('consolePreview').src=$('consolePreview').dataset.src;
 if(exporting){$('consolePreview').hidden=true;$('consoleRecording').hidden=false;}
}
function flight(shot,duration=.75){cameraFlight={eye:camera.position.clone(),target:controls.target.clone(),to:shot.eye,at:shot.target,start:performance.now()/1000,duration:reduced.matches?0:duration};request();}
function applyCamera(eye,target){camera.position.copy(eye);controls.target.copy(target);camera.lookAt(target);}
function poseScene(){
 robot.root.position.fromArray(state.pose.position);robot.root.rotation.set(0,state.pose.yaw,0);robot.apply(state);
 for(const item of robot.instances){const rotor=item.appearance.userData.rotor;if(rotor)rotor.rotation.z=state.pose.wheels[item.node.name]||0;item.appearance.userData.setOLED?.(state.oled);}
 robot.effects.camera.update(state.t-20,state.focus==='camera'&&state.focusAmount>.8);
 robot.effects.ultrasonic.update(state.t-25,state.focus==='ultrasonic'&&state.focusAmount>.8);
 robot.effects.health.update(state.t,state.care.contact&&state.chapter==='care');
 const contact=robot.effects.health.contact();actor.pose(state,contact);studio.update(state);
 for(let i=0;i<sonarWaves.length;i++){const m=sonarWaves[i];m.visible=state.sonar;const phase=((state.t-100)*.5+i/3)%1,returning=phase>.5,distance=returning?2-2*phase:2*phase;
  const origin=robot.effects.ultrasonic.anchor.getWorldPosition(new T.Vector3());const travel=Math.max(.03,origin.x-(-.37+.036));m.position.z=distance*travel;m.scale.setScalar(.8+distance*1.3);m.material.opacity=(1-distance*.5)*.55;m.material.color.set(returning?'#edf6f5':'#9acbd1');}
}
function frame(now){scheduled=false;if(!ready||lost)return;const sec=now/1000,dt=last?Math.min(.1,sec-last):0;last=sec;
 if(mode==='inspect'){
  const a=reduced.matches?1:1-Math.exp(-dt*7);inspectOpen+=(inspectGoal-inspectOpen)*a;if(Math.abs(inspectOpen-inspectGoal)<.0001)inspectOpen=inspectGoal;
  robot.root.position.set(0,ROBOT_Y,0);robot.root.rotation.set(0,0,0);inspection.apply(inspectOpen,selected);actor.root.visible=false;studio.update(state,true);sonarWaves.forEach(m=>m.visible=false);
  const item=robot.instances.find(v=>v.node.name===selected);const effectTime=reduced.matches?2:(sec-inspectStart)%8;
  if(item&&robot.effects[item.id])robot.effects[item.id].update(effectTime,true);
  $('partLabels').hidden=inspectOpen<.85||!!selected;
  if(!$('partLabels').hidden)for(const b of $('partLabels').children){const members=robot.instances.filter(v=>v.id===b.dataset.part),bounds=new T.Box3();members.forEach(n=>bounds.union(new T.Box3().setFromObject(n.appearance)));const p=bounds.getCenter(new T.Vector3()).project(camera);b.style.left=`${(p.x+1)*stage.clientWidth/2}px`;b.style.top=`${(1-p.y)*stage.clientHeight/2+16}px`;}
  if(cameraFlight){const t=cameraFlight.duration?ease((sec-cameraFlight.start)/cameraFlight.duration):1;applyCamera(cameraFlight.eye.clone().lerp(cameraFlight.to,t),cameraFlight.target.clone().lerp(cameraFlight.at,t));if(t===1)cameraFlight=null;}
 }else{
  $('partLabels').hidden=true;
  if(!external){if(mode==='scroll')director.seek(scrollTime());else director.tick(sec);}
  state=evaluate(mode==='deck'&&!director.playing&&director.time===director.hold?Math.max(0,director.time-.000001):director.time,{aspect:camera.aspect,reduced:reduced.matches});poseScene();applyCamera(new T.Vector3(...state.eye),new T.Vector3(...state.target));copy();
 }
 renderer.render(scene,camera);draws++;
 if(director.playing||(mode==='inspect'&&selected&&!reduced.matches)||cameraFlight||Math.abs(inspectGoal-inspectOpen)>.0001)request();
}
function resize(){if(!renderer)return;const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=32;camera.updateProjectionMatrix();const frame=$('consolePreview'),box=frame.parentElement;frame.style.transform=`scale(${box.clientWidth/1440})`;request();}
function expand(value){clearTimeout(hoverTimer);clearTimeout(exitTimer);if(selected)return;inspectGoal=value;$('expand').textContent=value?'收拢整机':'展开结构';
 // Compute target bounds at the requested layout, then restore the current animated pose.
 inspection.apply(value);const shot=inspection.shot(null,camera.aspect);inspection.apply(inspectOpen);flight(shot);}
function clearSelection(){selected=null;$('closePart').hidden=true;document.querySelectorAll('#parts button').forEach(b=>b.setAttribute('aria-pressed','false'));$('partTitle').textContent='选择一个部件';$('partDescription').textContent='独立展开各个功能组。点选之后，带你近一点看。';$('partCategory').textContent='EXPLORE THE STRUCTURE';$('instanceLabel').textContent='';inspectGoal=1;inspection.apply(1);flight(inspection.shot(null,camera.aspect));}
function selectPart(id,instanceId){if(mode!=='inspect')return;const items=robot.instances.filter(n=>n.id===id);if(!instanceId){const current=items.findIndex(n=>n.node.name===selected);instanceId=items[(current+1)%items.length].node.name;}
 selected=instanceId;inspectStart=performance.now()/1000;inspectGoal=inspectOpen=1;inspection.apply(1,selected);flight(inspection.shot(selected,camera.aspect));const p=parts.find(p=>p.id===id);
 $('partTitle').textContent=p.name;$('partCategory').textContent=p.category;$('partDescription').textContent=p.description;$('instanceLabel').textContent=`${instanceId}${items.length>1?' · 再点同一按钮切换实例':''}`;$('closePart').hidden=false;
 document.querySelectorAll('#parts button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.part===id)));request();}
function enterInspect(){if(!ready||mode==='inspect')return;saved={mode,time:director.time};director.pause();mode='inspect';document.body.dataset.mode=mode;$('inspectPanel').hidden=false;controls.enabled=true;selected=null;inspectOpen=inspectGoal=0;cameraFlight=null;
 robot.root.position.set(0,ROBOT_Y,0);robot.root.rotation.set(0,0,0);inspection.apply(0);resize();const shot=inspection.shot(null,camera.aspect);applyCamera(shot.eye,shot.target);$('expand').textContent='展开结构';$('closePart').hidden=true;$('partTitle').textContent='完整，从这里开始。';$('partDescription').textContent='转动、放大，或展开后选择一个部件。';$('instanceLabel').textContent='';$('leaveInspect').focus();request();}
function leaveInspect(){if(mode!=='inspect')return;clearTimeout(hoverTimer);clearTimeout(exitTimer);mode=saved.mode;director.setMode(mode);director.seek(saved.time);external=mode!=='scroll';selected=null;cameraFlight=null;controls.enabled=false;$('inspectPanel').hidden=true;document.body.dataset.mode=mode;resize();if(mode==='scroll')syncScroll();lastIndex=-1;$('inspect').focus();request();}
function picking(){const canvas=renderer.domElement,ray=new T.Raycaster(),pointer=new T.Vector2();let down=null,active=new Set();
 canvas.addEventListener('pointerdown',e=>{active.add(e.pointerId);down=active.size===1?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;cameraFlight=null;clearTimeout(exitTimer);});
 canvas.addEventListener('pointercancel',e=>{active.delete(e.pointerId);down=null;});
 canvas.addEventListener('pointerup',e=>{active.delete(e.pointerId);if(mode!=='inspect'||!down||down.id!==e.pointerId||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5){down=null;return;}down=null;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const targets=[];for(const item of robot.instances)if(item.node.visible)item.appearance.traverse(n=>{if(n.isMesh)targets.push(n);});const hit=ray.intersectObjects(targets,false)[0];if(hit)selectPart(hit.object.userData.partId,hit.object.userData.instanceId);});
 canvas.addEventListener('pointerenter',e=>{if(mode!=='inspect'||selected||e.pointerType==='touch')return;clearTimeout(exitTimer);hoverTimer=setTimeout(()=>expand(1),200);});
 canvas.addEventListener('pointerleave',e=>{if(mode!=='inspect'||selected||e.pointerType==='touch'||active.size)return;clearTimeout(hoverTimer);exitTimer=setTimeout(()=>expand(0),350);});
 $('inspectPanel').addEventListener('pointerenter',()=>clearTimeout(exitTimer));
 controls.addEventListener('start',()=>{cameraFlight=null;});controls.addEventListener('change',request);
}
function fallback(message){$('poster').hidden=false;$('loadStatus').hidden=false;$('loadStatus').replaceChildren(document.createTextNode(message+' '));const link=document.createElement('a');link.href='assets/film/CareRover-film.mp4';link.textContent='播放离线影片 ↗';$('loadStatus').append(link);$('inspect').disabled=true;document.body.dataset.viewer='fallback';}
async function boot(){try{
 renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:exporting});renderer.setPixelRatio(exporting?1:Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;stage.append(renderer.domElement);
 scene=new T.Scene();camera=new T.PerspectiveCamera(32,1,.001,20);controls=new OrbitControls(camera,renderer.domElement);controls.enabled=false;controls.enableDamping=false;controls.enablePan=false;controls.minDistance=.035;controls.maxDistance=3;controls.minPolarAngle=.001;controls.maxPolarAngle=Math.PI-.001;
 studio=makeStudio(scene,renderer);[robot,actor]=await Promise.all([loadRobot(),loadActor()]);scene.add(robot.root,actor.root);inspection=makeInspection(robot);
 for(let i=0;i<3;i++){const wave=new T.Mesh(new T.RingGeometry(.012,.0128,64),new T.MeshBasicMaterial({color:'#9acbd1',transparent:true,side:T.DoubleSide,depthWrite:false}));robot.effects.ultrasonic.anchor.add(wave);sonarWaves.push(wave);}
 picking();renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;if(mode==='inspect')leaveInspect();director.pause();fallback('3D 暂时中断 · 可使用离线影片继续展示');});renderer.domElement.addEventListener('webglcontextrestored',()=>{studio.restoreEnvironment();lost=false;ready=true;document.body.dataset.viewer='ready';$('poster').hidden=true;$('loadStatus').hidden=true;$('inspect').disabled=false;request();});
 ready=true;document.body.dataset.viewer='ready';$('poster').hidden=true;$('loadStatus').hidden=true;$('inspect').disabled=false;new ResizeObserver(resize).observe(stage);resize();
 // Local-only diagnostics and deterministic film capture. This page imports no transport.
 window.__careRover={seek:async(t)=>{if(mode==='inspect')leaveInspect();external=true;director.pause();director.seek(t);state=evaluate(t,{aspect:camera.aspect});poseScene();applyCamera(new T.Vector3(...state.eye),new T.Vector3(...state.target));copy();
   if(exporting&&state.console){const video=$('consoleRecording');if(video.readyState<2)await new Promise(resolve=>video.addEventListener('loadeddata',resolve,{once:true}));const target=Math.min(video.duration-.04,Math.max(0,t-130));if(Math.abs(video.currentTime-target)>.012)await new Promise(resolve=>{video.addEventListener('seeked',resolve,{once:true});video.currentTime=target;});}
   renderer.render(scene,camera);await new Promise(requestAnimationFrame);return state;},
  snapshot:()=>({ready,mode,time:director.time,playing:director.playing,selected,open:inspectOpen,draws,camera:camera.position.toArray(),target:controls.target.toArray(),render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures},actor:{height:1.70,position:actor.root.position.toArray()},contact:robot.effects.health.contact().toArray(),indexTip:actor.indexTip().toArray(),partBounds:robot.instances.map(n=>{const box=new T.Box3().setFromObject(n.appearance),points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new T.Vector3(x,y,z).project(camera).toArray());return {id:n.node.name,visible:n.node.visible,min:box.min.toArray(),max:box.max.toArray(),projected:points};}),instances:robot.instances.map(n=>({id:n.id,instanceId:n.node.name,position:n.node.position.toArray(),rotation:n.node.quaternion.toArray(),visible:n.node.visible})),sensors:Object.fromEntries(Object.entries(robot.effects).filter(([,e])=>e.anchor).map(([k,e])=>[k,{position:e.anchor.getWorldPosition(new T.Vector3()).toArray(),forward:new T.Vector3(0,0,1).transformDirection(e.anchor.matrixWorld).toArray()}]))}),
  setMode,enterInspect,leaveInspect,selectPart,expand,reset:()=>{$('inspectReset').click();},loseContext:()=>renderer.forceContextLoss(),restoreContext:()=>renderer.forceContextRestore()};
 if(exporting){mode='film';director.setMode(mode);document.body.dataset.mode=mode;external=true;await window.__careRover.seek(Number(params.get('t'))||0);}request();
 }catch(error){console.error('CareRover presentation',error);fallback('3D 未能载入 · 请使用离线影片或章节海报');}}
for(const part of parts){const b=document.createElement('button');b.textContent=part.name;b.dataset.part=part.id;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>selectPart(part.id));$('parts').append(b);const label=b.cloneNode(true);label.addEventListener('click',()=>selectPart(part.id));$('partLabels').append(label);}
document.querySelectorAll('.modes button').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('watch').addEventListener('click',()=>{director.seek(0);setMode('film');});$('pause').addEventListener('click',()=>{external=false;if(mode==='scroll')setMode('film');else if(director.playing)director.pause();else{if(director.time===DURATION)director.seek(0);if(mode==='deck'&&director.time>=director.hold)director.chapter(Math.min(state.index+1,scenes.length-1));director.play();}request();});
$('previous').addEventListener('click',()=>chapter(state.index-1));$('next').addEventListener('click',()=>chapter(state.index+1));$('scrub').addEventListener('input',e=>{director.pause();director.seek(Number(e.target.value));external=mode!=='scroll';if(mode==='scroll')syncScroll();request();});
$('fullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>{});});
$('inspect').addEventListener('click',enterInspect);$('leaveInspect').addEventListener('click',leaveInspect);$('expand').addEventListener('click',()=>{if(selected)clearSelection();else expand(inspectGoal?0:1);});$('closePart').addEventListener('click',clearSelection);$('inspectReset').addEventListener('click',()=>{selected=null;inspectOpen=inspectGoal=0;inspection.apply(0);flight(inspection.shot(null,camera.aspect));$('expand').textContent='展开结构';$('closePart').hidden=true;$('partTitle').textContent='完整，从这里开始。';$('partDescription').textContent='转动、放大，或展开后选择一个部件。';$('instanceLabel').textContent='';document.querySelectorAll('#parts button').forEach(b=>b.setAttribute('aria-pressed','false'));});
window.addEventListener('scroll',()=>{if(mode==='scroll'&&!external)request();},{passive:true});window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{last=0;director.last=null;if(!document.hidden)request();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&mode==='inspect'){leaveInspect();return;}if(mode==='inspect'||e.target.closest('input,button,a'))return;if(['ArrowRight','PageDown','ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();chapter(state.index+(['ArrowRight','PageDown'].includes(e.key)?1:-1));}if(e.code==='Space'){e.preventDefault();$('pause').click();}});
if(params.get('static')==='1')fallback('静态展示 · 请使用离线影片了解完整故事');else boot();
