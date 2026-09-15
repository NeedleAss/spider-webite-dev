# Windows 现场进度（接手后维护）

初始状态：已于 2026-09-15 在本机开始接手。历史 Mac/CI 和旧包现场结果仍不算本轮实物验收；以下只记录本机实际执行结果。

## 当前交接点

- 当前阶段：W0 Windows 环境与 compile-only 构建复现（PASS）；W1 设备核对与完整备份（PASS）；W2 设备烧录前编译已启动后按用户要求暂停
- 最近完成：主控三组、CAM 两组 compile-only 构建、本机浏览器 Mock 场景均 PASS；COM6/COM3 identity、Flash ID/容量与完整备份均完成；尚未烧录
- 下一步：恢复后从 SAFE_BASELINE 设备包编译继续，先 verify 包与分区，再烧录 CAM/主控并进行串口/网页验收；舵机仍保持断电、车轮架空
- 阻塞/待用户提供：W2 编译进程已按要求中止，设备未写入新固件；恢复时需确认现场仍满足舵机 5 V 断开和车轮架空
- 版本同步：本地提交 `922ed6d` 已生成；推送到 GitHub 因本机 Git Credential Manager 无可用凭据而被拒绝，待用户在本机完成 GitHub 登录后重试，未使用强制推送
- 最近修改及原因：仅补充本轮 Windows 可复现证据；尚未修改产品源码
- 下一条命令或人工操作：在舵机 5 V 断开、车轮架空条件下连接主控和 CAM USB；只做端口/identity 盘点，不立即烧录

## 环境与设备

| 项目 | 实际值/证据 |
|---|---|
| Windows / Python / Git / Node | Windows 11 家庭中文版 10.0.26200 build 26200；Python 3.12.10；Git 2.52.0.windows.1；Node 24.15.0 / npm 11.12.1 |
| Arduino CLI / Core / 库 / FQBN | Arduino IDE bundled CLI 1.5.1；esp32:esp32 3.3.10；ArduinoJson 7.4.2 等见 `build/environment-report.json`；当前只有 compile-only FQBN，实板 FQBN 待核对 |
| ESP-IDF / ESP-DL 版本及 commit | ESP-IDF v5.3.4 / `1b459d9c4950395dec12ce19256c73f9a41e306f`；ESP-DL v3.3.11 / `5d9c36063dddbe98b5387828c831d6bbadb1370f`；两者工作树 clean；IDF 自带 CMake 3.30.2、Ninja 1.12.1 |
| 主控型号、Flash、PSRAM、串口 | 初步确认 COM6 为主控：115200 只读日志含 `wireless_status`（`stage:5`、`backend:tracking`、`ap:true`、`firmware:fffc41be9b0db516-s5-follow`）、`imu_status`、`health`、`gesture`、`person`；Flash/PSRAM/FQBN 尚未用 esptool 读取 |
| CAM 型号、Flash、PSRAM、串口 | 初步确认 COM3 为 CAM：115200 只读日志含 CRC 正确的 `@G/@P` 帧和 `cam_metrics`（gesture/face/JPEG 约 2.4–3 FPS，gesture 约 248–249 ms，face 约 37–40 ms，Wi-Fi=true）；Flash/PSRAM/FQBN 尚未用 esptool 读取 |
| 主控 / CAM profile 路径（不写密码） | 新仓库 local profile 均缺失；旧现场目录存在 `wifi_secrets.h`、`board.local.json`、`cam-board.local.json`，尚未复制，待核对确为同一两块板 |
| Flash 与 NVS 备份路径、大小、SHA-256 | 主控 `build/backups/main-before-20260915-com6.bin`，16,777,216 B，SHA-256 `89102E245B56035C004265584E5F80BD18FD0EC7725EB6FA50CE5E204D9969B9`；CAM `build/backups/cam-before-20260915-com3.bin`，8,388,608 B，SHA-256 `CB117F3D78E612CC43DEF0E200E13A145CF5C3B201EB4240DA90738E0736D8B5`；NVS 包含在整片备份内，未单独擦除 |
| 接线 / 电源 / 架空状态 | 仅确认 COM6 有主控运行日志；未从串口推断供电/舵机/车轮状态，未操作复位、烧录或运动；现场安全状态仍待用户确认 |

## 阶段记录

| 阶段 | 状态 | 构建版本 | 原始证据路径 | 问题与下一步 |
|---|---|---|---|---|
| W0 接收/环境/构建 | PASS | `a7d1f4135c88a114d85a697e994ae9c8dee7ed04` | `build/environment-report.json`；`output/windows/0915-replay.json`；五个 `build/*-check` / `build/cam-*-compile_only` 包；localhost Mock 浏览器记录 | Python/Node/C++/清单/回放、主控三组、CAM 两组及 Mock PASS；全部软件/模拟结果，不能代替实物验收 |
| W1 设备核对/备份 | PASS | COM6=16MB、COM3=8MB，均为 ESP32-S3 rev0.2 / 8MB PSRAM；两板完整备份成功 | `build/backups/main-before-20260915-com6.bin`、`build/backups/cam-before-20260915-com3.bin`（本地产物，未入库）；两份 SHA-256 见上表 | NVS 未擦除；备份文件不提交 Git，恢复时保留原路径 |
| W2 CAM | NOT RUN | — | — | — |
| W3 observe | NOT RUN | — | — | — |
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

## 2026-09-12 超声波集成增量

新增 HC-SR04 驱动、前方保护/绕障状态机、网页/OLED 和 Mock。Windows/实物测试仍为 NOT RUN；接手时另读 ultrasonic-development.md。前方探头和绕障参数分别有 verified 门禁，模板 null 不可填写推测值。

## 2026-09-15 Mac 接收与软件优化（未操作实物）

已合并 0915 现场修复和现有超声波功能，三档配置及新字段详见 [0915 开发记录](0915-demo-development.md)。原包内层 617 项 SHA-256 PASS；外层 ZIP 缺失，NOT RUN。根目录 C++（含双配置）/Node 21/Python 33 通过，主控三配置、CAM balanced stream、独立校准工程编译通过，浏览器桌面/手机显示与断流清空通过。

历史 Windows W2–W6 记录保存在原包 `reference_docs/windows-progress.md`，不能用本文件的旧模板反推现场从未测试，也不能把历史 PASS 算到新包。现场下一阶段为 safe/observe 复现与舵机断电 A/B；真人延迟、多人框关联、倾斜 A/B、落地及十分钟测试均待补。真实 PPG 回放首次 HR 14.35 s，低延迟目标尚未全部达到。
