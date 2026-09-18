import * as T from 'three';
import {GLTFLoader} from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
export async function loadHand(){
 const gltf=await new GLTFLoader().loadAsync('assets/hand/hand_demo.glb');
 const root=new T.Group();root.name='Baked-contact-hand';root.add(gltf.scene);
 const mixer=new T.AnimationMixer(gltf.scene);if(!gltf.animations.length)throw Error('Missing baked hand action');
 const action=mixer.clipAction(gltf.animations[0]);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const pad=gltf.scene.getObjectByName('IndexPad');if(!pad)throw Error('Missing authored index pad');
 function sample(seconds){action.reset().play();mixer.setTime(Math.max(0,Math.min(5,seconds)));root.updateMatrixWorld(true);}
 function place(node){root.position.copy(node.localToWorld(new T.Vector3(0,.0037,0)));root.quaternion.copy(node.getWorldQuaternion(new T.Quaternion()));}
 return {root,sample,place,pad:()=>pad.getWorldPosition(new T.Vector3()),seconds:gltf.animations[0].duration};
}
