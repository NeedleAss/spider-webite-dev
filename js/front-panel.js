import { demoBypass } from './protocol.js';

export function frontView(front, now = Date.now(), telemetryStale = false) {
  const age = (front?.age_ms ?? Infinity) + Math.max(0, now - (front?.receivedAt ?? 0));
  const valid = !telemetryStale && front?.enabled === true && front?.valid === true && age < 220 && Number.isFinite(front.distance_cm);
  return { valid, distance: valid ? `${Math.round(front.distance_cm)} cm` : '—',
    status: telemetryStale ? 'UNKNOWN' : !front?.enabled ? 'DISABLED' : !front.ready ? 'UNCONFIGURED' : !valid ? 'UNKNOWN' : front.status };
}
const labels = {
  boot:['启动待机','Boot idle'], mode_changed:['模式已切换','Mode changed'], release:['操作已释放','Controls released'],
  front_obstacle:['前方障碍停车','Stopped for front obstacle'], front_unknown:['测距失效停车','Stopped: range unavailable'],
  front_unconfigured:['测距尚未标定','Range calibration required'], bypass_timeout:['横移超时停车','Lateral motion timed out'],
  bypass_blocked:['绕行路径再次受阻','Bypass path blocked'], front_unstable:['近障读数不稳定','Unstable near readings'],
  target_reacquire_timeout:['未能重新确认目标','Target confirmation timed out'], target_lost:['目标丢失','Target lost'],
  person_timeout:['目标数据超时','Target data expired'], owner_watchdog:['控制者连接超时','Controller timed out'],
  watchdog:['运动指令超时','Motion command expired'], network_down:['网络断开','Network disconnected'],
  owner_disconnected:['控制者已断开','Controller disconnected'], estop:['紧急停止','Emergency stop'],
  estop_cleared:['已解除急停，保持待机','Emergency stop cleared; idle'], imu_invalid:['姿态数据异常','Invalid IMU'],
  tilt_fault:['倾斜保护停车','Tilt protection'], imu_timeout:['姿态数据超时','IMU data expired'],
  fault:['设备故障停车','Device fault'], camera_timeout:['摄像头数据超时','Camera data expired'],
  camera_resync:['摄像头重新同步','Camera resynchronizing'], bypass_disabled:['绕障已取消','Bypass cancelled'],
  bypass_pass_complete:['已越过障碍，停车确认目标','Passed obstacle; stopped to confirm target'],
  bypass_complete:['绕障已完成','Bypass complete'], mode_exit:['已退出运动模式','Motion mode exited'],
  demo_changed:['演示设置已更新','Demo setting updated'],
  DISABLED: ['未接入', 'Not installed'], UNCONFIGURED: ['待标定', 'Calibration required'],
  UNKNOWN: ['测距未知', 'Range unknown'], CLEAR: ['前方距离正常', 'Front range clear'],
  WARN: ['前方接近障碍', 'Obstacle ahead'], SLOW: ['前进已限速', 'Forward speed limited'],
  BLOCKED: ['前方受阻', 'Front blocked'], STOPPED: ['已停车 · 请先释放摇杆', 'Stopped · release joystick'],
  BYPASS: ['正在绕障', 'Bypassing'], NONE: ['未执行', 'Inactive'], HALT: ['停车确认', 'Stopping'],
  RIGHT: ['向右横移', 'Moving right'], MARGIN: ['车身让行余量', 'Body clearance margin'],
  PASS: ['直行越过', 'Passing forward'], REACQUIRE: ['重新确认人脸', 'Confirming face']
};
export function createFrontPanel({ state, send, tr, stale, signal }) {
  const el = id => document.getElementById(id); let pending = null;
  el('demoBypass').addEventListener('change', () => {
    const enabled=el('demoBypass').checked;
    if(send(demoBypass(enabled)))pending={enabled,at:Date.now()};
    el('demoBypass').checked=state.front?.demo_enabled===true;
  }, {signal});
  return () => {
    const f=state.front, view=frontView(f,Date.now(),stale());
    const label=key=>labels[key]?tr(...labels[key]):key;
    el('frontTitle').textContent=tr('前方障碍距离','Front obstacle distance');
    el('frontDistance').textContent=view.distance;
    el('frontStatus').textContent=label(view.status);
    el('frontStatus').dataset.tone=['WARN','SLOW','BLOCKED','STOPPED','UNKNOWN'].includes(view.status)?'warn':'normal';
    el('frontPhase').textContent=tr('绕障阶段：','Bypass: ')+label(f?.phase??'NONE');
    el('frontReason').textContent=f?.stop_reason?tr('停车记录：','Last stop: ')+label(f.stop_reason):'';
    el('demoBypassLabel').textContent=tr('演示绕障 · 固定向右','Demo bypass · right side');
    el('frontHint').textContent=tr('仅跟随模式；预留右侧及绕行后通道。单探头不探测侧后方。','Follow only. Keep the right side and exit path clear; sides and rear are not sensed.');
    if(pending&&(f?.demo_enabled===pending.enabled||Date.now()-pending.at>1500))pending=null;
    el('demoBypass').checked=f?.demo_enabled===true;
    el('demoBypass').disabled=!!pending||!view.valid||!f?.demo_ready||state.robot.mode!=='PERSON_FOLLOW'||state.robot.estop||state.ui.estopLatch||state.ui.replaying||state.robot.control_allowed===false;
  };
}
