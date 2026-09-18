// Shared, deterministic film time. Metres throughout; no command transport.
import {clamp,ease,mix,wheelAngles} from './timeline.js';
export const DURATION=150;
export const TABLE_Y=.740,ROBOT_Y=.7612;
export const scenes=[
  {id:'meet',start:0,end:7,kicker:'SENSE. MOVE. CARE.',title:'让感知，\n成为行动。',body:'认识 CareRover。\n一台把感知、运动与关怀连在一起的小机器人。',note:'CAD 装配与实物参考外观 · 产品原理动画'},
  {id:'inside',start:7,end:20,kicker:'01 / BEAUTIFULLY CONNECTED',title:'小小机身，\n各有分工。',body:'感知、判断、驱动。\n打开之后，每一层都有自己的任务。',note:'目标装配 · 示意线束在拆解时断开，不代表实际接线'},
  {id:'senses',start:20,end:29,kicker:'02 / TWO WAYS TO SENSE',title:'看见位置。\n听见距离。',body:'镜头捕捉线索。\n双探头，让前方的回声有了意义。',note:'视域与声波为原理示意，非标定波束'},
  {id:'scale',start:29,end:40,kicker:'03 / MADE FOR THE DESK',title:'刚刚好的小。',body:'从器件的细节，回到日常的尺度。\n它的世界，就在桌面上。',note:'机器人、桌面与成人采用一致米制尺度'},
  {id:'motion',start:40,end:60,kicker:'04 / MOVE YOUR WAY',title:'怎么转，\n都有范。',body:'前后、左右、原地旋转。\n横着走，也不必先转身。',note:'两组正交全向轮对 · 编排轨迹，无实测轮速'},
  {id:'gesture',start:60,end:82,kicker:'05 / A GESTURE IS ENOUGH',title:'一个手势，\n心领神会。',body:'看见，确认，再回应。\n不用先打开网页，直接比给它看。',note:'动作仍受标定、数据有效性和安全条件约束'},
  {id:'follow',start:82,end:98,kicker:'06 / FOLLOW WITH CARE',title:'跟得上。\n也停得住。',body:'位置有效，先朝向再移动。\n目标不可用，就停下来等待。',note:'人脸位置跟随 · 不识别身份，不自动搜人'},
  {id:'range',start:98,end:112,kicker:'07 / BEFORE THE NEXT MOVE',title:'先有判断，\n再向前。',body:'回声返回，距离有据。\n遇到前方障碍，先停下。',note:'单前向探头 · 没有侧后方或桌沿检测'},
  {id:'care',start:112,end:130,kicker:'08 / A LITTLE CARE',title:'轻轻一触，\n状态可见。',body:'手指接触，开始采集。\n转向顶部屏幕，看见这一次回应。',note:'72 BPM / 98% 为模拟值 · 测量时间压缩 · 非医疗设备'},
  {id:'console',start:130,end:143,kicker:'09 / YOUR CONTROL CENTER',title:'看得清。\n控得稳。',body:'实时视野、手动操作与设备状态。\n在一个清楚的界面里，各就其位。',note:'生产控制台的模拟会话 · 未连接或控制实物'},
  {id:'whole',start:143,end:150,kicker:'CAREROVER',title:'现在，\n交给现场。',body:'从一张设计，到一台机器人。\n从这里，开始我们的演示。',note:'实体动作以现场验收为准'},
];
const vectorMix=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
const ramp=(t,a,b)=>ease((t-a)/(b-a));
const key=(t,eye,target)=>({t,eye,target});
export const cameras=[
  key(0,[-.36,.92,.15],[0,.81,0]),key(7,[-.34,.90,.13],[0,.81,0]),
  key(12,[-.48,1.10,.32],[0,.88,0]),key(19,[-.48,1.10,.32],[0,.88,0]),
  key(22,[-.25,.88,.13],[-.094,.813,0]),key(24,[-.25,.88,.13],[-.094,.813,0]),
  key(26,[-.23,.915,.12],[-.108,.854,0]),key(28,[-.23,.915,.12],[-.108,.854,0]),
  key(29,[-.48,1.07,.24],[0,.83,0]),key(31,[-.48,1.07,.24],[0,.83,0]),key(39,[-.30,1.38,1.80],[-.28,.88,0]),
  key(60,[-.30,1.38,1.80],[-.28,.88,0]),key(64,[.04,1.32,1.60],[-.27,.96,.06]),
  key(81,[.04,1.32,1.60],[-.27,.96,.06]),key(85,[-.22,1.26,1.20],[-.28,.89,0]),
  key(97,[-.22,1.26,1.20],[-.28,.89,0]),key(101,[-.25,1.15,.79],[-.16,.79,0]),
  key(109,[-.25,1.15,.79],[-.16,.79,0]),key(114,[-.20,1.02,.40],[-.04,.823,.04]),
  key(119,[-.20,1.02,.40],[-.04,.823,.04]),key(123,[-.105,1.01,.07],[0,.873,0]),
  key(127,[-.105,1.01,.07],[0,.873,0]),key(130,[-.30,1.38,1.80],[-.28,.88,0]),
  key(143,[-.30,1.38,1.80],[-.28,.88,0]),key(146,[-.36,.92,.15],[0,.81,0]),
  key(150,[-.36,.92,.15],[0,.81,0]),
];
export function shotAt(t){let i=0;while(i<cameras.length-2&&t>cameras[i+1].t)i++;const a=cameras[i],b=cameras[i+1],u=ramp(t,a.t,b.t);return {eye:vectorMix(a.eye,b.eye,u),target:vectorMix(a.target,b.target,u)};}
export function independentMotion(t) {
  const s=clamp(t,0,20);let forward=0,right=0,clockwise=0,label='停稳',phase=5;
  if(s<4){forward=.09*ramp(s,0,4);label='向前';phase=0;}
  else if(s<8){forward=.09*(1-ramp(s,4,8));label='向后';phase=1;}
  else if(s<11){right=.09*ramp(s,8,11);label='向右横移';phase=2;}
  else if(s<14){right=.09*(1-ramp(s,11,14));label='向左横移';phase=3;}
  else if(s<19){clockwise=2*Math.PI*ramp(s,14,19);label='原地 360°';phase=4;}
  else clockwise=2*Math.PI;
  return {forward,right,clockwise,label,phase,position:[-forward||0,ROBOT_Y,-right||0],yaw:-clockwise,wheels:wheelAngles(forward,right,clockwise)};
}
export function careEvent(t) {
  const contact=t>=115&&t<127;
  return {contact,approach:ramp(t,112.5,115)*(1-ramp(t,127,129)),phase:t<115?'approach':t<118?'acquiring':t<122?'measuring':t<127?'result':'released',
    hr:contact&&t>=122?72:null,spo2:contact&&t>=122?98:null,simulated:true,timeCompressed:true};
}
export function gestureEvent(t) {
  if(t<60||t>=82)return {label:'NONE',accepted:false,hand:0};
  const hand=ramp(t,60,62)*(1-ramp(t,80,82));
  if(t<70)return {label:'TWO',accepted:t>=64,hand,stage:t<64?'confirming':'turning'};
  if(t<73)return {label:'DISLIKE',accepted:t>=71,hand,stage:t<71?'confirming':'stopped'};
  if(t<76)return {label:'NONE',accepted:false,hand,stage:'released'};
  return {label:'LIKE',accepted:t>=79,hand,stage:t<79?'confirming':'following'};
}
export function evaluate(time,{aspect=16/9,reduced=false}={}) {
  const t=clamp(Number.isFinite(time)?time:0,0,DURATION);
  const index=Math.max(0,scenes.findIndex(s=>t<s.end)),chapter=t===DURATION?scenes.length-1:index,s=scenes[chapter];
  const progress=clamp((t-s.start)/(s.end-s.start));
  let open=ramp(t,7,13)*(1-ramp(t,28,31)),focus=null,focusAmount=0;
  if(t>=20&&t<25){focus='camera';focusAmount=1;}
  if(t>=25&&t<29){focus='ultrasonic';focusAmount=1;}
  let pose={position:[0,ROBOT_Y,0],yaw:0,wheels:wheelAngles(0,0,0),label:'就绪'};
  if(t>=40&&t<=60)pose=independentMotion(t-40);
  if(t>=60&&t<82){const turn=2*Math.PI*ramp(t,64,70);pose.yaw=-turn;pose.wheels=wheelAngles(0,0,turn);}
  if(t>=82&&t<98){const turn=2*Math.PI,travel=.08*ramp(t,86,93);pose.position[0]=-travel;pose.yaw=-turn;pose.wheels=wheelAngles(travel,0,turn);pose.label=t<86?'先朝向':t<93?'跟随':'目标不可用 · 停止等待';}
  if(t>=98&&t<112){const travel=.08*(1-ramp(t,98,100))+.055*ramp(t,101,105)*(1-ramp(t,109,112));pose.position[0]=-travel;pose.wheels=wheelAngles(travel,0,0);pose.label=t<105?'靠近前方障碍':'前方受阻 · 停止';}
  const camera=shotAt(t),room=ramp(t,30,39)*(1-ramp(t,143,146));
  // Portrait composition changes the camera, never the robot/person scale.
  if(aspect<.85){const target=camera.target;camera.eye=target.map((v,i)=>v+(camera.eye[i]-v)*1.35);}
  const care=careEvent(t),gesture=gestureEvent(t);
  const oled=t>=112&&t<130?{line1:'DEMO / SIMULATED',line2:care.hr?'72 BPM  98%':care.contact?'ACQUIRING':'NO FINGER',line3:care.contact?'CONTACT':'READY'}:
    t>=60&&t<82?{line1:'GESTURE',line2:gesture.label,line3:gesture.accepted?'ACCEPTED':'CONFIRMING'}:
    {line1:'CARE ROVER',line2:t>=40&&t<60?'MOVE':t>=82&&t<98?(t<93?'FOLLOW':'WAIT'):'READY',line3:'PRODUCT DEMO'};
  return {t,index:chapter,chapter:s.id,progress,...camera,open,focus,focusAmount,room,pose,care,gesture,oled,
    person:{visible:room>.01,headAway:ramp(t,92,95)*(1-ramp(t,98,101)),reach:care.approach},
    cup:ramp(t,98,100)*(1-ramp(t,110,112)),sonar:t>=100&&t<110,console:t>=130&&t<143,
    copy:s,reduced};
}
export class Director {
  constructor(){this.mode='scroll';this.time=0;this.playing=false;this.hold=DURATION;this.last=null;}
  seek(t){this.time=clamp(t,0,DURATION);this.last=null;return this.time;}
  setMode(mode){if(!['scroll','deck','film'].includes(mode))throw Error('Invalid director mode');this.mode=mode;this.playing=false;this.last=null;}
  play(){if(this.mode==='scroll')return;this.playing=true;this.last=null;}
  pause(){this.playing=false;this.last=null;}
  chapter(i){const s=scenes[clamp(i,0,scenes.length-1)];this.seek(s.start);this.hold=s.end;this.playing=this.mode==='deck';}
  tick(now){if(this.last!==null&&this.playing){this.time=Math.min(this.mode==='deck'?this.hold:DURATION,this.time+Math.max(0,now-this.last));if(this.time>=(this.mode==='deck'?this.hold:DURATION))this.playing=false;}this.last=now;return this.time;}
}
