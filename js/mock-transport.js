/**
 * 浏览器内 Mock Transport。
 *
 * 不开任何网络连接，但对外表现得和 WebSocketTransport 完全一致：
 * 同样的连接状态机、同样的 JSON 文本收发、同样的延迟与断线行为。
 * 因此它既能让页面在 GitHub Pages 上零后端演示，
 * 也能在没启动 mock/server.py 时继续开发 UI。
 */
import { CONFIG, LINK } from './config.js';
import { Transport } from './transport.js';
import { RobotSim } from './sim.js';

const TELEMETRY_HZ = 10;
const PPG_BATCH_HZ = 10;
const SIM_HZ = 50;

export class MockTransport extends Transport {
  constructor(opts = {}) {
    super();
    this.sim = new RobotSim();
    this.connectDelayMs = opts.connectDelayMs ?? 260;   // 模拟握手耗时
    this.fakeLatencyMs = opts.fakeLatencyMs ?? 8;       // 模拟链路往返
    this._timers = [];
    this._raf = null;
    this._lastSim = 0;
    this._ppgCarry = 0;
    this._dropUntil = 0;
  }

  get name() { return 'mock'; }

  connect() {
    if (this._state === LINK.CONNECTED || this._state === LINK.CONNECTING) return;
    this._setState(this._state === LINK.DISCONNECTED ? LINK.CONNECTING : LINK.RECONNECTING);
    this._timers.push(setTimeout(() => {
      this._setState(LINK.CONNECTED);
      this._start();
    }, this.connectDelayMs));
  }

  disconnect() {
    this._stop();
    this._setState(LINK.DISCONNECTED);
  }

  send(message) {
    if (!this.isOpen) return false;
    // 走一遍真实的序列化/反序列化，确保 Mock 阶段就能发现协议里的坑
    let msg;
    try { msg = JSON.parse(JSON.stringify(message)); } catch { return false; }

    // 模拟上行链路延迟
    this._timers.push(setTimeout(() => {
      if (!this.isOpen) return;
      const replies = this.sim.handleCommand(msg);
      for (const r of replies) this._deliver(r);
    }, this.fakeLatencyMs));
    return true;
  }

  /** 调试用：模拟断线 N 毫秒后自动重连，用于演示 RECONNECTING → CONNECTED。 */
  simulateDrop(downMs = 2600) {
    if (!this.isOpen) return;
    this._stop();
    this._setState(LINK.RECONNECTING);
    this._timers.push(setTimeout(() => {
      this._setState(LINK.CONNECTED);
      this._start();
    }, downMs));
  }

  /* ── 内部 ───────────────────────────────────────────────────────────── */

  _start() {
    this._lastSim = performance.now();

    // 仿真步进用 rAF：页面切到后台时浏览器会暂停它，这正好模拟了
    // "机器人还在跑但网页收不到数据"之外的另一种情形，且不浪费 CPU。
    const loop = t => {
      if (!this.isOpen) return;
      const dt = Math.min((t - this._lastSim) / 1000, 0.25); // 夹住长间隔，防止切回前台时状态跳变
      this._lastSim = t;
      this.sim.step(dt);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);

    this._timers.push(setInterval(() => this._deliver(this.sim.telemetry()), 1000 / TELEMETRY_HZ));

    this._timers.push(setInterval(() => {
      // 每批样本数 = 采样率 / 批频率，用余数累加避免长期漂移
      const exact = CONFIG.PPG_EXPECTED_RATE_HZ / PPG_BATCH_HZ + this._ppgCarry;
      const n = Math.floor(exact);
      this._ppgCarry = exact - n;
      if (n <= 0) return;
      this._deliver({
        type: 'ppg_batch',
        ts: Date.now(),
        sample_rate_hz: CONFIG.PPG_EXPECTED_RATE_HZ,
        samples: this.sim.ppgSamples(n, CONFIG.PPG_EXPECTED_RATE_HZ).map(v => Math.round(v))
      });
    }, 1000 / PPG_BATCH_HZ));

    void SIM_HZ; // 仿真步进由 rAF 驱动，SIM_HZ 仅作为文档性常量保留
  }

  _stop() {
    for (const h of this._timers) { clearTimeout(h); clearInterval(h); }
    this._timers = [];
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  _deliver(msgObj) {
    if (!this.isOpen) return;
    this._emitMessage(JSON.stringify(msgObj));
  }

  /** 供视频合成器读取当前场景，保证画面里的人形和 bbox 完全对齐。 */
  getScene() { return this.sim.scene(); }
}
