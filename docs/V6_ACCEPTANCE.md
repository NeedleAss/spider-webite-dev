# V6 实施与验收

V6 延续 `7e3a091` 的装配和既有安全修复，加入用户最终确认的默认直接手势、生产操作台收尾、150 秒发布片和统一展示。V5/V6 原报告为输入，用户后续决定见 `V6_DECISIONS.md`。最终冻结源码、Git/ZIP 与媒体校验见 `V6_DELIVERY.md`。

## 产品结果

- `/presentation/`：随心浏览、逐页讲解、播放影片共享确定时间轴；正面开场、分层开壳、真实尺度桌面成人、独立前后左右与整圈运动、手势、跟随等待、前向障碍、手指/OLED、生产控制台模拟录屏、正面结尾。
- Inspect：完整进入、200 ms 停留展开、350 ms 离开后收拢；选中锁定、可打断平滑镜头、实例隔离、轮/舵机实例切换、全角度旋转和缩放，手机有明确按钮。三套布局独立；展开没有非设计 AABB 穿透。任意视角的二维遮挡不等于三维穿透。
- 人物：1.70 m CC0 衍生角色，真实手指骨骼；桌高 0.740 m，机器人沿用原 CAD 米制高度约 0.1295 m。镜头拉远而不缩放机器人。不是实物扫描或团队成员肖像。
- 影片：实际 1080p/30 fps MP4、字幕、海报；原创数学合成轻配乐，无采样。150 秒、4,500 帧从相同生产 evaluator 导出。模拟读数及原理边界显示在画面中。
- 根目录操作台：主视野、操作列、识别与指令受理、来源/所有权、健康、折叠诊断；实际 WS/MJPEG 与本地模拟仍是不同来源。网页观看不抢权。

## 控制与固件行为

默认直接手势不需要网页点击模式或网页心跳。标定、相机/IMU 数据、网络服务与安全门禁继续有效。持有手动/Follow 控制权时拒绝自主启动；正常松手归零并释放。被手动或故障打断的旧手势必须经过三次原始中立观测，再接受新的合格动作。DISLIKE 是普通停止，不能解除急停。健康模式抑制动作启动。

自动页面释放使用 `release_only:true`，后端声明 `scoped_release`；过期释放不能取消后续手势或他人的控制。显式停止仍取消当前允许停止的动作。观察页隐藏或切换视频源不应控制他人。

视频通过直接 CAM multipart JPEG 读取、完整帧解码和绘制确认 freshness；5 秒无首帧、2 秒无新帧显示失效。解析与解码队列有上限；连续连接失败最多重试三次，503 只允许手动重试。CAM 错误响应沿用主控来源 CORS。AI FPS 与视频帧年龄独立，检测框无逐帧绑定证据。

模式、目标和设备急停确认只接受有效 `robot` 包续期。health/IMU 继续不能维持过期机器人状态。OLED 增加短时指令受理/拒绝反馈；它证明设备软件报告，不证明 PWM 或实物完成。

## 软件验收表

| 范围 | 本轮结果与证据 | 边界 |
|---|---|---|
| Node | 51 项 PASS；`evidence/v6/node-progress.txt` | 生产纯逻辑、输入、协议、MJPEG、时间轴 |
| Python | 38 项 PASS；`python-progress.txt` | mock WS、工具与打包逻辑 |
| C++ 主机 | 12 套 PASS；`firmware-progress.txt` | 实际头文件，SAFE / DEMO；非 MCU 调度/PWM 实测 |
| 生产控制台 | 16 项 PASS；`console-browser.json` | Chromium + 明确隔离的 WS/JPEG fixture |
| 展示交互 | 19 项 PASS；`presentation-browser.json` | 含方向、回拖无漂移、约 4 mm 指尖锚点间距、布局、聚焦、手机尺寸 |
| 恢复/重复操作 | 7 项 PASS；`presentation-resilience.json` | Context loss/恢复、重复聚焦、延迟收拢、减少动态、静态降级 |
| 主控/CAM 编译 | 构建日志和版本见 `V6_DELIVERY.md` | compile_only，未烧录 |
| MP4 / 音轨 / 离线 | 参数、完整解码与抽帧记录见 `evidence/v6/film-validation.json` | 模拟发布影片，不是实体演示证据 |
| 原 CAD | GLB SHA-256 保持 `2310e2bd46a6940497349d1acf00ef70bd8279881a637424b2764c136229d61b` | 衍生外观/隐藏第四舵机另记；非原生 CAD 装配重新验收 |

浏览器恢复测试曾因首次渲染尚未上传全部网格而错误比较内存；改为等待一次完整渲染后比较。延迟收拢测试同时等待 350 ms 防抖和实际收拢动画，使用有界条件等待。它们不是放宽产品行为的理由。人物最初的衣物掩码漏读多段范围、相机特写看向主板背面、手指未对准传感器等视觉问题均已在样张检查中修正。

软件测试通过不自动意味着美术完美。当前人物为实时三维角色，室内为克制的合成场景；与真实拍摄仍有差别。整车实物外观、最终走线、具体载板细节及所有实体动作仍应由团队核验。

## 未通过现场门槛

**G01 安全任务自身停摆后的独立 PWM 撤销仍为 NOT RUN / 动力发布阻断。** 当前 Mac 没有连接实物，不能用同执行路径的期限检查关闭该项。

Windows 当前配置构建与刷写、实际串口/板卡、主控/CAM/FFat 同版部署、真实 OLED、PWM 与实体停止、倾倒、电源、无线长时运行、真实手机/Safari、超声安装标定均为 NOT RUN。完整可填写表见 `V6_FIELD_RUNBOOK.md`。只在对应现场门槛通过后展示动力动作。

## 复现

```sh
npm test
python -m unittest discover -s tests -p 'test_*.py' -v
python tools/check_firmware.py
python tools/appearance_manifest.py --check
```

浏览器需先启动根目录 HTTP 8765 和 `tests/browser/v6_video_fixture.py` 的 8767 JPEG fixture，并用 Playwright CLI 开一个会话。然后使用 `tools/run_browser_check.py` 执行 `tests/browser/check_console_v6.js`、`check_story_v6.js`、`check_story_resilience_v6.js`。这些工具不连接机器人；真实设备页验证另行按现场手册执行。

旧 V4 浏览器脚本和报告保留为历史。不能把其七章/旧默认展开断言套到新的 V6 交互上，也不能把旧 Windows 的 PASS 转记到此轮固件。
