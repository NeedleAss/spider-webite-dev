import * as T from 'three';
import {GLTFLoader} from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import {ease} from './structure.js';
export async function loadInteraction(){
 const loader=new GLTFLoader();const [head,two,like]=await Promise.all(['head','two','like'].map(n=>loader.loadAsync(`assets/interaction/${n}.glb`)));
 function fit(object,height){const b=new T.Box3().setFromObject(object),size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3());object.position.sub(center);const wrapper=new T.Group();wrapper.add(object);wrapper.scale.setScalar(height/size.y);return wrapper;}
 const bust=fit(head.scene,.066);bust.rotation.y=Math.PI-.65;
 // Palm faces the viewer; hand longitudinal axis (+X) becomes screen-up (+Y).
 const gestures=new T.Group();gestures.name='Sculpted gesture hands';const models={};
 for(const [name,gltf] of [['TWO',two],['LIKE',like]]){const mesh=gltf.scene;mesh.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0,1,0),new T.Vector3(0,0,1),new T.Vector3(1,0,0)));mesh.updateMatrixWorld(true);const view=fit(mesh,.125);gestures.add(view);models[name]=view;}
 function update(t,label){gestures.visible=label!=='NONE';const start=label==='TWO'?56:label==='DISLIKE'?63:67,end=label==='TWO'?63:label==='DISLIKE'?66:70;gestures.scale.setScalar(ease((t-start)/.45)*(1-ease((t-(end-.35))/.35)));for(const [name,m] of Object.entries(models))m.visible=name===(label==='DISLIKE'?'LIKE':label);const current=models[label==='DISLIKE'?'LIKE':label];if(current){current.rotation.z=label==='TWO'?0:label==='DISLIKE'?Math.PI/2:-Math.PI/2;current.rotation.y=.15*Math.sin(Math.min(1,Math.max(0,(t-56)/2))*Math.PI);}}
 return {head:bust,gestures,update};
}
// A ceramic vessel has a rim, hollow inner wall, base and handle, not a flat target.
export function makeObstacle(){
 const group=new T.Group(),mat=new T.MeshStandardMaterial({color:'#b4bfc6',roughness:.34,metalness:.08,side:T.DoubleSide});
 const points=[[0,-.04],[.027,-.04],[.029,-.037],[.032,.034],[.031,.038],[.027,.038],[.026,.033],[.023,-.031],[0,-.031]].map(p=>new T.Vector2(...p));
 const body=new T.Mesh(new T.LatheGeometry(points,64),mat);group.add(body);
 const handle=new T.Mesh(new T.TorusGeometry(.019,.004,12,48),mat);handle.position.set(.029,-.001,0);handle.scale.set(.8,1.2,1);group.add(handle);
 group.rotation.y=-.35;return {group,body};
}
export function makeReveal(robot){
 const meshes=[];for(const item of robot.instances)item.appearance.traverse(n=>{if(n.isMesh){n.material=Array.isArray(n.material)?n.material.map(m=>m.clone()):n.material.clone();meshes.push({n,id:item.id,m:Array.isArray(n.material)?n.material:[n.material]});}});
 function apply(focus,amount){for(const {n,id,m} of meshes){const opacity=focus&&id!==focus?1-.92*ease(amount):1;n.material=Array.isArray(n.material)?m:m[0];for(const material of m){material.opacity=opacity;if(material.transparent!==(opacity<1)){material.transparent=opacity<1;material.needsUpdate=true;}material.depthWrite=opacity>.5;}n.visible=true;} }
 return {apply,snapshot:()=>Object.fromEntries(meshes.map(({id,m})=>[id,m[0].opacity]))};
}
