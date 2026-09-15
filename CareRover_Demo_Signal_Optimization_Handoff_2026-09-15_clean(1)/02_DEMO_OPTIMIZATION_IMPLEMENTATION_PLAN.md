# CareRover Demo 检测与滤波优化实施交接

更新时间：2026-09-15  
目标读者：下一位直接修改、构建、刷写和现场调参的 Agent。  
目标：优先提升比赛 Demo 的“快、稳、看得见、不会因一两个坏帧突然消失或停车”，同时不伪造测量，不绕过运动硬安全门。

## 0. 任务定义与完成标准

不要重做已经完成的无线网页、OLED、正交全向轮、动作映射或基础跟随集成。基于交接包根目录的当前源增量修改；`resources/` 是同内容归档副本。

必须交付：

1. 一套集中、可切换的 `DEMO_BALANCED` 参数配置，并对运动相关时序单独做回归。
2. 手势：低延迟显示、短丢帧不断闪；动作仍防误触。
3. 人物：框和控制对单个漏检平滑；人物保持在画面中心且框面积接近进入时参考值。
4. PPG：有真实波形时更快出现结果；获得可信结果后个别坏窗不清空；HR/SpO₂ 独立显示和保持。
5. IMU：不因单个坏样本或短加速度冲击停车；真实持续倾倒、断线、超时仍停车。
6. OLED、串口 JSON、WebSocket、网页对 `fresh/held/predicted/stale` 有一致语义。
7. 更新确定性单元测试、离线重放和现场验收记录；所有原测试继续通过。

需要把“真实新结果”“滤波保持值”“预测值”和“传感器断开”分别标记，便于客观比较展示稳定性。

## 1. 先做结构性改造：把参数与状态集中

第一步不是随处改 magic number，而是新增一个轻量配置头，例如：

```text
firmware/main_wireless/demo_tuning.h
firmware/cam_tracking/main/demo_tuning.h（或 Kconfig）
```

建议定义三档 profile：

- `SAFE_BASELINE`：完全复现当前参数，用作 A/B 和回退。
- `DEMO_BALANCED`：本文件给出的首轮目标值，默认。
- `DIAGNOSTIC_RAW`：只增加诊断，不允许运动参数自动放宽。

参数必须按层命名：`*_DETECT_*`、`*_DISPLAY_*`、`*_ACTION_*`、`*_SAFETY_*`。禁止再用一个 confidence 同时支配检测、显示和运动。

为 telemetry 新增只读 `tuning_profile` 和关键状态字段；协议保持向后兼容，旧网页遇到新字段可忽略。

## 2. 总体算法原则

不同数据类型不应一律套卡尔曼滤波：

- 离散手势标签：用带衰减的证据累积、Schmitt 进入/保持阈值和短丢帧桥接；卡尔曼不适合类别标签。
- 人物 bbox：用常速度 alpha-beta 或轻量 Kalman；这是最适合 Kalman 的模块。
- PPG 波形：先带通/去趋势、稳健候选和质量加权；对最终 HR/SpO₂ 用一维自适应 Kalman 或 alpha-beta。不要直接对原始红光/红外套普通 Kalman 后声称提高准确度。
- MPU：现有互补滤波适合 ESP32；先做样本合理性检查和中值抗脉冲，再做互补/Mahony。没有必要为了“用了卡尔曼”重写成昂贵 EKF。

状态统一为：

```text
ABSENT -> ACQUIRING -> LIVE -> HELD/PREDICTED -> STALE
```

每个输出至少携带 `valid`、`state`、`age_ms`；滤波保持的数据必须标 `held/predicted`，不能冒充 fresh。

## 3. 手势：证据累积替代“必须连续帧”

### 3.1 首轮建议参数

| 层 | 当前 | DEMO_BALANCED 起点 |
|---|---:|---:|
| CAM 手检测 | 0.20 | 0.16；若静态误框明显再升到 0.18 |
| 显示进入 | 0.45/连续2 | score≥0.35，3 帧窗口内至少 2 帧同标签 |
| 显示保持 | 0.25 | 0.18 |
| 显示分类丢失 | 7 帧 | 8 帧或 1800 ms，优先改为时间制 |
| 显示无手丢失 | 3 帧 | 4 帧或 900 ms |
| 标签切换 | 连续2 | 3 帧窗口内 2 帧，新标签证据必须超过当前标签 0.25 |
| 网页稳定展示 | 0.45 | 直接信任主控 `stable`；confidence 仅展示，不做第二次拒绝 |
| 网页手势 stale | 2000 ms | 2200 ms；仅显示，不影响动作 |

首轮不要降低动作原始分数底线 0.45，也不要移除近景框门。显示灵敏和动作安全必须分开。

### 3.2 推荐状态算法

为每个 label 保存一个 evidence：

```text
e[label] = e[label] * exp(-dt / tau) + clamp((score - floor)/(1-floor), 0, 1)
```

- `tau=700 ms`。
- 有手但未分类：只衰减，不立即清零。
- 明确 `no_hand`：以约 2 倍速率衰减。
- 进入：候选 evidence ≥1.05 且过去 3 个分类帧至少 2 个同标签。
- 保持：当前 evidence ≥0.25 或距最后直接支持 `<1800 ms`。
- 切换：新标签 evidence ≥1.05 且比当前高 ≥0.25。

若接手 Agent 不想引入 evidence map，至少把“连续帧”改为“2-of-3 多数窗”，它能直接解决单个低分帧打断确认。

### 3.3 动作链改进

- LIKE：使用 4 个新鲜动作帧中的 3 个，而非严格连续 4 个；总窗口不得超过 1500 ms。
- DISLIKE：保持 2-of-3，优先响应停止。
- TWO/OK：保持 4-of-5，近景框仍 80×120。
- LIKE 近景框保持 80×110。
- 只有原始帧直接支持、score≥0.45、非 holding、近景框通过，才记一票动作证据。
- 同标签一次性 latch、3 帧释放、网络/人物/IMU/标定/ESTOP 门全部保留。

### 3.4 验收

- 真实 LIKE/OK/TWO 各 10 次：显示成功 ≥9/10；从首次合格手框到稳定标签 P90 <900 ms。
- 动作成功：LIKE ≥9/10；TWO/OK ≥8/10；DISLIKE P90 <700 ms。
- 空背景 5 min：不得产生任何运动动作；允许短暂 UNKNOWN/待确认显示，但不得 action。
- 每类插入一个低分或 no_gesture 帧，稳定标签不得闪成 NONE。

## 4. 人物：bbox 预测与运动安全分层

### 4.1 检测与关联建议

| 层 | 当前 | DEMO_BALANCED 起点 |
|---|---:|---:|
| CAM face stage 0 | 0.42 | 0.35 |
| CAM face stage 1 | 0.42 | 0.38 |
| CAM 发送候选 | 0.45 | 0.35 |
| 跟随首次获取 | 0.45 | 0.40，3 帧中 2 帧通过且几何一致 |
| 跟随已锁定保持 | 0.45 | 0.28，必须通过预测门 |
| IoU 单一门 | 0.03 | 不单独否决；与中心距离/尺度共同 gating |
| 视觉框显示保持 | 500 ms | 700 ms 淡出；>490 ms 明确标 predicted/stale，不能授权运动 |

降低 CAM face threshold 后必须保留多目标歧义保护。关联代价建议：

```text
cost = 0.55 * (1 - IoU)
     + 0.30 * normalized_center_distance
     + 0.15 * abs(log(area / predicted_area))
```

候选通过至少满足：IoU≥0.02，或中心距离≤0.22 且面积比例在 `[0.45, 2.2]`。多人时选择最低 cost；最佳与次佳 cost 过近（差 <0.08）则只保持预测、不更新身份。

### 4.2 bbox 滤波器

推荐 6 状态常速度滤波：

```text
x = [cx, cy, logArea, vx, vy, vLogArea]
z = [cx, cy, logArea]
```

坐标归一化到 `[0,1]`，dt 使用真实人物帧间隔。可选实现：

- 首选轻量 alpha-beta：位置 alpha=0.55、速度 beta=0.10；低 confidence 时 alpha 降到 0.25。
- 若实现 Kalman：过程噪声允许人缓慢移动；测量噪声 `R` 随 `1/confidence²` 增大，并对突然面积变化额外增大。

不要再把过滤后的框与上一张原始框用极低 IoU 一票否决。

### 4.3 短漏检策略

分三条输出：

1. `display_bbox`：可在最后实测后预测/淡出最多 700 ms，必须在网页标识 predicted。
2. `follow_bbox`：只在 CAM 链路持续、预测协方差可控且最后实测年龄≤350 ms时可使用；速度按年龄衰减。
3. `motion_fresh`：当前为 490 ms；若调整，应单独记录停车延迟与误停率后再定值。

建议跟随预测速度：

```text
decay = clamp(1 - age_ms/350, 0, 1)
predicted vx,wz = last_filtered_command * decay
```

如果不让预测驱动车轮，则在单帧漏检时保持 PERSON_FOLLOW 模式、速度立即为零；下一实测框回来后恢复。当前实现超过 490 ms 回到 IDLE；若下一阶段调整该时间，应同步验证断流停车延迟。

### 4.4 跟随控制改进

保留“同时计算 vx 和 wz、vy=0”。建议：

- 中心死区从 0.07 改为带迟滞：进入修正 0.075，停止修正 0.045，减少左右抖动。
- 距离死区同理：进入 0.10，停止 0.06。
- 参考面积不要只在前三帧后永远固定；人物居中且命令近零、连续 2 s 时，以 `alpha=0.01` 极慢更新，适应姿态变化，但进入跟随最初 5 s 冻结。
- 输出加速度限制：`Δvx≤0.04/100 ms`，`Δwz≤0.05/100 ms`；停止、ESTOP、timeout 不受斜率限制，必须立即归零。
- 首轮仍保留 maxVx=0.25、maxWz=0.30；不要同时提高速度和放宽识别。

### 4.5 验收

- 离线重放现有 97 帧序列，3 个 missing 不得导致单帧退出；>490 ms 断流必须停止。
- 一人居中静止 60 s：bbox 显示中断总时长 <2 s，任何单次闪断 <700 ms。
- 人从中心移动到左右：P90 重新居中时间 <2.5 s；稳态中心误差 <画宽 10%。
- 人前后移动：框面积稳态误差 <15%，不得因为水平偏差暂停前后修正。
- 两人交叉：不得突然锁到更远的第二人；歧义时停车或保持预测，绝不跳目标加速。

## 5. MAX30102：软质量评分、多速率估计与独立保持

### 5.1 不应做的事

- 不要只把全部硬阈值统一砍半。
- 不要在从未获得过某一数值时复制或猜测该数值。
- 不要让 finger=false、传感器掉线或样本超时继续显示“实时有效”。
- 不要用普通 Kalman 直接平滑原始 DC 很大的 IR/Red 并宣称医疗准确。

### 5.2 手指检测

现场空气 IR 约 400、有效接触约 123k，当前 50k 并非主要瓶颈，但可加入迟滞：

- enter：IR ≥35,000，连续 3 样本。
- exit：IR <20,000，连续 8 样本（约 320 ms）。
- 明显掉线、I²C error 或 sample age>250 ms仍立即无效。

这比单阈值更不容易在手指轻微移动时来回进入/退出。

### 5.3 波形预处理

建议保留原始 25 Hz，不提高传感器负担。将 51 点局部均值去趋势改为流式两级：

1. 慢 EMA 估 DC，时间常数 1.5–2.0 s。
2. `AC = raw - DC` 后用 3 或 5 点 Savitzky-Golay/对称 FIR 平滑。
3. 对 AC 使用 3 点 Hampel/中值滤波去单点脉冲。

如果继续使用窗口实现，HR 使用 150 点/6 s、每 12 或 13 点/约 0.5 s更新；SpO₂ 可保留 200 点/8 s。这样 HR 首次候选更快，同时 SpO₂ 仍用较长窗保证比值稳定。

### 5.4 候选质量改成软评分

保留物理硬界：sample 20–30 Hz、HR 45–150、SpO₂ 65–100、ratio R 0.15–2.0。其余项形成 0–1 quality：

```text
q = 0.30*q_pulse_corr
  + 0.25*q_spectral_snr
  + 0.20*q_acdc
  + 0.15*q_red_ir_corr
  + 0.10*q_ir_level
```

建议首轮门：

| 项 | 当前硬门 | 候选底线 | 满分附近 |
|---|---:|---:|---:|
| pulse autocorr | 0.30 | 0.22 | 0.55 |
| spectral SNR | 2.0 | 1.5 | 4.0 |
| AC/DC | 0.00002–0.030 | 0.00001–0.050 | 0.00005–0.015 |
| Red/IR corr（SpO₂） | 0.30 | 0.20 | 0.70 |
| Ratio R | 0.20–1.80 | 0.15–2.00 | 0.30–1.50 |

- HR：硬界通过且 `q≥0.42` 可作候选。
- SpO₂：硬界通过且 `q≥0.38` 可作候选。
- 首次“估计值”可在 1 个候选窗显示为 ACQUIRING；正式 LIVE 需要最近 3 窗中 2 个相容候选。
- 相容门保持 HR 12 BPM、SpO₂ 6%，避免过度放宽。

### 5.5 最终数值滤波

五窗中值会引入较大延迟。建议改为：先 3 窗中值去离群，再用一维自适应 Kalman。

HR 起点：

- 状态值为 BPM，初始协方差 `P=16`。
- 过程噪声 `Q=1.5 BPM²/s`。
- 测量噪声 `R=4 + 21*(1-q)²`。
- 每次输出仍限速，正常变化不超过 4 BPM/s；重新获得后可在 2–3 s 收敛。

SpO₂ 起点：

- `P=4`，`Q=0.05 %²/s`。
- `R=0.25 + 3.75*(1-q)²`。
- 输出每秒最多变化 1%，与当前 Demo 观感一致。

若不用 Kalman，则保留当前 `StableMetric`，但把“连续 2 好窗”改为“最近 3 窗至少 2 好窗”，坏窗保持改成以毫秒计而不是窗口数。

### 5.6 显示保持

- HR：取得 LIVE 后，坏候选最多保持 30 s；每次中等质量候选可更新 age，但不能用来大幅改值。
- SpO₂：取得 LIVE 后保持 12 s（当前 8 s可略延长）。
- finger=false：两项立即清空，不保持。
- sample>250 ms 或 report>2500 ms：网页状态 ERROR，数值清空。
- 网页应独立渲染 `hr_valid/hr_held/hr_age_ms` 和 `spo2_valid/spo2_held/spo2_age_ms`；不要用一个总 `healthy` 决定两项同时显示。
- OLED 同样逐项显示；held 值可用小点或 `~` 标记。
- 协议可新增字段而保留现有 `hr_bpm/spo2_pct/state`，确保旧网页兼容。

### 5.7 验收

- 有效手指放置后：PPG 波形 <1 s出现；HR 估计 P90 <8 s、LIVE P90 <10 s；SpO₂ LIVE P90 <12 s。
- 稳定手指 60 s：已取得值后，HR/SpO₂ 单次空白次数为 0；held 可以出现并明确标识。
- 人为插入 1–5 个坏窗：数值不消失；finger=false 后 <500 ms清空。
- 压力慢漂移回放：不得再出现 40 BPM 边界假值。
- 不宣称医疗精度；与指夹仪只比较趋势和合理范围。

## 6. MPU6050：先拒绝坏样本，再判断倾倒

### 6.1 当前问题判断

历史“轻微不水平就停”包含两类问题：

- 真正持续倾角触发 40°/200 ms。
- 舵机电源干扰造成不可能的加速度样本，曾把融合角打到 -70°/-116°。

硬件已通过“MPU 改接主板 3.3 V”解决主要根因。算法仍应阻止单个坏样本污染滤波器。

### 6.2 样本合理性与抗脉冲

在 `ImuFilter::update` 前增加：

- 非有限数：拒绝。
- accel norm `<0.20 g` 或 `>2.2 g`：不用于姿态校正；若连续 >100 ms才判 invalid。
- 相邻 accel norm 跳变 `>0.9 g/10 ms`：标 transient，进入 3 点中值，不直接更新倾角计时。
- 任一 gyro 接近量程饱和（建议 `|g|>245 dps`）：该轴本帧不可用于积分。
- 合法帧计数和 rejected frame 计数写 telemetry。

短拒绝期间保持上次姿态，运动安全的 100 ms硬新鲜度仍然计时；连续坏帧自然触发停车。

### 6.3 姿态滤波选择

首选保留互补滤波并增强：

- gyro 积分保持 100 Hz。
- accel norm 越偏离 1 g，动态增大 alpha（更信陀螺、少信加速度）。
- norm 在 0.90–1.10 g 时用当前 tau=0.5 s。
- norm 在 0.70–1.30 g 外时本帧只用陀螺预测。

若后续需要更好的三轴姿态，再换 Mahony；当前没有磁力计，不要把 yaw 说成绝对航向。

### 6.4 Demo 倾倒门建议

在通过坏样本拒绝测试后，再 A/B 以下值：

| 参数 | 当前 | DEMO_BALANCED 起点 |
|---|---:|---:|
| 警告角 | 无 | 35°，只显示 |
| 停车角 | 40° | 50° |
| 停车持续 | 200 ms | 350 ms |
| 恢复角 | 30° | 35° |
| 恢复持续 | 1000 ms | 1000 ms |
| 数据硬超时 | 100 ms | 100 ms，不改 |

若底盘在赛场有真实翻倒风险，停车角保持 45°而非 50°。必须用真实底盘倾斜试验选择，不可只凭桌面日志。

### 6.5 显示与安全分离

- 网页角度可用 100–150 ms EMA 平滑，减少数字跳动；这只用于显示。
- 旋转 360°的 yaw 累积用陀螺积分原路径，不要用网页平滑角。
- 倾倒判定使用合理性检查后的原始 accel angle + 融合角。
- ESTOP、当前 100 ms IMU timeout、未校准和传感器断线的响应继续单独测试与记录。

### 6.6 验收

- 车轮架空，短推/轻震 20 次：不得误停。
- 维持 30–40°斜坡：警告但按所选 profile 不应立即 fault。
- 维持 >50°超过 350 ms：必须停车。
- 拔掉 MPU SDA 或电源：<150 ms停止。
- 重放历史不可能坏样本：单帧不得把显示角打到极值，也不得污染后续 1 s。

## 7. OLED、网页与协议改造

建议扩展但不破坏现有消息：

```json
{
  "vision": {
    "gesture": {"label":"LIKE","confidence":0.41,"stable":true,"held":true,"age_ms":420},
    "person": {"found":true,"predicted":true,"age_ms":310,"confidence":0.52}
  },
  "health": {
    "hr_bpm":72,"hr_valid":true,"hr_held":true,"hr_age_ms":8200,
    "spo2_pct":96,"spo2_valid":true,"spo2_held":false,"spo2_age_ms":400,
    "finger_detected":true,"state":"VALID"
  },
  "imu": {"valid":true,"rejected_frames":2,"warning_tilt":false}
}
```

显示原则：

- fresh：正常颜色。
- held：仍显示值，旁边用 `保持`/淡色点，不清空。
- predicted bbox：虚线/淡框，不等同实测。
- stale/absent：才显示 `—/无结果`。
- 网页不要再用 `GESTURE_STABLE_CONFIDENCE` 对主控 stable 二次否决。
- health 两项独立渲染；其中一项暂缺不隐藏另一项。
- OLED 动画只在手势、HR、SpO₂ 均真正无可显示结果后 1.5 s进入；held 值应阻止动画。

## 8. 实施顺序

严格按阶段推进，每阶段均可回退，不要一次改完后才上车：

### 阶段 A：离线参数化与状态语义

1. 复制当前 profile 为 `SAFE_BASELINE`，保证二进制行为测试等价。
2. 集中阈值；新增状态/age 字段但不改判断。
3. 跑全部 C++、Python、Node 测试。

完成条件：baseline 全绿，协议向后兼容。

### 阶段 B：显示稳定，不触动车轮

1. 实现手势 2-of-3/evidence、health 独立 held、网页/OLED held/predicted 展示。
2. 使用现有 JSONL 离线回放。
3. 舵机 5 V 断开，串口 + 网页观察。

完成条件：短丢帧不闪，静态背景无动作。

### 阶段 C：PPG

1. 先加入 quality telemetry 和软评分，保留旧输出并行对比。
2. 再启用 6 s HR + 8 s SpO₂、多数窗与自适应滤波。
3. 完成 no-finger、慢漂移、真实手指 60–90 s。

完成条件：达到第 5.7 节，且不存在伪造/断线保持。

### 阶段 D：人物 bbox

1. 降 CAM 候选门并离线检查误检。
2. 上 alpha-beta/Kalman 和组合 gating，只显示预测，不驱动。
3. 舵机断电时验证跟随 target 输出。

完成条件：框连续、身份不跳、硬 490 ms截止仍通过。

### 阶段 E：IMU

1. 加坏样本拒绝和动态互补权重。
2. 先保持 40°/200 ms跑回归。
3. 真实倾斜 A/B 后才选择 45–50°/300–350 ms。

完成条件：短冲击不过早停，真倾倒/拔线必停。

### 阶段 F：低速运动验收

1. 舵机 5 V仍断开，确认启动、MPU校准、fault=false。
2. 四轮架空，接通舵机 5 V，低 speed scale。
3. 先 MANUAL，再 LIKE follow，再 DISLIKE，再 TWO/OK；ESTOP随时可用。
4. 最后落地做中心/距离阶跃测试。

完成条件：所有运动安全测试通过，才把 DEMO_BALANCED 设为比赛默认。

## 9. 必须新增/保留的测试

在现有 `tests/firmware/tuning_test.cpp` 和 `tracking_test.cpp` 上增量加入：

- 手势 `[0.48, 0.12, 0.46]` 可进入显示，但不能凭 holding 触发动作。
- LIKE 4 帧中 3 个 fresh 可启动；静态误框序列不能启动。
- person 320 ms 单 miss：模式保留；>490 ms：必停。
- bbox 两人歧义：不跳目标。
- PPG 一好一坏交替：已有值保持；never-acquired 不得编造。
- finger exit <500 ms 清空。
- 单帧异常 accel 不 fault；连续异常 >100 ms导致 invalid stop；持续大倾角 fault。
- 网页旧协议字段仍可解析；新 held/predicted 字段正确渲染；断线 reset。

必须重放：

- `evidence/final-health-raw-finger-30s.jsonl`
- `evidence/post-health-hold-fix-finger-valid-60s.jsonl`
- `evidence/final-motion-action-guard-static-60s.jsonl`
- `evidence/like-follow-online-sequence-servo-off-40s.jsonl`
- `evidence/post-like-gate-fix-online-sequence-30s.jsonl`

## 10. 构建、刷写与现场边界

- 先阅读 `reference_docs/AGENTS.md`、`WINDOWS_START_HERE.md`、`WINDOWS_AI_HANDOFF.md`、`windows-progress.md`。
- 使用当前源增量修改，不从旧 handoff 回灌。
- 先跑 `tools/check_firmware.py`、Python tests、Node tests。
- 任何刷写前重新识别 COM3/CAM 8 MB 与 COM6/主控 16 MB；不得凭端口号猜设备。
- 保护 NVS 标定和 FFat；若网页版本未变不要重写 FFat。
- 烧主控前舵机 5 V断开、四轮架空；复位后水平静置约 8 s，确认 `calibrated=true`、`tilt_fault=false`、`fault=false`，再接通舵机 5 V。
- 当前运动相关基线为：240 ms输出租约、490 ms CAM/person来源过期、100 ms IMU来源过期，以及 ESTOP、网络、NVS标定和控制权条件。若改动其中任何一项，需保留旧 profile，并提供响应时间、误停率和断流测试对比。
- 每一阶段把真实命令、包 hash、串口日志、通过/失败边界追加到项目 `docs/windows-progress.md`。

## 11. 预期最终结果

接手 Agent 完成后，比赛演示应呈现：

- 手势一出现就较快显示，偶发一个低分帧不会闪灭；运动动作仍需近景、多票和全部安全门。
- 人物框在短漏检时平滑保持/淡出，跟随不因一个 P 帧丢失退出；车始终同时修正中心与距离。
- 手指已有清晰波形时较快出现 HR/SpO₂；一项暂时低质量不会把另一项一起抹掉，已可信结果在短中期坏窗中明确以 held 方式持续显示。
- MPU 数字稳定，单个电气/机械冲击不误停；持续翻倒、断线和超时仍可靠停车。
- OLED、网页、串口对 fresh/held/predicted/stale 的解释一致，演示观感稳定但不隐藏真实故障。
