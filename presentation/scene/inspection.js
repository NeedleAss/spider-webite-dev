import * as T from 'three';
import {makeAssembly,groups,wheelPairs} from '../v7/assembly.js';
// The approved study is the only assembly path, for story and inspection.
export function makeInspection(robot){
 const assembly=makeAssembly(robot);
 function family(item){
  const group=Object.values(groups).find(g=>g.includes(item.id));
  if(group)return robot.instances.filter(i=>group.includes(i.id)).map(i=>i.node.name);
  const pair=Object.entries(wheelPairs).find(([w,s])=>[w,s].includes(item.node.name));
  return pair||[item.node.name];
 }
 function apply(open,selected=null,isolated=false){
  assembly.apply(open);robot.select(null);
  const selectedItem=robot.instances.find(i=>i.node.name===selected);
  if(selectedItem){
   const context=family(selectedItem);
   for(const i of robot.instances)i.node.visible=isolated?i.node.name===selected:context.includes(i.node.name)||i.id==='chassis';
  }
  robot.root.updateMatrixWorld(true);
 }
 function box(selected=null){const b=new T.Box3();for(const i of robot.instances)if(!selected||i.node.name===selected)b.union(new T.Box3().setFromObject(i.appearance));return b;}
 function shot(selected,aspect){
  const b=box(selected),target=b.getCenter(new T.Vector3()),size=b.getSize(new T.Vector3());let dir=new T.Vector3(-.49,.175,.55);
  const i=robot.instances.find(v=>v.node.name===selected);
  if(i&&['camera','ultrasonic'].includes(i.id)){dir.set(-.48,.38,1);const effect=robot.visualEffects?.[i.id];if(effect){b.union(new T.Box3().setFromObject(effect.root));b.getCenter(target);b.getSize(size);}}
  if(i&&['display','health','controller','imu'].includes(i.id))dir.set(-.45,1,.55);
  if(i&&['wheel','servo'].includes(i.id))dir.set(0,0,1).applyQuaternion(i.rotation).add(new T.Vector3(-.2,.4,.2));
  const radius=size.length()/2,distance=Math.max(.065,radius/Math.sin(30*Math.PI/360)*1.08*Math.max(1,1/aspect));
  return {eye:target.clone().addScaledVector(dir.normalize(),distance),target};
 }
 return {apply,box,shot,assembly,family};
}
