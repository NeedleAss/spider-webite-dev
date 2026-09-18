import test from 'node:test';
import assert from 'node:assert/strict';
import * as p from '../js/protocol.js';
import * as s from '../js/state.js';
import { CONFIG } from '../js/config.js';

test('independently invalidated HR/SpO2 explicitly clear old values', () => {
  const update=o=>s.applyTelemetry(p.decode(JSON.stringify({type:'telemetry',...o})).msg);
  update({health:{state:'VALID',finger_detected:true,hr_bpm:73,spo2_pct:98}});
  update({health:{state:'VALID',hr_bpm:74,spo2_pct:null}});
  assert.equal(s.getState().health.hr_bpm,74);
  assert.equal(s.getState().health.spo2_pct,null);
  update({health:{sqi:.9}}); assert.equal(s.getState().health.spo2_pct,null);
  update({health:{state:'NO_FINGER',finger_detected:false,hr_bpm:null,spo2_pct:null}});
  assert.equal(s.getState().health.hr_bpm,null);
});
test('wireless capabilities block non-owner input and reset on disconnect', () => {
  s.setConnectionState('connected'); s.markEstopLocal(false); s.setRequestedMode(null);
  s.applyTelemetry(p.decode(JSON.stringify({type:'telemetry',connection:{camera:true,main_mcu:true},robot:{mode:'MANUAL',state:'READY',estop:false,control_allowed:false,motion_output_installed:false},device:{firmware:'abc123',backend:'test_targets',stage:5}})).msg);
  assert.equal(s.isManualEnabled(),false);
  assert.equal(s.getState().device.firmware,'abc123');
  assert.equal(s.getState().robot.motion_output_installed,false);
  s.applyTelemetry({robot:{control_allowed:true}}); assert.equal(s.isManualEnabled(),true);
  s.resetForDisconnect(); assert.equal(s.getState().robot.control_allowed,undefined);
  assert.deepEqual(s.getState().device,{});
});
test('errors retain request correlation and sensor block freshness is independent', () => {
  const m=p.decode('{"type":"error","code":"UNSUPPORTED_MODE","request_type":"set_mode","request_id":42}').msg;
  assert.equal(m.request_type,'set_mode'); assert.equal(m.request_id,42);
  const state=s.getState(); state.connection.lastHealthTs=123; state.vision.lastGestureTs=456;
  s.applyTelemetry({robot:{mode:'IDLE',estop:false}});
  assert.equal(state.connection.lastHealthTs,123); assert.equal(state.vision.lastGestureTs,456);
  assert.equal(CONFIG.PPG_EXPECTED_RATE_HZ,25);
});

test('robot freshness cannot be renewed by health, IMU, vision or PPG traffic',()=>{
  s.resetForDisconnect();s.setConnectionState('connected');s.markEstopLocal(false);s.setRequestedMode(null);
  s.applyTelemetry({robot:{mode:'MANUAL',estop:false,control_allowed:true}});
  const state=s.getState(),then=Date.now()-CONFIG.TELEMETRY_STALE_MS-1;state.connection.lastRobotTs=then;
  for(const block of [{health:{sqi:.95}},{imu:{yaw_deg:0}},{vision:{gesture:{label:'LIKE'}}},{robot:{state:'READY'}}])s.applyTelemetry(block);
  s.appendPpgSamples([1,2,3],25,Date.now());
  assert.equal(s.isTelemetryStale(),false);assert.equal(s.isRobotStale(),true);assert.equal(s.isManualEnabled(),false);
  s.setRequestedMode('MANUAL');s.applyTelemetry({health:{sqi:.9}});assert.equal(state.ui.requestedMode,'MANUAL');
  s.applyTelemetry({robot:{mode:'MANUAL',estop:false}});assert.equal(s.isRobotStale(),false);assert.equal(state.ui.requestedMode,null);
  assert.equal(s.isRobotStale(state.connection.lastRobotTs-1),true);
});
test('scoped release and recognized-versus-accepted gesture events retain their meaning',()=>{
  assert.equal(p.validateOutgoing(p.releaseInput()),null);
  assert.ok(p.validateOutgoing({...p.releaseInput(),vx:.5}));assert.ok(p.validateOutgoing({...p.releaseInput(),release_only:'true'}));
  const raw={type:'telemetry',robot:{control_owned:false,control_occupied:false},device:{scoped_release:true},gesture_action:{seq:4,label:'TWO',accepted:false,reason:'CONTROL_BUSY',age_ms:300}};
  const msg=p.decode(JSON.stringify(raw)).msg;
  assert.equal(msg.gesture_action.accepted,false);assert.equal(msg.robot.control_owned,false);s.applyTelemetry(msg);
  const at=s.getState().gestureAction.sourceAt;s.applyTelemetry({...msg,gesture_action:{...msg.gesture_action,age_ms:0}});
  assert.equal(s.getState().gestureAction.sourceAt,at);
  raw.gesture_action.accepted='yes';assert.equal(p.decode(JSON.stringify(raw)).msg.gesture_action,undefined);
  s.resetForDisconnect();assert.equal(s.getState().gestureAction,null);
});
