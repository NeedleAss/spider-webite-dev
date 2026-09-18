// Isolated browser fixture. No robot connection is made.
(() => {
  const f=window.v6Fixture={messages:[],mode:'IDLE',estop:false,owned:false,occupied:false,robot:true,seq:0,silent:false,stream:'http://127.0.0.1:8767/stream?scenario=live',action:null};
  class Socket {
    static CONNECTING=0;static OPEN=1;static CLOSED=3;readyState=0;bufferedAmount=0;
    constructor(){window.v6Socket=this;setTimeout(()=>{this.readyState=1;this.onopen?.();this.timer=setInterval(()=>this.telemetry(),80);},10);}
    emit(msg){this.onmessage?.({data:JSON.stringify({ts:Date.now(),...msg})});}
    send(raw){const m=JSON.parse(raw);f.messages.push(m);
      if(m.type==='ping')this.emit({type:'pong',id:m.id});
      if(m.type==='set_mode'){f.mode=m.mode;f.owned=['MANUAL','PERSON_FOLLOW'].includes(m.mode);f.occupied=f.owned;this.emit({type:'ack',ok:true,request_type:m.type,request_id:m.request_id});}
      if(m.type==='cmd_vel'){if(m.release_only&&!f.owned)return;if(m.vx||m.vy||m.wz){f.owned=f.occupied=true;}else{f.owned=f.occupied=false;if(['GESTURE_CONTROL','PERSON_FOLLOW'].includes(f.mode))f.mode='IDLE';}}
      if(m.type==='estop')f.estop=true;
      if(m.type==='clear_estop'){f.estop=false;f.mode='IDLE';f.owned=f.occupied=false;this.emit({type:'ack',ok:true,request_type:m.type,request_id:m.request_id});}
    }
    telemetry(){if(f.silent||this.readyState!==1)return;++f.seq;this.emit({type:'telemetry',connection:{camera:true,main_mcu:true,simulated:true},
      ...(f.robot?{robot:{mode:f.mode,estop:f.estop,state:'READY',vx:0,vy:0,wz:0,control_owned:f.owned,control_occupied:f.occupied,control_allowed:!f.occupied||f.owned,motion_output_installed:false}}:{}),
      device:{scoped_release:true,backend:'tracking',firmware:'V6-BROWSER-FIXTURE'},video:{stream_url:f.stream},
      ...(f.action?{gesture_action:f.action}:{}),
      imu:{valid:true,calibrated:true,yaw_deg:0,pitch_deg:0,roll_deg:0},health:{state:'VALID',hr_bpm:72,spo2_pct:98,finger_detected:true,sqi:.9},vision:{image_width:320,image_height:240,person:{found:true,x:90,y:35,w:110,h:180,confidence:.9,seq:f.seq,age_ms:0},gesture:{label:'TWO',confidence:.95,stable:true,age_ms:0}}});}
    close(){clearInterval(this.timer);this.readyState=3;this.onclose?.();}
  }window.WebSocket=Socket;
})();
