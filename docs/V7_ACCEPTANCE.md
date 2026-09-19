# V7 制作与验收记录

基线：`1d073b5` 的三段视觉研究，用户已接受并要求继续；其生产固件/操作台继承 V6 `f6d7969`。当前交付为 V7 展示候选，最终用户视觉审核与实体验收分别记录。

## 交付

| 项目 | 内容 | 状态 |
|---|---|---|
| 产品页 | 十章，112 秒；Scroll / Deck / Film 共用确定时间轴 | 已实现 / 待用户视觉复审 |
| 自由探索 | 使用用户接受的同一装配路径，完整进入、停留展开、选中固定、平滑聚焦、完整旋转/缩放、明确隔离 | 软件 PASS |
| 扫描与回波 | 表面扫描、目标框；网格求交命中、独立回程波、接收后保持停止说明 | 已接入 / 原理示意 |
| 运动/手势/跟随 | 正交轮组、横移不转身、连续累计360°；TWO/DISLIKE/中立/LIKE；目标失效等待 | 已实现 / 模拟 |
| 健康/OLED | 烘焙完整右手靠近、指腹保持、采集、模拟结果、离开清空 | 软件与制作自检 PASS / 用户手模审核待完成 |
| 独立手部材料 | `hand.html`，三视图、5秒接触 MP4、`hand_source.blend`、`hand_demo.glb`、CC0许可和来源 | 已交付 |
| 离线影片 | 112秒，1920×1080，30fps，3360帧，H.264/AAC；SRT/VTT/分镜/海报 | 编码、解码、浏览器回放 PASS |
| 操作台 | 保持 V6 真实生产页面与直接手势/视频保护；修复产品页中的嵌入缩放 | 16项 fixture 回归 PASS |

原始三段样片仍在 `v7.html`。其 `v7-media/MANIFEST.json` 记录当时制作源哈希，对应 Git `1d073b5`；本轮动态回波裁切/环境清理的修复以新资产清单为准，不把旧样片源哈希冒充当前源哈希。

## 本轮实际执行

| 范围 | 结果 | 证据 |
|---|---|---|
| Node | 57 / 57 PASS | `evidence/v7/node.txt` |
| Python | 38 / 38 PASS | `evidence/v7/python.txt` |
| C++ 主机 | 12套 PASS，含 SAFE / DEMO | `evidence/v7/cpp.txt` |
| 新展示浏览器 | 55 / 55 PASS | `evidence/v7/presentation-browser.json` |
| 重复操作/降级/减少动态 | 7 / 7 PASS | `evidence/v7/resilience.json`；复用兼容的 V6 通用场景 |
| 生产操作台 fixture | 16 / 16 PASS | `evidence/v7/console-browser.json` |
| 固件/控制台/配置保护 | 75文件哈希未变 | `evidence/v7/protected-hashes.json` |
| 媒体 | 完整音视频解码；主片4倍速静音完整回放；手部短片原速完整回放 | `film-validation.json`、`playback.json` |
| 源码/媒体一致性 | 20个渲染源哈希；完整资产清单71文件 | `assets/film-v7/FILM_MANIFEST.json`、`assets/appearance/manifest.json` |

55项浏览器检查包含：剧情与自由探索逐实例姿态相同、重复拆合归零、选中安装参照和主动隔离、拖动打断镜头、退出恢复原时间、正反 seek 的传感器/手部截图逐字节一致、5个接触保持时刻的锚点间距小于0.01mm、Deck键盘、操作台实际可见尺寸、手机说明优先、上下文恢复和不加载旧成人/房间/影片。锚点精度是计算结果，不是实体精度或全网格穿透证明。

制作自检查看了完整右手/前臂的中性光手背、手掌、侧面，原始 GLB 在 Blender 重新导入后渲染。浏览器逐章截图与编码成片每4秒抽样联系表见 `evidence/v7/visual/`；自动化完整播放到结尾与人工逐章画面检查属于不同证据。新手模和成片还需用户视觉接受。

## 已发现并修正

- 原平面分列布局与故事布局不一致，改为共同装配路径。
- 选中后直接隔离所有参照，改为默认保留安装组/底盘，另设明确隔离操作。
- 回波障碍裁切平面只在初始姿态计算，改为随传感器/装配更新。
- 恢复 WebGL 时重复添加环境灯，改为移除旧灯后重建；恢复时不尝试删除属于失效上下文的旧 GPU 对象。
- 操作台 iframe 在隐藏时取到零宽度，进入章节时重新按实际尺寸缩放。
- 退出探索时滚动像素舍入改变播放时间，改为保持原时间，等待主动滚动。
- 手机点选后说明仍埋在部件列表下面，改为选中时优先呈现说明，返回总览恢复列表。

## 不据此放行

真实紧固件、机械退出顺序、完整网格连续干涉、最终实物布线/安装、真实手机/Safari、Windows、烧录、真实无线视频/手势/OLED、实体停止、PWM撤销均没有本轮实测。G01 继续 NOT RUN / 动力发布阻断。没有改固件，因此本轮没有重编译MCU或制造“新可刷二进制”；V6历史编译结果不能改记为V7现场通过。

用户接受三条样片：**已完成**。新手部与完整成片视觉接受：**待审核**。实物验收：按 `V6_FIELD_RUNBOOK.md` 由现场组员逐项填写。

## 复现

```sh
npm test
python -m unittest discover -s tests -p 'test_*.py' -v
python tools/check_firmware.py
python tools/appearance_manifest.py --check
python tools/validate_film_v7.py
```

浏览器：根目录 HTTP 8765，隔离 JPEG fixture 8767，用 Playwright CLI 创建各自会话，经 `tools/run_browser_check.py` 执行 `check_story_v7.js`、`check_story_resilience_v6.js`、`check_console_v6.js`。后三者不连接实物；控制台 fixture 会主动制造503/断帧等状态。影片重建使用 `tools/film_score_v7.py`、`tools/render_film_v7.py`，Blender 手部重建见 `tools/art/build_hand.py`。

## 2026-09-18 样片 / 主片 / Inspect 画面一致性复验

此前的末态姿态比较不足以证明动画观感一致。本次增加实际浏览器中三个入口的对照：在 1440×900 下，对样片 0–10 秒的 13 个时刻与主片 7–17 秒分别比较相机、目标点、画布矩形、全部实例的位置/旋转，以及包围盒角点的屏幕投影；Inspect 的完整与展开总览也使用相同比较。差异低于 1e-8。该指标验证取景与姿态，不代表整张网页像素完全相同（交互 UI 与 OLED 内容不同）。

| 范围 | 本次结果 | 证据 |
|---|---|---|
| 样片一致性、展开速度、收拢、途中反向与退出停止渲染 | 21 项 PASS | `evidence/v7/structure-browser.txt` |
| 展示与手机布局回归 | 55 项 PASS | `evidence/v7/structure-regression.txt` |
| 重复选择/恢复、上下文、减少动态与降级 | 7 项 PASS | `evidence/v7/structure-resilience.txt` |
| Node | 59 / 59 PASS | `evidence/v7/structure-node.txt` |
| 固件/控制台/配置 | 原 75 文件哈希再次核对未变 | `evidence/v7/protected-hashes.json` |

画面对照见 `evidence/v7/visual/structure-reference.png`、`structure-film.png`、`structure-inspect.png`。离线影片重新从当前生产页面导出并完整解码，哈希和抽帧证据更新在 `FILM_MANIFEST.json`、`evidence/v7/film-validation.json`。先前 Python/C++/控制台 fixture 为上一轮记录，本次没有把它们重记为重跑。用户最终视觉审核与实物门槛仍保留。

## 三维人头 / 立体障碍物 / 手势候选

- 新场景检查 22 项 PASS：整机进入、连续透视、安装参照、返回整体、反向 seek 图像一致、三种模型手势、中立清空、Inspect 恢复材质、手机布局与浏览器异常。证据 `evidence/v7/interaction-browser.txt`。
- 拆合对照 21 项 PASS：`evidence/v7/interaction-structure.txt`；Node 59 项 PASS：`interaction-node.txt`。
- 新增模型无皮肤纹理，均有 CC0 来源；手指离线摆姿后导出，浏览器只移动和旋转整体。截图在 `evidence/v7/visual/interaction-*`。手形与新镜头的最终美术评价由用户审核。
- 预览服务改用 `python3 tools/serve_presentation.py`，增大并发连接队列并要求缓存重新验证。排查中旧预览服务曾发生 ES 模块连接重置，未把这些失败记为通过。
- 完整展示回归 55 项 PASS：`interaction-regression.txt`，在新浏览器会话重跑，包含模型手势替代符号、传感器/接触帧倒放一致性、Inspect、手机说明和上下文恢复。

## 2026-09-19 连续人脸跟随

浏览器专项检查覆盖同一个人头从特写到整机的保持、世界坐标与机身分离、目标先动/机身后跟、反向响应、跟随时整机不透明、倒放画面一致、停止回位和直接跳到超声章节，原始结果见 `evidence/v7/follow-browser.txt`。Node 60 项通过，记录 `follow-node.txt`。新影片同步重导，当前媒体清单及完整解码结果更新；最终运动观感仍待用户审核。
完整展示回归 55 项 PASS，见 `evidence/v7/follow-regression.txt`；跟随专项45项PASS。此轮测试中已按新时序更新超声、手势和Deck跳转断言，未用旧章节时间冒充新流程验证。
补充：扫描开始时不再对零尺度矩阵做世界坐标逆变换，避免边界帧生成NaN顶点；新增边界控制台检查，跟随专项总计45项通过。模型隐藏与矩阵保持可逆分别处理，正反seek一致性复验通过。

## 2026-09-19 用户批准的 55 秒最终片

用户已接受 cut55-2 画面、绕障和配乐，明确授权输出。1650 帧全部按确定时间逐帧生成，1080p30 MP4 完整音视频解码通过；实际编码文件 55.0 秒。音轨为用户 M4A 自 7.372 秒起的 55 秒，音量 0.7、0.5 秒淡入、1.5 秒淡出，与参考音频相关系数 0.999275。导出与验证记录：`evidence/v7/final55-export.json`、`final55-validation.json`；编码画面抽检：`visual/final55-contact.jpg`。交付文件在 Downloads/3D建模/CareRover_Final_55s_1080p.mp4，本轮没有覆盖仓库的历史影片，没有新硬件验收。
