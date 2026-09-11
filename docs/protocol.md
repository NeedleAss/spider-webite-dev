# CareRover JSON 协议 v1

最终整机中，浏览器只连接主 ESP32-S3 的 `/ws`。所有消息是 JSON 文本，含 `type` 和 `ts`（Unix 毫秒）。视频不进入 WebSocket。USB 串口桥仅用于开发诊断。

## Browser → Robot

| type | 字段 | 语义 |
| --- | --- | --- |
| `cmd_vel` | `vx`, `vy`, `wz` | 有限数，各在 [-1,1]，只允许 MANUAL 非零运动 |
| `set_mode` | `mode`, `request_id` | 请求模式，不表示已经生效 |
| `estop` | 无额外必需字段 | 立即停车并锁定 |
| `clear_estop` | `request_id` | 显式恢复；成功后回到 IDLE |
| `ping` | `id` | 由 pong 回传同一个 id |

`request_id` 是可选的 v1 扩展。本网页为模式和恢复请求生成递增整数；服务端原样回传。旧硬件不含 request_id 的 ACK 仍被支持，但模式最终以 telemetry 为准。

```json
{"type":"cmd_vel","ts":1788940000000,"vx":0.6,"vy":0.3,"wz":0}
```

坐标约定：vx 正为前进，负为后退；vy 正为右移，负为左移；wz 正为顺时针 / 右转，负为逆时针 / 左转。屏幕 y 向下，因此摇杆上拖得到正 vx。二维向量长度不超过 1，再乘用户速度上限。前端不发送单个舵机 PWM，也不做四轮逆运动学。

输入按住时以最多约 20 Hz 发送目标。松手、pointercancel、lostpointercapture、blur、hidden、断线、模式切换、过期遥测时本地输入归零，连接可用时立即发送零速度，并再重复 3 次。零速度和急停不受普通发送节流影响。高频 cmd_vel 不逐包 ACK，通过 telemetry 回显。

## Robot → Browser

聚合 telemetry 推荐 10 Hz。源图像分辨率与画布尺寸是两个坐标系统：

```json
{
  "type":"telemetry","ts":1788940000000,
  "connection":{"camera":true,"main_mcu":true},
  "robot":{"mode":"MANUAL","state":"READY","estop":false,"battery_pct":87,"vx":0,"vy":0,"wz":0},
  "imu":{"yaw_deg":1.2,"pitch_deg":0.1,"roll_deg":-0.2},
  "vision":{
    "image_width":320,"image_height":240,"ai_fps":5.8,
    "person":{"found":true,"x":124,"y":32,"w":76,"h":176,"confidence":0.94},
    "gesture":{"label":"PALM","confidence":0.91,"stable":true}
  },
  "health":{"hr_bpm":74,"spo2_pct":98,"sqi":0.94,"finger_detected":true,"state":"VALID"}
}
```

部分块可省略，省略字段不覆盖上次值；数值 0 是有效上报。**MANUAL 许可要求 mode、estop 的完整机器人回报在 1 秒内收到**，且两个设备链路均在线。仅收到健康数据不会延长运动许可。

Mock 额外上报 `connection.simulated: true`，用于将 WebSocket 模拟设备清楚标注为模拟来源；真实设备可以省略此字段。

- 请求模式：`IDLE`, `MANUAL`, `PERSON_FOLLOW`, `GESTURE_CONTROL`, `HEALTH_CHECK`。
- 系统模式：`ESTOP`, `FAULT`，不可通过 set_mode 请求。
- 状态：`IDLE`, `READY`, `DRIVING`, `TRACKING`, `SEARCHING`, `MEASURING`, `ESTOP`, `FAULT`。
- 手势：`NONE`, `PALM`, `FIST`, `THUMB_UP`, `VICTORY`, `POINT_LEFT`, `POINT_RIGHT`, `ONE`, `TWO`, `THREE`, `FOUR`, `FIVE`, `OK`, `CALL`, `LIKE`, `DISLIKE`, `UNKNOWN`。显示置信度和更新时间；stable 且 confidence ≥ 0.75 显示“已稳定”，网页不会据此自行发运动命令。
- 健康状态：`NO_FINGER`, `ACQUIRING`, `MEASURING`, `VALID`, `LOW_QUALITY`, `ERROR`。无手指、无效、低质量或过期时不显示为有效 HR / SpO₂。
- person 500 ms 未更新隐藏；gesture 2 秒未更新失效。两个时间戳各自维护。

## PPG

当前真机 25 samples/s，推荐每 200 ms 一批 5 个样本：

```json
{"type":"ppg_batch","ts":1788940000000,"sample_rate_hz":25,"samples":[18342,18480,18900,20110,19420]}
```

ts 表示本批**最后一个样本**时间；其余按采样率反推。前端绘图将批末锚定本地接收时间，避免未同步的设备时钟让波形跑出视野；原始 ts 保留在录制文件中。断开的时间段不补线。

兼容单样本 `{"type":"ppg","ts":1788940000000,"value":18342}`。最大单批 512 样本；无效样本丢弃；采样率接受 (0,2000] Hz。波形只展示最近 8 秒，固定分配 4096 样本缓冲。

## ACK / ERROR / PONG

```json
{"type":"ack","ts":1788940000010,"request_type":"set_mode","request_id":1,"ok":true}
```

set_mode 等待一致 telemetry 才选中模式；1.5 秒未确认提示失败。clear_estop 必须先有成功 ACK，再有 `estop:false, mode:IDLE` 的 telemetry 才解除本地锁。迟到的普通 telemetry 不得解除本地急停。

```json
{"type":"error","ts":1788940000010,"code":"ESTOP_ACTIVE","message":"Motion rejected while emergency stop is active"}
{"type":"pong","ts":1788940000010,"id":1788940000000}
```

错误包括 `ESTOP_ACTIVE`, `NOT_IN_MANUAL`, `INVALID_COMMAND`, `INVALID_MODE`, `UNKNOWN_TYPE`, `INVALID_JSON`, `CONTROL_BUSY`。

## 安全与连接契约

1. 主控最高优先级为 ESTOP，其次 FAULT，再进行模式仲裁。
2. 主控 **>250 ms 未收到有效 MANUAL cmd_vel 必须独立归零**。浏览器断电、系统冻结、网络丢包时仍然成立。
3. 断开控制所有者时停止并回 IDLE。急停锁跨连接持续存在。重连不恢复旧输入。
4. Mock 服务由第一个成功 set_mode / 非零运动 / clear_estop 客户端持有控制权；其他客户端只读，可随时急停。所有者断开释放控制权。固件必须实现等价仲裁。
5. WebSocket 重连退避 0.5 / 1 / 2 / 4 / 5 秒，上限 5 秒；握手超过 5 秒关闭后重试。ping 每 2 秒；超过 4 秒未回 pong 后重连。
6. 本地急停在连接断开期间也锁定 UI，并在重连时补发 estop。离线时不能宣称机器人已经收到急停，机器人端 watchdog 是必要兜底。
7. 入站单帧上限 64 KiB；非法 JSON 不进入状态。WS 发送积压超过 64 KiB 关闭链路，防止排队的旧运动命令。
8. 回放完全隔离命令发送，恢复实时仍等待新的机器人状态。

本协议不定义 ESP-DL 推理、UART 帧、轮子运动学或 PWM 校准。


## 主控无线测试后端扩展

完整部署说明见 `wireless-development.md`。新增可选字段均兼容原网页协议：

- `robot.motion_output_installed:false`：速度回显仅为测试目标，无实际执行器输出。
- `robot.control_allowed`：当前会话是否可申请/持有控制；false 时网页只读，仍允许 estop。
- `device`：firmware、backend=`test_targets`、stage、uptime_ms、last_cmd_ms、stopped_at_ms、stop_sequence、stop_reason、max_safety_gap_ms、publish_drops、free_heap；均为设备诊断信息，不是传感器测量。
- error 追加可选 `request_type` / `request_id`，供网页立即结束对应失败请求。
- `CLOCK_NOT_READY`、`STALE_COMMAND`、`READ_ONLY`、`UNSUPPORTED_MODE`、`CAMERA_OFFLINE`、`FAULT_ACTIVE` 为新增错误码。

主控首次 ping 建立每个会话的 Unix 时间估计，之前不发布传感器遥测；未校时的错误/急停 ACK 使用 ts=0 表示未建立时间基准。浏览器连接立即 ping。所有安全时限和来源新鲜度使用设备单调时钟。

本轮只实现 IDLE/MANUAL/HEALTH_CHECK；自主模式拒绝。MANUAL 在 CAM 超时、所有者断开、网络断开或有效非零命令过期时清零并回 IDLE，需重新申请模式。实际过期阈值 240 ms，周期任务 5 ms，为 250 ms 上限保留余量。未安装输出在所有 stage 中均不可开启。

健康结果中的 null 明确清除对应旧值；省略字段仍保留旧值。健康网页新鲜度为 2500 ms；机器人许可仍为 1000 ms。固件健康有效性另外要求采样仍在推进。传感器块只在新结果或失效变化时发送，不用 10 Hz 重发旧块延长有效期。

固件最多 4 个 WS 会话；整条入站消息不超过 64 KiB，仅接受未分片文本帧，JSON 深度上限 8，顶层不超过 8 个键且不允许重复键。模式/运动/恢复的请求时间相对会话时间基准落后超过 200 ms 或超前超过 100 ms 时拒绝；急停、零释放不受这个窗口限制。请求 id 若提供必须是非负安全整数。ping 的 ts 需为 2000–2100 年范围的 Unix 毫秒，id 为非负安全整数。
