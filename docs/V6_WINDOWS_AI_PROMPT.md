# 给实物端 AI 的 V6 接手提示词

请在 `NeedleAss/spider-webite-dev` 的 `codex/final-polish` 接手 V6。先读 `docs/V6_DELIVERY.md` 核对冻结源码，再读 `docs/V6_DECISIONS.md`、`docs/V6_ACCEPTANCE.md`、`docs/V6_FIELD_RUNBOOK.md`、`docs/protocol.md`。V5/V6 review 位于 `docs/v6/source-briefs/`，用户最新决定优先：默认直接比手势，不需要网页先切手势模式。保留控制权、原始中立手势重新准入、标定和所有安全门槛。

你面对的是已有实物与私有配置，不能拿示例覆盖。请先只读盘点分支/提交/改动、Python/Node/Arduino/IDF、实际串口与双板身份、接线/供电、现存 NVS、Wi-Fi、舵机与超声配置。保护队友未提交成果。已有授权范围内完成软件准备和验证，不因为旧文档的泛化说法重复请求确认；需要接线、人手移动或实体动作条件不明时，说明具体缺项。

ZIP 解压后先 `py tools/verify_handoff.py`；Git checkout 核验 commit，不运行只针对导出包的 manifest 检查。记录 SOURCE_MANIFEST 与 EXPORT_INFO。不要用旧 V4 ZIP、仅刷固件不刷 Web，或混用不同 commit 的 CAM/主控/FFat。当前公开 `config/tracking-development.json` 和 CAM 示例仅 compile_only，不能改个验证标记就烧录。

执行顺序：现场身份与备份 → 同版本 CAM → 主控 observe → 数据/视频只读 → 架空校准 → 通过门槛后 manual → 再 Follow/手势 → 无 USB 稳定性。真实 COM、GPIO、板卡、FQBN、分区、标定来自枚举和现场证据，不能猜。使用 `tools/carerover.py` / `tools/tracking.py` 既有构建、验证和刷写入口，按 `docs/tracking-development.md`、`docs/WINDOWS_0915_HANDOFF.md` 中的环境流程执行；历史参数不得覆盖 V6 协议和当前配置。

重点复验：无网页时新手势可执行；旁观网页不抢权；手动期间拒绝新手势；正常松手归零并释放；持有的旧手势不复活；中立后新的动作才准入；DISLIKE 普通停止；急停不被手势解除；健康模式抑制动作。观察 OLED 与网页的识别/受理/目标，另行观察 PWM 和实体动作。

视频必须实测 CAM 直连：主控 HTTP 来源、CORS、单观看者 503、完整帧解码、冻结与断流、手动重试。AI FPS 不是视频 FPS；UART 检测框与 JPEG 无 frame ID，不能宣称逐帧同步。robot 遥测停止但 health/IMU 继续时，旧模式/速度/急停确认必须变未知，控制不可继续授权。

G01：独立验证安全任务自身停摆后 PWM/驱动撤销，分别记录目标、PWM 与实体停止。未通过前不放行有动力演示；不得删 watchdog/倾倒/有效期/NVS 或把 safetyTask 中同一执行路径的 240 ms 当作独立保证。没有硬件证据时填 NOT RUN，不填 PASS。

逐项填写 `docs/V6_FIELD_RUNBOOK.md` 的表：提交、构建版本、板卡/配置哈希、输入步骤、软件目标、PWM、实体结果、证据路径、测试人和时间。新修改先加定向复现与回归，再构建同版本、更新现场记录。不要在此阶段新增机器人功能，也不要为影片修改实际运动速度或保护阈值。
