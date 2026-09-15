# CareRover 当前联动逻辑与阈值总表

更新时间：2026-09-15  
用途：给接手 Agent 的单一现状基线。本文只描述当前已烧录/已验证实现，不把下一阶段建议伪装成现状。改进方案见 `02_DEMO_OPTIMIZATION_IMPLEMENTATION_PLAN.md`。

## 0. 必须先确认的基线

- 主控当前运行：`fffc41be9b0db516-s5-follow`。
- 已验证主控设备包：`build/stage5-follow-fffc41be9b0db516-device`。
- app SHA-256：`ABB44EC9D7D78F68C8589FD18BE6485CF0E121AF64B43B2E37AD786222D96D8A`。
- manifest SHA-256：`A40B01F3EB7BA6D81FA8BA799FA93A2A240D8C39BAE54AA55180F4FF82218A7D`。
- CAM 使用已验证 stream 固件；CAM 由外部稳定 5 V 供电，与主控共地，通过 UART 通信。CAM 不必连接电脑 USB。
- 舵机现场状态：5 V 断开、四轮架空；本交接包不授权移动、刷写或改 NVS。
- 最终 450 ms 人物漏检宽限固件已烧录并完成启动验证，但尚未做最后一次连续真人跟随现场回归。
- 当前源代码目录是唯一权威源。不得用旧 `CareRover_Tracking_Motion_Handoff_2026-09-11` 覆盖。
- 不含私密 Wi-Fi 密码、NVS/Flash 备份、工具链或构建缓存。
- 为方便直接运行测试，包根目录另有 `firmware/`、`tools/`、`config/`、`index.html`、`js/`、`css/`、`assets/` 的工程镜像；`resources/` 保留同一份来源归档。两份内容 hash 一致，修改时以根目录为工作副本。

## 1. 当前硬件与坐标约定

### 1.1 主控与模块连接

| 模块 | 连接 | 当前值 |
|---|---|---|
| CAM UART | CAM TX → 主控 GPIO18；CAM RX ← 主控 GPIO17；GND 共地 | 115200, 8N1 |
| MAX30102 | SDA → GPIO8；SCL → GPIO9；VCC/GND 按已验证接法 | I²C 400 kHz，地址 0x57，期望 Part ID 0x15 |
| OLED SSD1306 | SDA → GPIO4；SCL → GPIO5 | 独立 I²C 400 kHz，地址 0x3C，128×64 |
| MPU6050 | SDA → GPIO6；SCL → GPIO7；VCC → 主控 3.3 V；GND → 主控 GND；AD0 悬空 | 软件 I²C，先探测 0x68，再探测 0x69 |
| 舵机 | FL GPIO10；FR GPIO12；RL GPIO13；RR GPIO11 | 外部 5 V；电源 GND、主控 GND、CAM GND 必须共地 |

### 1.2 底盘结构

俯视、车头朝上：

```text
GPIO10 / FL：纵向主动轮        GPIO12 / FR：横向主动轮

GPIO13 / RL：横向主动轮        GPIO11 / RR：纵向主动轮
```

它不是 X-drive。GPIO10/11 主动负责前后，GPIO12/13 主动负责左右；另一对轮靠胎面小滚轮被动随动。坐标约定：`vx > 0` 前进，`vy > 0` 右移，`wz > 0` 俯视顺时针。

当前混控：

```text
GPIO10 = vx + wz
GPIO12 = vy + wz
GPIO13 = vy - wz
GPIO11 = vx - wz
```

四值按最大绝对值归一化到 `[-1, 1]`；电气方向、中心脉宽、单轮量程由已验证 NVS 标定处理。

## 2. 端到端状态层次

每个“有结果/无结果”都应按下列五层区分，不能只改一个数：

1. 传感器或模型产生原始候选。
2. 模块内质量门、几何门或关联门接受/拒绝候选。
3. 主控时序滤波决定进入、保持、切换和退出。
4. 无线运行时按来源时间戳决定数据是否新鲜，并映射为协议字段。
5. OLED/网页再按各自过期时间和显示规则决定是否可见；运动控制器另有一组来源过期时间。

显示保持与运动判定目前是两个独立通道，调参时需要分别记录。

## 3. CAM 手势识别完整逻辑

### 3.1 CAM 原始识别

- 摄像头输入：RGB565，QVGA 320×240。
- XCLK：15 MHz。
- 帧缓冲：2，`CAMERA_GRAB_LATEST`。
- JPEG quality：16。
- 手检测器：`ESPDET_PICO_224_224_HAND`。
- 手检测分数阈值：`0.20`。
- 手势分类结果取检测列表中最高分手框；未分类到手势时发 `no_gesture`、score 0。
- CAM 在手势和人物之间逐帧交替推理，因此单类结果频率低于摄像头采集频率。
- MJPEG 最小发布间隔：200 ms，即理论上限约 5 FPS。

### 3.2 UART 和主控源接受

- UART：115200。
- CAM 有效包硬超时：490 ms；超时会重置手势滤波并报告 CAM timeout。
- 源候选诊断门：手存在、标签不是 `no_gesture/no_hand`、score ≥ 0.450。
- 注意：`sourceAccepted` 当前主要写入串口诊断；实际显示状态由下面的 `GestureHysteresis` 决定。

### 3.3 手势显示状态机

| 参数 | 当前值 | 含义 |
|---|---:|---|
| 进入分数 | 0.450 | 新标签候选达到此分数才可累计进入 |
| 保持分数 | 0.250 | 已激活的同标签达到此分数视为新鲜维持 |
| 首次进入 | 连续 2 帧 | 两帧同标签且达到进入分数后 accepted |
| 标签切换 | 连续 2 帧 | 新标签连续两帧达到进入分数后切换 |
| 分类丢失宽限 | 7 帧 | 仍检测到手但标签低分/不同/无分类时保持旧标签；超过 7 才清空 |
| 无手宽限 | 3 帧 | 连续无手超过 3 帧才清空 |

状态语义：

- `accepted=true, holding=false`：本帧直接支持当前稳定标签。
- `accepted=true, holding=true`：本帧没有直接支持，但旧标签仍在宽限期内；允许显示，不允许作为新的运动动作证据。
- `accepted=false`：显示 `NONE/--`，动作不可能触发。

### 3.4 手势动作链

动作只接收 `accepted && !holding && actionBoxValid` 的新鲜帧。

| 标签 | 动作 | 近景框门 | 连续确认 | 释放后可再触发 |
|---|---|---:|---:|---:|
| LIKE | 开始人物跟随 | 宽 ≥ 80，高 ≥ 110 | 4 帧 | 连续 3 个非合格动作帧 |
| DISLIKE | 立即停止并回 IDLE | 宽 ≥ 80，高 ≥ 120 | 2 帧 | 连续 3 帧 |
| TWO | 原地顺时针 360° | 宽 ≥ 80，高 ≥ 120 | 4 帧 | 连续 3 帧 |
| OK | 原地逆时针 360° | 宽 ≥ 80，高 ≥ 120 | 4 帧 | 连续 3 帧 |

同一持续标签只触发一次。LIKE 若触发时人物刚好未就绪，可等待下一张合格人物帧，最长 2000 ms。

LIKE 还必须同时满足：网页站点在线、CAM 新鲜、IMU 有效且已校准、无倾倒故障、NVS 舵机标定有效、人物新鲜且 score ≥ 0.450、没有 ESTOP/FAULT/控制权冲突。

旋转动作：起始 `|wz|=0.28`，累计转角 ≥ 300° 后降到 `|wz|=0.18`，累计 ≥ 360°停止；12 s 超时也停止。yaw 跨 ±180°时做环绕差分。

### 3.5 OLED 与网页手势显示

- OLED：CAM 已连接且 `accepted=true` 才显示标签；否则显示 `--`。
- OLED 数据页刷新：250 ms。
- 网页运行时只把主控手势源年龄 `<1000 ms` 的结果发布为 fresh；否则发 `NONE/0/not stable`。
- 网页本地手势过期：最后手势更新超过 `500×4=2000 ms`。
- 网页“已稳定”二次展示门：`stable=true` 且 confidence ≥ 0.450；否则可显示标签但注明“待确认”。

### 3.6 手势退出路径

- 连续分类缺失超过 7 帧，或连续无手超过 3 帧：主控 accepted 清空。
- CAM UART 490 ms 无有效包：手势滤波立即 reset。
- 网页 2 s 未收到新手势：显示“等待手势”。
- 网页总遥测 1 s 过期：整个实时状态进入等待连接。
- DISLIKE 仅影响运动模式，不要求隐藏刚识别出的手势标签。

## 4. CAM 人物识别、框显示与跟随逻辑

### 4.1 CAM 人物候选

- 人脸检测模型：`ESPDET_PICO_224_224_FACE` + `MSRMNP_S8_V1` 两级。
- Stage 0 score threshold：0.42。
- Stage 1 score threshold：0.42。
- 进入 CAM 候选列表还需 score ≥ 0.450。
- 未处于 tracking 时：选面积最大的候选。
- 已 tracking 时：选与上一框 IoU 最大的候选。
- 已 tracking 且最佳 IoU `<0.03`：本帧输出无人物。
- 已 tracking 且最佳与次佳 IoU 差 `<0.02`：视为歧义，本帧输出无人物。
- 本帧没有被接受的框即 `tracking=false`，下一帧重新按最大面积初始化。

### 4.2 主控人物新鲜度和进入

- 主控/运动接受 score：≥ 0.450。
- 人物包硬新鲜期：490 ms。
- CAM 任一视觉包硬新鲜期：490 ms。
- 跟随目标初始化：3 个合格框；取三框面积中值作为参考面积 `A0`。
- 主控人物关联：若已有上一框，新框与上一框 IoU 必须 ≥ 0.03。
- 单次漏检：立即令跟随输出速度为 0，但不立即退出模式。
- 从最后合格人物框起超过 450 ms：`lost=true`，安全控制器退出到 IDLE，reason=`target_lost`。
- 即使 450 ms 逻辑未触发，人物来源 490 ms 无新包也会由硬门停止，reason=`person_timeout`。

### 4.3 当前跟随控制器全部参数

| 参数 | 当前值 | 说明 |
|---|---:|---|
| 人物置信度 | 0.45 | 低于此值不更新跟随 |
| bbox EMA alpha | 0.30 | 平滑中心横向误差和面积 |
| 中心水平死区 | 0.07 | 归一化到半画宽；约 ±11.2 px |
| 距离死区 | 0.08 | `1-sqrt(A/A0)` 的死区 |
| 距离增益 | 0.55 | 输出 vx |
| 转向增益 | 0.75 | 输出 wz |
| 最大 |vx| | 0.25 | 前后跟随限幅 |
| 最大 |wz| | 0.30 | 旋转居中限幅 |
| 关联 IoU | 0.03 | 主控上一框关联门 |
| 漏检模式保持 | 450 ms | 小于当前 490 ms 人物来源过期时间 |

计算：

```text
ex = (bbox_center_x - 160) / 160
distance_error = 1 - sqrt(filtered_area / A0)
vx = clamp(0.55 * deadzone(distance_error, 0.08), ±0.25)
wz = clamp(0.75 * deadzone(ex, 0.07), ±0.30)
vy = 0
```

`vx` 和 `wz` 同时计算，避免“先转向、再跟距离”造成停顿。摄像头水平居中只用旋转，不用横移。

舵机输出层当前参数也会影响跟随观感：PWM 50 Hz、14 bit；输出更新 10 ms；归一化速度斜率 2.5/s；`|speed|≤0.005` 视为零；脉宽最终夹在 900–2100 μs；主控每次给驱动层 240 ms 命令期限，驱动 API 可接受的绝对上限为 5000 ms。NVS 标定只有在 neutral 1300–1700 μs、direction 为 ±1、单轮 span 100–500 μs且 layout id 匹配时才有效。

### 4.4 网页人物框

- 设备发布人物框时，源年龄必须 `<490 ms` 且 `found=true`。
- 网页按人物 `seq` 和 `age_ms` 维护源时间；重复 seq 不会虚假刷新。
- 网页人物框过期：500 ms。
- 人物框过期后隐藏；PERSON_FOLLOW 模式仍可显示居中引导线。
- 视频为 CAM 的 `http://192.168.4.2/stream`，320×240 MJPEG；框数据来自主控 WebSocket，二者是独立通道。

### 4.5 人物跟随退出路径

- 一个不合格/漏检人物帧：输出归零，模式最多保留 450 ms。
- 最后合格人物框超过 450 ms：target_lost → IDLE。
- 人物包超过 490 ms：person_timeout → IDLE。
- CAM 任意包超过 490 ms：camera_timeout → IDLE。
- IMU 无效、未校准、tilt fault 或超过 100 ms：立即停止。
- 网页控制站断开、网络 AP 停止、控制者 watchdog、输出 240 ms 租约、ESTOP/FAULT：停止。
- 当前设计不会在人物重新出现后自动从 IDLE 恢复，必须重新进入 PERSON_FOLLOW 或重新触发 LIKE。

## 5. MAX30102 心率/血氧完整逻辑

### 5.1 采集参数

| 参数 | 当前值 |
|---|---:|
| I²C | 400 kHz |
| MAX30102 地址 | 0x57 |
| LED 初始功率 | 30 |
| FIFO 配置 | 100 conversions/s，平均 4，约 25 sample/s |
| 通道 | Red + IR |
| pulse width | 411 μs |
| ADC range | 4096 nA |
| 分析窗 | 200 样本，约 8 s |
| 滑动步长 | 25 样本，约 1 s |
| 去趋势半宽 | 25 样本；总局部均值约 51 点 |
| 平滑核 | `[1,2,3,2,1]/9` |
| 传感器重试 | 3000 ms |
| health 报告 | 1000 ms |

### 5.2 手指进入/退出

- 手指阈值：IR ≥ 50,000。
- 连续低于阈值 5 个 FIFO 样本（约 200 ms）后判 `no_finger`，立即清空 HR、SpO₂、所有滤波和窗口。
- 从 no_finger 首次重新达到阈值：进入 `acquiring`，从空窗口重新收集。
- LED 自动控制目标：IR mean 90,000–190,000。
- IR mean >190,000 且 LED power>8：每次降 4，最低 8。
- IR mean <90,000 且 LED power<60：每次升 4，最高 60。
- 每次 LED 功率改变都会清 FIFO、重置 PPG 状态并重新 acquiring。

### 5.3 信号处理与候选门

HR 采用时间域自相关主估计；频谱 Goertzel 主要用于质量指标和谐波辅助。

| 条件 | HR 候选 | SpO₂ 候选 |
|---|---:|---:|
| 实际采样率 | 20–30 Hz | 20–30 Hz |
| IR AC/DC | 0.00002–0.030 | 0.00002–0.030 |
| 频谱 SNR | ≥2.0 | ≥2.0 |
| Red/IR 相关性 | 不要求 | ≥0.30 |
| Ratio R | 不要求 | 0.20–1.80 |
| 数值范围 | health gate 40–200 BPM；自相关实际搜索 45–150 BPM | 65–100% |
| 自相关峰值 | ≥0.30，且必须为非端点局部峰 | 不直接使用 |

频谱搜索 0.67–3.00 Hz，步长 0.02 Hz；若最佳频率 >1.50 Hz 且半频功率超过最佳功率 25%，频谱质量指标选半频。HR 最终数值不再直接用该频谱峰，避免慢压力漂移产生 40 BPM 假值。

SpO₂ 候选：`round(110 - 25*R)`。

SQI 每项 20 分，总计 0–100：

1. IR mean 在 50,000–210,000。
2. IR max <245,000 且 IR min >1,000。
3. AC/DC 在 0.00002–0.030。
4. Red/IR correlation ≥0.30。
5. spectral SNR ≥2.0。

SQI 当前只用于显示，不是 HR/SpO₂ 最终有效性的单一总分门。

### 5.4 数值滤波、进入、保持和退出

候选先经过 5 窗中值滤波，再进入 `StableMetric`。

| 参数 | HR | SpO₂ |
|---|---:|---:|
| 首次有效所需好窗 | 2 个 | 2 个 |
| 相邻候选最大差 | 12 BPM | 6% |
| 有效后坏窗宽限 | 30 窗，约 30 s | 8 窗，约 8 s |
| 每个好窗最大显示步长 | 3 BPM | 1% |

关键行为：

- 首次进入必须两个相邻且差值不超门限的合格候选。
- 已有效后，坏窗期间输出最后可信值并标 `held`。
- 坏窗超过宽限才把该项变为 null。
- HR 和 SpO₂ 独立有效、独立保持；`measurementValid = hrValid || spo2Valid`。
- 手指移开、传感器缺失、LED 调整会立即 reset，不走长保持。
- 两项都有效：`stable/holding`；只 HR：`hr_stable/hr_holding`；只 SpO₂：`spo2_stable/spo2_holding`；有部分好窗但未进入：`acquiring`；否则 `poor_signal`。

### 5.5 无线和显示逻辑

- 设备侧 health fresh：最近原始样本 `<250 ms` 且最近 health report `<2500 ms`。
- fresh=false 或传感器 not ready → 网页状态 `ERROR`。
- 无手指 → `NO_FINGER`；poor_signal → `LOW_QUALITY`；acquiring → `ACQUIRING`。
- 只要 HR 或 SpO₂ 任一有效 → 协议状态 `VALID`，各数值仍按自身 valid 独立发送 number/null。
- 网页 health 本地过期：2500 ms。
- 网页当前 `healthy` 条件：fresh、finger detected、state=`VALID`；然后分别渲染 HR 和 SpO₂，null 显示为 `—`。
- PPG 波形只要最近 batch `<1000 ms` 且手指存在就绘制；显示 8 s 窗，环形缓存 4096 点，期望 25 Hz。
- OLED 独立显示 HR 和 SpO₂；任一有效都算“有结果”。

### 5.6 OLED 无结果动画

- `hasResult = gestureValid || heartRateValid || spo2Valid`。
- 有任一结果：显示 CAM/HR/O₂ 数据页，无效项显示 `--`。
- 三项都无结果：先显示 `NO RESULT`；持续 1500 ms 后随机选择两只线条小狗动画之一。
- 动画：128×64 屏上的 72×56 位图，8 帧，125 ms/帧（约 8 FPS）；每个动画约 4032 B。
- OLED 探测失败每 3000 ms 重试；不会拖垮主循环。

## 6. MPU6050 实时姿态与安全逻辑

### 6.1 采集配置

| 参数 | 当前值 |
|---|---:|
| 地址 | 0x68 优先，0x69 后备 |
| DLPF | 配置值 3 |
| sample divider | 9 |
| gyro range | ±250 dps |
| accel range | ±2 g |
| 主任务周期 | 10 ms（100 Hz） |
| 初始化重试 | 1000 ms |
| 串口状态报告 | 1000 ms |
| 单次软件 I²C 操作期限 | 4 ms |
| clock stretch | 200 μs |
| 半周期 | 5 μs |

### 6.2 静置校准

校准窗口必须连续满足：

- `|sqrt(ax²+ay²+az²)-1| ≤ 0.08 g`。
- `|gx|, |gy|, |gz| ≤ 3 dps`。
- 连续时间 ≥5000 ms。
- 样本数 ≥450。

任一条件不满足就把校准累计、样本数和 bias 累加全部归零。成功后以平均陀螺值为三轴 bias。

### 6.3 姿态滤波

- pitch/roll：互补滤波。
- 时间常数 `tau=0.5 s`。
- `alpha = 0.5/(0.5+dt)`；100 Hz 时约 0.9804。
- yaw：减 bias 后的 z 轴陀螺积分，并限制在 [-180°, 180°]。
- 非有限输入：立即 missing。
- `dt >0.1 s`：该样本链路视为 missing；内部 dt 回退 0.01 s。

### 6.4 倾倒进入与恢复

| 参数 | 当前值 |
|---|---:|
| 故障角 | 原始加速度角或融合角的 |pitch|/|roll| ≥40° |
| 故障确认 | 持续 ≥200 ms |
| 恢复角 | 原始角和融合角均 <30° |
| 恢复确认 | 持续 ≥1000 ms |

一次短加速度冲击不会触发；持续大倾角会触发。历史“轻微波动即停”的主要硬件根因已定位为 MPU 与舵机电源共用导致的坏样本，现已把 MPU VCC 改到主控 3.3 V。

### 6.5 运行时与网页

- 运动安全 IMU fresh：`valid && calibrated && !tiltFault`，年龄 `<100 ms`。
- MANUAL 或 PERSON_FOLLOW 中收到 IMU invalid/uncalibrated/tilt：立即 stop。
- 所有 moving mode 每次 safety tick 再检查 IMU 100 ms 硬新鲜度。
- 设备 WebSocket 发布 IMU fresh 也是 `<100 ms`，否则角度字段发 null。
- 网页本地显示 fresh：确认总遥测在线、`imu.valid !== false`、最后 IMU 源时间 `<500 ms`。
- 网页显示 yaw、pitch、roll 到 0.1°；tilt fault 优先显示“倾角故障”。

## 7. 跨模块模式进入/退出矩阵

| 模式/功能 | 进入条件 | 保持条件 | 退出/停止条件 |
|---|---|---|---|
| 纯显示 | WebSocket 在线或 OLED 就绪 | 各模块独立 freshness/hold | 各自过期；不影响其他模块 |
| HEALTH_CHECK | 网页 set_mode 成功 | 网络、设备状态正常；测量本身不驱动车轮 | 切模式、断网、ESTOP |
| MANUAL | 网络、CAM、标定、IMU、安全与控制权均通过 | 网页 20 Hz cmd_vel；主控输出租约 240 ms | 松手零速、240 ms watchdog、IMU/CAM/网络/ESTOP |
| PERSON_FOLLOW（网页） | 上述运动门 + fresh person score≥0.45 | 100 ms follow task续租；人物和 CAM 均 fresh | missing 先零速；450 ms target loss、490 ms person/CAM、IMU/网络/ESTOP |
| PERSON_FOLLOW（LIKE） | 4 帧新鲜近景 LIKE + 同一组运动门；人物若暂缺可等 2 s | 同上 | DISLIKE 或同上 |
| GESTURE_CONTROL 旋转 | TWO/OK 4 帧新鲜近景动作 + 网络/CAM/IMU/标定 | IMU yaw 持续更新，输出租约持续刷新 | 360°、12 s、DISLIKE、IMU/CAM/网络/ESTOP |

全局运动相关时序与条件汇总：

- 输出/手动指令租约：240 ms。
- CAM 任意视觉来源：490 ms。
- 人物来源：490 ms。
- 运动 IMU：100 ms。
- 网页总遥测：1000 ms；网页手动 deadman 约定 250 ms，发送 20 Hz，零速重复 3 次。
- ESTOP、NVS 标定、网络在线、控制权和数值有限范围检查。

网页手动控制相关阈值：cmd_vel 上限 20 Hz（50 ms/包），摇杆死区 0.08，默认 speed scale 0.60，旋转按钮基准 1.0，松手零速额外重复 3 包，模式确认超时 1500 ms，WebSocket 重连退避 500–5000 ms，ping 周期 2000 ms、pong 显示超时 4000 ms。

## 8. 已知现状与证据边界

- 真人人物序列证明 LIKE 可成功启动跟随；人物 94/97 帧 found、置信度 0.982–1.000，居中时零速，偏心时仅小幅 wz、vy=0。
- 该序列也暴露旧 300 ms 漏检宽限小于人物帧约 312 ms 周期；现已改为 450 ms并烧录。450 ms 版本只完成启动/静态验证，最终持续跟随现场回归仍待执行。
- MAX30102 有效 60 s 记录：手指 60/60、SpO₂ 60/60；HR 重新获得后约 42 s 不消失，30 个坏窗仍可保持；40 BPM 慢漂移假值已消除。
- 最终静态背景 60 s：手势动作 0、运动动作 0、协议错误 0。
- MPU 改由主控 3.3 V 供电后，最终启动记录 15/15 valid/calibrated、无 tilt fault。

证据文件和 SHA-256 见交接包 `evidence/` 与 `MANIFEST.sha256`。完整历史详见 `reference_docs/windows-progress.md`。

## 9. 权威实现文件索引

- CAM 模型与轮转：`resources/firmware/cam_tracking/main/main.cpp`
- 手势状态机/指标保持：`resources/firmware/main_wireless/signal_state_filters.h`
- 手势动作：`resources/firmware/main_wireless/gesture_actions.h`
- MAX30102 主链：`resources/firmware/main_wireless/main_wireless.ino`
- PPG 质量门：`resources/firmware/main_wireless/health_quality.h`
- HR 自相关：`resources/firmware/main_wireless/ppg_rate_estimator.h`
- MPU 滤波：`resources/firmware/main_wireless/imu_filter.h`
- MPU 采集：`resources/firmware/main_wireless/mpu6050_soft.h`
- 人物跟随：`resources/firmware/main_wireless/person_follow.h`
- 运动安全：`resources/firmware/main_wireless/safety_controller.h`
- 无线状态映射：`resources/firmware/main_wireless/wireless_runtime.cpp`
- OLED：`resources/firmware/main_wireless/oled_ui.h/.cpp`
- 网页阈值/状态/渲染：`resources/web/js/config.js`、`state.js`、`protocol.js`、`app.js`
