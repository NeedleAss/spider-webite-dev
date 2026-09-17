# V4 交付与演示说明

## 给组员

推荐发送 `deliverables/CareRover_V4_Candidate_20260918.zip` 和 `docs/V4_WINDOWS_AI_PROMPT.md`。ZIP 已含提示词、源码、模型、依赖、截图、录像、软件结果和现场待填表；不含私有配置或可直接烧录的二进制。也可以让组员拉取 `codex/final-polish`，先保存本机尚未提交的修改。

ZIP 解压后在根目录运行 `py tools/verify_handoff.py`；核对 `EXPORT_INFO.json` 固定源码提交和 `SOURCE_MANIFEST.json` / `EVIDENCE_MANIFEST.json`。SHA-256 文件可检测下载是否完整。原 20260917 ZIP 保留为历史，不是 V4。

实物端按提示词核对板子/供电/端口，备份 Flash/NVS，用私有已核实配置重建。控制台 JS 更新意味着设备端 FFat 也需要重建；独立 `/presentation/` 不烧入主控。具体烧录由现场条件与授权决定。本轮没有执行任何设备写入。

## 给复审者

发 PR #1 链接与 `docs/V4_REVIEW_PROMPT.md`。完整 V3/V4 指导正文、源合同、当前实现、证据与限制都在分支上。复审要固定 HEAD，读取 `docs/V4_ACCEPTANCE.md` 与 `docs/visual-v4/RESULTS.json`，并实际运行展示；GitHub 链接可用于源码审查，但不保证任何聊天产品都能自动获取所有二进制附件，必要时直接附 ZIP。

## 答辩如何打开

任何一台已准备好 Python 与现代浏览器的电脑都可使用，不限定这台 Mac。解压源码包或克隆仓库，在根目录运行：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Windows 用 `py -m http.server 8765 --bind 127.0.0.1`。浏览器打开 `http://127.0.0.1:8765/presentation/`，保持终端运行。不需要机器人或互联网；不能直接双击 HTML。现场事先检查投影比例、浏览器缩放 100%、减少动态效果设置和页面性能。

展示顺序约 90 秒：正面 → 开壳 → 摄像头（后段整车回应）→ 超声 → 运动 → 手指接触（后段顶部屏幕）→ 收拢/实物照片。用页内箭头或滚动；自由探索为可选补充。加载问题加 `?static=1`；录像在 `evidence/visual-v4/story-tour.webm`，也可直接在本地播放器打开。

GitHub 仓库页本身不是网站托管。本轮交付源码、PR 和离线展示，未配置 GitHub Pages 或其他公开域名；现场离线方式最容易复现。后续若部署静态托管，只发布独立 `presentation/` 目录，保留子目录路径，不将控制台 WebSocket 地址配置到公开演示页。

## 放行边界

软件验证通过不等同于实物运动通过。G01 独立撤销 PWM、真实手机、Windows/原生 CAD、现场失效停车及无线耐久仍需组员填写证据。没有闭环的项目用 observe / 明确标注的 Mock / 产品展示页答辩。不要用网页动画、CI 绿灯或旧日志冒充本轮真机通过。
