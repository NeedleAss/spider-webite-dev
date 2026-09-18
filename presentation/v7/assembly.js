import * as T from 'three';
export const clamp=x=>Math.max(0,Math.min(1,x));
export const ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
const phase=(p,a,b)=>ease((p-a)/(b-a));
// Stable CAD instance pairs, verified from the saved transforms. Not array order.
export const wheelPairs={'wheel-1':'servo-1','wheel-5':'servo-5','wheel-6':'servo-6','wheel-7':'servo-7'};
export const groups={top:['lid','display'],compute:['controller','board-mount','board-frame'],vision:['camera','camera-mount']};
// Conceptual display extraction, pending a physical installation/fastener review.
// The shell clears upward before moving sideways. No claim of a service procedure.
export function offsetFor(item,p,axisByServo){
 const id=item.id, d=new T.Vector3();
 if(groups.top.includes(id))d.y=.176*phase(p,0,.26);
 else if(id==='shell'){d.y=.142*phase(p,.24,.60);d.x=.088*phase(p,.60,.88);d.z=-.014*phase(p,.60,.88);}
 else if(groups.compute.includes(id)){d.y=.022*phase(p,.68,1);d.x=.019*phase(p,.68,1);}
 else if(groups.vision.includes(id))d.x=.013*phase(p,.13,.24)*(1-phase(p,.66,.95))-.033*phase(p,.66,.95);
 else if(id==='ultrasonic')d.x=.013*phase(p,.13,.24)*(1-phase(p,.69,1))-.044*phase(p,.69,1);
 else if(id==='health')d.z=.019*phase(p,.72,1);
 else if(id==='imu')d.z=-.016*phase(p,.72,1);
 else if(id==='battery')d.y=.008*phase(p,.75,1);
 else if(id==='wheel'){d.copy(axisByServo[wheelPairs[item.node.name]]).multiplyScalar(.027*phase(p,.67,1));}
 else if(id==='servo')d.copy(axisByServo[item.node.name]).multiplyScalar(.012*phase(p,.67,1));
 return d;
}
export function makeAssembly(robot){
 const axes={};
 for(const [wheel,servo] of Object.entries(wheelPairs)){
  const w=robot.instances.find(i=>i.node.name===wheel);if(!w||!robot.instances.some(i=>i.node.name===servo))throw Error('Missing CAD wheel/servo pair');
  axes[servo]=new T.Vector3(0,0,1).applyQuaternion(w.rotation).normalize();
 }
 const rest=new Map(robot.instances.map(i=>[i.node.name,{p:i.rest.clone(),q:i.rotation.clone(),s:i.node.scale.clone()}]));
 function apply(progress){const p=clamp(progress);for(const i of robot.instances){const r=rest.get(i.node.name);i.node.position.copy(r.p).add(offsetFor(i,p,axes));i.node.quaternion.copy(r.q);i.node.scale.copy(r.s);i.node.visible=true;}robot.cableRoot.visible=false;Object.values(robot.effects).forEach(e=>e.content.visible=false);robot.root.updateMatrixWorld(true);}
 return {apply,rest,axes};
}
export function openingAt(t){if(t<.8)return 0;if(t<4.4)return ease((t-.8)/3.6);if(t<5.6)return 1;if(t<9.2)return 1-ease((t-5.6)/3.6);return 0;}
