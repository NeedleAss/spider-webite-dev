# CareRover V4 复审提示词

请审查 https://github.com/NeedleAss/spider-webite-dev/pull/1 的最新 `codex/final-polish`，先固定当前 HEAD，区分本轮基线 `72ee475bd76b7a46f2c3bd6477dcd2f45b76ac69` 与最新变更。不要只读 main，也不要把历史冻结包当当前实现。

先读 `docs/V4_ACCEPTANCE.md`、`docs/visual-v4/RESULTS.json`、`presentation/README.md`，再读 `docs/visual-v4/source-briefs/CareRover_Production_Brief_v4.md` 及第三版审查。源合同在 `docs/visual-v4/source-contracts/`，公开截图、录像、浏览器结果和日志在 `evidence/visual-v4/`。需实际运行页面看正向、反向、首帧/中间/末帧与手机；只读截图和代码不能证明动画手感。

重点评价：传感器正面是否清楚；顶盖/外壳路径；四轮四舵机与原矩阵；真实器件的可识别特征；杜邦线长块是否消失且没有破坏原件；传感器端面/旋转/单位；摄像头后段整车回应、超声去回、正交轮对/原地转向、手指接触与 OLED；字体、层次、留白、视口比例和章节切换。不要把“Apple 风格”作为无需指出具体证据的结论。

检查相同 progress 重访/反滚/刷新/resize 是否一致、100 次拆装无漂移、Story/Inspect 输入边界、多指取消、降级与 context restore、按需绘制与资源稳定、无外连/机器人命令。检查控制台 U01 急停确认层级、U02 回放优先级、U03 采样/接收时间与缺口语义，确认旧运动安全修复未回退。

客观审查已公开取舍：自制运行时器件几何而非扫描或新完整写实 GLB；摄像头/OLED 显示间隙；有限的概念线束、非逐针走线；133 calls 超出 <100 初始软目标；手机只是 Mac 模拟，原生 CAD/Windows/物理机器人均未完成本轮验收。评估是否需要继续改善，并给出可复现问题与最小修复。

输出按严重程度排列的问题、文件/代码行、复现步骤、实际影响、修复建议和验收方法；没有问题时也明确剩余风险与测试缺口。固件源码本轮未改；安全任务停摆后独立撤销 PWM 的 G01 仍是现场发布阻断，CI/视觉通过不能关闭它。不要新增机器人功能或推倒重来。
