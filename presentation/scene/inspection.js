import * as T from 'three';
// A separate functional layout. Values are metres, never firmware coordinates.
const centres={
 display:[0,.37,0],lid:[0,.23,-.24],shell:[0,.23,.25],
 camera:[-.02,.25,0],ultrasonic:[0,.13,-.24],controller:[0,.13,0],health:[0,.13,.25],
 imu:[0,.02,-.24],'board-mount':[0,.02,0],'board-frame':[0,.02,.25],
 'camera-mount':[0,-.10,-.24],battery:[0,-.10,0],chassis:[0,-.10,.25],
 wheel:[0,-.24,-.14],servo:[0,-.24,.20],
};
export function makeInspection(robot){
 robot.root.position.set(0,0,0);robot.root.rotation.set(0,0,0);robot.root.updateMatrixWorld(true);
 const boxes=new Map();
 for(const item of robot.instances){const box=new T.Box3().setFromObject(item.appearance);if(!boxes.has(item.id))boxes.set(item.id,new T.Box3());boxes.get(item.id).union(box);}
 const offsets=new Map();
 for(const item of robot.instances){const group=boxes.get(item.id).getCenter(new T.Vector3()),desired=new T.Vector3(...centres[item.id]);
   const delta=desired.sub(group);
   if(item.id==='wheel'||item.id==='servo'){const members=robot.instances.filter(v=>v.id===item.id),i=members.indexOf(item);const local=new T.Box3().setFromObject(item.appearance).getCenter(new T.Vector3()).sub(group);delta.sub(local);delta.z+=(i%2?1:-1)*.047;delta.y+=(i<2?1:-1)*.043;}
   offsets.set(item.node.name,delta);
 }
 function apply(open,selected=null){
  for(const item of robot.instances){item.node.position.copy(item.rest).addScaledVector(offsets.get(item.node.name),open);item.node.quaternion.copy(item.rotation);item.node.visible=!selected||item.node.name===selected;}
  robot.cableRoot.visible=false;for(const effect of Object.values(robot.effects))effect.content.visible=false;robot.select(null);robot.root.updateMatrixWorld(true);
 }
 function box(selected=null){const result=new T.Box3();for(const item of robot.instances)if(!selected||item.node.name===selected)result.union(new T.Box3().setFromObject(item.appearance));return result;}
 function shot(selected,aspect){const b=box(selected);const selectedItem=robot.instances.find(v=>v.node.name===selected);if(selectedItem&&['camera','ultrasonic'].includes(selectedItem.id))b.union(new T.Box3().setFromObject(robot.effects[selectedItem.id].content));const target=b.getCenter(new T.Vector3()),size=b.getSize(new T.Vector3());let dir=new T.Vector3(-1,.55,.45);
  const item=robot.instances.find(v=>v.node.name===selected);if(item&&['camera','ultrasonic'].includes(item.id))dir=new T.Vector3(0,0,1).transformDirection(item.node.matrixWorld).add(new T.Vector3(0,.18,.2));
  if(item&&['display','health','controller','imu'].includes(item.id))dir=new T.Vector3(0,1,0).transformDirection(item.node.matrixWorld).add(new T.Vector3(-.15,.18,.12));
  if(item&&['servo','wheel'].includes(item.id))dir=new T.Vector3(0,0,1).transformDirection(item.node.matrixWorld).add(new T.Vector3(-.2,.35,.12));
  const radius=size.length()/2,distance=Math.max(.07,radius/Math.sin(32*Math.PI/360)*1.08*Math.max(1,1/aspect));return {eye:target.clone().addScaledVector(dir.normalize(),distance),target};
 }
 return {apply,box,shot,offsets};
}
