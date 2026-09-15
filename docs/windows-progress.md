# Windows 现场进度（接手后维护）

初始状态：NOT RUN。此文件是空的现场记录模板，不是已经执行的测试结果。

## 当前交接点

- 当前阶段：W0，尚未在 Windows 运行
- 最近完成：Mac 软件交付和 ZIP 文件完整性核验
- 下一步：运行 `tools/verify_handoff.py`，记录环境、真实串口和板型
- 阻塞/待用户提供：现场连接后确定，不预设 COM6
- 最近修改及原因：待填写
- 下一条命令或人工操作：待填写

## 环境与设备

| 项目 | 实际值/证据 |
|---|---|
| Windows / Python / Git / Node | 待填写 |
| Arduino CLI / Core / 库 / FQBN | 待填写 |
| ESP-IDF / ESP-DL 版本及 commit | 待填写 |
| 主控型号、Flash、PSRAM、串口 | 待填写 |
| CAM 型号、Flash、PSRAM、串口 | 待填写 |
| 主控 / CAM profile 路径（不写密码） | 待填写 |
| Flash 与 NVS 备份路径、大小、SHA-256 | 待填写 |
| 接线 / 电源 / 架空状态 | 待填写 |

## 阶段记录

| 阶段 | 状态 | 构建版本 | 原始证据路径 | 问题与下一步 |
|---|---|---|---|---|
| W0 接收/环境/构建 | NOT RUN | — | — | — |
| W1 备份 | NOT RUN | — | — | — |
| W2 CAM | NOT RUN | — | — | — |
| W3 observe | NOT RUN | — | — | — |
| W4 校准 | NOT RUN | — | — | — |
| W5 manual | NOT RUN | — | — | — |
| W6 follow | NOT RUN | — | — | — |
| W7 十分钟无线 | NOT RUN | — | — | — |

## 修改与测试追加记录

每项记录：时间、复现步骤、预期/实际、原始 FAIL 日志、改动文件与原因、相关回归、设备结果、遗留项。修复后保留旧失败记录，不覆盖成 PASS。

## 2026-09-12 超声波集成增量

新增 HC-SR04 驱动、前方保护/绕障状态机、网页/OLED 和 Mock。Windows/实物测试仍为 NOT RUN；接手时另读 ultrasonic-development.md。前方探头和绕障参数分别有 verified 门禁，模板 null 不可填写推测值。

## 2026-09-15 Mac 接收与软件优化（未操作实物）

已合并 0915 现场修复和现有超声波功能，三档配置及新字段详见 [0915 开发记录](0915-demo-development.md)。原包内层 617 项 SHA-256 PASS；外层 ZIP 缺失，NOT RUN。根目录 C++（含双配置）/Node 21/Python 33 通过，主控三配置、CAM balanced stream、独立校准工程编译通过，浏览器桌面/手机显示与断流清空通过。

历史 Windows W2–W6 记录保存在原包 `reference_docs/windows-progress.md`，不能用本文件的旧模板反推现场从未测试，也不能把历史 PASS 算到新包。现场下一阶段为 safe/observe 复现与舵机断电 A/B；真人延迟、多人框关联、倾斜 A/B、落地及十分钟测试均待补。真实 PPG 回放首次 HR 14.35 s，低延迟目标尚未全部达到。
