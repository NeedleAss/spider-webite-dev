import {clamp,mix,wheelAngles} from '../story/timeline.js';
import {ease,openingAt,STRUCTURE_EYE,STRUCTURE_TARGET} from './structure.js';
export const DURATION=112,ROBOT_Y=0;
const ramp=(t,a,b)=>ease((t-a)/(b-a));
const scene=(id,start,end,kicker,title,body,note)=>({id,start,end,kicker,title,body,note});
export const scenes=[
 scene('meet',0,6,'SENSE. MOVE. CARE.','让感知，\n成为行动。','认识 CareRover。\n把感知、运动与关怀连在一起。','CAD 装配与实物参考外观 · 产品原理动画'),
 scene('inside',6,18,'DESIGNED FROM WITHIN','每一层，\n都有秩序。','打开机身。\n看见细节之间的联系。','装配关系示意 · 退出路径待实物安装核对'),
 scene('vision',18,28,'A DIFFERENT WAY TO SEE','看见。\n然后理解。','光掠过表面。\n让感知，有迹可循。','感知可视化 · 摄像头不发射可见激光'),
 scene('range',28,38,'EVERY RETURN TELLS A STORY','距离，\n有了回响。','一次发出。一次回应。\n在向前之前，知道距离。','声波原理示意 · 传播已放慢，非实测声束'),
 scene('motion',38,56,'MOVE YOUR WAY','怎么转，\n都有范。','前后、左右、原地旋转。\n横着走，也不必先转身。','两组正交全向轮对 · 编排轨迹，无实测轮速'),
 scene('gesture',56,70,'A GESTURE IS ENOUGH','一个手势，\n心领神会。','看见，确认，再回应。\n不用先打开网页，直接比给它看。','识别与执行流程模拟 · 动作受标定、数据和安全条件约束'),
 scene('follow',70,80,'FOLLOW WITH CARE','跟得上。\n也停得住。','位置有效，朝向再移动。\n目标不可用，就停下来等待。','位置跟随示意 · 不识别身份，不自动搜人'),
 scene('care',80,96,'A LITTLE CARE','轻轻一触，\n状态可见。','从接触，到采集。\n每一次回应，都清楚呈现。','72 BPM / 98% 为模拟值 · 测量时间压缩 · 非医疗设备'),
 scene('console',96,106,'YOUR CONTROL CENTER','看得清。\n控得稳。','实时视野、手动操作与设备状态。\n在一个清楚的界面里，各就其位。','生产操作台的模拟会话 · 未连接或控制实物'),
 scene('whole',106,112,'CAREROVER','现在，\n交给现场。','从一张设计，到一台机器人。\n从这里，开始我们的演示。','实体动作以现场验收为准'),
];
const key=(t,eye,target)=>({t,eye,target});
export const cameras=[
 key(0,[-.31,.195,.28],[0,.06,0]),key(5,[-.31,.195,.28],[0,.06,0]),
 key(7,STRUCTURE_EYE,STRUCTURE_TARGET),key(17,STRUCTURE_EYE,STRUCTURE_TARGET),
 key(18,[-.185,.136,.230],[-.092,.066,0]),key(27.9,[-.185,.136,.230],[-.092,.066,0]),
 key(28,[-.195,.158,.275],[-.098,.092,0]),key(35,[-.195,.158,.275],[-.098,.092,0]),key(37.9,[-.42,.30,.49],[-.055,.06,0]),
 key(38,[-.42,.30,.49],[-.025,.05,-.03]),key(56,[-.42,.30,.49],[-.025,.05,-.03]),
 key(70,[-.42,.30,.49],[-.025,.05,-.03]),key(80,[-.42,.30,.49],[-.025,.05,-.03]),
 key(82,[-.40,.34,.63],[-.10,.065,.025]),key(88,[-.40,.34,.63],[-.10,.065,.025]),
 key(91,[-.085,.265,.105],[0,.112,0]),key(94,[-.085,.265,.105],[0,.112,0]),
 key(96,[-.31,.195,.28],[0,.06,0]),key(112,[-.31,.195,.28],[0,.06,0])
];
export function shotAt(t){let i=0;while(i<cameras.length-2&&t>cameras[i+1].t)i++;const a=cameras[i],b=cameras[i+1],u=ramp(t,a.t,b.t);return {eye:a.eye.map((v,i)=>mix(v,b.eye[i],u)),target:a.target.map((v,i)=>mix(v,b.target[i],u))};}
export function independentMotion(t){
 let f=0,r=0,turn=0,label='停稳';
 if(t<3){f=.065*ramp(t,0,3);label='向前';}else if(t<6){f=.065*(1-ramp(t,3,6));label='向后';}
 else if(t<9){r=.065*ramp(t,6,9);label='向右横移';}else if(t<12){r=.065*(1-ramp(t,9,12));label='向左横移';}
 else {turn=2*Math.PI*ramp(t,12,17);label=t<17?'原地 360°':'停稳';}
 return {position:[-f||0,0,-r||0],yaw:-turn||0,wheels:wheelAngles(f,r,turn),label};
}
export function gestureEvent(t){
 if(t<56||t>=70)return {label:'NONE',accepted:false,stage:'idle'};
 if(t<63)return {label:'TWO',accepted:t>=58,stage:t<58?'confirming':'turning'};
 if(t<66)return {label:'DISLIKE',accepted:t>=64,stage:t<64?'confirming':'stopped'};
 if(t<67)return {label:'NONE',accepted:false,stage:'released'};
 return {label:'LIKE',accepted:t>=68.5,stage:t<68.5?'confirming':'following'};
}
export function careEvent(t){const contact=t>=83&&t<93;return {contact,approach:ramp(t,80,83)*(1-ramp(t,93,95)),phase:t<83?'approach':t<87?'acquiring':t<89?'measuring':t<93?'result':'released',hr:contact&&t>=89?72:null,spo2:contact&&t>=89?98:null,simulated:true,timeCompressed:true};}
export function evaluate(time,{aspect=16/9,reduced=false}={}){
 const t=clamp(Number.isFinite(time)?time:0,0,DURATION),index=t===DURATION?scenes.length-1:scenes.findIndex(s=>t<s.end),s=scenes[index];
 const open=openingAt(t-7);let pose={position:[0,0,0],yaw:0,wheels:wheelAngles(0,0,0),label:'就绪'};
 if(t>=38&&t<56)pose=independentMotion(t-38);
 if(t>=56&&t<70){const turn=2*Math.PI*ramp(t,58,63);pose.yaw=-turn;pose.wheels=wheelAngles(0,0,turn);}
 if(t>=70&&t<80){const travel=.065*ramp(t,72,77);pose.position[0]=-travel;pose.wheels=wheelAngles(travel,0,0);pose.label=t<72?'位置有效 · 先朝向':t<77?'跟随目标':'目标不可用 · 停止等待';}
 const camera=shotAt(t);if(aspect<1.4)camera.eye=camera.target.map((v,i)=>v+(camera.eye[i]-v)*1.4/aspect);
 const care=careEvent(t),gesture=gestureEvent(t);
 const oled=s.id==='care'?{line1:'DEMO / SIMULATED',line2:care.hr?'72 BPM  98%':care.contact?'ACQUIRING':'NO FINGER',line3:care.contact?'CONTACT':'READY'}:s.id==='gesture'?{line1:'GESTURE / DEMO',line2:gesture.label,line3:gesture.accepted?'ACCEPTED':'CONFIRMING'}:{line1:'CARE ROVER',line2:s.id==='motion'?'MOVE':s.id==='follow'?(t<77?'FOLLOW':'WAIT'):'READY',line3:'PRODUCT DEMO'};
 return {t,index,chapter:s.id,progress:clamp((t-s.start)/(s.end-s.start)),...camera,open,pose,care,gesture,oled,copy:s,reduced,console:s.id==='console',focus:s.id==='vision'?'camera':s.id==='range'&&t<35.3?'ultrasonic':null};
}
export class Director {
 constructor(){this.mode='scroll';this.time=0;this.playing=false;this.hold=DURATION;this.last=null;}
 seek(t){this.time=clamp(t,0,DURATION);this.last=null;return this.time;}
 setMode(mode){if(!['scroll','deck','film'].includes(mode))throw Error('Invalid director mode');this.mode=mode;this.pause();}
 play(){if(this.mode==='scroll')return;this.playing=true;this.last=null;}
 pause(){this.playing=false;this.last=null;}
 chapter(i){const s=scenes[clamp(i,0,scenes.length-1)];this.seek(s.start);this.hold=s.end;this.playing=this.mode==='deck';}
 tick(now){if(this.last!==null&&this.playing){const end=this.mode==='deck'?this.hold:DURATION;this.time=Math.min(end,this.time+Math.max(0,now-this.last));if(this.time>=end)this.playing=false;}this.last=now;return this.time;}
}
