# 请复审 CareRover V6

请审查 PR #1 的最新 `codex/final-polish`，不要只读 main。先报告实际 HEAD，再对照 `docs/V6_DELIVERY.md` 的源码冻结与构建版本；该文件后的证据/交付提交不应被误认为固件源码另有变化。

请先读 `V6_DECISIONS.md`、`V6_ACCEPTANCE.md`、`V6_FIELD_RUNBOOK.md`；再读 `docs/v6/source-briefs/` 的 V5/V6 输入报告。用户最新决定是默认直接比手势，不需要网页授权模式。不能因为报告旧建议与用户新决定冲突，就要求恢复强制网页模式。

请具体复审：

1. 控制权：观察页不抢权/不续他方动作；主动手动优先；正常释放归零并交接；`release_only` 延迟报文不会取消后续手势/其他 owner；显式 Stop、DISLIKE、ESTOP 语义分离；中立重新准入阻止旧动作复活；健康模式门禁。
2. 视频：CAM 直连的 CORS、单观看者、503、multipart 上限、解码/过期/迟到帧、重试上限和来源切换；AI FPS 与视频 freshness、检测框不同步边界；robot 来源新鲜度不能由其他遥测续期。
3. 展示：真实米制尺度与传感器局部轴；统一 Scroll/Deck/Film 时间轴、回拖和暂停；完整进入 Inspect、独立布局、实例聚焦和手动打断；全角度/缩放/手机布局；手指与 OLED 同事件。
4. 实际媒体：读取或下载 `presentation/assets/film/CareRover-film.mp4`、字幕、海报及 manifest。影片 150 秒，含独立运动、手势和生产控制台模拟录屏。若不能下载或播放，请明确说明，不把路径/元数据算作亲自观看。原始视觉样张在 `evidence/v6/visual/`。
5. 版本与现场：源码、主控、CAM、FFat、资产、影片、ZIP 校验的关联是否可复核。compile_only 不可刷；真实 Windows/手机/PWM/实体均需现场记录。G01 没有独立实物证据，不得关闭。

请独立复现有条件运行的测试。输出按严重度排序的问题、明确文件/路径/触发步骤、证据与推测边界、最小修改建议、软件可关闭项和现场待验项。不要因测试通过就把美术与实物全部判定 PASS，也不要再扩展机器人新功能。
