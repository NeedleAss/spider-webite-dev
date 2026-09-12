# Windows 接手入口

从 GitHub 获取的是当前开发源码，原始本地参考包及恢复镜像不随源码提交。下面的 ZIP 清单校验仅适用于带 SOURCE_MANIFEST/EVIDENCE_MANIFEST 的导出包；源码 checkout 按 docs/tracking-development.md 和 docs/ultrasonic-development.md 构建与验收，无需本地参考目录。

这是一份 **2026-09-12 本机软件交付快照**。包含当前集成源码、工具、依赖锁定、主机测试证据和原始 `CareRover_Tracking_Motion_Handoff_2026-09-11/` 资料。Mac 上软件已编译验证，尚未连接实物；接下来的任务是 Windows 整机验收。

## 1. 解压并校验

建议解压到短的英文路径 `C:\CareRover`，使本文件与 `tools`、`firmware` 位于该目录下。不要在旧工程目录上覆盖解压。安装 Python 3.12、Git、Node.js LTS、Arduino IDE/CLI；CAM 还需要锁定的 ESP-IDF 5.3.4 工具链。依赖未塞进 ZIP，首次安装需要网络。

将 ZIP 与旁边的 `.sha256` 一起复制到 Windows。PowerShell 执行（从下载目录运行）：

```powershell
Get-FileHash .\CareRover_Windows_Handoff_2026-09-12.zip -Algorithm SHA256
Get-Content .\CareRover_Windows_Handoff_2026-09-12.zip.sha256
```

两个哈希应一致。解压后：

```powershell
cd C:\CareRover
py -3.12 tools\verify_handoff.py
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r tools\requirements.txt -r hardware\requirements.txt -r mock\requirements.txt
node --test tests/*.test.js
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v
.\tools\windows.cmd environment
```

不需要 `.git` 才能构建。`EXPORT_INFO.json` 记录导出时的 Git 基线，`SOURCE_MANIFEST.json` 记录实际源码指纹；代码包含未提交的集成改动，不能只 checkout 原基线提交代替此包。C++ 主机测试需要支持 C++17 的编译器，未安装时可先复核包内 Mac 测试证据，不能标为 Windows 已运行。

## 2. 接下来按顺序工作

先阅读 [Windows AI 完整交接说明](docs/WINDOWS_AI_HANDOFF.md)，其中有逐文件改动索引、W0–W7 阶段任务和下一条回复要求；然后阅读：

1. [软件结果与待验收清单](docs/tracking-acceptance.md)
2. [Windows 构建、烧录、校准、串口日志操作](docs/tracking-development.md)
3. [原交接开发顺序与验收要求](CareRover_Tracking_Motion_Handoff_2026-09-11/docs/04_开发调试步骤与验收.md)
4. [原接线、供电与引脚分配](CareRover_Tracking_Motion_Handoff_2026-09-11/docs/03_接线供电与引脚分配.md)

顺序是：核实设备与工具版本 → 备份两板和主控 NVS → CAM 手势/人脸/视频 → 主控 observe → 四轮架空校准 → manual 故障与停止测试 → follow → 外部供电、无 USB 连续十分钟。

当前板上固件与串口需要重新识别，COM6 只是历史记录。所有示例配置是 `compile_only`；核实板型、Flash/PSRAM、无线凭据后创建 `.local.json` 设备配置，不能仅为绕过检查而改 verification。主控 16 MB、CAM 8 MB 不可混烧。现有构建工具在写入前备份完整 Flash；独立校准工程通过 IDE 上传前也必须先完成备份。

CAM 依赖准备在项目根运行：

```powershell
.\.venv\Scripts\python.exe tools\tracking.py prepare --idf
```

之后在 CMD 中进入 `C:\CareRover`，执行：

```bat
call build\toolchains\esp-idf-5.3.4\install.bat esp32s3
call build\toolchains\esp-idf-5.3.4\export.bat
python tools\tracking.py cam-build --variant gesture
```

CAM 构建使用激活后的 ESP-IDF Python；烧录和串口日志使用项目 `.venv` Python。详细设备构建参数见开发指南。不要搬运 Mac 的 `.venv` 或编译缓存。

## 3. 交给 Windows Agent 的提示词

> 请先阅读项目根 AGENTS.md、WINDOWS_START_HERE.md、docs/WINDOWS_AI_HANDOFF.md、docs/tracking-development.md、docs/tracking-acceptance.md，以及原交接 docs/04_开发调试步骤与验收.md。当前包已完成 Mac 本机软件集成，所有实物验收均为 NOT RUN。先验证文件清单，检查当前 Windows 工具链与真实串口、两块板 Flash/PSRAM、供电接线，备份固件与 NVS，再严格按 CAM → observe → 架空校准 → manual → follow → 无 USB 十分钟的顺序继续。保留原始交接目录，不用其旧源码覆盖当前集成源码。只有实物通过才能填写校准、FPS、停车延迟与演示结果；不要将控制输出当作实测轮速，不要使用历史 COM6 自动选板。记录所有修改、版本、测试日志和 PASS/FAIL/NOT RUN，持续更新 docs/windows-progress.md。先完成只读盘点，给我当前阶段、缺失条件和下一步；如需 Plan mode，只做 Windows 现场执行计划，不重做已完成的软件设计。最后回交新的源码与证据包。

`evidence/` 是 Mac 交付证据；Windows 新日志另存 `output/windows/`。包不含私人 Wi-Fi 密码、工具链缓存或可直接宣称已在设备验证的固件。原始参考资源中的旧固件仅用于已核实对应设备的恢复参考，不是本轮集成固件。
