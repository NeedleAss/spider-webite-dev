import * as T from 'three';
import {sonarCycle, clamp} from '../story/timeline.js';
const accent=0x83dce9;
function line(points,opacity=.35,color=accent) {
  return new T.Line(new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p))),new T.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));
}
function plane(w,h,opacity=.1,color=accent){return new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color,transparent:true,opacity,side:T.DoubleSide,depthWrite:false}));}
export const sensorDefinitions={
  camera:{position:[-.011,0,.0213],forward:[0,0,1],up:[-1,0,0],status:'surface of authored lens; illustrative FOV'},
  ultrasonic:{position:[0,0,.0133],forward:[0,0,1],up:[0,1,0],status:'module-level axis; TX/RX and beam angle uncalibrated'},
};
export function makeCareEffect(instance) {
  const content=new T.Group();content.name='illustrative-finger-contact';instance.add(content);
  const finger=new T.Group();finger.position.set(0,.012,.012);content.add(finger);
  const skin=new T.MeshStandardMaterial({color:0xb7a999,roughness:.72});
  const body=new T.Mesh(new T.CapsuleGeometry(.004,.022,6,20),skin);body.rotation.x=Math.PI/2;finger.add(body);
  const nail=new T.Mesh(new T.SphereGeometry(1,18,10),new T.MeshStandardMaterial({color:0xd9c7b8,roughness:.43}));nail.scale.set(.0028,.0006,.0038);nail.position.set(0,.0037,-.008);finger.add(nail);
  for(const z of [.002,.006]){const crease=new T.Mesh(new T.TorusGeometry(.0039,.00009,4,18,Math.PI*.6),new T.MeshStandardMaterial({color:0x938679,roughness:.85}));crease.rotation.x=Math.PI/2;crease.rotation.z=.6;crease.position.z=z;finger.add(crease);}
  const contact=new T.Mesh(new T.RingGeometry(.0048,.0051,48),new T.MeshBasicMaterial({color:accent,transparent:true,opacity:.5,side:T.DoubleSide,depthWrite:false}));
  contact.rotation.x=-Math.PI/2;contact.position.set(0,.0037,0);content.add(contact);content.visible=false;
  return {content,update(time,enabled){content.visible=enabled;if(!enabled)return;const phase=time%7,approach=clamp(phase/1.5),exit=clamp((7-phase)/1.4);finger.position.y=.008+(1-Math.min(approach,exit))*.023;contact.visible=phase>1.5&&phase<5.6;contact.material.opacity=.35+.15*Math.sin(time*3);}};
}
export function makeSensorEffect(kind,instance) {
  const d=sensorDefinitions[kind], anchor=new T.Group();anchor.name=`${instance.name}-sensor-anchor`;
  anchor.position.fromArray(d.position);if(kind==='camera')anchor.rotation.z=Math.PI/2;
  instance.add(anchor);
  const content=new T.Group();anchor.add(content);content.visible=false;
  if(kind==='camera') {
    const z=.052,w=.020,h=.022;
    const corners=[[-w,-h,z],[w,-h,z],[w,h,z],[-w,h,z]];
    for(const p of corners)content.add(line([[0,0,0],p],.16));
    content.add(line([...corners,corners[0]],.22));
    const glass=plane(w*2,h*2,.055);glass.position.z=z;content.add(glass);
    const person=new T.Group();person.position.z=z+.0003;content.add(person);
    const head=new T.Mesh(new T.CircleGeometry(.004,24),new T.MeshBasicMaterial({color:0xd9e8eb,transparent:true,opacity:.7,side:T.DoubleSide,depthWrite:false}));head.position.y=.006;person.add(head);
    const torso=new T.Mesh(new T.CircleGeometry(.008,24,0,Math.PI),head.material);torso.rotation.z=0;torso.scale.y=.9;torso.position.y=-.010;person.add(torso);
    const bracket=new T.Group();bracket.position.z=z+.0006;content.add(bracket);
    for(const [sx,sy] of [[-1,-1],[-1,1],[1,-1],[1,1]]) bracket.add(line([[sx*.010,sy*.011,0],[sx*.010,sy*.015,0],[sx*.006,sy*.015,0]],.85));
    const scan=line([[-.009,0,0],[.009,0,0]],.35);scan.position.z=z+.0007;content.add(scan);
    return {anchor,content,update(time,enabled){
      content.visible=enabled;if(!enabled)return;
      const t=Math.min(time,8), enter=clamp(t/.9), exit=clamp((7-t)/.9);
      person.position.x=(1-enter)*-.03+(1-exit)*.03;person.visible=t<7.8;
      head.material.opacity=.72*Math.min(enter,exit);bracket.visible=t>1&&t<6.6;
      bracket.position.x=person.position.x;scan.visible=t>1&&t<3;scan.position.y=.012-((t-1)/2)*.024;
    }};
  }
  const wave=new T.Mesh(new T.RingGeometry(.012,.0123,64),new T.MeshBasicMaterial({color:accent,transparent:true,opacity:.6,side:T.DoubleSide,depthWrite:false}));content.add(wave);
  const obstacle=plane(.052,.044,.16,0xbfc9d2);obstacle.position.z=.073;content.add(obstacle);
  content.add(line([[-.026,-.022,.073],[.026,-.022,.073],[.026,.022,.073],[-.026,.022,.073],[-.026,-.022,.073]],.32,0xbfc9d2));
  content.add(line([[0,0,0],[0,0,.073]],.1));
  return {anchor,content,update(time,enabled){content.visible=enabled;if(!enabled)return;const c=sonarCycle(time);wave.position.z=c.distance*.073;wave.scale.setScalar(.6+c.distance*.6);wave.material.opacity=c.returning?.45:.7;wave.material.color.set(c.returning?0xebf9ff:accent);}};
}
