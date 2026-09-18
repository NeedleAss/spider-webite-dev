import * as T from 'three';
import {ease,clamp} from './assembly.js';
function panel(w,h,r,depth,material){const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.0005,bevelSize:.0005,bevelSegments:3,steps:1,curveSegments:12});g.translate(0,0,-depth/2);return new T.Mesh(g,material);}
const line=(pts,color,opacity)=>new T.Line(new T.BufferGeometry().setFromPoints(pts.map(p=>new T.Vector3(...p))),new T.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));
export function makeScan(anchor){
 const root=new T.Group();anchor.add(root);
 const uniforms={scan:{value:.05},power:{value:0}};
 const material=new T.MeshStandardMaterial({color:'#77858c',metalness:.45,roughness:.43});
 material.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);s.vertexShader='varying vec3 scanWorld;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nscanWorld=(modelMatrix*vec4(transformed,1.)).xyz;');s.fragmentShader='varying vec3 scanWorld;uniform float scan;uniform float power;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nfloat band=exp(-pow((scanWorld.y-scan)/.0024,2.));totalEmissiveRadiance+=vec3(.21,.92,.69)*band*power*(.11+dot(diffuseColor.rgb,vec3(.333))*1.6);');};
 material.customProgramCacheKey=()=> 'v7-surface-scan';
 const target=new T.Group();target.position.z=.108;target.rotation.y=Math.PI*.75;root.add(target);
 const surface=panel(.066,.080,.004,.002,material);target.add(surface);const uv=surface.geometry.attributes.uv,pos=surface.geometry.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)/.066+.5,pos.getY(i)/.080+.5);uv.needsUpdate=true;
 // Authored image-plane portrait: fine contours and landmarks, not a miniature body.
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1280;const c=canvas.getContext('2d');
 c.fillStyle='#11191e';c.fillRect(0,0,1024,1280);
 const path=(draw,alpha=1,width=3)=>{c.beginPath();draw(c);c.strokeStyle=`rgba(173,199,208,${alpha})`;c.lineWidth=width;c.lineCap='round';c.stroke();};
 path(c=>{c.moveTo(320,480);c.bezierCurveTo(295,195,729,195,704,480);c.bezierCurveTo(712,640,627,780,512,836);c.bezierCurveTo(397,780,312,640,320,480);},.65,3);
 path(c=>{c.moveTo(358,464);c.quadraticCurveTo(411,430,458,463);c.moveTo(566,463);c.quadraticCurveTo(613,430,666,464);},.6,3);
 path(c=>{c.moveTo(363,497);c.quadraticCurveTo(410,477,454,498);c.quadraticCurveTo(410,524,363,497);c.moveTo(570,498);c.quadraticCurveTo(614,477,661,497);c.quadraticCurveTo(614,524,570,498);},.68,2);
 path(c=>{c.moveTo(510,487);c.bezierCurveTo(505,550,486,596,475,621);c.quadraticCurveTo(510,642,549,621);},.55,2);
 path(c=>{c.moveTo(438,693);c.quadraticCurveTo(475,675,512,688);c.quadraticCurveTo(549,675,586,693);c.quadraticCurveTo(512,724,438,693);},.5,2);
 for(let y=355;y<785;y+=32)for(let x=350;x<690;x+=32){const q=((x-512)/183)**2+((y-535)/273)**2;if(q<.89){c.fillStyle='rgba(148,186,198,.26)';c.beginPath();c.arc(x,y,1.4,0,Math.PI*2);c.fill();}}
 for(let y=384;y<770;y+=64)path(c=>{c.moveTo(375,y);c.quadraticCurveTo(512,y+20,649,y);},.075,1);
 c.strokeStyle='#273943';c.lineWidth=1;c.strokeRect(92,105,840,1070);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;material.map=texture;material.color.set('#ffffff');material.metalness=.24;material.roughness=.52;
 // Finely drawn contours keep the target legible when the scan falls away.
 const outline=line([[-.027,-.034,.002],[.027,-.034,.002],[.027,.034,.002]],'#65747b',.18);target.add(outline);
 const frame=new T.Group();target.add(frame);for(const sx of [-1,1])for(const sy of [-1,1])frame.add(line([[sx*.023,sy*.022,.008],[sx*.023,sy*.031,.008],[sx*.015,sy*.031,.008]],'#bcf7df',.9));
 const vertices=new Float32Array([-.003,0,.001,.003,0,.001,-.031,0,.110,.003,0,.001,.031,0,.110,-.031,0,.110]);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(vertices,3));
 const beam=new T.Mesh(geo,new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,uniforms:{alpha:{value:0}},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p;uniform float alpha;void main(){float edge=1.-smoothstep(.016,.033,abs(p.x));gl_FragColor=vec4(.33,.94,.70,alpha*edge*smoothstep(0.,.11,p.z));}'}));root.add(beam);
 function update(t){root.visible=true;const u=clamp((t-1.2)/4),active=t>=1.2&&t<5.2;const y=.034-.068*ease(u);const local=new T.Vector3(0,y,.11),world=anchor.localToWorld(local.clone());uniforms.scan.value=world.y;uniforms.power.value=active?Math.sin(Math.PI*u)*1.25:0;
  // A thin light sheet is driven by the same surface intersection as the scan.
  const a=geo.attributes.position;for(let i=0;i<a.count;i++){if(i===0||i===1||i===3)continue;const v=new T.Vector3(i===4?.031:-.031,y,.0016);target.updateMatrixWorld(true);target.localToWorld(v);anchor.worldToLocal(v);a.setXYZ(i,v.x,v.y,v.z);}a.needsUpdate=true;
  beam.material.uniforms.alpha.value=active?.09*Math.sin(Math.PI*u):0;frame.visible=t>=4.7&&t<8.5;frame.children.forEach(l=>l.material.opacity=.8*ease((t-4.7)/.7)*(1-ease((t-7.8)/.7)));
  return {phase:t<1.2?'目标进入视域':t<5.2?'表面扫描':t<7.8?'目标已识别':'扫描结束',scanActive:active,detected:frame.visible};
 }
 return {root,update,surface};
}
export function echoState(t,distance){
 const out=clamp((t-1.0)/2.6),back=clamp((t-4.1)/2.6);
 return {outgoing:t>=1&&t<3.6,hit:t>=3.6,returning:t>=4.1&&t<6.7,received:t>=6.7,distance,out,back,phase:t<1?'准备测距':t<3.6?'发出':t<4.1?'命中':t<6.7?'返回':'距离已确认'};
}
function waveRibbon(inner,start,length){
 const pos=[],uv=[],idx=[];const rows=8,cols=80;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const r=inner+(1-inner)*j/rows,a=start+length*i/cols;pos.push(r*Math.cos(a),r*Math.sin(a),.34*(1-r*r));uv.push(i/cols,j/rows);}
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;idx.push(a,b,a+1,a+1,b,b+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function makeEcho(anchor){
 const root=new T.Group();anchor.add(root);
 const wall=panel(.080,.071,.006,.006,new T.MeshStandardMaterial({color:'#838788',roughness:.30,metalness:.72}));wall.position.set(.008,0,.128);wall.rotation.y=Math.PI*.75;root.add(wall);root.updateMatrixWorld(true);
 const ray=new T.Raycaster(anchor.getWorldPosition(new T.Vector3()),new T.Vector3(0,0,1).transformDirection(anchor.matrixWorld));
 const hit=ray.intersectObject(wall,false)[0];if(!hit)throw Error('Sonar ray must hit visible obstacle');const point=anchor.worldToLocal(hit.point.clone());
 const glow=new T.Mesh(new T.PlaneGeometry(.041,.041),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{strength:{value:0}},vertexShader:'varying vec2 q;void main(){q=uv-.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 q;uniform float strength;void main(){float r=length(q);float a=exp(-r*r*24.)*.32+exp(-pow((r-.27)*35.,2.))*.5;gl_FragColor=vec4(.65,.87,1.,a*strength);}'}));glow.position.copy(point);glow.position.add(new T.Vector3(0,0,.0006).applyQuaternion(wall.quaternion));glow.rotation.copy(wall.rotation);root.add(glow);
 const planePoint=anchor.localToWorld(point.clone()),planeNormal=new T.Vector3(0,0,1).applyQuaternion(wall.getWorldQuaternion(new T.Quaternion()));
 const clipWave=m=>{m.onBeforeCompile=s=>{s.uniforms.obstaclePoint={value:planePoint};s.uniforms.obstacleNormal={value:planeNormal};s.vertexShader='varying vec3 waveWorld;varying vec2 waveUv;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nwaveWorld=(modelMatrix*vec4(transformed,1.)).xyz;waveUv=uv;');s.fragmentShader='varying vec3 waveWorld;varying vec2 waveUv;uniform vec3 obstaclePoint;uniform vec3 obstacleNormal;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(dot(waveWorld-obstaclePoint,obstacleNormal)<-.00005)discard;');s.fragmentShader=s.fragmentShader.replace('#include <alphamap_fragment>','#include <alphamap_fragment>\ndiffuseColor.a*=pow(max(0.,sin(waveUv.y*3.14159265)),.8)*max(0.,sin(waveUv.x*3.14159265));');};m.customProgramCacheKey=()=> 'v7-wave-obstacle-clip';return m;};
 const outgoing=[],returns=[];for(let i=0;i<3;i++){
  const g=waveRibbon(.72,-Math.PI*.83,Math.PI*1.66),m=new T.MeshBasicMaterial({color:'#92dbe7',transparent:true,depthWrite:false,side:T.DoubleSide});clipWave(m);const w=new T.Mesh(g,m);root.add(w);outgoing.push(w);
  const g2=waveRibbon(.84,Math.PI*.18,Math.PI*1.28),m2=m.clone();m2.color.set('#e8f0ff');clipWave(m2);const back=new T.Mesh(g2,m2);root.add(back);returns.push(back);
 }
 const path=line([[0,0,.001],point.toArray()],'#91bac8',.12);root.add(path);
 function update(t){root.visible=true;root.updateMatrixWorld(true);planePoint.copy(anchor.localToWorld(point.clone()));planeNormal.set(0,0,1).applyQuaternion(wall.getWorldQuaternion(new T.Quaternion()));const s=echoState(t,point.z);
  outgoing.forEach((m,i)=>{const u=(t-1-i*.19)/2.6;m.visible=u>=0&&u<=1;m.position.set(0,0,Math.min(1,u)*point.z);m.scale.setScalar(.012+clamp(u)*.019);m.material.opacity=.62*Math.sin(Math.PI*clamp(u))**.4;});
  returns.forEach((m,i)=>{const u=(t-4.1-i*.15)/2.6;m.visible=u>=0&&u<=1;m.position.copy(point).multiplyScalar(1-clamp(u));m.scale.setScalar(.005+clamp(u)*.014);m.rotation.z=.22*i;m.material.opacity=.78*Math.sin(Math.PI*clamp(u))**.6;});
  glow.material.uniforms.strength.value=ease((t-3.6)/.25)*(1-ease((t-4.8)/1.6));return s;
 }
 return {root,update,hit:point,wall};
}
