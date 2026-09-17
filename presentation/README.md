# CareRover V4 产品展示

七章深色滚动叙事，沿用真实 CAD 装配，增加按团队照片与器件说明制作的外观。独立电脑端网页，不连接机器人、不发 WebSocket 或运动命令，也不进入 ESP32 FFat 网页包。

## 启动与展示

在仓库根目录运行：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Windows 用 `py -m http.server 8765 --bind 127.0.0.1`。打开 <http://127.0.0.1:8765/presentation/>，不要直接双击 HTML。所需 Three.js、模型、海报、材质和字体回退均本地提供，启动后不依赖互联网。本机 HTTP 服务应保持运行。

- 默认 Story：原生向下滚动，或章节圆点、上下箭头、PageDown / PageUp。画布中央允许手机上下翻页。
- 摄像头章继续向下滚动，从传感器近景转入整车回应；健康章继续滚动，转入顶部屏幕近景。
- `Ⅱ` 暂停小动画，`↺` 重播。摄像头和整车运动演示结束后停住，不突然跳回起点。
- “自由探索”才启用拖动旋转与滚轮缩放。按钮或模型可选择具体实例，重复点轮组/舵机按钮切换实例。Escape / 关闭恢复原章与进度。
- 系统“减少动态效果”使用静态构图。`?static=1` 主动切换章节海报；模型、WebGL 或 Three.js 加载失败也自动降级，DOM 文字仍可读。
- 页面结尾可查看团队自己的未完成装配照片。它不代表成品或实物验收通过。

没有身份识别、全向避障、群控、实测轮速、真实健康读数或真实电量演示。检测视域、超声波束、人物/手指和车辆轨迹均为原理示意。OLED 只显示 DEMO/原型状态。

## 资产与单位

原始 `assets/cad/carerover.glb` 未修改，SHA-256：

```text
2310e2bd46a6940497349d1acf00ef70bd8279881a637424b2764c136229d61b
```

它来自 15 个 SLDPRT 与一个 SLDASM 的保存显示网格：20 个可见实例，另一个舵机在原装配中隐藏。V4 衍生展示按用户确认的四舵机目标，恢复其保存的 reference 7 矩阵；原 CAD、原 GLB 及原 hidden 记录保留。实际安装仍待现场核对。

结构网格、安装矩阵、外观和效果分层。所有坐标以米为单位，没有旧根节点的 1000 倍缩放；整机正面为当前保存 CAD 的 −X，上方 +Y。摄像头、超声局部 +Z 对应世界 −X。每次状态从 immutable rest 推导，滚动不累加变换。

九类器件外观由 `scene/appearance.js` 自行生成：四个八滚子轮及白联轴器、四舵机、双 USB 主板、镜筒/相机板、HC-SR04、OLED、健康板、IMU 与电源。不是扫描资产，也没有宣称交付新的完整写实 GLB。细小元件、标签与被遮挡部分是简化外观，不能当作尺寸测量或电路图。

主板外观按语义整体替换，因此原件内两条杜邦线代理长块不会渲染；不按三角形高度盲删。有限长度彩色线束表达模块级连接关系，拆开距离过大时省略，未知 GPIO 没有补造。摄像头板面在外观层沿局部 Z 留 0.5 mm 防共面闪烁间隙，OLED 外观沿局部 Y 抬高 2.5 mm 避免埋入顶盖；这两项为显示处理，不改变保存的安装矩阵，不是实测安装调整。镜头锚点同步至新外观端面。

`assets/appearance/manifest.json` 绑定实现、海报、参考照片、原 GLB 和传感器锚点的 SHA-256。更新后运行：

```sh
python3 tools/appearance_manifest.py
python3 tools/appearance_manifest.py --check
```

结构导出仍可用 `python3 tools/export_cad.py /path/to/3D建模 --output /path/to/new-output`，不要为重建外观覆盖原 GLB。该工具只解析本项目已验证格式的保存显示网格，不是通用 SolidWorks/B-rep 转换器。原格式参考 [cadmpeg 文档](https://github.com/cadmpeg/cadmpeg/blob/main/docs/formats/sldprt.md)，CC BY 4.0；没有复制其转换器源码。原生 SolidWorks 配合/配置核查 NOT RUN。

## 来源与许可

Three.js 固定 0.180.0，MIT，`vendor/three` 为官方分发原文件及 LICENSE。没有 CDN、第三方模型或商家图片贴图。所有标签、OLED、材质噪声和环境光面板均自行生成。团队正面/内部参考照片取自用户提供的 V4 PDF；公开内部图已是裁掉背景个人卡片的版本。未发布原 PDF、商家图或原始 CAD。

制作规范与原始配置见 [V4 来源资料](../docs/visual-v4/source-briefs/CareRover_Production_Brief_v4.md)、[资产合同](../docs/visual-v4/source-contracts/ASSET_CONTRACT.json)。实现取舍、测量与未验项见 [V4 验收报告](../docs/V4_ACCEPTANCE.md)。

## 运行时与测试

`story/timeline.js` 负责可逆章节姿态、正交轮系数学；`scene/robot.js` 负责保存安装矩阵和线束；`scene/appearance.js` 负责外观；`effects/sensors.js` 负责端面锚点和示意情节；`app.js` 负责原生滚动、摄影机、微动画时钟、Inspect 和故障恢复。

静止整机、暂停与减少动态效果不持续绘制；隐藏标签页停止绘制。WebGL 恢复重建环境资源，保留章节；尺寸变化和刷新保留进度。诊断 `window.__careRover` 只提供快照及 WebGL 故障测试，不引用机器人传输层。

```sh
npm test
python3 tools/appearance_manifest.py --check
```

浏览器脚本见 `tests/browser/check_story*.js` 与 `check_display_semantics.js`，使用 Playwright CLI 0.1.20 的 `run-code` 执行；复现入口见 [验收报告](../docs/V4_ACCEPTANCE.md)。手机视口/触控模拟不等同于真机 Safari 或 Android。G01（安全任务停摆后的独立 PWM 撤销）仍为实物发布阻断项，网页展示通过不会关闭它。
