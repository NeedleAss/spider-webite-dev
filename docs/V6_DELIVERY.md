# V6 交付与版本核验

这一轮的软件与视觉候选包含生产控制台、直接手势准入、150 秒影片、Scroll / Deck / Film 与自由探索。现场接手先读 `V6_WINDOWS_AI_PROMPT.md`，复审先读 `V6_REVIEW_PROMPT.md`，验收与已知限制见 `V6_ACCEPTANCE.md`。

## 交付入口

- 展示：仓库 `/presentation/`，根目录 HTTP 服务下打开。
- 影片：`presentation/assets/film/CareRover-film.mp4`，可离线直接播放；同目录附 SRT / VTT 和海报。
- 操作台：根目录 `/`。本地模拟与设备连接明确区分。默认不占用 CAM 单观看者视频。
- 实物端：`V6_FIELD_RUNBOOK.md`，逐项填写版本、软件目标、PWM 与实体结果。

影片已验证 150 秒、1920 × 1080、30 fps、4,500 帧，完整音视频解码通过；SHA-256 为 `18c6873d0b87dfe09aa2b843e07a363ed3007f9dabeac00912516fbbdba2d6c2`。`FILM_MANIFEST.json` 记录 54 个生产渲染来源哈希；原 CAD GLB 保持不变。

## 冻结流程

此文件在实现冻结时建立。最终编译、源码提交、交接 ZIP 与校验记录会在随后的交付提交中填入；在这些记录齐备前不把本段视为最终打包完成。

公开配置仅用于 compile_only。没有本轮实物烧录、Windows 或真实手机测试。G01 独立 PWM 撤销为 NOT RUN，动力发布仍受现场门槛约束。GitHub 仓库/PR 是审查入口，不等于网站已上线；当前未配置 GitHub Pages。
