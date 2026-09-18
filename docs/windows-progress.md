> **2026-09-17 最终候选更新**：下方 Windows/烧录记录是历史现场证据。本轮 Mac 软件验证、代码与真实 CAD 展示已完成；没有连接/烧录/运动实物。当前入口：[FINAL_ACCEPTANCE.md](FINAL_ACCEPTANCE.md)，机器可读结果：[FINAL_RESULTS.json](FINAL_RESULTS.json)。历史软件版本不得替代当前候选验收。

# Windows 现场进度（接手后维护）

初始状态：已于 2026-09-15 在本机开始接手。历史 Mac/CI 和旧包现场结果仍不算本轮实物验收；以下只记录本机实际执行结果。

## 当前交接点

- 当前阶段：W0 Windows 环境与构建复现（PASS）；W1 设备核对与完整备份（PASS）；W2 CAM 烧录/串口验收（PASS）；W3 observe（IN PROGRESS）；主控与 CAM 的 DEMO_BALANCED 设备包均已烧录并通过串口验收
- 最近完成：主控 `7a160cd4dc396869-s5-follow`（stage5-follow DEMO_BALANCED）与 CAM `demo_balanced` stream 均已写入并通过 Hash 校验；两板完整备份与硬复位完成；CAM/主控 115200 串口日志已保存并核对新固件版本
- 下一步：保持舵机 5 V 断开、车轮架空，先加入 CareRover-EE68（密码由现场本地配置提供）并访问 192.168.4.1 做网页/无线 observe；随后再由现场授权进行传感器、人物框和运动验收
- 阻塞/待用户提供：尚未进行真人入镜、手指稳定放置、舵机落地或十分钟无线实物验收；这些需要现场输入和明确的运动授权
- 版本同步：本地提交 `922ed6d` 已生成；推送到 GitHub 因本机 Git Credential Manager 无可用凭据而被拒绝，待用户在本机完成 GitHub 登录后重试，未使用强制推送
- 最近修改及原因：仅补充本轮 Windows 可复现证据；尚未修改产品源码
- 下一条命令或人工操作：保持舵机 5 V 断开、车轮架空；电脑连接 `CareRover-EE68`（密码由现场本地配置提供），打开 `http://192.168.4.1/?transport=ws&video=mjpeg`，执行网页 observe。需要运动时必须先由用户明确授权并保留急停可达。

- 软件部署：已完成一轮”手动模式/姿态/视觉显示/手势响应”改进并通过主机回归；主控 `7a160cd4dc396869-s5-follow` 与 CAM `demo_balanced` 设备包已在本机（COM6/COM3）烧录并通过串口验收（见下方 2026-09-16 记录）。

## 环境与设备

| 项目 | 实际值/证据 |
|---|---|
| Windows / Python / Git / Node | Windows 11 家庭中文版 10.0.26200 build 26200；Python 3.12.10；Git 2.52.0.windows.1；Node 24.15.0 / npm 11.12.1 |
| Arduino CLI / Core / 库 / FQBN | Arduino IDE bundled CLI 1.5.1；esp32:esp32 3.3.10；ArduinoJson 7.4.2 等见 `build/environment-report.json`；实板 profile 已核对：主控 16MB/OPI PSRAM，CAM 8MB/OPI PSRAM |
| ESP-IDF / ESP-DL 版本及 commit | ESP-IDF v5.3.4 / `1b459d9c4950395dec12ce19256c73f9a41e306f`；ESP-DL v3.3.11 / `5d9c36063dddbe98b5387828c831d6bbadb1370f`；两者工作树 clean；IDF 自带 CMake 3.30.2、Ninja 1.12.1 |
| 主控型号、Flash、PSRAM、串口 | COM6：ESP32-S3 rev0.2、16 MB Flash、8 MB embedded PSRAM，MAC `68:ee:8f:60:68:24`；烧录后 115200 日志含 `firmware=6123d4056525afc4-s5-follow`、`stage=5`、`backend=tracking`、`ap=true`、`imu_status valid=true calibrated=true`、`vision_link bad=0` |
| CAM 型号、Flash、PSRAM、串口 | COM3：ESP32-S3 rev0.2、8 MB Flash、8 MB embedded PSRAM，MAC `44:b1:76:b9:fe:b8`；烧录后 115200 日志含 CRC 正确的 `@G/@P`、`cam_metrics`，gesture/face/JPEG 约 2.4–2.9 FPS，gesture 约 249 ms，face 约 38–40 ms，`jpeg_drops=0`、`capture_drops=0`、`wifi=true` |
| 主控 / CAM profile 路径（不写密码） | 本地忽略文件 `config/board.local.json`、`config/cam-board.local.json` 和 `firmware/main_wireless/wifi_secrets.h` 已按实测板型与现场 AP 配置生成；密码不入库 |
| Flash 与 NVS 备份路径、大小、SHA-256 | 主控 `build/backups/main-before-20260915-com6.bin`，16,777,216 B，SHA-256 `89102E245B56035C004265584E5F80BD18FD0EC7725EB6FA50CE5E204D9969B9`；CAM `build/backups/cam-before-20260915-com3.bin`，8,388,608 B，SHA-256 `CB117F3D78E612CC43DEF0E200E13A145CF5C3B201EB4240DA90738E0736D8B5`；NVS 包含在整片备份内，未单独擦除 |
| 接线 / 电源 / 架空状态 | 本轮烧录前按现场约定保持舵机 5 V 断开、车轮架空；串口烧录/抓取未驱动舵机。真实落地运动和供电负载仍未验收 |

## 阶段记录

| 阶段 | 状态 | 构建版本 | 原始证据路径 | 问题与下一步 |
|---|---|---|---|---|
| W0 接收/环境/构建 | PASS | `a7d1f4135c88a114d85a697e994ae9c8dee7ed04` | `build/environment-report.json`；`output/windows/0915-replay.json`；五个 `build/*-check` / `build/cam-*-compile_only` 包；localhost Mock 浏览器记录 | Python/Node/C++/清单/回放、主控三组、CAM 两组及 Mock PASS；全部软件/模拟结果，不能代替实物验收 |
| W1 设备核对/备份 | PASS | COM6=16MB、COM3=8MB，均为 ESP32-S3 rev0.2 / 8MB PSRAM；两板完整备份成功 | `build/backups/main-before-20260915-com6.bin`、`build/backups/cam-before-20260915-com3.bin`（本地产物，未入库）；两份 SHA-256 见上表 | NVS 未擦除；备份文件不提交 Git，恢复时保留原路径 |
| W2 CAM | PASS | `cam-stream-safe_baseline-windows_baseline_confirmed` | `build/windows/cam-after-safe.jsonl`；备份 `build/backups/cam-20260915-213322.bin` | 烧录全部分区 Hash PASS，硬复位后 `cam_metrics`/`@G`/`@P` 连续输出；未做真人手势/人物实物验收 |
| W3 observe | IN PROGRESS | `6123d4056525afc4-s5-follow` | `build/windows/main-after-safe.jsonl` | 主控已烧录且 `wireless_status ap=true`、IMU valid、vision_link bad=0；待网页连接和现场输入验证 |
| W4 校准 | NOT RUN | — | — | — |
| W5 manual | NOT RUN | — | — | — |
| W6 follow | NOT RUN | — | — | — |
| W7 十分钟无线 | NOT RUN | — | — | — |

## 修改与测试追加记录

每项记录：时间、复现步骤、预期/实际、原始 FAIL 日志、改动文件与原因、相关回归、设备结果、遗留项。修复后保留旧失败记录，不覆盖成 PASS。

### 2026-09-15 W0 Windows 首轮复现

- Git：按交接命令获取 `feat/main-wireless`，HEAD `a7d1f4135c88a114d85a697e994ae9c8dee7ed04`；确认基线 `ad633bc7161f5dd2b12723e455aba7d4cf4246ac` 是其祖先；开始时工作树 clean。
- Python：使用 3.12.10 新建 `.venv`，安装 `tools/requirements.txt`、`hardware/requirements.txt`、`mock/requirements.txt`，`pip check` PASS；Python unittest 33/33 PASS。
- Web：本机 Node 24.15.0（高于文档 Node 22 基线），`node --test tests\\*.test.js` 21/21 PASS。
- C++：第一次由 PATH 命中 `C:\\Users\\new20\\MinGW\\bin\\c++.exe`（GCC 6.3），因不支持项目使用的完整 C++17 `std::clamp`/inline variable 而 FAIL；未改源码规避。改为本机既有 `D:\\MSYS2\\usr\\bin\\g++.exe`（GCC 15.2）后 `tools/check_firmware.py` 全部 PASS，包括双调优档、保护与故障场景。
- 交付清单：`tools/verify_demo_handoff.py` 核验原包内层 617 项 PASS；外层 ZIP 不在仓库中，因此外层 ZIP SHA 仍 NOT RUN。
- 离线回放：使用 GCC 15.2 对原包 evidence 完成 DEMO_BALANCED 回放，报告为 `output/windows/0915-replay.json`。旧真实 PPG 首次 HR 仍是 14350 ms；旧人物摘要不含 bbox，因此此回放不能证明低延迟目标、框误差、多人连续性或实车运动。
- Arduino：项目环境命令自动找到 Arduino IDE 内置 CLI 1.5.1，已安装 esp32 Core 3.3.10，无需下载或切换 Core；库与路径见 `build/environment-report.json`。
- 主控构建：`SAFE_BASELINE observe` PASS（程序 1,081,478 B / 34%，动态内存 62,048 B / 18%）；`SAFE_BASELINE follow` PASS（1,090,854 B / 34%，62,072 B / 18%）；`DEMO_BALANCED follow` PASS（1,096,318 B / 34%，56,760 B / 17%）。产物均标记 `compile_only`，命令确认 `NO DEVICE WAS FLASHED`。
- CAM 工具链：首次和第二次从 GitHub clone ESP-IDF 均因 443 连接失败；失败目录均未残留。随后从旧交接目录复制并核验完全匹配锁文件的 ESP-IDF v5.3.4 `1b459d9...`，项目 `prepare --idf` PASS；ESP-DL 为 `5d9c360...`。运行 IDF `install.bat esp32s3` 补齐用户级工具及独立 Python 环境，未改变仓库源码。
- CAM 构建：`SAFE_BASELINE stream` PASS，app 二进制 `0x3ffe60`，app 分区剩余约 43%；`DEMO_BALANCED stream` PASS，app 二进制 `0x400550`，剩余约 43%。两包均标记 `compile_only`，命令确认 `NO DEVICE WAS FLASHED`。
- 浏览器 Mock：启动 `mock/server.py` 并访问 `http://127.0.0.1:8080/?transport=ws&video=canvas`。跟随模式启用固定向右演示绕障后先显示 18 cm、速度归零和“停车确认”，随后恢复 120 cm 并显示“绕障已完成”；模拟断线时显示“Telemetry stale; input released”、速度归零，视觉/健康/遥测清空，随后自动重连；再次在绕障期间触发急停，收到 ACK，界面进入“急停锁定”，速度保持 `+0.00 / +0.00 / +0.00` 且模式控件禁用。解除急停出现人工确认框后选择取消，未越过确认。记录为 Mock PASS，不是实物停车或运动验收。
- 误用记录：在 Git 工作副本根目录直接运行 `tools/verify_handoff.py` 得到 `SOURCE_MANIFEST.json missing` / `EVIDENCE_MANIFEST.json missing`。该脚本固定校验“解压发布包根目录”且不接收路径参数，因此此 FAIL 不代表仓库内容损坏；本轮适用的 `verify_demo_handoff.py <0915原包>` 已 617 项 PASS，保留本记录避免将不适用入口误报为产品故障。
- 设备：串口盘点只有蓝牙 COM4/COM5。未据历史资料猜测主控/CAM COM、FQBN、Flash、PSRAM、供电或校准状态，也未烧录。

### 2026-09-15 W1 只读串口身份核对（主控）

- Windows PnP 重新枚举到 `USB-SERIAL CH340 (COM6)`（VID `1A86` / PID `7523`）；另有短暂的 COM3 Unknown 项，打开前已消失，未把它当作 CAM。
- 在不触发 reset、不开启 DTR/RTS 脉冲、不写入串口的前提下，以 115200 波特率只读 COM6 5 秒，捕获 62 行。日志连续包含 `wireless_status`、`imu_status`、`health`、`gesture`、`person` 和 `vision_link`：`firmware=fffc41be9b0db516-s5-follow`、`stage=5`、`backend=tracking`、`ap=true`、`imu address=0x68 valid=true calibrated=true`，因此 COM6 可确认是当前主控而非 CAM。
- 该捕获仅证明串口身份和运行状态：没有读取 Flash ID、没有整片备份、没有烧录、没有证明实物运动/人物框或无线网页验收。`health` 当时为 `no_finger`、`person found=false` 属于现场输入状态，不判为产品故障。
- COM6 捕获摘要仍保留工具给出的 `hardware_acceptance=NOT EVALUATED`；下一步是现场确认 CAM 单独端口和板型，再在舵机断电/车轮架空条件下执行 W1 备份。
- 版本同步：尝试 `git push origin feat/main-wireless` 返回“unable to get password from user”；提交仍安全保存在本地，远端尚未包含 `922ed6d`。

### 2026-09-15 W1 只读串口身份核对（CAM）

- CAM 重新接入后，Windows PnP 同时显示 `USB-SERIAL CH340 (COM3)` 与主控 `COM6`；COM3 状态为 OK，未再依据端口号猜测，而是读取协议内容确认归属。
- 在不触发 reset、不开启 DTR/RTS 脉冲、不写入串口的前提下，以 115200 波特率只读 COM3 5 秒，捕获 31 行，其中 28 个 CRC 正确的 `@G/@P` 帧和 3 个 `cam_metrics`。指标显示 gesture 约 2.50–2.86 FPS、face/JPEG 约 2.38–2.99 FPS、gesture 推理约 248–249 ms、face 推理约 37–40 ms、`jpeg_drops=0`、`capture_drops=0`、`wifi=true`，可确认 COM3 为 CAM。
- 当次画面为空背景：`person_found=0`、`max_person_gap_ms=438`，不能作为人物识别或跟随验收；这次捕获只完成串口身份/链路健康检查。

### 2026-09-15 W1 Flash ID 与完整备份

- 使用 esptool 读取两板身份（用户已授权进入烧录流程）：COM6 为 ESP32-S3 rev0.2、16MB Flash、8MB embedded PSRAM、MAC `68:ee:8f:60:68:24`；COM3 为 ESP32-S3 rev0.2、8MB Flash、8MB embedded PSRAM、MAC `44:b1:76:b9:fe:b8`。容量与私有 local profile 完全匹配。
- 主控从地址 0 读取 `0x1000000` 字节成功；CAM 从地址 0 读取 `0x800000` 字节成功。备份文件大小与目标容量一致，SHA-256 已写入表格。备份包含 NVS，未执行擦除或修改。
- 随后启动 SAFE_BASELINE 主控设备包编译；因用户要求暂停，在 Arduino 编译完成前中止。此次中止不涉及串口写入，未产生设备变更；恢复时可直接重新运行同一命令。

### 2026-09-15 W2 CAM SAFE_BASELINE 实物烧录与串口验收

- 使用 `tools/tracking.py cam-flash build/cam-stream-safe_baseline-windows_baseline_confirmed --port COM3`，以 venv 的 esptool 5.1.0 执行；先自动保存整片 8 MB 备份 `build/backups/cam-20260915-213322.bin`（SHA-256 `5E24EAB61E519A9C102454B89F5A6BDB7F9C83AF6F3D55A8E16D1EB5B0B358E6`），再写入 bootloader、分区表和应用。
- 三个写入区域均报告 `Hash of data verified`，最终重新读取 Flash ID 仍为 8 MB，并通过 RTS 硬复位；无擦除 NVS 的操作。
- 115200 串口抓取 `build/windows/cam-after-safe.jsonl`：连续出现 CRC 正确 `@G/@P`，`cam_metrics` 显示 `wifi=true`、gesture/face/JPEG 约 2.4–2.9 FPS、gesture 约 249 ms、face 约 38–40 ms，`jpeg_drops=0`、`capture_drops=0`。本次画面为空背景，不能据此宣称真人手势或人物跟随 PASS。

### 2026-09-15 主控 SAFE_BASELINE stage5-follow 实物烧录与串口验收

- 使用 `tools/carerover.py flash build/stage5-follow-6123d4056525afc4-device --port COM6 --baud 460800 --only all`；先自动保存整片 16 MB 备份 `build/backups/main-before-20260915-214923.bin`（SHA-256 `CBBCFBBF34713707AD8A545CC334F1801C978CD583758ED1D01874DE88E0E655`），随后写入 bootloader、分区表、boot_app0、应用和 FFat。
- 所有写入区域均报告 `Hash of data verified`，检测到 16 MB Flash，最终通过 RTS 硬复位；未擦除 NVS。
- 115200 串口抓取 `build/windows/main-after-safe.jsonl`：`firmware=6123d4056525afc4-s5-follow`、`stage=5`、`backend=tracking`、`ap=true`、`mode=IDLE`、`estop=false`；`imu_status address=0x68 valid=true calibrated=true`；`vision_link valid` 持续增长且 `bad=0/stale=0/resync=0`；健康/手势/人物事件均能持续输出。未因无手指、无人入镜而判为模块故障。
- 当前只完成软件写入与串口健康证据；网页连接、真人入镜跟随、手势动作和车轮运动仍属于后续 W3–W7 现场验收。

### 2026-09-15 W3 前置与同步状态

- 主控串口抓取证明 `ap=true`、固件 `6123d4056525afc4-s5-follow`、IMU `0x68 valid=true calibrated=true`；当前 Windows Wi-Fi 仍连接 `Tsinghua-Secure`，未擅自切换网络，因此网页 observe 尚未执行。
- `git push origin feat/main-wireless` 本轮再次尝试时因 HTTPS connection reset 失败；本地提交 `b7955c9` 已保留，未使用强制推送。待网络稳定或用户完成 GitHub 凭据后重试。

### 2026-09-15 手动/姿态/视觉回归修复（尚未烧录）

- 根因：主控 `SafetyController::tick()` 原先在 CAM 来源超过 490 ms、IMU 来源超过 100 ms 或滤波器瞬时无效时直接 `stop()`；模式被置为 `IDLE` 后，网页下一包非零速度自然收到 `NOT_IN_MANUAL`。视觉发布在 SAFE_BASELINE 直接采用原始人脸包，单帧漏检就清框。
- 修复：CAM/人物来源门限调整为 900 ms；IMU 新鲜度调整为 180 ms，单次 I²C/坏帧在窗口内保留最近健康状态；倾角改为 55°、恢复 42°、持续 400 ms；`BoxTrack` 改为有界常速度 Kalman（仅显示/关联，不驱动车轮），所有调优档均启用短时框保持；手势显示独立保持 2.4 s/无手 1.5 s；CAM 调度改为两帧手势一帧人脸，提高手势帧率。
- 回归：`tools/check_firmware.py` 全部测试 PASS；`npm test` 21/21 PASS。新主控包 `build/stage5-follow-bd75ab23c459ce7b-device`、新 CAM 包 `build/cam-stream-demo_balanced-windows_baseline_confirmed` 均已 compile-only 构建，尚未写入设备。

## 2026-09-12 超声波集成增量

新增 HC-SR04 驱动、前方保护/绕障状态机、网页/OLED 和 Mock。Windows/实物测试仍为 NOT RUN；接手时另读 ultrasonic-development.md。前方探头和绕障参数分别有 verified 门禁，模板 null 不可填写推测值。

## 2026-09-15 Mac 接收与软件优化（未操作实物）

已合并 0915 现场修复和现有超声波功能，三档配置及新字段详见 [0915 开发记录](0915-demo-development.md)。原包内层 617 项 SHA-256 PASS；外层 ZIP 缺失，NOT RUN。根目录 C++（含双配置）/Node 21/Python 33 通过，主控三配置、CAM balanced stream、独立校准工程编译通过，浏览器桌面/手机显示与断流清空通过。

历史 Windows W2–W6 记录保存在原包 `reference_docs/windows-progress.md`，不能用本文件的旧模板反推现场从未测试，也不能把历史 PASS 算到新包。现场下一阶段为 safe/observe 复现与舵机断电 A/B；真人延迟、多人框关联、倾斜 A/B、落地及十分钟测试均待补。真实 PPG 回放首次 HR 14.35 s，低延迟目标尚未全部达到。

## 2026-09-16 手动/IMU/视觉第二轮放宽（仍未烧录）

- 根因补充：`DEMO_BALANCED` 原先把正常车体振动/加速度变化当作 `transient` 坏帧；坏帧持续超过旧的 180 ms IMU 新鲜度后，`SafetyController::tick()` 将模式置为 `IDLE`，网页下一次非零 `cmd_vel` 因而得到 `NOT_IN_MANUAL`。这不是摇杆协议错误，而是模式已被安全控制器收回。
- IMU：删除动态加速度瞬态拒绝，仅拒绝非有限值、`|a|<0.12 g`、`|a|>3.5 g` 或 `|gyro|>1000 dps` 的物理异常；实际停车仍要求滤波后的俯仰/横滚达到 55° 并持续 400 ms，恢复阈值 42°。IMU 新鲜度窗口改为 750 ms。
- 链路与跟随：CAM/人物来源窗口改为 1200 ms，人物显示窗口 1400 ms；人物跟随接受分数为 0.40（CAM balanced 候选阈值 0.32），目标丢失宽限 1.1 s；命令看门狗 300 ms，仍要求网页持续刷新命令。
- 视觉：`BoxTrack` 使用有界常速度 Kalman（中心 x/y、log-area），只用于检测框显示和关联，不直接驱动车轮；预测显示上限 1.0 s。前端 `VISION_STALE_MS=1400`，覆盖当前 CAM 的 2G:1P 调度周期，单个漏检不会清框。
- 手势：CAM 采用两帧手势后再跑一帧人脸；显示进入/保持门限为 0.30/0.14（safe 档仍为 0.35/0.18），保持 2.6 s、无手 1.7 s；动作门限 balanced 为 0.40。
- 回归证据：`tools/check_firmware.py` 全部固件套件 PASS；`npm test` 21/21 PASS。主控包 `build/stage5-follow-7a160cd4dc396869-device`（16 MB，固件版本 `7a160cd4dc396869-s5-follow`）与 CAM 包 `build/cam-stream-demo_balanced-windows_baseline_confirmed`（8 MB，应用 `0x400e70`，约 43% 分区余量）均已 compile-only 构建；manifest 的 `source_commit=23ff6505b5cc8caf0d63654aadeee88d6ec25899`、`source_dirty=false`，命令输出 `NO DEVICE WAS FLASHED`。
- 当前设备状态：COM6/COM3 仍运行上一轮 SAFE_BASELINE，未因本次修复自动覆盖。需现场明确授权后，才可按备份和 115200 串口步骤烧录并做真人/实车验收；本机 Wi-Fi 未切换。

## 2026-09-16 DEMO_BALANCED 实物烧录与串口验收

- 现场授权后，在本机 COM6（主控）/ COM3（CAM）烧录 DEMO_BALANCED 设备包：均先自动整片备份、再逐区写入并 `Hash of data verified`、RTS 硬复位，未擦除 NVS，未驱动舵机。
- 主控：`tools/carerover.py flash build/stage5-follow-7a160cd4dc396869-device --port COM6 --baud 460800 --only all`，写入 bootloader / partitions / boot_app0 / app / ffat；整片 16 MB 备份 `build/backups/main-before-20260916-173024.bin`（16,777,216 B，SHA-256 `452d8710d368d99be4334c857b70802a59aa88ac80726b49a77463993f400e73`）。
- CAM：`tools/tracking.py cam-flash build/cam-stream-demo_balanced-windows_baseline_confirmed --port COM3`，写入 bootloader（21,552 B @0x0）/ partition-table（3,072 B @0x8000）/ app（4,198,000 B @0x10000）；整片 8 MB 备份 `build/backups/cam-20260916-173019.bin`（8,388,608 B，SHA-256 `9dd09f7fedfc8ca5b8d3e2040f4391086c7f4a86260fcbaf5344f931c7ee5231`）。
- 主控 115200 抓取 `build/windows/main-after-balanced.jsonl`：`firmware=7a160cd4dc396869-s5-follow`、`stage=5`、`backend=tracking`、`ap=true`；IMU `0x68 valid=true calibrated=true`；`min_heap=218132` / `min_psram=8324064`。`mode=FAULT`、`stop_reason=boot`、`tilt_fault=true`（`roll≈-67.8°`）为架空/倾斜姿态下安全控制器正确保持停车，非故障；`vision_link valid=0` 因当时 CAM 正在自行烧录未上线。
- CAM 115200 抓取 `build/windows/cam-after-balanced.jsonl`：296 个 CRC 正确 `@G/@P`、0 坏帧；`cam_metrics` 显示 gesture≈3.14 FPS（较 SAFE 的 ~2.5–2.86 提升，印证 2G:1P 调度）、face≈1.35–1.75 FPS / 39–40 ms、JPEG≈2.69 FPS、`jpeg_drops=0`、`capture_drops=0`、`wifi=true`、`min_heap=36807` / `min_psram=2516924`。
- 遗留：真人入镜、手指稳定放置、舵机落地、十分钟无线实物验收仍未执行；网页 observe 与运动授权仍按现场约定待办。

## 2026-09-16 跟随灵敏度/步长/丢目标续跟 调整（已烧录）

- 用户要求：更灵敏识别人脸移动、更小步长、框大小稳定、参考框=首次识别框、出框不退出跟随（30 s 等待）、暂不改 IMU 校准门禁（第 7 点跳过）。
- 改动（仅主控）：`person_follow.h` 降低中心/距离死区（0.04/0.025、0.05/0.03）、增益 0.40/0.50、`maxVx=0.08`/`maxWz=0.10`、加减速限幅 0.15/0.20；参考框由"前三帧中位数"改为"首帧面积"；`demo_tuning.h` 增 `FollowLostTimeoutMs=30000`；`safety_controller.h` 的 `person()` 在 `follow_.lost()` 时不再 `stop()`，改为保持不动并 30 s 后 `target_lost_timeout`，前方绕障丢目标仍即时停。
- 框大小稳定：沿用 `BoxTrack` 对数面积 Kalman + 跟随 EMA（0.30）；EMA 未进一步调低，避免拖慢收敛并破坏 SAFE_BASELINE 回归。
- 回归：`tools/check_firmware.py` 8 套全 PASS（经 MSYS2 `bash -lc` 用 `CXX=g++`，规避 Git Bash 下 cygwin g++ 找不到 `<cmath>` 的挂载问题）；`tests/firmware/tracking_test.cpp` 参考框断言改为首帧、新增 30 s 续跟超时用例。
- 构建/烧录：`build/stage5-follow-a0a4b33575a57b1a-device`（`a0a4b33575a57b1a-s5-follow`，程序 34%/动态 17%）；刷 COM6，整片备份 `build/backups/main-before-20260916-212413.bin`（SHA-256 `db7a150896d75077fd274bfed627104a983a41aeb14c0cb23add473a67a1e3b3`）。
- 串口：`build/windows/main-after-followtune.jsonl` 确认 `firmware=a0a4b33575a57b1a-s5-follow`；`mode=FAULT`/`tilt_fault=true`（`roll≈-101°`）为架空倾斜姿态，非故障。
- 遗留：真人入镜验证跟随灵敏度/小步/框稳定/出框续跟仍待现场；IMU 校准门禁（第 7 点）按用户要求未改。

## 2026-09-16 去除全部运动限制 + IMU 竖直安装（已烧录）

- 根因：现场 IMU 以矩形长边（Y 轴）竖直安装，重力落在 Y 轴上；旧代码按水平安装（重力在 Z）算倾角，`roll=atan2(ay,az)≈-101°`，瞬时锁存 `tilt_fault` → 模式退回 Idle → 下一次 `cmd_vel` 报 `NOT_IN_MANUAL`。
- 按用户要求去除全部运动限制（`safety_controller.h`）：移除 `watchdog`、`imu_timeout`/`imu_invalid`、`tilt_fault`、`camera_timeout`、`person_timeout`、`owner_watchdog`、`network_down`、`owner_disconnected` 的 `stop()`；`velocity`/`setMode`/`autonomousFollow`/`autonomousTurn` 不再因 IMU 健康/校准/相机/网络而拒绝；`snapshot().fault` 与 `clear()` 仅保留真正硬件 `fault`。仍保留：急停 `estop`、硬件 `fault`、前方超声波绕障。
- IMU 竖直安装（`imu_filter.h`）：`pitch=atan2(ax,ay)`、`roll=atan2(az,ay)`（Y 向上、重力沿 +Y 为水平）；互补滤波 yaw 用 gyro Y（`gy`）、pitch 用 `gz`、roll 用 `gx`。注：+Y 向上这一符号约定待真车水平时确认，若水平时 pitch/roll≈180° 需翻转符号。
- 回归：`tools/check_firmware.py` 8 套全 PASS（`safety/tracking/front/demo/tuning` 断言改为"模式在断开/超时/断网/丢相机时保持"，IMU 用例改竖直输入）；经 MSYS2 `bash -lc` 用 `CXX=g++`（Git Bash 下 cygwin g++ 因挂载找不到 `<cmath>`）。
- 构建/烧录：`build/stage5-follow-0baad7a2cc3f0802-device`（`0baad7a2cc3f0802-s5-follow`，程序 34%/动态 17%）；刷 COM6，整片备份 `build/backups/main-before-20260916-230338.bin`（SHA-256 `9a0f269837bcedcb7795c9e5a92bfceae1c90abbdc61c4a1b1e53768fc2a3a85`）。首次烧录因读备份时 Windows 串口 `PermissionError(13)` 中断（未写、未损坏），重试成功。
- 串口 `build/windows/main-after-unrestricted.jsonl`：`firmware=0baad7a2cc3f0802-s5-follow`；`mode=IDLE`、`fault=false`、`estop=false`（板上倾斜时不再显示 FAULT，网页可进入手动）。
- 卡尔曼说明：`BoxTrack`（`box_track.h`）确有常速度卡尔曼（`ScalarKalman`×3：中心 cx/cy + 对数面积 area），用于人物框显示与 DEMO_BALANCED 跟随测量（`track_.view()`）；IMU 倾角走互补滤波（陀螺+加速度 `alpha` 融合），非卡尔曼。
- 遗留：真车水平时确认倾角符号；运动限制已全去除，急停/硬件故障/前方绕障为唯一剩余保护。

## 2026-09-17 IMU 实为 X 轴竖直 + 恢复倾角保护 + 跟随解耦/预测/手势（已烧录）

- IMU 实测 `accel_g≈[1.03,-0.11,-0.07]`，重力落在 +X：现场实为 **X 轴竖直**（非 Y）。`imu_filter.h` 改为 `pitch=atan2(ay,ax)`、`roll=atan2(az,ax)`；互补滤波 yaw 用 `gx`、pitch 用 `gz`、roll 用 `gy`。串口确认 `pitch≈-6°`、`roll≈-4°`、`tilt_fault=false`。
- 按用户要求**恢复倾角保护**：`safety_controller.h::imu()` 在 `tilt` 且运动模式时恢复 `stop("tilt_fault")`（ImuFilter 55°/400ms 锁存）。其余限制仍去除。
- 转弯只一边轮子：跟随把 `vx`+`wz` 同时输出，`RR=vx-wz≈0` 被抵消。改为**解耦**：偏离中心时纯旋转（四轮同转）、居中后才前后；并提高 `maxVx=0.15`/`maxWz=0.20`（前后跟随原 `maxVx=0.08` 几乎无效果）。
- 人脸预测：跟随测量改用 `track_.view(now+lookaheadMs=300)`，用 BoxTrack 常速度卡尔曼预测未来 300 ms 人脸位置。
- 手势：`TWO`→顺时针一周（已有）、新增 `THREE`→逆时针一周（原逆时针为 OK，二者并存）；`LIKE`→开跟随、`DISLIKE`→停跟随（已有，4 帧确认/3 帧释放）。
- 回归：`tools/check_firmware.py` 8 套全 PASS；IMU 用例改 X 竖直输入；新增 THREE 手势用例。
- 构建/烧录：`build/stage5-follow-6a29b278dd82b6f6-device`（`6a29b278dd82b6f6-s5-follow`）；刷 COM6，整片备份 `build/backups/main-before-20260917-000518.bin`（SHA-256 `327e30b9064bc99d4494bf2552e0532bd08b8410d86e0e219db4db2fd437b4b1`）。
- 超声：`front_config.h` 定义 `FrontInstallation{trig,echo,FrontConfig}`；允许引脚 1/2/14/15/16/21/38–42；功能=前方障碍保护（stopCm/slowCm/warnCm/releaseCm）+ 自动绕障 demo bypass（lateralSpeed/forwardSpeed/settleMs/marginMs/passMs/lateralTimeoutMs）。接入需按 `front_config.example.h` 建 `front_config.local.h` 填 trig/echo 与阈值并置 `enabled`，`verified` 待实测后再置真。

## 2026-09-17 最终优化候选（Mac 软件证据）

- 基线：`058ce89bd1aa5b5da0dbf89101f4625df70ca6df`；工作分支 `codex/final-polish`。远端新提交与两轮 review 正文已经对照；独立附件未取得，未冒称重跑原脚本。
- 修复：键盘/指针轴残留、手动超时、所有者断开、人物静默、WAIT_TARGET 周期退出、动作普通停止、手势期限、倾倒拒绝帧计时/缺失锁存、运动准入；保留 +X 安装与已有调优。
- PASS：JS 24 用例；Python 37 用例；C++ 10 套；独立 SAFE22/22、DEMO23/23；ASan/UBSan 8 组。基线 FAIL 与最终日志分别保留。
- PASS：SAFE follow、DEMO follow、SAFE observe 完整 compile_only 构建，版本/清单见 FINAL_RESULTS.json。首次本机 ctags 架构错误 FAIL 保留，使用同版原生工具局部覆盖后构建成功。没有烧录。
- PASS：真实 CAD 15 类网格/20 可见实例、GLB Validator 零错误零警告；本地浏览器桌面/手机、拆解/选择/收拢、原理说明、静态降级、急停与普通停止核验。原生 SolidWorks 引用/配合 NOT RUN。
- 控制台提高字号/对比度、触控尺寸与手机安全区；Mock 明确为模拟。视频路径文档纠正为浏览器直连 CAM 的 `.2/stream`。
- 发布包包含当前代码、展示页、来源/证据 SHA-256 清单；不含原始 CAD、构建目录、设备凭据或可直接烧录的设备包。导出清单与代码/证据核对通过后才交接。
- NOT RUN：当前候选 Windows/真实串口/接线/校准/PWM/实体停止/无线十分钟。安全任务停摆时撤销输出仍是发布阻断，不能用页面零速度代替。
- 当前文档已去除 AP 明文密码，历史未重写；现场配置由持有人维护。

## 2026-09-18 — V6 first software checkpoint (Mac, not field acceptance)

User approved V6 implementation with direct device gestures; mandatory webpage gesture authorization is superseded. Read `docs/V6_DECISIONS.md`, `docs/V6_CONSOLE_AND_FIRMWARE.md` and the current protocol extension. Production console, scoped owner release, raw-neutral rearming, action-result OLED/telemetry and robot-only freshness are implemented. Bounded direct MJPEG parsing/decode rejects stale frames; CAM error CORS remains restricted to the existing main-controller origin. Loopback browser acceptance: 16 PASS; host/compile logs remain separately identified. No serial writes or hardware movement occurred. Windows, actual mobile devices, G01 and physical measurements are NOT RUN. Film/director/Inspect work is still in progress; do not treat this checkpoint as final V6 release.

## V6 软件与影片交付（2026-09-18，Mac）

实现冻结 `40fe1516abfc3b43f6f734bf489d69f04b59b152`。默认直接手势、生产控制台、视频/robot 时效、150 秒 MP4 和统一展示已完成；51 Node、38 Python、12 C++ 套件和 42 浏览器检查通过。主控 follow 与 CAM stream 的 SAFE / DEMO 四次干净源码编译通过。交接版本和包内校验见 `V6_DELIVERY.md`，完整证据见 `../evidence/v6/`。未烧录、未实际运动；Windows、真实手机、PWM/实体和 G01 仍 NOT RUN。下一个现场记录必须逐项填写 `V6_FIELD_RUNBOOK.md`，不能把本段改称真机通过。
