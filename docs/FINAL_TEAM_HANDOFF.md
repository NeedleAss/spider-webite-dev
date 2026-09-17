# 最终候选：远程协同交接

本说明是冻结交付包的外部补充，不改变包内源码与 SHA-256。

## 固定版本

- 仓库：https://github.com/NeedleAss/spider-webite-dev
- 开发分支：`codex/final-polish`
- 候选提交：`1246b016e59d9fef02f342994ec24f8b53d0dc64`
- 审查基线：`058ce89bd1aa5b5da0dbf89101f4625df70ca6df`（`feat/main-wireless`）
- 源码与证据包：`CareRover_Final_Candidate_20260917.zip`
- ZIP SHA-256：`ce5c0314232060120f899e34d70c2f8ce0ffee395f6c02ce0f57d73ab64fc769`

软件验证通过不代表真机验收通过。本包不含可直接烧录的设备二进制、私有配置或原始 CAD。3D 展示使用的 GLB、预览与本地依赖已包含。原始 0915 归档也不在本 ZIP 内。

## 从 GitHub 获取材料

本分支中的 `deliverables/CareRover_Final_Candidate_20260917.zip` 是固定在 1246b01 的源码与证据包；相邻 `.sha256` 可校验。后续提交只补交接资料、可浏览证据与交付包，不改变该冻结候选。可直接把本页与 [Windows AI 提示词](FINAL_WINDOWS_AI_PROMPT.md) 发给组员。

代码审查使用本分支对 `feat/main-wireless` 的草稿 PR；[复审提示词](FINAL_REVIEW_PROMPT.md) 固定代码基线与范围。[原始验证证据](../evidence/final/README.md) 可以直接在 GitHub 阅读。不要以旧 main 为本轮基线。

## Windows 实物端接手

立即可用 ZIP：保存旧工程及私有配置，在新目录（例如 `C:\CareRover-final`）解压。先用 PowerShell 核验 ZIP，再进入解压后的项目根目录核验内容：

```powershell
Get-FileHash .\CareRover_Final_Candidate_20260917.zip -Algorithm SHA256
py tools\verify_handoff.py
```

对比上面的 SHA-256；包内校验应为 PASS。只有导出包运行 `verify_handoff.py`，普通 Git checkout 不运行它。该 ZIP 不含原始 0915 归档，不能要求其通过 `verify_demo_handoff.py`。

也可以在新目录获取 Git 源码（最新分支包含本交接补充；以下检查确认包含冻结候选）：

```powershell
git clone --branch codex/final-polish --single-branch https://github.com/NeedleAss/spider-webite-dev.git C:\CareRover-final
Set-Location C:\CareRover-final
git merge-base --is-ancestor 1246b016e59d9fef02f342994ec24f8b53d0dc64 HEAD
if ($LASTEXITCODE -ne 0) { throw '代码不包含最终候选' }
git rev-parse HEAD
```

Git 方式包含 `evidence/final/` 中精选的本轮日志和 `deliverables/` 冻结 ZIP；其余本机 `output/` 不上传。不要在已有未保存工程中执行重置或覆盖。

阅读优先级：本说明的固定版本 → `docs/FINAL_ACCEPTANCE.md` / `docs/FINAL_RESULTS.json` → `docs/WINDOWS_0915_HANDOFF.md` 的环境及设备流程 → 具体构建、校准与验收文档。冻结 ZIP 内的旧 `WINDOWS_START_HERE.md` 和历史 0915 交接仍指向旧分支；本说明优先。历史人物/CAM490ms、IMU100ms、40°/200ms 不代表当前候选，当前数值以 `FINAL_ACCEPTANCE.md` 和生产源码为准；不要按旧说明回退阈值。

由现场持有人核对并私下沿用真实的 `config/board.local.json`、`config/cam-board.local.json`、`firmware/main_wireless/wifi_secrets.h`、`firmware/main_wireless/front_config.local.h` 以及已验证的 NVS/标定记录。不要复制 Mac 虚拟环境和编译缓存，不要提交密码、Flash/NVS 备份。

本次三个构建均为 `compile_only`，不能直接烧录。现场需按文档安装工具链，用实际核验过的 local profile 和配置重新构建设备包；不能只把 verification 改成 `windows_baseline_confirmed` 来绕过核实。实际端口、接线和标定值由现场确认。

顺序：核对两板与接线/供电 → 完整 Flash/NVS 备份 → 核对 CAM 版本与通信 → observe → 架空校准 → manual → follow → 无 USB 十分钟。CAM 生产代码本轮未修改，先确认现有版本，不因收到新包就自动重烧 CAM。

逐项执行 `docs/FINAL_ACCEPTANCE.md` 的现场门槛，分别记录软件 target、PWM、实体停止。安全任务自身停摆测试仍是发布阻断项；若不通过，使用 observe 和离线结构展示，不标记运动验收完成。

每次反馈附：Git SHA、设备包 manifest/版本、设备配置（去除秘密）、测试步骤、预期/实际、PASS/FAIL/NOT RUN、串口日志和相关视频。现场代码修改另建分支提交，保留原候选方便比较；不要用聊天里一句“已经改好了”替代差异和复测记录。

## 展示

Windows 项目根目录运行 `py -m http.server 8765 --bind 127.0.0.1`，打开 `http://127.0.0.1:8765/presentation/`。这是本机地址，不能直接发给异地组员访问。保持本地服务运行即可离线演示。

若需要公共展示链接，可将 `presentation/` 作为静态站点发布到 GitHub Pages；发布前检查实际子路径加载。它只展示结构与示意动画，不提供机器人远程控制。答辩现场仍保留本地离线副本。上传代码到 GitHub 不等于网站已部署，也不等于设备已烧录。
