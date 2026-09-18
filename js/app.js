import { CONFIG, LINK } from './config.js';
import { createTransport } from './transport.js';
import * as protocol from './protocol.js';
import * as store from './state.js';
import { initLang, getLang, setLang, t } from './i18n.js';
import { MotionInput } from './joystick.js';
import { PpgChart } from './telemetry.js';
import { VideoPanel } from './video.js';
import { createFrontPanel } from './front-panel.js';
import { DebugPanel } from './debug.js';
import {stopStatus,ppgTimestamp} from './display-semantics.js';

const $ = id => document.getElementById(id);
const state = store.getState();
const lifecycle = new AbortController();
const sourceKind = new URLSearchParams(location.search).get('source');
let transport, controls, debug, video, chart;
let pendingMode = null, pendingClear = null, pong = null, replay = null;
let raf, lastPaint = 0, frames = 0, fps = 0, frameEpoch = performance.now(), lastUi = 0;
let zeroRepeats = 0, lastCommand = 0, previousEnabled = false, previousLink = LINK.DISCONNECTED;
let wasStale = true, destroyed = false;
let liveEstopLatch = false;
let liveVideoSource = 'none';
let estopDelivery='none', replayViewTs=null;
let inputActive=false,legacySessionClaim=false;
const timers = [];
const text = (id, value) => { const el = $(id); const str = String(value); if (el.textContent !== str) el.textContent = str; };
const tr = (zh, en) => getLang() === 'zh' ? zh : en;
const activeEstop = () => state.ui.estopLatch || state.robot.estop || state.robot.mode === 'ESTOP';
const renderFront = createFrontPanel({state,send:message=>send(message),tr,stale:()=>store.isRobotStale(),signal:lifecycle.signal});
const confirmedModeLabel=()=>store.isRobotStale()?tr('等待设备','Waiting for device'):t(`mode.${state.robot.mode}`);
const manual = () => store.isManualEnabled() && !$('confirmDlg').open && !document.hidden;
const value = (v, decimals = 0, suffix = '') => Number.isFinite(v) ? v.toFixed(decimals) + suffix : '—';
const signed = v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
function toast(message, tone = '') {
  const el = document.createElement('div'); el.className = `toast toast--${tone}`; el.textContent = message;
  $('toasts').append(el); while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  setTimeout(() => el.remove(), 3200);
}
function send(message) {
  if (state.ui.replaying || !transport?.isOpen) return false;
  const invalid = protocol.validateOutgoing(message);
  if (invalid) { debug.log('err', invalid); return false; }
  if (message.type === 'cmd_vel' && (message.vx || message.vy || message.wz) && !manual()) return false;
  if (activeEstop() && message.type === 'set_mode') return false;
  if (!transport.send(message)) return false;
  if(message.type==='cmd_vel'&&(message.vx||message.vy||message.wz))inputActive=true;
  store.countTx();
  if (message.type !== 'ping' && (message.type !== 'cmd_vel' || Date.now() - lastCommand > 500)) {
    debug.log('tx', JSON.stringify(message)); lastCommand = Date.now();
  }
  return true;
}
function stop() { controls?.reset(true); }
function releaseOwnInput() {
  const owned=state.robot.control_owned===true || state.robot.control_owned===undefined&&legacySessionClaim;
  if(!inputActive&&!owned)return;
  const scoped=state.device.scoped_release===true;
  send(scoped?protocol.releaseInput():protocol.cmdVel(0,0,0));
  zeroRepeats=scoped?CONFIG.CMD_VEL_ZERO_REPEAT:0;
  inputActive=false;legacySessionClaim=false;
}
function ordinaryStop() {zeroRepeats=0;send(protocol.cmdVel(0,0,0));inputActive=false;legacySessionClaim=false;}
function emergency() {
  if (state.ui.replaying) { toast(tr('回放中，未向机器人发送指令', 'Replay: no commands sent')); return; }
  pendingMode = null; pendingClear = null; store.setRequestedMode(null);
  store.markEstopLocal(true); stop(); estopDelivery=send(protocol.estop())?'sent':'failed';
  $('confirmDlg').close(); toast(estopDelivery==='sent'?tr('本地控制已锁定 · 等待设备确认', 'Local controls locked · awaiting device confirmation'):tr('本地控制已锁定 · 急停未送达设备', 'Local controls locked · stop not delivered'), 'bad'); render();
}
function changeMode(mode) {
  if (activeEstop() || state.ui.replaying || store.isRobotStale() || pendingMode) return;
  stop(); zeroRepeats = 0; previousEnabled = false; const command = protocol.setMode(mode);
  store.setRequestedMode(mode);
  pendingMode = { command, expires: Date.now() + CONFIG.MODE_ACK_TIMEOUT_MS };
  if (!send(command)) { pendingMode = null; store.setRequestedMode(null); }
  render();
}
function requestClear() {
  if (!activeEstop() || !transport.isOpen || state.ui.replaying || pendingClear) return;
  stop(); text('confirmTitle', t('safety.clear.title')); text('confirmMsg', t('safety.clear.msg'));
  $('confirmDlg').showModal();
}
function confirmClear() {
  $('confirmDlg').close();
  if (!transport.isOpen || state.ui.replaying) return;
  const command = protocol.clearEstop();
  pendingClear = { command, ack: false, expires: Date.now() + CONFIG.MODE_ACK_TIMEOUT_MS };
  if (!send(command)) pendingClear = null;
}
function receive(raw, isReplay = false, receivedTs=Date.now()) {
  const decoded = protocol.decode(raw);
  if (!decoded.ok) { debug.log('err', decoded.error); return; }
  const msg = decoded.msg; store.countRx(); if (!isReplay) debug.message(raw);
  switch (msg.type) {
    case 'telemetry':
      store.applyTelemetry(msg);
      if (msg.video?.stream_url) video?.setStreamUrl(msg.video.stream_url);
      if (pendingMode && msg.robot?.mode === pendingMode.command.mode && msg.robot.estop === false) {
        legacySessionClaim=['MANUAL','PERSON_FOLLOW'].includes(msg.robot.mode)&&msg.robot.control_allowed!==false;
        toast(t('t.mode.ok', { mode: t(`mode.${msg.robot.mode}`) })); pendingMode = null;
      }
      if (pendingClear?.ack && msg.robot?.estop === false && msg.robot.mode === 'IDLE') {
        store.markEstopLocal(false); estopDelivery='none';pendingClear = null; toast(t('t.estop.clear'), 'ok');
      }
      if (!manual() && previousEnabled) stop();
      break;
    case 'ppg_batch': case 'ppg': {
      const stamp=ppgTimestamp(msg.sourceTs,receivedTs,isReplay&&replay?replay.wallStart-replay.first:0);
      // A backwards source clock starts a new segment; never draw a line backwards through history.
      if(stamp.time<state.ppg.lastTs)state.ppg.ring.clear();
      store.appendPpgSamples(msg.type==='ppg_batch'?msg.samples:[msg.value],msg.sample_rate_hz||state.ppg.sampleRateHz,stamp.time);
      state.ppg.receivedTs=stamp.receivedTs;state.ppg.sourceTs=stamp.sourceTs;state.ppg.timeBasis=stamp.basis;
      break;
    }
    case 'pong':
      if (pong?.id === msg.id) { store.setLatency(performance.now() - pong.at); pong = null; }
      break;
    case 'ack':
      if(msg.request_type==='estop'&&!msg.ok)estopDelivery='failed';
      if (msg.request_type === 'set_mode' && pendingMode && (msg.request_id === undefined || msg.request_id === pendingMode.command.request_id) && !msg.ok) {
        pendingMode = null; store.setRequestedMode(null); toast(t('t.mode.fail'), 'warn');
      }
      if (msg.request_type === 'clear_estop' && pendingClear && (msg.request_id === undefined || msg.request_id === pendingClear.command.request_id)) {
        if (msg.ok) pendingClear.ack = true;
        else { pendingClear = null; toast(tr('机器人拒绝解除急停', 'Robot refused to clear emergency stop'), 'warn'); }
      }
      debug.log('rx', JSON.stringify(msg)); break;
    case 'error':
      if(msg.request_type==='estop')estopDelivery='failed';
      if (pendingMode && msg.request_type === 'set_mode' && msg.request_id === pendingMode.command.request_id) { pendingMode = null; store.setRequestedMode(null); }
      if (pendingClear && msg.request_type === 'clear_estop' && msg.request_id === pendingClear.command.request_id) pendingClear = null;
      if (msg.code === 'ESTOP_ACTIVE') { store.markEstopLocal(true); stop(); }
      toast(msg.message || msg.code, 'warn'); debug.log('err', `${msg.code}: ${msg.message}`); break;
  }
}
let lastPingAt = -Infinity;
function pingServer() {
  if (!pong) { lastPingAt = performance.now(); const id = Date.now(); pong = { id, at: performance.now() }; send(protocol.ping(id)); }
}
function linkChanged(link) {
  store.setConnectionState(link);
  video?.connection(link === LINK.CONNECTED);
  if (link !== LINK.CONNECTED) {
    if(state.ui.estopLatch)estopDelivery='failed';
    if (video) video.streamUrl = null;
    stop();inputActive=false;legacySessionClaim=false;zeroRepeats=0; store.resetForDisconnect(); pendingMode = null; pendingClear = null; pong = null;
    $('confirmDlg').close();
    if (previousLink === LINK.CONNECTED && !state.ui.replaying) toast(t('t.link.lost'), 'warn');
  } else {
    pingServer(); // Establish device time immediately, before releases or mode requests.
    // New sessions never inherit input held before a disconnect.
    stop(); if (state.ui.estopLatch) estopDelivery=send(protocol.estop())?'sent':'failed';
    if (previousLink === LINK.RECONNECTING) toast(t('t.link.back'), 'ok');
  }
  previousLink = link; debug.log('sys', link); render();
}
function startReplay(messages) {
  stop(); if (debug.record) debug.finishRecording();
  if (!state.ui.replaying) { liveEstopLatch = state.ui.estopLatch; liveVideoSource = video.kind === 'file' ? 'none' : video.kind; }
  state.ui.replaying = true; transport.disconnect(); store.resetForDisconnect();
  store.markEstopLocal(false); state.robot.estop = false; state.robot.mode = undefined;
  video.setSource('canvas');
  replay = { messages, index: 0, first: messages[0].at, began: performance.now(),wallStart:Date.now() };
  replayViewTs=replay.wallStart;
  toast(t('t.replay.start', { n: messages.length }));
}
function resumeLive() {
  replay = null;replayViewTs=null; state.ui.replaying = false; store.markEstopLocal(liveEstopLatch); store.resetForDisconnect(); video.setSource(liveVideoSource); transport.connect();
}
function render() {
  if (!debug) return;
  const stale = store.isRobotStale(), locked = activeEstop(), enabled = manual();
  $('app').dataset.link = state.connection.link; $('app').dataset.estop = String(locked);
  $('linkStat').dataset.state = state.ui.replaying ? 'reconnecting' : state.connection.link;
  text('linkStatLabel', state.ui.replaying ? tr('回放中', 'REPLAY') : t(`link.${state.connection.link}`));
  text('mLatency', Date.now() - state.connection.lastPongTs < CONFIG.PING_TIMEOUT_MS ? value(state.connection.latencyMs, 0, ' ms') : '—');
  text('mTransport', state.ui.replaying ? 'REPLAY' : state.ui.transportName === 'mock' ? tr('模拟', 'DEMO') : sourceKind === 'usb' ? tr('USB桥接', 'USB BRIDGE') : 'Wi-Fi');
  text('langToggle', getLang() === 'zh' ? 'EN' : '中');
  const stopDisplay=stopStatus({replaying:state.ui.replaying,local:state.ui.estopLatch,device:state.robot.estop||state.robot.mode==='ESTOP',stale:store.isRobotStale(),delivery:estopDelivery});
  text('sessionTitle',stopDisplay==='replay'?tr('会话回放','Session replay'):stopDisplay==='device-reported'?tr('设备已上报急停','Device reports emergency stop'):stopDisplay==='awaiting-device'?tr('本地已锁定 · 等待设备确认','Locally locked · awaiting device'):stopDisplay==='local-only'?tr('本地已锁定 · 设备未确认','Locally locked · device unconfirmed'):stale?tr('等待机器人连接','Waiting for your robot'):state.ui.transportName==='mock'||state.connection.simulated?tr('模拟控制台','Simulation console'):tr('机器人已连接','Robot connected'));
  text('sessionDescription', locked ? tr('控制已锁定。确认环境安全后，可解除急停并回到待机。', 'Controls are locked. Clear the stop to return to idle.') : state.ui.replaying ? tr('正在查看录制数据，运动控制已关闭。', 'Recorded session. Motion controls are disabled.') : state.ui.transportName === 'mock' || state.connection.simulated ? tr('模拟环境已准备就绪。选一个模式，开始探索。', 'Your simulated environment is ready. Choose a mode to begin.') : state.robot.motion_output_installed === false ? tr('运动输出未接入 · 速度仅为测试目标值，手势和健康数据来自真机。', 'Motion output not installed · Velocities are test targets; gesture and health data are live.') : tr('实时连接设备。所有运动由机器人确认执行。', 'Connected to your device. Motion is confirmed by the robot.'));
  if(stopDisplay==='replay')text('sessionDescription',tr('正在查看录制数据，运动控制已关闭。','Recorded session. Motion controls are disabled.'));
  else if(stopDisplay==='local-only'||stopDisplay==='awaiting-device')text('sessionDescription',tr('本地输入已锁定，尚无设备急停确认。请由现场人员确认停车，必要时使用实体停止手段。','Local input is locked; device stop is unconfirmed. Have the on-site operator verify the stop and use the physical stop if needed.'));
  else if(stopDisplay==='device-reported')text('sessionDescription',tr('设备遥测已报告急停；实体是否静止仍需现场确认。','Device telemetry reports emergency stop; physical standstill still requires on-site confirmation.'));
  text('mPpgTime',state.ppg.timeBasis==='source-batch'?tr('批次采样时间 · 批内按标称频率','Batch sample time · nominal spacing'):tr('接收时间估计 · 非精确采样时间','Arrival-time estimate · not exact sampling'));
  const visionStale = store.isPersonStale() || (stale && !state.ui.replaying);
  $('visionStale').hidden = !visionStale;
  $('telemStale').hidden = !stale;
  text('hudRes', `${state.vision.image_width} × ${state.vision.image_height}`);
  text('hudFps', `AI ${stale ? '—' : value(state.vision.ai_fps, 1)} FPS`);
  const g = state.vision.gesture, gestureStale = store.isGestureStale() || (stale && !state.ui.replaying);
  const gestureLabel = gestureStale ? tr('等待手势', 'Waiting for gesture') : `${t(`g.${g.label}`)}${g.label === 'NONE' ? '' : ' · ' + value(g.confidence * 100, 0, '%')}`;
  text('hudGesture', gestureLabel);
  $('hudGesture').dataset.stable = String(!gestureStale && g.label !== 'NONE' && g.stable);
  text('gestureDetail', gestureStale || g.label === 'NONE' ? '—' : `${g.held ? tr('保持', 'Held') : g.stable ? tr('已稳定', 'Stable') : tr('待确认', 'Unconfirmed')} · ${value((Date.now() - state.vision.lastGestureTs) / 1000, 1, ' s')}`);
  const simulated=state.ui.transportName==='mock'||state.connection.simulated;
  document.querySelector('.console-title').textContent=tr('看得清。控得稳。','A clearer view. A lighter touch.');
  text('sourceBadge',state.ui.replaying?tr('会话回放','SESSION REPLAY'):simulated?tr('模拟演示','SIMULATION'):stale?tr('等待设备','WAITING'):tr('真实设备','DEVICE'));
  $('sourceBadge').dataset.kind=state.ui.replaying?'replay':simulated?'simulation':stale?'waiting':'device';
  text('ownerBadge',stale?tr('控制状态待确认','Control status unavailable'):state.robot.control_owned?tr('本页控制 · 松手交回','This page controls · release to hand back'):state.robot.control_occupied?tr('其他终端控制 · 本页只读','Another controller · viewing only'):tr('仅观看 · 不占控制权','Viewing · control remains free'));
  text('controlMode',confirmedModeLabel());
  text('controlHint',locked?tr('急停锁定。恢复后仍需新的输入。','Emergency lock. New input required after recovery.'):tr('直接比手势即可回应。按住摇杆，由你接管。','Gesture directly. Hold the joystick to take control.'));
  text('actionHeading',tr('手势 · 设备回应','GESTURE · DEVICE RESPONSE'));
  const event=state.gestureAction,age=event?Date.now()-event.sourceAt:Infinity;
  const actionFresh=event&&age>=0&&age<4000&&!stale&&!state.ui.replaying;
  const reasons={CONTROL_BUSY:tr('手动控制中。松开后，放下手再重新比手势。','Manual control is active. Release, lower your hand, then gesture again.'),NEW_GESTURE_REQUIRED:tr('请先放下手，再比一个新手势。','Lower your hand, then make a new gesture.'),HEALTH_IN_PROGRESS:tr('正在接触测量，暂不启动运动。','Contact measurement in progress. Motion is inhibited.'),TARGET_NOT_READY:tr('等待新的人物目标，尚未开始跟随。','Waiting for a fresh person target. Follow has not started.'),IMU_NOT_READY:tr('姿态数据尚未准备好。','Orientation data is not ready.'),ESTOP_ACTIVE:tr('急停仍在锁定，手势不会解除急停。','Emergency stop remains latched.'),FAULT_ACTIVE:tr('设备报告故障，暂不启动运动。','Device fault. Motion is inhibited.')};
  text('actionTitle',locked?tr('运动已锁定','Motion is locked'):actionFresh?`${t('g.'+event.label)} · ${event.accepted?tr('指令已接受','Command accepted'):tr('未启动','Not started')}`:!gestureStale&&g.label!=='NONE'?tr('已识别 · 等待动作确认','Recognized · awaiting action result'):tr('等待新手势','Ready for a new gesture'));
  text('actionReason',locked?tr('可继续显示识别；不会自动恢复旧动作。','Recognition can continue. Previous actions will not resume.'):actionFresh?event.accepted?tr('设备已接受指令；实体动作以现场为准。','Command accepted by the device; observe the physical response.'):reasons[event.reason]||event.reason:tr('无需先打开网页或选择手势模式。','No webpage or gesture-mode selection required.'));
  $('actionTitle').dataset.tone=locked?'bad':actionFresh&&!event.accepted?'warn':'normal';
  const frameAt=video?.stream.frameAt,frameAge=frameAt===null?null:performance.now()-frameAt;
  text('frameState',video?.kind==='none'?tr('尚未打开','CLOSED'):video?.kind==='canvas'?tr('合成画面','SYNTHETIC'):video?.kind==='file'?tr('本地文件','LOCAL FILE'):video?.ready?tr('新帧接收中','RECEIVING'):tr('暂无新帧','NO FRESH FRAME'));
  text('frameAge',video?.kind==='mjpeg'&&frameAge!==null&&frameAge>=0?tr(`解码帧 ${Math.round(frameAge)} ms 前`,`Decoded frame ${Math.round(frameAge)} ms ago`):'');
  text('videoTiming',video?.kind==='file'?tr('本地文件不叠加现场识别框。','Local playback does not show live detection boxes.'):tr('识别标记来自独立遥测，可能与画面存在时间差。','Detection metadata arrives separately and may not match this frame.'));
  text('sceneLabel', video?.kind==='none'?tr('实时视野','CAMERA VIEW'):video?.kind === 'canvas' ? tr('模拟视野', 'SIMULATED VIEW') : video?.kind === 'file' ? tr('本地视频 · 识别数据独立', 'LOCAL VIDEO · SEPARATE METADATA') : state.connection.simulated ? tr('模拟摄像头', 'SIMULATED CAMERA') : tr('摄像头视频', 'CAMERA STREAM'));
  $('videoError').hidden = video?.ready;
  const videoMessages={idle:tr('打开摄像头，查看实时画面','Open the camera to see its view'),connecting:tr('正在连接摄像头…','Connecting to camera…'),busy:tr('视频已被占用 · 关闭其他观看页面后重试','Video busy · close other viewers and retry'),stale:tr('画面已过期 · 等待新帧','Frame expired · waiting for a fresh frame'),error:tr('视频连接中断 · 可手动重试','Video interrupted · retry available'),'decode-error':tr('画面解码失败','Unable to decode video'),disconnected:tr('先连接机器人，再打开摄像头','Connect the robot to open its camera'),'file-waiting':tr('选择本地视频文件','Choose a local video file')};
  text('videoError',videoMessages[video?.status]||'');
  const confirmed = !store.isRobotStale() || state.ui.replaying;
  renderFront();
  text('sMode', confirmed ? t(`mode.${state.robot.mode}`) : '—');
  text('sState', confirmed ? t(`state.${state.robot.state}`) : '—');
  $('sMode').dataset.tone = locked ? 'bad' : 'idle';
  const imuFresh = confirmed && state.imu.valid !== false && Date.now() - state.lastImuTs < CONFIG.IMU_STALE_MS;
  text('sImuStatus', state.imu.tilt_fault ? tr('倾角故障', 'Tilt fault') : !imuFresh ? tr('不可用', 'Unavailable') : state.imu.calibrated === false ? tr('静置校准中', 'Calibrating') : tr('可用 · 相对航向', 'Ready · relative heading'));
  text('sYaw', imuFresh ? value(state.imu.yaw_deg, 1, '°') : '—');
  text('sPitchRoll', imuFresh ? `${value(state.imu.pitch_deg, 1)}° / ${value(state.imu.roll_deg, 1)}°` : '—');
  text('sAiFps', confirmed ? value(state.vision.ai_fps, 1, ' FPS') : '—');
  text('sVel', confirmed ? [state.robot.vx, state.robot.vy, state.robot.wz].map(signed).join(' / ') : '—');
  text('sBattPct', confirmed ? value(state.robot.battery_pct, 0, '%') : '—');
  $('sBatt').firstElementChild.style.width = `${confirmed ? state.robot.battery_pct || 0 : 0}%`;
  $('sBatt').dataset.tone = state.robot.battery_pct < 20 ? 'warn' : 'ok';
  for (const [id, key] of [['sLinkCam', 'camera'], ['sLinkMcu', 'main_mcu']]) {
    const connected = confirmed ? state.connection[key] : undefined;
    $(id).dataset.on = String(connected);
    text(id, connected === undefined ? '—' : connected ? tr('在线', 'Online') : tr('离线', 'Offline'));
  }
  const healthFresh = confirmed && Date.now() - state.connection.lastHealthTs < CONFIG.HEALTH_STALE_MS;
  const healthy = healthFresh && state.health.finger_detected && state.health.state === 'VALID';
  const hrVisible=healthFresh && state.health.finger_detected && (state.health.hr_valid ?? healthy);
  const spo2Visible=healthFresh && state.health.finger_detected && (state.health.spo2_valid ?? healthy);
  text('mHr', hrVisible ? value(state.health.hr_bpm)+(state.health.hr_held ? ' ~' : '') : '—');
  text('mSpo2', spo2Visible ? value(state.health.spo2_pct)+(state.health.spo2_held ? ' ~' : '') : '—');
  text('mSqi', healthFresh && state.health.finger_detected ? value(state.health.sqi * 100, 0, '%') : '—');
  text('healthState', healthFresh ? t(`hs.${state.health.state}`)+(state.health.hr_held||state.health.spo2_held ? tr(' · ~ 保持值',' · ~ held value') : '') : tr('等待信号', 'Waiting for signal'));
  $('healthState').dataset.tone = healthy ? 'ok' : 'muted';
  text('mFinger', healthFresh && state.health.finger_detected ? t('health.finger') : t('health.nofinger'));
  $('mFinger').dataset.on = String(healthFresh && state.health.finger_detected);
  text('mPpgRate', `${state.ppg.sampleRateHz} Hz · ${CONFIG.PPG_WINDOW_SECONDS} s`);
  $('controlBody').dataset.enabled = String(enabled);
  $('joystick').setAttribute('aria-disabled', String(!enabled));
  $('joystick').tabIndex = enabled ? 0 : -1;
  for (const id of ['rotL', 'rotR', 'speedScale']) $(id).disabled = !enabled;
  text('ctlLock', enabled ? tr('按住移动，松开停止', 'Hold to move. Release to stop.') : locked ? tr('本地输入锁定', 'Local input locked') : stale ? tr('等待连接', 'Waiting for connection') : t('ctl.locked'));
  for (const [id, v] of [['vVx', state.ui.joystick.vx], ['vVy', state.ui.joystick.vy], ['vWz', state.ui.rotate]]) text(id, signed(v * state.ui.speedScale));
  text('speedVal', value(state.ui.speedScale * 100, 0, '%'));
  for (const b of $('modeBar').querySelectorAll('[data-mode]')) {
    b.setAttribute('aria-pressed', String(!stale && !locked && state.robot.mode === b.dataset.mode));
    b.dataset.pending = String(state.ui.requestedMode === b.dataset.mode);
    const unsupported = state.device.supported_modes ? !state.device.supported_modes.includes(b.dataset.mode) : state.device.backend === 'test_targets' && (!['IDLE', 'MANUAL', 'HEALTH_CHECK'].includes(b.dataset.mode) || state.device.stage < 4);
    b.disabled = stale || locked || !!pendingMode || state.ui.replaying || unsupported || state.robot.control_allowed === false;
  }
  $('clearEstopBtn').hidden = !locked; $('clearEstopBtn').disabled = !transport?.isOpen || !!pendingClear || state.robot.control_allowed === false || (state.device.stage !== undefined && state.device.stage < 4);
  $('estopBtn').disabled = state.ui.replaying;
  text('estopLabel', locked ? stopDisplay==='device-reported'?tr('设备上报急停','DEVICE REPORTS STOP'):tr('本地控制已锁定','LOCAL INPUT LOCKED') : t('safety.estop'));
  $('dbgDrop').disabled = !transport?.isOpen || state.ui.replaying;
  text('footNote', state.ui.transportName === 'mock' ? tr('演示模式 · 数据由本地模拟生成', 'Demo mode · Locally simulated data') : state.connection.simulated ? tr('模拟设备 · WebSocket 与 MJPEG 通信', 'Simulated device · WebSocket & MJPEG') : tr('设备模式 · 数据来自 WebSocket', 'Device mode · Data received over WebSocket'));
  if (state.device.firmware) {
    const webVersion = document.querySelector('meta[name=carerover-web-version]')?.content || 'development';
    text('footNote', `${tr('固件', 'Firmware')} ${state.device.firmware} · Web ${webVersion} · ${state.robot.control_allowed === false ? tr('只读客户端', 'Read-only client') : state.robot.motion_output_installed ? tr('舵机输出已接入', 'Servo output installed') : tr('运动输出未接入', 'Motion output not installed')}`);
  }
  debug.render(state, fps); previousEnabled = enabled;
}
function tick(now) {
  if (destroyed) return;
  if (now - lastPaint < 1000 / 60 - .5) { raf = requestAnimationFrame(tick); return; }
  lastPaint = now;
  if (replay) {
    replayViewTs=replay.wallStart+Math.min(now-replay.began,replay.messages.at(-1).at-replay.first);
    let processed = 0;
    while (replay.index < replay.messages.length && replay.messages[replay.index].at - replay.first <= now - replay.began && processed++ < 200) {
      const row=replay.messages[replay.index++];receive(row.raw,true,replay.wallStart+row.at-replay.first);
    }
    if (replay.index === replay.messages.length) { replay = null; toast(t('t.replay.end')); }
  }
  video.render(state.vision, { personStale: store.isPersonStale(), gestureStale: store.isGestureStale(), showGuide: state.robot.mode === 'PERSON_FOLLOW' });
  const chartNow=state.ui.replaying&&replayViewTs!==null?replayViewTs:Date.now();
  chart.render(state.ppg, chartNow - state.ppg.lastTs < CONFIG.TELEMETRY_STALE_MS && state.health.finger_detected,chartNow);
  frames++; if (now - frameEpoch >= 1000) { fps = Math.round(frames * 1000 / (now - frameEpoch)); frames = 0; frameEpoch = now; }
  if (now - lastUi >= 100) { render(); lastUi = now; }
  raf = requestAnimationFrame(tick);
}
async function main() {
  initLang();
  debug = new DebugPanel({ replay: startReplay, resume: resumeLive });
  controls = new MotionInput({ pad: $('joystick'), knob: $('joystickKnob'), left: $('rotL'), right: $('rotR'), stop: $('btnStop'), enabled: manual, emergency,stopAction:ordinaryStop,
    change: (v, immediate) => {
      store.setJoystick(v.vx, v.vy); store.setRotate(v.wz);
      if (immediate && !v.vx && !v.vy && !v.wz) releaseOwnInput();
    } });
  video = new VideoPanel({ stage: $('videoStage'), source: $('videoSource'), overlay: $('videoOverlay'), image: $('videoStream'), retry:$('videoRetry'),onState:({status})=>{if(['source-changed','error','stale','decode-error','busy','disconnected'].includes(status))stop();},video: $('videoFile'), select: $('videoSourceSel'), input: $('videoFileInput'), openFile: $('videoFileOpen'), notice: () => toast(tr('视频无法载入，请检查画面源', 'Video unavailable. Check the selected source.'), 'warn') });
  chart = new PpgChart($('ppgChart'));
  transport = await createTransport(); state.ui.transportName = transport.name;
  const requestedVideo=new URLSearchParams(location.search).get('video');
  video.setSource(['canvas','mjpeg'].includes(requestedVideo)?requestedVideo:transport.name==='mock'?'canvas':'none');
  const offMessage = transport.onMessage(raw => receive(raw)); const offState = transport.onStateChange(linkChanged);
  const on = (id, event, fn) => $(id).addEventListener(event, fn, { signal: lifecycle.signal });
  on('modeBar', 'click', e => { const button = e.target.closest('[data-mode]'); if (button) changeMode(button.dataset.mode); });
  on('estopBtn', 'click', emergency); on('clearEstopBtn', 'click', requestClear);
  on('confirmYes', 'click', confirmClear); on('confirmNo', 'click', () => $('confirmDlg').close());
  on('langToggle', 'click', () => { setLang(getLang() === 'zh' ? 'en' : 'zh'); render(); });
  on('speedScale', 'input', e => { store.setSpeedScale(Number(e.target.value) / 100); render(); });
  on('dbgDrop', 'click', () => { stop(); transport.simulateDrop(); });
  timers.push(setInterval(() => {
    const enabled = manual(); if (!enabled && previousEnabled) stop();
    if (enabled && (state.ui.joystick.vx || state.ui.joystick.vy || state.ui.rotate)) {
      send(protocol.cmdVel(state.ui.joystick.vx * state.ui.speedScale, state.ui.joystick.vy * state.ui.speedScale, state.ui.rotate * state.ui.speedScale));
    } else if (zeroRepeats > 0) { send(protocol.releaseInput()); zeroRepeats--; }
    previousEnabled = enabled;
    const stale = store.isRobotStale(); if (stale && !wasStale && !state.ui.replaying) { stop(); debug.log('sys', 'Telemetry stale; input released'); } wasStale = stale;
    if (pendingMode && Date.now() > pendingMode.expires) { pendingMode = null; store.setRequestedMode(null); toast(t('t.mode.fail'), 'warn'); }
    if (pendingClear && Date.now() > pendingClear.expires) { pendingClear = null; toast(tr('未收到恢复确认，控制保持锁定', 'No recovery confirmation. Controls remain locked.'), 'warn'); }
  }, 1000 / CONFIG.CMD_VEL_HZ));
  timers.push(setInterval(() => {
    if (transport.isOpen && !state.ui.replaying) {
      if (pong && performance.now() - pong.at > CONFIG.PING_TIMEOUT_MS) { stop(); transport.simulateDrop(); return; }
      const following = state.robot.mode === 'PERSON_FOLLOW' && (state.robot.control_owned===true||state.robot.control_owned===undefined&&legacySessionClaim) && !activeEstop() && !document.hidden && !store.isRobotStale();
      if (following || performance.now() - lastPingAt >= CONFIG.PING_INTERVAL_MS) pingServer();
    }
  }, 100));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); }, { signal: lifecycle.signal });
  window.addEventListener('pagehide', e => { stop(); if (!e.persisted) destroy(); else transport.disconnect(); }, { signal: lifecycle.signal });
  window.addEventListener('pageshow', e => { if (e.persisted && !state.ui.replaying) transport.connect(); }, { signal: lifecycle.signal });
  function destroy() {
    destroyed = true; cancelAnimationFrame(raf); timers.forEach(clearInterval); controls.destroy(); video.destroy(); debug.destroy();
    offMessage(); offState(); transport.disconnect(); lifecycle.abort();
  }
  transport.connect(); raf = requestAnimationFrame(tick);
}
main().catch(error => { console.error(error); text('sessionTitle', '启动失败 / Unable to start'); text('sessionDescription', error.message); });
