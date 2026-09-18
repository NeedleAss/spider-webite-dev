import * as T from 'three';
export function lightProduct(scene,renderer){
 scene.add(new T.HemisphereLight('#eaf1fb','#22252b',.68));
 for(const [color,power,pos] of [['#fff4e7',3.4,[-.6,1,.6]],['#ccdfff',2.1,[.6,.5,-.5]],['#ffffff',.65,[-.7,.15,-.4]]]){const l=new T.DirectionalLight(color,power);l.position.fromArray(pos);scene.add(l);}
 const env=new T.Scene();env.background=new T.Color('#14171d');
 for(const [pos,size,power] of [[[-2,3,2],[1.8,3.4,.08],5],[[2,1,-1],[.14,3,2],6],[[0,4,0],[3,.08,2],2]]){
  const card=new T.Mesh(new T.BoxGeometry(...size),new T.MeshBasicMaterial({color:new T.Color(power,power,power)}));card.position.fromArray(pos);env.add(card);
 }
 const pmrem=new T.PMREMGenerator(renderer),target=pmrem.fromScene(env,.015);scene.environment=target.texture;scene.environmentIntensity=.34;pmrem.dispose();env.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
 return {dispose:()=>target.dispose()};
}
