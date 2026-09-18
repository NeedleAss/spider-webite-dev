import * as T from 'three';
import {GLTFLoader} from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Y=V(0,1,0);
export async function loadActor(){
 const gltf=await new GLTFLoader().loadAsync('assets/actors/adult.glb');
 const root=new T.Group();root.name='Adult · 1.70 m · CC0';root.add(gltf.scene);
 const bones={},rest=new Map();gltf.scene.traverse(o=>{if(o.isBone){bones[o.name]=o;rest.set(o,{q:o.quaternion.clone(),p:o.position.clone()});}if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
 root.rotation.y=Math.PI/2;root.position.set(-.76,-.42,0);root.updateMatrixWorld(true);
 const world=b=>b.getWorldPosition(V());
 function aim(b,dir){const q=b.getWorldQuaternion(new T.Quaternion()),axis=Y.clone().applyQuaternion(q);q.premultiply(new T.Quaternion().setFromUnitVectors(axis,dir.clone().normalize()));b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));root.updateMatrixWorld(true);}
 function limb(type,side,target,pole){
  const upper=[bones[`${type==='arm'?'upperarm':'upperleg'}01${side}`],bones[`${type==='arm'?'upperarm':'upperleg'}02${side}`]];
  const lower=[bones[`${type==='arm'?'lowerarm':'lowerleg'}01${side}`],bones[`${type==='arm'?'lowerarm':'lowerleg'}02${side}`]],end=bones[`${type==='arm'?'wrist':'foot'}${side}`];
  const a=world(upper[0]),b=world(lower[0]),c=world(end),l1=a.distanceTo(b),l2=b.distanceTo(c),delta=target.clone().sub(a),d=Math.max(.001,Math.min(delta.length(),l1+l2-.0001)),dir=delta.normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),off=Math.sqrt(Math.max(0,l1*l1-along*along));
  const bend=pole.clone().sub(a);bend.addScaledVector(dir,-bend.dot(dir)).normalize();
  const elbow=a.clone().addScaledVector(dir,along).addScaledVector(bend,off);
  upper.forEach(bone=>aim(bone,elbow.clone().sub(world(bone))));
  lower.forEach(bone=>aim(bone,target.clone().sub(world(bone))));
 }
 // Orient a hand with an explicit finger direction and palm normal, using its rest anatomy.
 const handFrames={};
 for(const side of ['L','R']){
  const w=bones[`wrist${side}`],inv=w.getWorldQuaternion(new T.Quaternion()).invert(),origin=world(w);
  const along=world(bones[`finger3-1${side}`]).sub(origin).normalize().applyQuaternion(inv);
  const across=world(bones[`finger2-1${side}`]).sub(world(bones[`finger5-1${side}`])).normalize().applyQuaternion(inv);
  const normal=across.clone().cross(along).normalize().multiplyScalar(side==='R'?1:-1);
  handFrames[side]={along,normal};
 }
 function palm(side,along,normal){const b=bones[`wrist${side}`],frame=handFrames[side];let q=new T.Quaternion().setFromUnitVectors(frame.along,along.clone().normalize());
  const n=frame.normal.clone().applyQuaternion(q),axis=along.clone().normalize(),desired=normal.clone().addScaledVector(axis,-normal.dot(axis)).normalize();
  const angle=Math.atan2(axis.dot(n.clone().cross(desired)),n.dot(desired));q.premultiply(new T.Quaternion().setFromAxisAngle(axis,angle));b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));root.updateMatrixWorld(true);
 }
 function fingers(side,curls){for(let f=1;f<=5;f++)for(let j=1;j<=3;j++){const b=bones[`finger${f}-${j}${side}`];if(!b)continue;
   // Rig local X is the anatomical flexion axis; thumb receives a smaller curl.
   b.quaternion.multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),(curls[f-1]||0)*(j===1?.65:1)));}root.updateMatrixWorld(true);}
 function pose(state,contact){
  for(const [b,r] of rest){b.quaternion.copy(r.q);b.position.copy(r.p);}
  root.position.set(-.76+.16*state.person.reach,-.42,0);root.rotation.y=Math.PI/2;root.visible=state.person.visible;root.updateMatrixWorld(true);
  for(const side of ['L','R']){
   const sign=side==='R'?1:-1;
   limb('leg',side,V(-.40,.075,sign*.14),V(-.35,.55,sign*.15));aim(bones[`foot${side}`],V(1,-.26,0));
   limb('arm',side,V(-.37,.785,sign*.22),V(-.67,.76,sign*.32));palm(side,V(1,-.1,0),V(0,-1,0));
  }
  const head=bones.head;head.quaternion.multiply(new T.Quaternion().setFromAxisAngle(V(0,1,0),-.9*state.person.headAway));
  const armBones=Object.values(bones).filter(b=>/R$/.test(b.name)&&/arm|wrist|finger/.test(b.name));
  const idle=new Map(armBones.map(b=>[b,b.quaternion.clone()]));
  function gesturePose(label){
   for(const [b,q] of idle)b.quaternion.copy(q);root.updateMatrixWorld(true);
   const h=state.gesture.hand,target=V(-.37,.785,.22).lerp(V(-.48,1.02,.22),h);
   limb('arm','R',target,V(-.65,.81,.37));
   const thumb=label==='LIKE'||label==='DISLIKE';palm('R',thumb?V(0,0,1):V(0,1,.03),V(1,0,0));
   if(label==='DISLIKE'){const w=bones.wristR,q=w.getWorldQuaternion(new T.Quaternion());q.premultiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),Math.PI));w.quaternion.copy(w.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));}
   fingers('R',thumb?[0,1.55,1.55,1.55,1.55]:label==='TWO'?[.8,0,0,1.2,1.2]:[.1,.1,.1,.1,.1]);
   if(thumb){const sign=label==='LIKE'?1:-1;aim(bones['finger1-1R'],V(.05,sign,.1));aim(bones['finger1-2R'],V(.05,sign,.04));aim(bones['finger1-3R'],V(.05,sign,.02));}
  }
  if(state.gesture.hand>0){
   gesturePose(state.gesture.label);const target=new Map(armBones.map(b=>[b,b.quaternion.clone()]));
   const transition=state.t>=76&&state.t<76.65?[76,'NONE']:state.t>=73&&state.t<73.65?[73,'DISLIKE']:state.t>=70&&state.t<70.65?[70,'TWO']:null;
   if(transition){gesturePose(transition[1]);const u=Math.min(1,(state.t-transition[0])/.65),blend=u*u*(3-2*u);for(const [b,q] of target)b.quaternion.slerp(q,blend);}
   // Bring up/lower the complete hand continuously, including wrist and finger posture.
   for(const [b,q] of idle)b.quaternion.copy(q.clone().slerp(b.quaternion,state.gesture.hand));
  }
  if(state.person.reach>0&&contact){
   const h=state.person.reach,target=contact.clone().add(V(-.15,.025,.015)),wrist=V(-.37,.785,.22).lerp(target,h),tipGoal=contact.clone().add(V(0,0,.004));
   for(let iteration=0;iteration<5;iteration++){
    for(const [bone,r] of rest)if(/finger.*R$/.test(bone.name))bone.quaternion.copy(r.q);
    limb('arm','R',wrist,V(-.45,.90,.26));palm('R',V(1,-.05,0),V(0,0,-1));fingers('R',[.35,0,.8,.9,1]);
    const distal=bones['finger2-3R'],tip=world(distal).add(Y.clone().applyQuaternion(distal.getWorldQuaternion(new T.Quaternion())).multiplyScalar(.0236));
    if(iteration<4)wrist.addScaledVector(tipGoal.clone().sub(tip),h*.9);
   }
   for(const [b,q] of idle)b.quaternion.copy(q.clone().slerp(b.quaternion,h));
  }
  root.updateMatrixWorld(true);
 }
 return {root,bones,pose,palm,limb,world,indexTip:()=>{const b=bones['finger2-3R'];return world(b).add(Y.clone().applyQuaternion(b.getWorldQuaternion(new T.Quaternion())).multiplyScalar(.0236));}};
}
