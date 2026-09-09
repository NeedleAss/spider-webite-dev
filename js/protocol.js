/**
 * CareRover WebSocket JSON 协议 —— 编解码与校验。
 * 规范文档：docs/protocol.md（本文件是它的唯一可执行实现，两者必须同步修改）
 *
 * 设计要点：
 *  - 所有入站数据都当作不可信输入：字段缺失、类型错误、超范围都不得让页面崩溃。
 *  - 校验结果是"净化后的对象"，UI 只消费净化结果，绝不直接碰原始 JSON。
 *  - 出站消息一律由本文件的构造函数生成，避免各处手拼字符串。
 */
import { MODES, SYSTEM_MODES, GESTURES, HEALTH_STATES } from './config.js';

export const ALL_MODES = [...MODES, ...SYSTEM_MODES];

/** 入站消息类型白名单。 */
export const IN_TYPES = ['telemetry', 'ppg', 'ppg_batch', 'ack', 'error', 'pong'];
/** 出站消息类型白名单。 */
export const OUT_TYPES = ['cmd_vel', 'set_mode', 'estop', 'clear_estop', 'ping'];

export const now = () => Date.now();

/* ── 基础净化工具 ─────────────────────────────────────────────────────── */

/** 有限数字才通过，否则返回 fallback。NaN / Infinity / 字符串一律拒绝。 */
export function num(v, fallback = undefined) {
  return (typeof v === 'number' && Number.isFinite(v)) ? v : fallback;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

/** 速度分量统一约束到 [-1, 1]。 */
export function clampVel(v) {
  const n = num(v, 0);
  return clamp(n, -1, 1);
}

export function bool(v, fallback = undefined) {
  return typeof v === 'boolean' ? v : fallback;
}

export function enumOf(v, list, fallback = undefined) {
  return (typeof v === 'string' && list.includes(v)) ? v : fallback;
}

/** 只接受对象（不含 null / 数组）。 */
function obj(v) {
  return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;
}

/* ── 出站消息构造 ─────────────────────────────────────────────────────── */

export function cmdVel(vx, vy, wz) {
  return { type: 'cmd_vel', ts: now(), vx: r3(clampVel(vx)), vy: r3(clampVel(vy)), wz: r3(clampVel(wz)) };
}
export function setMode(mode) {
  return { type: 'set_mode', ts: now(), mode };
}
export function estop()      { return { type: 'estop',       ts: now() }; }
export function clearEstop() { return { type: 'clear_estop', ts: now() }; }
export function ping(id)     { return { type: 'ping',        ts: now(), id }; }

/** 保留三位小数：网络包更小，且避免 0.30000000000000004 这类噪声。 */
const r3 = v => Math.round(v * 1000) / 1000;

/* ── 入站解析 ─────────────────────────────────────────────────────────── */

/**
 * 解析一条原始入站消息。
 * @returns {{ok: true, msg: object} | {ok: false, error: string, raw?: string}}
 */
export function decode(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'non-text frame' };

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid JSON', raw: raw.slice(0, 120) };
  }

  const o = obj(data);
  if (!o) return { ok: false, error: 'payload is not an object' };
  if (typeof o.type !== 'string') return { ok: false, error: 'missing "type"' };
  if (!IN_TYPES.includes(o.type)) return { ok: false, error: `unknown type "${o.type}"` };

  const ts = num(o.ts, now());

  switch (o.type) {
    case 'telemetry': return { ok: true, msg: { ...normalizeTelemetry(o), ts } };
    case 'ppg':       return { ok: true, msg: { type: 'ppg', ts, value: num(o.value, 0) } };
    case 'ppg_batch': return { ok: true, msg: normalizePpgBatch(o, ts) };
    case 'ack':       return { ok: true, msg: {
                          type: 'ack', ts,
                          request_type: enumOf(o.request_type, OUT_TYPES, 'unknown'),
                          ok: bool(o.ok, true)
                        } };
    case 'error':     return { ok: true, msg: {
                          type: 'error', ts,
                          code: typeof o.code === 'string' ? o.code.slice(0, 64) : 'UNKNOWN',
                          message: typeof o.message === 'string' ? o.message.slice(0, 240) : ''
                        } };
    case 'pong':      return { ok: true, msg: { type: 'pong', ts, id: num(o.id, undefined) } };
    default:          return { ok: false, error: 'unreachable' };
  }
}

/**
 * telemetry 净化。任何子块缺失都返回 undefined，由 state 层决定"保留旧值"还是"标记未知"。
 * 注意：这里刻意不填默认值，因为"传感器没上报"和"传感器上报了 0"是两回事。
 */
export function normalizeTelemetry(o) {
  const out = { type: 'telemetry' };

  const c = obj(o.connection);
  if (c) out.connection = { camera: bool(c.camera), main_mcu: bool(c.main_mcu) };

  const r = obj(o.robot);
  if (r) out.robot = {
    mode:        enumOf(r.mode, ALL_MODES),
    state:       typeof r.state === 'string' ? r.state.slice(0, 32) : undefined,
    estop:       bool(r.estop),
    battery_pct: num(r.battery_pct) !== undefined ? clamp(num(r.battery_pct), 0, 100) : undefined,
    vx: num(r.vx) !== undefined ? clampVel(r.vx) : undefined,
    vy: num(r.vy) !== undefined ? clampVel(r.vy) : undefined,
    wz: num(r.wz) !== undefined ? clampVel(r.wz) : undefined
  };

  const i = obj(o.imu);
  if (i) out.imu = { yaw_deg: num(i.yaw_deg), pitch_deg: num(i.pitch_deg), roll_deg: num(i.roll_deg) };

  const v = obj(o.vision);
  if (v) {
    out.vision = {
      image_width:  num(v.image_width),
      image_height: num(v.image_height),
      ai_fps:       num(v.ai_fps)
    };
    const p = obj(v.person);
    if (p) {
      const found = bool(p.found, false);
      out.vision.person = found
        ? {
            found: true,
            x: num(p.x, 0), y: num(p.y, 0),
            w: Math.max(0, num(p.w, 0)), h: Math.max(0, num(p.h, 0)),
            confidence: clamp(num(p.confidence, 0), 0, 1)
          }
        : { found: false };
    }
    const g = obj(v.gesture);
    if (g) out.vision.gesture = {
      label: enumOf(g.label, GESTURES, 'UNKNOWN'),
      confidence: clamp(num(g.confidence, 0), 0, 1),
      stable: bool(g.stable, false)
    };
  }

  const h = obj(o.health);
  if (h) out.health = {
    hr_bpm:   num(h.hr_bpm),
    spo2_pct: num(h.spo2_pct),
    sqi:      num(h.sqi) !== undefined ? clamp(num(h.sqi), 0, 1) : undefined,
    finger_detected: bool(h.finger_detected),
    state:    enumOf(h.state, HEALTH_STATES)
  };

  return out;
}

/** ppg_batch 净化：非法样本直接丢弃，不让 NaN 进入绘图缓冲。 */
function normalizePpgBatch(o, ts) {
  const rate = num(o.sample_rate_hz);
  const src = Array.isArray(o.samples) ? o.samples : [];
  const samples = [];
  // 单包上限 512，防止恶意/异常大包一次性撑爆缓冲
  for (let k = 0; k < src.length && samples.length < 512; k++) {
    const s = num(src[k]);
    if (s !== undefined) samples.push(s);
  }
  return {
    type: 'ppg_batch',
    ts,
    sample_rate_hz: (rate !== undefined && rate > 0 && rate <= 2000) ? rate : undefined,
    samples
  };
}

/** 出站消息在真正 send 之前的最后一道自检，防止内部 bug 把非法包发到机器人。 */
export function validateOutgoing(msg) {
  const o = obj(msg);
  if (!o || !OUT_TYPES.includes(o.type)) return 'unknown outgoing type';
  if (o.type === 'cmd_vel') {
    for (const k of ['vx', 'vy', 'wz']) {
      const n = num(o[k]);
      if (n === undefined) return `cmd_vel.${k} must be a finite number`;
      if (n < -1 || n > 1) return `cmd_vel.${k} out of range [-1,1]`;
    }
  }
  if (o.type === 'set_mode' && !MODES.includes(o.mode)) return 'set_mode.mode not requestable';
  return null; // 合法
}
