import * as T from 'three';
// Subdivided box projected around an inset core; local, dependency-free rounded edges.
function roundedBox(w,h,d,r){
 const g=new T.BoxGeometry(w,h,d,8,8,8).toNonIndexed(),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i),c=v.clone().clamp(new T.Vector3(-w/2+r,-h/2+r,-d/2+r),new T.Vector3(w/2-r,h/2-r,d/2-r));v.sub(c).normalize().multiplyScalar(r).add(c);p.setXYZ(i,v.x,v.y,v.z);}
 g.computeVertexNormals();return g;
}
export function makeStudio(scene,renderer){
 const room=new T.Group();scene.add(room);
 const mat=(color,roughness=.6,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const wood=mat('#33251c',.77),metal=mat('#292c2e',.35,.6),cloth=mat('#3e4447',.85),wall=mat('#20242a',.95);
 function box(parent,size,pos,material,r=.01){const m=new T.Mesh(roundedBox(...size,Math.min(r,...size.map(v=>v/2))),material);m.position.fromArray(pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 const table=box(room,[1.22,.038,1.22],[-.02,.721,0],wood,.017);
 for(const x of [-.51,.47])for(const z of [-.49,.49])box(room,[.028,.70,.028],[x,.35,z],metal,.006);
 box(room,[.39,.07,.44],[-.76,.405,0],cloth,.045);box(room,[.065,.48,.43],[-.95,.69,0],cloth,.045);
 for(const x of [-.91,-.59])for(const z of [-.17,.17])box(room,[.027,.37,.027],[x,.185,z],metal,.006);
 box(room,[5,.03,5],[0,-.015,0],wall,.001);
 box(room,[5,3,.06],[0,1.5,-1.3],mat('#252930'),.01);
 const panel=box(room,[.6,1.65,.015],[.6,1.25,-1.25],mat('#252e34'),.01);panel.material.emissive.set('#667780');panel.material.emissiveIntensity=.22;
 const cup=new T.Group();cup.position.set(-.37,.740,.01);room.add(cup);
 const ceramic=mat('#b1b6b3',.22),inside=mat('#2e2924',.2);
 const body=new T.Mesh(new T.CylinderGeometry(.036,.028,.138,48,1,true),ceramic);body.position.y=.069;body.castShadow=true;body.receiveShadow=true;cup.add(body);
 const rim=new T.Mesh(new T.TorusGeometry(.034,.002,10,48),ceramic);rim.rotation.x=Math.PI/2;rim.position.y=.138;cup.add(rim);
 const coffee=new T.Mesh(new T.CircleGeometry(.032,48),inside);coffee.rotation.x=-Math.PI/2;coffee.position.y=.125;cup.add(coffee);
 const handle=new T.Mesh(new T.TorusGeometry(.032,.004,10,32),ceramic);handle.position.set(0,.078,-.044);handle.rotation.y=Math.PI/2;cup.add(handle);
 const shadow=new T.Mesh(new T.PlaneGeometry(1.6,1.6),new T.ShadowMaterial({color:0,opacity:.30}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.7401;scene.add(shadow);
 scene.add(new T.HemisphereLight('#cbd8e9','#27201a',1.45));
 const key=new T.DirectionalLight('#fff1df',3.4);key.position.set(-1.3,2.8,1.4);key.target.position.set(-.2,.75,0);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-1.2,right:1.2,top:1.2,bottom:-1.2,near:.1,far:6});key.shadow.normalBias=.0007;key.shadow.bias=-.0001;scene.add(key,key.target);
 const rimLight=new T.DirectionalLight('#b7d6ee',2);rimLight.position.set(.4,2,-1);scene.add(rimLight);
 const fill=new T.DirectionalLight('#ffffff',.6);fill.position.set(-2,1,-.5);scene.add(fill);
 function restoreEnvironment(){
 const env=new T.Scene();env.background=new T.Color('#242a33');
 for(const [p,s,power] of [[[-2,3,1],[2,3,2],6],[[1,2,-2],[1,4,2],3],[[0,4,0],[4,.1,4],3]]){const b=new T.Mesh(new T.BoxGeometry(...s),new T.MeshBasicMaterial({color:new T.Color(power,power,power)}));b.position.fromArray(p);env.add(b);}
 const pmrem=new T.PMREMGenerator(renderer),map=pmrem.fromScene(env,.025);scene.userData.environmentTarget?.dispose();scene.userData.environmentTarget=map;scene.environment=map.texture;scene.environmentIntensity=.5;pmrem.dispose();env.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
 restoreEnvironment();
 function update(state,inspect=false){room.visible=state.room>.01&&!inspect;cup.visible=state.room>.01;shadow.visible=!inspect&&!room.visible;}
 return {room,cup,table,update,restoreEnvironment};
}
