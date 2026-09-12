import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTelemetry, demoBypass, validateOutgoing } from '../js/protocol.js';
import { frontView } from '../js/front-panel.js';
import { RobotSim } from '../js/sim.js';
import { FrontSim } from '../js/front-sim.js';
const cmd=(s,type,extra={})=>s.handleCommand({type,ts:Date.now(),...extra});
test('front protocol does not retain malformed/no-echo/stale ranges and validates demo commands',()=>{
  const base={enabled:true,ready:true,valid:true,distance_cm:25,age_ms:10,status:'SLOW'};
  for(const patch of [{valid:false},{distance_cm:null},{distance_cm:-1},{distance_cm:401},{age_ms:220},{age_ms:-1}]) {
    const f=normalizeTelemetry({front:{...base,...patch}}).front;assert.equal(f.valid,false);assert.equal(f.distance_cm,null);
  }
  const f={...normalizeTelemetry({front:base}).front,receivedAt:1000};
  assert.equal(frontView(f,1100).distance,'25 cm');assert.equal(frontView(f,1220).distance,'—');assert.equal(frontView(f,1000,true).status,'UNKNOWN');
  assert.equal(validateOutgoing(demoBypass(true)),null);assert.ok(validateOutgoing(demoBypass('true')));
});
test('manual stop latches until release and missing echo cancels movement',()=>{
  const s=new RobotSim();cmd(s,'set_mode',{mode:'MANUAL'});s.front.distance=15;
  cmd(s,'cmd_vel',{vx:1,vy:0,wz:0});s.step(.08);assert.equal(s.vel.vx,0);assert.equal(s.front.held,true);
  s.front.distance=120;s.step(.08);assert.equal(cmd(s,'cmd_vel',{vx:1,vy:0,wz:0})[0].code,'FRONT_RELEASE_REQUIRED');
  s.step(.08);s.step(.08);
  cmd(s,'cmd_vel',{vx:0,vy:0,wz:0});cmd(s,'cmd_vel',{vx:.5,vy:0,wz:0});s.step(.08);assert.ok(s.vel.vx>0);
  s.front.distance=null;s.step(.08);assert.equal(s.mode,'IDLE');assert.equal(s.vel.vx,0);
});
test('simulated demo visits every bypass phase then disables itself',()=>{
  const s=new RobotSim();cmd(s,'set_mode',{mode:'PERSON_FOLLOW'});cmd(s,'set_demo_bypass',{enabled:true});
  const phases=new Set();for(let i=0;i<160;i++){cmd(s,'ping',{id:i});s.step(.02);phases.add(s.front.phase);}
  for(const p of ['HALT','RIGHT','MARGIN','PASS','REACQUIRE','NONE'])assert.ok(phases.has(p),p);
  assert.equal(s.front.enabled,false);
});
test('bypass timeout, repeated obstruction and ESTOP cannot resume automatically',()=>{
  const f=new FrontSim();f.distance=18;f.setDemo(true,0);let result;
  for(let i=1;i<250;i++){result=f.step(i*.02,{vx:.1,vy:0,wz:0},true);if(result.abort)break;}
  assert.equal(result.abort,true);assert.equal(f.reason,'bypass_timeout');
  const s=new RobotSim();cmd(s,'set_mode',{mode:'PERSON_FOLLOW'});cmd(s,'set_demo_bypass',{enabled:true});
  for(let i=0;i<25;i++){cmd(s,'ping',{id:i});s.step(.02);}assert.equal(s.front.phase,'RIGHT');
  cmd(s,'estop');s.step(.02);assert.equal(s.front.phase,'NONE');assert.equal(s.vel.vy,0);cmd(s,'clear_estop');s.step(.02);assert.equal(s.mode,'IDLE');
});
