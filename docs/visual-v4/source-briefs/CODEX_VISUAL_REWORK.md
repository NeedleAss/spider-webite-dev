# Codex 下一轮执行指令｜CareRover 产品展示重做，保留安全成果

## 基线与任务

仓库 `NeedleAss/spider-webite-dev`；PR #1；审查基线 `72ee475bd76b7a46f2c3bd6477dcd2f45b76ac69`、分支 `codex/final-polish`。实际接手先 fetch、查看工作区、确认是否有更晚提交；保留本机修改，不强制 reset，不覆盖原始 handoff 或 CAD。

先读 `CareRover_Review_v3.md`、仓库的 `docs/FINAL_REVIEW_PROMPT.md`、`docs/FINAL_ACCEPTANCE.md`、`docs/FINAL_RESULTS.json`、`presentation/README.md`。本轮目标不是再做一次通用卡片美化，而是实现一个以真实机器人为主角的滚动产品介绍，并修正方向、起点、真实外观和触摸问题。

**保留已通过的运动失效修复，不为展示调整协议、IMU 轴、watchdog、倾倒锁存、NVS 校准或动作裁决。** 本轮独立 C++ 定向测试 safe 17 PASS/1 SKIP、balanced 18 PASS；PR CI 10 个任务成功。它们仍不是实物放行证明。

## 第一个交付，不是七章占位页面

先做完这条可看的短流程，再拓展其余章节：

1. 完整整机的传感器正面首屏，照片/实物参照明确；白色外壳、轮组和镜头有可读轮廓。
2. 原生向下滚动，顶盖/外壳有顺序地打开，内部结构不四散。
3. 相机近景，视域从真正镜头沿模块正前方展开，出现同向的目标/检测框，文字与画面解释同一个功能。

提交 1280×720、1366×768、390×844 的关键帧和一次正反向滚屏录制；说明用了什么真实资产、什么仍缺资料。没有可看的第一段，不继续堆另外十几张卡。

## 必修问题与位置

| 编号 | 位置（固定审查版本） | 要求 |
|---|---|---|
| V01/V02 | `presentation/app.js:57–65,81–83` | 效果不能 scene 根节点只跟 bbox 中心。建立 sensorAnchor，继承位置/旋转/比例 |
| V03 | `presentation/app.js:71` | 当前相机在 +X 侧、看到背面。CAD 世界 up=+Y、front=−X；以该坐标验证主镜头 |
| V04 | `presentation/style.css` 的 `.stage`；`app.js:38` | fallback 恢复垂直滚动，现有候选 patch 可单独应用并回归 |
| V05/V07 | `tools/export_cad.py` 与展示衍生资产 | 主板下两个长块是用户确认的杜邦线代理；真实外观单独制作，不破坏原始结构 |
| V06/V08 | `presentation/app.js`、`index.html` | Story/Inspect 分离、章节镜头、可逆姿态。不是继续默认悬停立即全拆 |
| V09/V10 | `app.js:54,67–72` | 类型与实例分开；低透明壳不能抢拾取；匹配 pointerId，区分拖动与点击 |
| V11 | `app.js:73–85` | 不要每帧无条件分配/绘制；上下文恢复不无条件回首页 |
| U01 | `js/app.js` emergency/render | 本地锁、发送失败/待确认、设备上报急停分别显示；不能延迟本地锁 |
| U02 | `js/app.js` render | 回放文案先于实时 stale；不改变回放禁发命令 |
| U03 | `js/app.js` receive PPG | 单独限定采样/接收/回放时间，不把网络延迟画成准确生理时序 |

V09/V10 的 WebGL 误选需在本地浏览器确认，审查报告并未把它们写成已复现的误操作。其他确认方法和边界见主报告。

## 传感器坐标契约

绑定资产 SHA256：`2310e2bd46a6940497349d1acf00ef70bd8279881a637424b2764c136229d61b`。
本资产 camera、ultrasonic 的局部 +Z 转到装配世界 −X；当前效果沿世界 +Z，相差约90°。

使用 `SENSOR_ANCHORS_CANDIDATE.json` 作候选，不作实物标定。它的 position 单位是**米、零件局部空间**，而现有根节点放大1000。效果作为子节点后也使用米。示意视域不应被说成光学标定；TX/RX、视场角、波束角缺失就保留未确认。

```js
// 示意接口，不是可直接替换整个 viewer 的补丁。
// frame 是以局部 +Z 为示意朝前的 Object3D；数量/大小也使用米。
const frame = new THREE.Group();
frame.name = `${partId}-sensor-anchor`;
frame.position.fromArray(anchor.position);
frame.quaternion.setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(...anchor.effectForward).normalize()
);
partInstance.add(frame);
frame.add(localEffect); // 不能重复加入 scene；不要再覆盖 world bbox 中心
```

不要混用 Three.Camera 的默认 −Z 观察方向和这套自定义效果的局部 +Z。所有锚点必须在 rest、exploded、selected、整车旋转及窗口变化时验证；不要仅在一张截图里调整到“看起来对”。

## 页面分镜与运行时

默认 Story 七章：完整正面 → 打开外壳 → 相机 → 超声 → 主控裁决 → 轮组/健康反馈 → 重新装配并与实物照片对应。可合并章节，但保留清晰起承转合。详细画面、文案和禁止项按主报告第08章。

原生滚动是唯一章节进度源。默认禁用 OrbitControls 手势；移动端画布允许纵向页面滚动。自由旋转只在明确进入 Inspect 后启用，退出返回原章节。提供章节导航和上一章/下一章；不要让全局键盘处理抢走按钮/输入框的默认行为。

每个部件保存 rest TRS；通过关键帧插值求最终状态，不在当前节点上累加偏移。相同 progress 正反向、刷新、直接进中段、resize 后一致。透明/强调/文本/效果来自同一个 scene state。关闭动态效果时静态分章仍完整。

优先原生 ES Modules + 当前本地 Three.js 0.180.0。只在确有必要且有离线证据时增加依赖；不要迁移整站框架，不用 CDN，不复制苹果素材/字体。模块拆分以能单测坐标和进度为目的，不追求文件数。

## 真实外观资产

原始 CAD 是结构依据，不是实物外观答案。保留原资产和manifest，新建衍生 appearance 层；不将外观更改回写固件或 NVS。

先拿到 `PHOTO_ASSET_BRIEF.md` 的最低照片/型号/尺寸资料。优先外壳、轮组、镜头/超声、主板和线束的近景。原 GLB 没有 UV/纹理，统一 roughness=.5/metalness=.12；不能把这个问题解释成只要换个灯就“扫描级”。

主板假线代理要由可验证的 CAD 实体/人工网格分离完成，不根据“下面”“最长两个”盲删三角形。线束端点使用参考资料，不猜 GPIO。第四舵机在保存装配中隐藏；是否在真实装配中应显示，由现场确认后作衍生资产调整并记录。

优先混合方式：CAD定位 + 实物网格/贴图 + 曲线线束 + 自有照片/预渲染备用。不要把整车扫描作为唯一交付路径，不用不匹配的通用机器人模型冒充实物。

## 测试与完成定义

先执行项目原测试，再加本轮回归。主报告 evidence 中有可直接运行的 C++ 子集，但它不替代 `npm test`、Python测试、`tools/check_firmware.py` 和锁版本构建。

展示至少覆盖：
- 相机/超声 forward 和锚点在 rest/全部拆解/部件近景/整车旋转时正确；无效果从包围盒底部出现。
- 每章开始/中间/结束及反向滚动的截图；首屏、近景、收拢姿态与实物参考一致。
- 页面滚轮、触摸、键盘、目录、Inspect退出；透明对象拾取、多指取消、resize、深链接/历史恢复。
- `prefers-reduced-motion`、静态fallback、模型加载失败、WebGL丢失与恢复；冷启动离线无外部请求。
- 显示文案不夸大身份识别、全向测距、轮速反馈、电量、医学能力或实物测试结果。
- 原运动失效测试仍通过；展示点击/键盘/滚动绝不发送机器人指令。

交付列出 source commit、web/asset/hash、未确认实物差异、原始截图/录像、PASS/FAIL/NOT RUN。没有操作实物就不要写实物 PASS；没有跑完整 WebGL 就不要用静态截图代替。

## 收尾约束

保留现有安全成果与源文件；每个提交可单独解释和回退。未确认的模型参数可继续通过可独立执行的软件工作推进，不停在“等照片”；但真实性不能靠猜。首屏/前几个镜头不达标时，优先修正这段，不再扩大功能。

本轮实际对远端写入、部署、烧录和实物动作的权限，以当前用户明确授权为准。复审材料本身没有授权任何硬件运动，也没有授权自动合并 PR。
