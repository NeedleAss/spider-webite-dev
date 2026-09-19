import * as T from 'three';
import {OrbitControls} from './vendor/three/examples/jsm/controls/OrbitControls.js';
import {loadRobot} from './scene/robot.js';
import {loadHand} from './v7/hand.js';
import {lightProduct} from './v7/lighting.js';
import {makeScan,makeEcho} from './v7/effects.js';
import {loadInteraction,makeReveal} from './v7/interaction.js';
import {makeInspection} from './scene/inspection.js';
import {parts} from './parts.js';
import {Director as SourceDirector,evaluate as sourceEvaluate,scenes as sourceScenes,DURATION as SOURCE_DURATION,ROBOT_Y,BYPASS_END} from './v7/director.js';
import {mountReviewAudio} from './v7/review-audio.js';
import {CutDirector,evaluateCut,cutScenes,CUT_DURATION} from './v7/cut55.js';
const reviewing=new URLSearchParams(location.search).get('review')==='55';
const Director=reviewing?CutDirector:SourceDirector,DURATION=reviewing?CUT_DURATION:SOURCE_DURATION,scenes=reviewing?cutScenes:sourceScenes;
const evaluate=(t,options)=>reviewing?evaluateCut(t,options):({...sourceEvaluate(t,options),sourceTime:t});
import {clamp} from './story/timeline.js';
import {ease,advanceAssembly} from './v7/structure.js';
const $=id=>document.getElementById(id),stage=$('stage'),director=new Director(),reduced=matchMedia('(prefers-reduced-motion:reduce)');
const params=new URLSearchParams(location.search),exporting=params.get('export')==='1';
let renderer,scene,camera,controls,robot,hand,lighting,inspection,scan,echo,ready=false,lost=false,mode='scroll',scheduled=false,last=0,draws=0;
let isolated=false,selected=null,inspectOpen=0,inspectPhase=0,inspectGoal=0,cameraFlight=null,hoverTimer=null,exitTimer=null,saved=null,lastIndex=-1,external=false;
let state=evaluate(0),inspectStart=0,interaction,reveal,faceOrigin,faceOrientation,obstacleOrigin,obstacleOrientation,reviewAudio;
document.body.dataset.mode=mode;document.body.dataset.export=String(exporting);if(exporting)$('consolePreview').src='about:blank';
$('scrub').max=DURATION;if(reviewing)$('watch').querySelector('span').textContent='55 秒 · 审核版';
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
 if(state.chapter==='vision'&&state.sourceTime>=25)beat=state.follow.label;
 if(state.chapter==='range')beat=state.avoidance.label;
 if(state.chapter==='care')beat=state.care.hr?'72 BPM   ·   SpO₂ 98%\n模拟读数':state.care.contact?'手指接触 · 采集中':'等待接触';
 $('beat').textContent=beat;$('scrub').value=director.time;$('time').value=`${stamp(director.time)} / ${stamp(DURATION)}`;$('pause').textContent=director.playing?'Ⅱ':'▷';$('pause').setAttribute('aria-pressed',String(director.playing));$('pause').setAttribute('aria-label',director.playing?'暂停':'播放');$('previous').disabled=state.index===0;$('next').disabled=state.index===scenes.length-1;
 $('consoleShot').hidden=!state.console||mode==='inspect';
 if(state.console){const iframe=$('consolePreview');iframe.style.transform=`scale(${iframe.parentElement.clientWidth/1440})`;}
 if(!state.console&&$('consolePreview').getAttribute('src')!=='about:blank')$('consolePreview').src='about:blank';
 if(state.console&&!exporting&&!reviewing&&$('consolePreview').getAttribute('src')==='about:blank')$('consolePreview').src=$('consolePreview').dataset.src;
 if(exporting||reviewing){$('consolePreview').hidden=true;$('consoleRecording').hidden=false;}
}
function flight(shot,duration=.75){cameraFlight={eye:camera.position.clone(),target:controls.target.clone(),to:shot.eye,at:shot.target,start:performance.now()/1000,duration:reduced.matches?0:duration};request();}
function applyCamera(eye,target){camera.position.copy(eye);controls.target.copy(target);camera.lookAt(target);}
function poseScene(){
 robot.root.position.fromArray(state.pose.position);robot.root.rotation.set(0,state.pose.yaw,0);
 inspection.apply(state.open);scan.root.visible=echo.root.visible=false;
 const sensor=state.chapter==='vision'?'camera':state.chapter==='range'?'ultrasonic':null;
 const revealTime=(sensor==='camera'?state.sourceTime:state.contentTime)-(sensor==='camera'?18:28),revealAmount=sensor?ease(revealTime/2)*(1-ease((revealTime-8)/2)):0;
 reveal.apply(sensor,sensor==='ultrasonic'?state.avoidance.reveal:revealAmount);
 for(const item of robot.instances){const rotor=item.appearance.userData.rotor;if(rotor)rotor.rotation.z=state.pose.wheels[item.node.name]||0;item.appearance.userData.setOLED?.(state.oled);}
 robot.root.updateMatrixWorld(true);
 if(state.chapter==='vision'){
  const faceScale=ease((state.sourceTime-18)/2);scan.root.scale.setScalar(Math.max(.0001,faceScale));robot.root.updateMatrixWorld(true);
  const world=faceOrigin.clone();world.z+=state.follow.targetZ;scan.target.position.copy(scan.root.worldToLocal(world));scan.target.quaternion.copy(scan.root.getWorldQuaternion(new T.Quaternion()).invert().multiply(faceOrientation));robot.root.updateMatrixWorld(true);
  scan.update(state.sourceTime<28?state.sourceTime-18:1.2+4*((state.sourceTime-28)%3)/3);scan.root.visible=faceScale>0;
 }
 if(state.chapter==='range'){echo.root.scale.setScalar(1);echo.pinObstacle(false);robot.root.updateMatrixWorld(true);echo.obstacle.position.copy(echo.root.worldToLocal(obstacleOrigin.clone()));echo.obstacle.quaternion.copy(echo.root.getWorldQuaternion(new T.Quaternion()).invert().multiply(obstacleOrientation));echo.pinObstacle(true);echo.update(state.avoidance.clock);}else echo.root.visible=false;
 robot.effects.health.update(state.sourceTime,state.care.contact&&state.chapter==='care');
 if(hand){hand.root.visible=state.chapter==='care';if(hand.root.visible){const n=robot.instances.find(i=>i.id==='health').node;hand.place(n);hand.sample(state.sourceTime<83?(state.sourceTime-80)/3*1.25:state.sourceTime<93?1.25+(state.sourceTime-83)/10*2.5:3.75+(state.sourceTime-93)/2*1.25);}}
 interaction.gestures.visible=state.chapter==='gesture';if(state.chapter==='gesture'){interaction.update(state.contentTime,state.gesture.label);interaction.gestures.position.set(-.14,.13,.02).add(new T.Vector3(...BYPASS_END));interaction.gestures.quaternion.setFromRotationMatrix(new T.Matrix4().lookAt(new T.Vector3(...state.eye),new T.Vector3(...state.target),new T.Vector3(0,1,0)));}
 $('gestureCard').hidden=true;$('followCard').hidden=true;
 if(state.chapter==='gesture'){
  $('gestureName').textContent=state.gesture.label==='NONE'?'准备新的动作':state.gesture.label;
  $('gestureResult').textContent=state.gesture.accepted?({TWO:'原地转圈',DISLIKE:'停止',LIKE:'跟随已就绪'}[state.gesture.label]):'识别确认中';
  document.querySelectorAll('[data-gesture]').forEach(e=>e.toggleAttribute('hidden',e.dataset.gesture!==state.gesture.label));
 }

}

function frame(now){scheduled=false;if(!ready||lost)return;const sec=now/1000,dt=last?Math.min(.1,sec-last):0;last=sec;
 if(mode==='inspect'){
  inspectPhase=reduced.matches?inspectGoal:advanceAssembly(inspectPhase,inspectGoal,dt);inspectOpen=ease(inspectPhase);
  robot.root.position.set(0,ROBOT_Y,0);robot.root.rotation.set(0,0,0);if(hand)hand.root.visible=false;inspection.apply(inspectOpen,selected,isolated);reveal.apply(null,0);interaction.gestures.visible=false;scan.root.scale.setScalar(1);echo.root.scale.setScalar(1);for(const i of robot.instances){if(i.appearance.userData.rotor)i.appearance.userData.rotor.rotation.z=0;i.appearance.userData.setOLED?.({line1:'CARE ROVER',line2:'EXPLORE',line3:'PRODUCT DEMO'});}scan.root.visible=echo.root.visible=false;$('gestureCard').hidden=$('followCard').hidden=true;
  const item=robot.instances.find(v=>v.node.name===selected);const effectTime=reduced.matches?2:(sec-inspectStart)%8;
  if(item?.id==='camera'){scan.target.quaternion.identity();scan.target.position.set(0,0,.108);scan.update(effectTime);}if(item?.id==='ultrasonic'){echo.pinObstacle(false);echo.update(effectTime);}
  $('partLabels').hidden=true;
  if(!$('partLabels').hidden)for(const b of $('partLabels').children){const members=robot.instances.filter(v=>v.id===b.dataset.part),bounds=new T.Box3();members.forEach(n=>bounds.union(new T.Box3().setFromObject(n.appearance)));const p=bounds.getCenter(new T.Vector3()).project(camera);b.style.left=`${(p.x+1)*stage.clientWidth/2}px`;b.style.top=`${(1-p.y)*stage.clientHeight/2+16}px`;}
  if(cameraFlight){const t=cameraFlight.duration?ease((sec-cameraFlight.start)/cameraFlight.duration):1;applyCamera(cameraFlight.eye.clone().lerp(cameraFlight.to,t),cameraFlight.target.clone().lerp(cameraFlight.at,t));if(t===1)cameraFlight=null;}
 }else{
  $('partLabels').hidden=true;
  if(!external){if(mode==='scroll')director.seek(scrollTime());else director.tick(sec);}
  state=evaluate(mode==='deck'&&!director.playing&&director.time===director.hold?Math.max(0,director.time-.000001):director.time,{aspect:camera.aspect,reduced:reduced.matches});poseScene();applyCamera(new T.Vector3(...state.eye),new T.Vector3(...state.target));copy();
 }
 if(reviewing){const video=$('consoleRecording');if(state.console&&mode!=='inspect'){const at=Math.min(video.duration-.04,Math.max(0,state.sourceTime-96));video.playbackRate=2;if(Number.isFinite(at)&&Math.abs(video.currentTime-at)>.2)video.currentTime=at;if(director.playing&&video.paused)video.play().catch(()=>{});if(!director.playing)video.pause();}else video.pause();}
 reviewAudio?.sync(director.time,director.playing&&mode!=='inspect'&&!document.hidden);renderer.render(scene,camera);draws++;
 if(director.playing||(mode==='inspect'&&selected&&!reduced.matches)||cameraFlight||(mode==='inspect'&&inspectPhase!==inspectGoal))request();
}
function resize(){if(!renderer)return;const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=30;camera.updateProjectionMatrix();const frame=$('consolePreview'),box=frame.parentElement;frame.style.transform=`scale(${box.clientWidth/1440})`;request();}
function expand(value){clearTimeout(hoverTimer);clearTimeout(exitTimer);if(selected)return;value=Number(Boolean(value));if(inspectPhase===inspectGoal)last=performance.now()/1000;inspectGoal=value;$('expand').textContent=value?'收拢整机':'展开结构';
 // Keep the approved camera still while the structure opens/closes; preserve user orbit.
 request();}
function clearSelection(){clearTimeout(exitTimer);$('expand').textContent='收拢整机';$('inspectPanel').dataset.selected='false';isolated=false;$('isolate').hidden=true;selected=null;$('closePart').hidden=true;document.querySelectorAll('#parts button').forEach(b=>b.setAttribute('aria-pressed','false'));$('partTitle').textContent='选择一个部件';$('partDescription').textContent='保留装配关系，沿同一路径展开与收拢。';$('partCategory').textContent='EXPLORE THE STRUCTURE';$('instanceLabel').textContent='';inspectGoal=1;inspection.apply(inspectOpen);flight(inspection.shot(null,camera.aspect));}
function selectPart(id,instanceId){if(mode!=='inspect')return;const items=robot.instances.filter(n=>n.id===id);if(!instanceId){const current=items.findIndex(n=>n.node.name===selected);instanceId=items[(current+1)%items.length].node.name;}
 $('inspectPanel').dataset.selected='true';isolated=false;$('isolate').hidden=false;$('isolate').textContent='单独看这个部件';selected=instanceId;$('expand').textContent='收拢整机';inspectStart=performance.now()/1000;inspectGoal=1;inspection.apply(1,selected);const focused=inspection.shot(selected,camera.aspect);inspection.apply(inspectOpen,selected);flight(focused);const p=parts.find(p=>p.id===id);
 $('partTitle').textContent=p.name;$('partCategory').textContent=p.category;$('partDescription').textContent=p.description;$('instanceLabel').textContent=`${instanceId}${items.length>1?' · 再点同一按钮切换实例':''}`;$('closePart').hidden=false;
 document.querySelectorAll('#parts button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.part===id)));if(innerWidth<=900)$('partTitle').scrollIntoView({block:'nearest',behavior:reduced.matches?'instant':'smooth'});request();}
function enterInspect(){if(!ready||mode==='inspect')return;saved={mode,time:director.time};director.pause();mode='inspect';$('inspectPanel').dataset.selected='false';isolated=false;$('isolate').hidden=true;document.body.dataset.mode=mode;$('inspectPanel').hidden=false;controls.enabled=true;selected=null;inspectOpen=inspectPhase=inspectGoal=0;cameraFlight=null;
 robot.root.position.set(0,ROBOT_Y,0);robot.root.rotation.set(0,0,0);inspection.apply(0);resize();const shot=inspection.shot(null,camera.aspect);applyCamera(shot.eye,shot.target);$('expand').textContent='展开结构';$('closePart').hidden=true;$('partTitle').textContent='完整，从这里开始。';$('partDescription').textContent='转动、放大，或展开后选择一个部件。';$('instanceLabel').textContent='';$('leaveInspect').focus();request();}
function leaveInspect(){if(mode!=='inspect')return;clearTimeout(hoverTimer);clearTimeout(exitTimer);mode=saved.mode;director.setMode(mode);director.seek(saved.time);external=true;selected=null;cameraFlight=null;controls.enabled=false;$('inspectPanel').hidden=true;document.body.dataset.mode=mode;resize();if(mode==='scroll')syncScroll();lastIndex=-1;$('inspect').focus();request();}
function picking(){const canvas=renderer.domElement,ray=new T.Raycaster(),pointer=new T.Vector2();let down=null,active=new Set();
 canvas.addEventListener('pointerdown',e=>{active.add(e.pointerId);down=active.size===1?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;cameraFlight=null;clearTimeout(exitTimer);});
 canvas.addEventListener('pointercancel',e=>{active.delete(e.pointerId);down=null;});
 canvas.addEventListener('pointerup',e=>{active.delete(e.pointerId);if(mode!=='inspect'||!down||down.id!==e.pointerId||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5){down=null;return;}down=null;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const targets=[];for(const item of robot.instances)if(item.node.visible)item.appearance.traverse(n=>{if(n.isMesh)targets.push(n);});const hit=ray.intersectObjects(targets,false)[0];if(hit)selectPart(hit.object.userData.partId,hit.object.userData.instanceId);});
 canvas.addEventListener('pointerenter',e=>{if(mode!=='inspect'||selected||e.pointerType==='touch')return;clearTimeout(exitTimer);hoverTimer=setTimeout(()=>expand(1),200);});
 canvas.addEventListener('pointerleave',e=>{if(mode!=='inspect'||selected||e.pointerType==='touch'||active.size)return;clearTimeout(hoverTimer);exitTimer=setTimeout(()=>expand(0),350);});
 $('inspectPanel').addEventListener('pointerenter',()=>clearTimeout(exitTimer));
 controls.addEventListener('start',()=>{cameraFlight=null;});controls.addEventListener('change',request);
}
function fallback(message){$('poster').hidden=false;$('loadStatus').hidden=false;$('loadStatus').replaceChildren(document.createTextNode(message+' '));const link=document.createElement('a');link.href='assets/film-v7/CareRover-film.mp4';link.textContent=reviewing?'播放上一版 112 秒影片 ↗':'播放离线影片 ↗';$('loadStatus').append(link);$('inspect').disabled=true;document.body.dataset.viewer='fallback';}
async function boot(){try{
 renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:exporting});renderer.setPixelRatio(exporting?1:Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;stage.append(renderer.domElement);
 scene=new T.Scene();camera=new T.PerspectiveCamera(30,1,.001,20);controls=new OrbitControls(camera,renderer.domElement);controls.enabled=false;controls.enableDamping=false;controls.enablePan=false;controls.minDistance=.035;controls.maxDistance=3;controls.minPolarAngle=.001;controls.maxPolarAngle=Math.PI-.001;
 lighting=lightProduct(scene,renderer);robot=await loadRobot();scene.add(robot.root);inspection=makeInspection(robot);
 interaction=await loadInteraction();scene.add(interaction.gestures);interaction.gestures.visible=false;reveal=makeReveal(robot);
 inspection.apply(0);scan=makeScan(robot.effects.camera.anchor,interaction.head);echo=makeEcho(robot.effects.ultrasonic.anchor,true);echo.pinObstacle(true);robot.visualEffects={camera:scan,ultrasonic:echo};robot.root.updateMatrixWorld(true);faceOrigin=scan.target.getWorldPosition(new T.Vector3());faceOrientation=scan.target.getWorldQuaternion(new T.Quaternion());obstacleOrigin=echo.obstacle.getWorldPosition(new T.Vector3());obstacleOrientation=echo.obstacle.getWorldQuaternion(new T.Quaternion());
 robot.materials.white.roughness=.56;robot.materials.white.color.set('#d9dddf');robot.materials.silver.roughness=.25;robot.materials.rubber.color.set('#14171a');

 hand=await loadHand();scene.add(hand.root);hand.root.visible=false;
 picking();renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;if(mode==='inspect')leaveInspect();director.pause();fallback('3D 暂时中断 · 可使用离线影片继续展示');});renderer.domElement.addEventListener('webglcontextrestored',()=>{lighting.dispose(true);lighting=lightProduct(scene,renderer);lost=false;ready=true;document.body.dataset.viewer='ready';$('poster').hidden=true;$('loadStatus').hidden=true;$('inspect').disabled=false;request();});
 ready=true;document.body.dataset.viewer='ready';$('poster').hidden=true;$('loadStatus').hidden=true;$('inspect').disabled=false;new ResizeObserver(resize).observe(stage);resize();
 // Local-only diagnostics and deterministic film capture. This page imports no transport.
 window.__careRover={seek:async(t)=>{if(mode==='inspect')leaveInspect();external=true;director.pause();director.seek(t);state=evaluate(t,{aspect:camera.aspect});poseScene();applyCamera(new T.Vector3(...state.eye),new T.Vector3(...state.target));copy();
   if((exporting||reviewing)&&state.console){const video=$('consoleRecording');if(video.readyState<2)await new Promise(resolve=>video.addEventListener('loadeddata',resolve,{once:true}));const target=Math.min(video.duration-.04,Math.max(0,state.sourceTime-96));if(Math.abs(video.currentTime-target)>.012)await new Promise(resolve=>{video.addEventListener('seeked',resolve,{once:true});video.currentTime=target;});}
   reviewAudio?.sync(director.time,false);renderer.render(scene,camera);await new Promise(requestAnimationFrame);return state;},
  snapshot:()=>({ready,mode,isolated,flight:!!cameraFlight,state:state.chapter,hand:hand?{visible:hand.root.visible,pad:hand.pad().toArray()}:null,contact:robot.instances.find(i=>i.id==='health').node.localToWorld(new T.Vector3(0,.0037,0)).toArray(),time:director.time,sourceTime:state.sourceTime,duration:DURATION,playing:director.playing,selected,open:inspectOpen,draws,interaction:{faceWorld:scan.target.getWorldPosition(new T.Vector3()).toArray(),robotWorld:robot.root.position.toArray(),robotYaw:robot.root.rotation.y,obstacleWorld:echo.obstacle.getWorldPosition(new T.Vector3()).toArray(),obstacleBounds:(()=>{const b=new T.Box3().setFromObject(echo.obstacle);return {min:b.min.toArray(),max:b.max.toArray()};})(),faceQuaternion:scan.target.getWorldQuaternion(new T.Quaternion()).toArray(),gesture:state.gesture.label,visible:interaction.gestures.visible,head:interaction.head.visible,reveal:reveal.snapshot()},camera:camera.position.toArray(),target:controls.target.toArray(),render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures},partBounds:robot.instances.map(n=>{const box=new T.Box3().setFromObject(n.appearance),points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new T.Vector3(x,y,z).project(camera).toArray());return {id:n.node.name,visible:n.node.visible,min:box.min.toArray(),max:box.max.toArray(),projected:points};}),instances:robot.instances.map(n=>({id:n.id,instanceId:n.node.name,position:n.node.position.toArray(),rotation:n.node.quaternion.toArray(),visible:n.node.visible})),sensors:Object.fromEntries(Object.entries(robot.effects).filter(([,e])=>e.anchor).map(([k,e])=>[k,{position:e.anchor.getWorldPosition(new T.Vector3()).toArray(),forward:new T.Vector3(0,0,1).transformDirection(e.anchor.matrixWorld).toArray()}]))}),
  setMode,enterInspect,leaveInspect,selectPart,expand,clearSelection, isolate:()=>{$('isolate').click();}, reset:()=>{$('inspectReset').click();},loseContext:()=>renderer.forceContextLoss(),restoreContext:()=>renderer.forceContextRestore()};
 if(reviewing){reviewAudio=mountReviewAudio(window.__careRover);mode='film';director.setMode(mode);document.body.dataset.mode=mode;external=true;director.seek(0);document.querySelectorAll('.modes button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode==='film')));}
 if(exporting){mode='film';director.setMode(mode);document.body.dataset.mode=mode;external=true;await window.__careRover.seek(Number(params.get('t'))||0);}request();
 }catch(error){console.error('CareRover presentation',error);fallback('3D 未能载入 · 请使用离线影片或章节海报');}}
for(const part of parts){const b=document.createElement('button');b.textContent=part.name;b.dataset.part=part.id;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>selectPart(part.id));$('parts').append(b);const label=b.cloneNode(true);label.addEventListener('click',()=>selectPart(part.id));$('partLabels').append(label);}
document.querySelectorAll('.modes button').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('watch').addEventListener('click',()=>{director.seek(0);setMode('film');});$('pause').addEventListener('click',()=>{external=false;if(mode==='scroll')setMode('film');else if(director.playing)director.pause();else{if(director.time===DURATION)director.seek(0);if(mode==='deck'&&director.time>=director.hold)director.chapter(Math.min(state.index+1,scenes.length-1));director.play();}request();});
$('previous').addEventListener('click',()=>chapter(state.index-1));$('next').addEventListener('click',()=>chapter(state.index+1));$('scrub').addEventListener('input',e=>{director.pause();director.seek(Number(e.target.value));external=mode!=='scroll';if(mode==='scroll')syncScroll();request();});
$('fullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>{});});
$('inspect').addEventListener('click',enterInspect);$('leaveInspect').addEventListener('click',leaveInspect);$('expand').addEventListener('click',()=>{if(selected)clearSelection();else expand(inspectGoal?0:1);});$('closePart').addEventListener('click',clearSelection);$('inspectReset').addEventListener('click',()=>{$('inspectPanel').dataset.selected='false';isolated=false;$('isolate').hidden=true;selected=null;clearTimeout(hoverTimer);clearTimeout(exitTimer);inspectGoal=0;inspection.apply(inspectOpen);flight(inspection.shot(null,camera.aspect));$('expand').textContent='展开结构';$('closePart').hidden=true;$('partTitle').textContent='完整，从这里开始。';$('partDescription').textContent='转动、放大，或展开后选择一个部件。';$('instanceLabel').textContent='';document.querySelectorAll('#parts button').forEach(b=>b.setAttribute('aria-pressed','false'));});
$('isolate').addEventListener('click',()=>{isolated=!isolated;$('isolate').textContent=isolated?'显示安装参照':'单独看这个部件';inspection.apply(inspectOpen,selected,isolated);request();});
for(const type of ['wheel','touchstart','pointerdown'])window.addEventListener(type,e=>{if(mode==='scroll'&&!e.target.closest('button,input,a')){external=false;request();}},{passive:true});
window.addEventListener('scroll',()=>{if(mode==='scroll'&&!external)request();},{passive:true});window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{last=0;director.last=null;reviewAudio?.sync(director.time,false);if(!document.hidden)request();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&mode==='inspect'){leaveInspect();return;}if(mode==='inspect'||e.target.closest('input'))return;if(['ArrowRight','ArrowDown','PageDown','ArrowLeft','ArrowUp','PageUp'].includes(e.key)){e.preventDefault();chapter(state.index+(['ArrowRight','ArrowDown','PageDown'].includes(e.key)?1:-1));}if(e.code==='Space'){e.preventDefault();$('pause').click();}});
if(params.get('static')==='1')fallback('静态展示 · 请使用离线影片了解完整故事');else boot();
