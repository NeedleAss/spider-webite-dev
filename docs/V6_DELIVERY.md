# V6 交付与版本核验

这一轮的软件与视觉候选包含生产控制台、直接手势准入、150 秒影片、Scroll / Deck / Film 与自由探索。现场接手先读 `V6_WINDOWS_AI_PROMPT.md`，复审先读 `V6_REVIEW_PROMPT.md`，验收与已知限制见 `V6_ACCEPTANCE.md`。

## 交付入口

- 展示：仓库 `/presentation/`，根目录 HTTP 服务下打开。
- 影片：`presentation/assets/film/CareRover-film.mp4`，可离线直接播放；同目录附 SRT / VTT 和海报。
- 操作台：根目录 `/`。本地模拟与设备连接明确区分。默认不占用 CAM 单观看者视频。
- 实物端：`V6_FIELD_RUNBOOK.md`，逐项填写版本、软件目标、PWM 与实体结果。

影片已验证 150 秒、1920 × 1080、30 fps、4,500 帧，完整音视频解码通过；SHA-256 为 `18c6873d0b87dfe09aa2b843e07a363ed3007f9dabeac00912516fbbdba2d6c2`。`FILM_MANIFEST.json` 记录 54 个生产渲染来源哈希；原 CAD GLB 保持不变。

## 冻结源码与编译

生产源码冻结：`40fe1516abfc3b43f6f734bf489d69f04b59b152`。四次编译均从该干净 checkout 完成（`source_dirty: false`）；之后的交付提交仅补充文档、证据与归档。`evidence/v6/build-results.json` 记录固件、JS、CSS、根 HTML 与展示目录的 Git 对象，可与最新 PR 对照。

| 构建 | 结果 / 版本 |
|---|---|
| 主控 Stage 5 / follow / SAFE_BASELINE | PASS · `3153233c1fe95349-s5-follow` |
| 主控 Stage 5 / follow / DEMO_BALANCED | PASS · `7d91a9065a214a3c-s5-follow` |
| 两档主控 FFat Web | `561e82427c8b4756`，均随对应固件一同构建 |
| CAM stream / SAFE_BASELINE | PASS · ESP-IDF 5.3.4，应用 4,191,968 bytes |
| CAM stream / DEMO_BALANCED | PASS · ESP-IDF 5.3.4，应用 4,195,280 bytes |

完整构建 manifest、二进制 SHA-256 和原始编译日志见 `evidence/v6/builds/`。公开配置仅用于 **compile_only**；这些二进制不随交接 ZIP 分发，不可直接刷入实物。组员须使用同版源码及现场已核验的私有配置重建 CAM、主控和 FFat，再记录现场版本。

## 给组员与复审方

交接包：`deliverables/CareRover_V6_Candidate_20260918.zip`，同目录 `.zip.sha256` 校验下载。包内 `EXPORT_INFO.json` 记录干净导出提交，`SOURCE_MANIFEST.json` / `EVIDENCE_MANIFEST.json` 记录逐文件哈希；解压后运行 `py tools/verify_handoff.py`。ZIP 包含当前源码、生产网页、模型、影片、文档和证据，不包含私有 Wi-Fi、现场配置、编译工具链、临时帧或可烧录二进制。历史材料位于对应历史目录，不覆盖本轮结论。

给组员：ZIP + `docs/V6_WINDOWS_AI_PROMPT.md` + `docs/V6_FIELD_RUNBOOK.md`。给 ChatGPT 复审：PR #1 + `docs/V6_REVIEW_PROMPT.md`。让复审方报告其实际读到的 HEAD；不能把仅看到视频路径算作亲自观看影片。

放映可直接复制 MP4 到任意能播放 H.264/AAC 的电脑，不必携带开发电脑。交互展示在解压目录启动本地 HTTP 服务（见 `presentation/README.md`）。GitHub 仓库/PR 是审查和下载入口，当前未配置 GitHub Pages，因此仓库链接不等于在线网站。真实操作台由机器人主控提供，现场连接其 AP 使用。

没有本轮实物烧录、Windows 或真实手机测试。**G01 独立 PWM 撤销为 NOT RUN，动力发布仍受现场门槛约束。** 软件测试、影片和构建成功都不能替代这项证据。
