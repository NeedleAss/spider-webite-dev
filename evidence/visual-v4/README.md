# V4 可复核证据

这是当前实现的实际 Chrome 截图、浏览器结果、源码回归与编译日志；不是外观设计稿。测试范围和真实设备缺口见 [V4 验收](../../docs/V4_ACCEPTANCE.md)。

[正向与反向滚屏录像](story-tour.webm) · [本地截图浏览器](gallery.html) · [完整 84 帧索引](capture_story_milestones.json)

展示浏览器检查 46 + 13 项，完整运动构图 2 项，控制台 fixture 9 项。手机图片来自 Mac 上视口/触控模拟，不是 iPhone/Android 现场照片。截图分阶段暂停拍摄，小动画的发生顺序看录像；阶段 JSON 记录实际 progress，最后一章会受最大滚动位置钳制。

| 场景 | 桌面 1440×900 | 手机 390×844 |
|---|---|---|
| 正面整机 | [整机](milestone-1440-meet-middle.png) | [整机](milestone-390-meet-middle.png) |
| 分层开壳 | [结构](milestone-1440-inside-middle.png) | [结构](milestone-390-inside-middle.png) |
| 摄像头 | [镜头](milestone-1440-vision-middle.png) / [整车回应](vision-late.png) | [镜头](milestone-390-vision-middle.png) |
| 前方回波 | [超声](milestone-1440-range-middle.png) | [超声](milestone-390-range-middle.png) |
| 运动 | [轮系](milestone-1440-motion-middle.png) | [轮系](milestone-390-motion-middle.png) |
| 健康/OLED | [接触](milestone-1440-care-middle.png) / [OLED](care-late.png) | [接触](milestone-390-care-middle.png) |
| 回到整机 | [收拢](milestone-1440-whole-middle.png) | [收拢](milestone-390-whole-middle.png) |

另外保留 1366×768、844×390 横屏的 start/middle/end 截图，文件以 `milestone-宽度-章节-阶段.png` 命名。所有公开图片均直接浏览器截图，未用生成图片替代实际页面。

- `check_story.json`：布局、实例、方向、循环拆装、Inspect、恢复、触控、网络。
- `check_story_resilience.json`：刷新/resize、多指、性能/资源、各种加载失败和无 JS。
- `check_motion_framing.json`：两种视口完整运动轨迹采样，检查模型不出画与桌面底部导航余量。
- `check_display_semantics.json`：模拟急停发送/确认/过期、PPG 延迟与回放。
- `node.txt` / `python.txt` / `firmware-host.txt`：本轮软件回归。
- `build-follow.txt` / `build-verify.txt` / `compile-only-manifest.json`：占位配置编译与 FFat 校验。manifest 如实保留构建时旧 HEAD + dirty 标记；其内容版本对应本轮已测控制台源。没有提供可直接烧录的二进制。
- `SHA256.json`：本目录证据完整性清单（不包含自身），可与源码/外观 manifest 交叉核验。

未公开 PDF/商家参考图/原始 CAD/私有配置。原始浏览器工具输出及制作迭代保留在本机 `output/playwright/v4/`，公开目录选用最终结果；不会将中间失败截图当最终结果。
