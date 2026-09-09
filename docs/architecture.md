# 架构与硬件对接

```text
HTML / CSS
   │
app.js ─── joystick.js（输入与释放）
   ├───── video.js + video-overlay.js（图像与独立 metadata）
   ├───── telemetry.js（PPG Canvas）
   ├───── debug.js（有界日志、录制与回放）
   │
protocol.js（JSON 校验） ↔ state.js（状态、许可、新鲜度、环形缓冲）
   │
Transport
   ├─ MockTransport → RobotSim（浏览器内、纯本地）
   └─ WebSocketTransport → /ws（Python Mock 或未来 CAM）

视频：img → /stream（独立 MJPEG HTTP 连接）
```

应用层看见统一的 connect / disconnect / send / onMessage / onStateChange 接口。视频合成器从标准 vision 元数据画场景，不读取 MockTransport 私有对象。WebSocket 模式不会下载 JS 模拟器。不存在 CDN、远程分析、云端 telemetry 或外网媒体资源。

PPG 50 Hz 与绘图频率解耦；rAF 绘制上限约 60 FPS，DOM 最多 10 Hz 更新。环形缓冲固定 4096 样本，日志 120 行，录制最多 20000 个入站消息。录制文件上限 32 MiB，回放最多一小时，结束后明确返回实时。录制只包含 JSON 数据；回放时从 metadata 重新合成画面，不录制或上传视频。关闭页面清理订阅、定时器、视频 URL 和 WebSocket。

三个独立状态不能混淆：transport 链路状态、机器人确认的 mode、UI 请求中的 mode。急停本地锁与机器人 estop 分开保存，防止网络延迟导致 UI 误解锁。

浏览器内仿真与 Python 仿真共享协议、轴约定、模式权限、急停 / 恢复和 250 ms watchdog；两者具体随机数、房间绘制及数值轨迹并不逐帧相同。Python 的物理步进与广播任务分开，慢客户端不能通过广播阻塞正常的超时判断。

## 视频坐标

源图像 iw × ih，容器 W × H。`scale=min(W/iw,H/ih)`，内容偏移 `ox=(W-iw*scale)/2`、`oy=(H-ih*scale)/2`，点映射到 `(ox+x*scale, oy+y*scale)`。Canvas 位图按 DPR 放大（上限 2），绘制仍用 CSS 像素。摄像头 MJPEG 的宽高比必须与 metadata 声明的源图像一致。

本地视频用于测试 `<video>` 播放和 overlay，不能产生真实检测结果。来自当前数据源的 bbox 会按归一化位置映射到视频的实际 contain 区域，但任意视频与独立 metadata 不保证语义对应。视频输入失败不静默冒充真实画面。Python MJPEG 640×480 与 metadata 320×240 使用相同 4:3 内容和成比例坐标。

## 部署范围

运行前端只需要静态服务器，无需 Node。Python 服务只用于本地开发验证，不烧录进 ESP32。GitHub Actions 执行逻辑及网络集成测试；浏览器视觉与真实硬件接入分别验收。

## Future Hardware Integration Contract

CAM ESP32-S3 至少提供：

```text
GET /
GET /stream     MJPEG，视频不经过主 ESP32-S3
WS  /ws         双向 JSON
```

Browser → CAM：`cmd_vel`, `set_mode`, `estop`, `clear_estop`, `ping`。

CAM → Browser：`telemetry`, `ppg_batch`, `ack`, `error`, `pong`。

CAM → Main ESP32-S3（未来 UART）：web movement command、mode command、estop、vision result。

Main → CAM（未来 UART）：actual robot mode/state、imu、action status、heart rate、SpO₂、SQI、PPG、battery、faults。

CAM 汇总主控遥测给浏览器；主控执行运动、安全裁决和传感器采样。主控独立处理 >250 ms 超时停车和急停。网页只发归一化速度目标，前端无需知道 UART 的存在。
