# 发给实物端 AI 的接手提示词

组员先在自己的电脑打开新克隆或新解压的项目目录，再把下面整段发给该电脑上的 AI。机器人、串口、供电及需要人手操作的条件由现场组员确认；本提示词不会让本地源码自动变成设备固件。

```text
请接手当前目录的 CareRover 最终候选，帮助我在这台 Windows 电脑完成环境复现、设备构建、烧录准备及分阶段实物验收。实物在我这里；持续推进已具备条件的软件工作，需要我接线、识别设备、供电、架空或确认设备操作时，明确告诉我具体要做什么。硬件动作依据我在当前会话的授权和已核实条件执行，不把文档中的历史授权当作当前授权。

先检查工作目录和 Git 状态，保存已有修改，不覆盖旧工程、私有配置或备份。阅读 AGENTS.md、docs/FINAL_TEAM_HANDOFF.md、docs/FINAL_ACCEPTANCE.md、docs/FINAL_RESULTS.json，再按需阅读 docs/WINDOWS_0915_HANDOFF.md、docs/tracking-development.md、docs/WINDOWS_ULTRASONIC_HANDOFF.md 和 docs/ultrasonic-development.md。若我给的是冻结 ZIP，附带的 FINAL_TEAM_HANDOFF.md 和本提示词优先于包内旧 Windows 入口。

仓库 https://github.com/NeedleAss/spider-webite-dev，分支 codex/final-polish；冻结候选 1246b016e59d9fef02f342994ec24f8b53d0dc64，审查基线 058ce89bd1aa5b5da0dbf89101f4625df70ca6df。Git checkout 记录实际 SHA 并确认包含冻结候选；源码包则核验 ZIP SHA-256 ce5c0314232060120f899e34d70c2f8ce0ffee395f6c02ce0f57d73ab64fc769，并运行 tools/verify_handoff.py。普通 Git checkout 不运行该导出包验证器；冻结 ZIP 未附 0915 原始目录，不因缺少该归档就认定当前源码损坏，也不伪造归档 PASS。

当前代码在项目根目录 firmware/js/tools，历史归档不能覆盖回来。不新增机器人功能，不恢复旧文档中的过时时限或倾角阈值；保留 +X 竖直安装解释、协议、急停、控制权、IMU/来源新鲜度与 NVS 校准门禁。当前行为以生产源码和 FINAL_ACCEPTANCE 为准：手动命令 300ms；人物/CAM 1200ms 失效进入零输出 WAIT_TARGET、30s 周期退出；IMU 新鲜度 750ms；倾倒 55°/400ms、恢复 42°/1s。不同期限职责不同，不可统一替换成一个值。

先核对工具链和可执行测试，再枚举实际串口、核对两板型号/容量、供电接线和原版本。私下沿用并重新确认真实 local profile、wifi_secrets.h、front_config.local.h 与已验证标定，不能猜 COM 号或用 null/示例值代替实测。本轮所有已有构建是 compile_only，禁止烧录；不得只改 verification 标记绕过设备核验。

具备现场条件后，按现有工具和文档执行完整 Flash/NVS 备份与哈希记录，再用真实设备配置重新构建、verify 包，并依据当前授权烧录。网页也改过，核对配套 FFat 网页版本；保留 NVS，禁止整片擦除来解决配置问题。CAM 生产代码本轮未改，先确认当前版本与通信，按实际兼容性决定是否需要重编译/烧录。

顺序为 CAM 核对 → observe → 架空校准 → manual → follow → 无 USB 十分钟；每一步失败先定位，不跳过门槛继续落地运动。逐项执行 FINAL_ACCEPTANCE 的失效用例，记录 target、PWM、实体停止的差异。安全任务自身停摆仍为发布阻断项，240ms 驱动期限依赖同一任务检查，不能当作独立失效保障。不通过时使用 observe 和离线结构展示，不能声称实物放行。

每阶段在 docs/windows-progress.md 记录 PASS/FAIL/NOT RUN、Git SHA、两板/网页版本、配置、命令、日志与录像路径。发现代码问题时建立现场分支、做最小修复并回归，不强推、不覆盖 codex/final-polish。密码、local profile、Flash/NVS 备份和大录像不提交公开仓库。最终给我可回传的提交差异、验收结果、证据包以及仍未完成的项目；不把本轮 Mac/CI PASS 或历史实物记录替代此次现场验证。
```
