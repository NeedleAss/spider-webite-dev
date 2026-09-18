import * as T from 'three';
import {GLTFLoader} from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import {makeMaterials,createAppearance} from './appearance.js';
import {makeSensorEffect,makeCareEffect} from '../effects/sensors.js';
import {partOffset} from '../story/timeline.js';

const hiddenServoMatrix=[1,1.224646799147353e-16,1.04744440165294e-14,0,1.04744440165294e-14,1.224646799147353e-16,-1,0,-1.224646799147366e-16,1,1.22464679914734e-16,0,.005100000000000156,-.002999999999999997,-.01499999999999992,1];
export async function loadRobot() {
  const gltf=await new GLTFLoader().loadAsync('assets/cad/carerover.glb');
  const root=new T.Group();root.name='CareRover-target-assembly';
  const materials=makeMaterials(),instances=[],effects={};
  const nodes=[...gltf.scene.children];
  const fourth=nodes.find(n=>n.userData.partId==='servo').clone();fourth.name='servo-7';fourth.matrix.fromArray(hiddenServoMatrix);fourth.matrix.decompose(fourth.position,fourth.quaternion,fourth.scale);nodes.push(fourth);
  for(const source of nodes) {
    const id=source.userData.partId;
    const node=new T.Group();node.name=source.name;node.userData={partId:id,instanceId:source.name};
    node.position.copy(source.position);node.quaternion.copy(source.quaternion);node.scale.copy(source.scale);
    const original=source.isMesh?source:source.children.find(n=>n.isMesh);
    const appearance=createAppearance(id,original,materials);node.add(appearance);root.add(node);
    appearance.traverse(m=>{if(m.isMesh)m.userData={...m.userData,partId:id,instanceId:node.name};});
    const entry={id,node,appearance,rest:node.position.clone(),rotation:node.quaternion.clone()};instances.push(entry);
    if(id==='camera'||id==='ultrasonic')effects[id]=makeSensorEffect(id,node);
    if(id==='health')effects.health=makeCareEffect(node);
  }
  // Module-level illustrative bundles, not verified electrical pin connections.
  const cableRoot=new T.Group();root.add(cableRoot);let cableKey='';
  const cableRoutes=[
    {id:'display',end:[0,.105,-.010],bend:[.018,.097,-.018],length:.100,color:'#d9aa45'},
    {id:'camera',end:[-.022,.043,.011],bend:[.009,.046,.018],length:.080,color:'#9f6950'},
    {id:'ultrasonic',end:[-.034,.080,-.004],bend:[.014,.077,-.015],length:.095,color:'#4c91af'},
    {id:'imu',end:[-.008,.083,-.027],bend:[.017,.082,-.025],length:.068,color:'#5e946b'},
    {id:'health',end:[-.006,.066,.036],bend:[.018,.070,.027],length:.070,color:'#cfb454'},
    {id:'battery',end:[.005,.027,.016],bend:[.025,.044,.022],length:.080,color:'#ad414a'},
  ];
  const cableMaterials=new Map();
  for(const r of cableRoutes)cableMaterials.set(r.id,new T.MeshStandardMaterial({color:r.color,roughness:.66}));
  function cables(state) {
    const key=[state.open.toFixed(3),state.focus,state.focusAmount.toFixed(3)].join('/');if(key===cableKey)return;cableKey=key;
    for(const old of [...cableRoot.children]){old.geometry.dispose();cableRoot.remove(old);}
    for(const r of cableRoutes){
      const offset=partOffset(r.id,state),end=new T.Vector3(...r.end).add(new T.Vector3(...offset)),start=new T.Vector3(.024,.065,.006);
      // Finite slack: large exploded gaps deliberately omit the illustrative connection.
      if(start.distanceTo(end) > r.length*.85)continue;
      const mid=new T.Vector3(...r.bend).addScaledVector(new T.Vector3(...offset),.45);
      for(let k=0;k<2;k++){
        const delta=new T.Vector3(0,0,k*.0012);
        const curve=new T.CatmullRomCurve3([start.clone().add(delta),mid.clone().add(delta),end.clone().add(delta)]);
        const mesh=new T.Mesh(new T.TubeGeometry(curve,16,.00042,5,false),cableMaterials.get(r.id));cableRoot.add(mesh);
      }
    }
  }
  const dimMaterials=new Map();
  for(const item of instances)item.appearance.traverse(mesh=>{
    if(!mesh.isMesh)return;
    if(!dimMaterials.has(mesh.material)){const dim=mesh.material.clone();if(dim.color)dim.color.multiplyScalar(.28);dimMaterials.set(mesh.material,dim);}
    mesh.userData.originalMaterial=mesh.material;
  });
  let lastFocus='';
  function apply(state) {
    const dimKey=state.focus&&state.focusAmount>.75?state.focus:'';
    for(const item of instances){
      item.node.position.copy(item.rest).add(new T.Vector3(...partOffset(item.id,state)));
      item.node.quaternion.copy(item.rotation);
      // Clear the close-up rather than turning every solid into noisy overlapping transparency.
      item.node.visible=!(dimKey && dimKey!=='health' && item.id!==dimKey && !(dimKey==='display'&&item.id==='lid'));
      if(lastFocus!==dimKey)item.appearance.traverse(mesh=>{if(mesh.isMesh)mesh.material=dimKey&&item.id!==dimKey&&!(dimKey==='health'&&item.id==='display')?dimMaterials.get(mesh.userData.originalMaterial):mesh.userData.originalMaterial;});
    }
    lastFocus=dimKey;cables(state);cableRoot.visible=!dimKey;
    root.updateMatrixWorld(true);
  }
  function select(instanceId) {
    for(const item of instances)item.appearance.traverse(mesh=>{if(mesh.isMesh)mesh.material=instanceId&&instanceId!==item.node.name?dimMaterials.get(mesh.userData.originalMaterial):mesh.userData.originalMaterial;});
    lastFocus='__inspect__';
  }
  return {root,instances,effects,apply,select,materials,cableRoot};
}
