# 给实物端 Windows AI 的 V4 接手提示词

请在 CareRover 现有项目上接手 **codex/final-polish 的 V4 候选**。先读 `WINDOWS_START_HERE.md`、`docs/V4_ACCEPTANCE.md`、`docs/visual-v4/RESULTS.json`、`docs/FINAL_ACCEPTANCE.md`。原始第三/四版指导在 `docs/visual-v4/source-briefs/`，对应配置在 `source-contracts/`；第四版为展示要求主基线，旧安全门槛继续生效。

这次更新的是独立产品展示页和控制台显示语义，固件源码保持 `72ee475bd76b7a46f2c3bd6477dcd2f45b76ac69` 时的安全修复。不要用历史目录覆盖当前代码；不要为动画改变控制权、IMU +X 安装解释、阈值、watchdog、NVS 或动作取消逻辑。不要新增机器人功能。

## 先核对拿到的版本

Git 用户记录 `git status --short`、当前分支和 `git rev-parse HEAD`，有组员未提交修改时保留并分析差异，不强制 reset。ZIP 用户在解压根目录运行 `py tools/verify_handoff.py`，保存输出及 `EXPORT_INFO.json`；它证明完整性，不证明硬件通过。普通 Git checkout 没有导出清单，不运行此 ZIP 检查。

`docs/visual-v4/RESULTS.json` 和验收表是这一轮的证据入口；20260917 旧冻结 ZIP/旧 FINAL_RESULTS 是历史，不能当最新 V4 包。当前交付包不包含可直接烧录的二进制或私有配置。

## 第一件事：无需机器人检查展示

在项目目录运行 `py -m http.server 8765 --bind 127.0.0.1`，浏览器打开 `http://127.0.0.1:8765/presentation/`。滚动七章，检查首屏是镜头/双超声的正面，摄像头和回波向前，顶部 OLED 跟盖开合。摄像头章后段有整车回应，健康章后段有顶部屏幕近景。自由探索退出应回原章；`?static=1` 是离线海报降级。

这页不用烧入 ESP32。它不连接机器人。可在任意准备好本地 HTTP 服务的演示电脑运行，资源随包完整提供，不依赖互联网。真实手机请测试中心翻页、横竖屏、多指/取消、后台恢复并记录设备/浏览器；当前 Mac 模拟测试不能代替你的手机结果。

## 第二件事：软件与配置核查

按已有环境文档运行 Node/Python/C++ 检查，`py tools/appearance_manifest.py --check` 核验资产。主控/控制台仍使用原工具流程，配置说明见 `docs/WINDOWS_0915_HANDOFF.md`、`docs/tracking-development.md`、`docs/WINDOWS_ULTRASONIC_HANDOFF.md`。

虽然固件逻辑没改，**控制台 JS 改了，需要从本次源码重建 FFat** 才能在设备网页看到新的急停确认与 PPG 时间提示。展示页不在 FFat 内。不要把旧 FFat 与本次网页源混称一个版本。

本机编译结果是 `compile_only`，禁止直接烧录，也不能只把 verification 改成已确认。现场先枚举实际端口，核实两板型号/Flash/PSRAM、FQBN、供电和接线，保存完整 Flash/NVS 备份和已验证标定，私下恢复真实 `board.local.json`、`wifi_secrets.h`、`front_config.local.h`。不猜 COM、不用 null/示例参数代替实测，不提交密码。需要烧录/操作实物时，以现场用户授权和已经满足的前置条件为准。

## 第三件事：按门槛进行现场验证

遵守 CAM → observe → 架空校准 → manual → follow → 无 USB 十分钟。记录构建 manifest、网页版本、两板串口、输入来源和失效时刻。

请逐项填写 `docs/V4_ACCEPTANCE.md` 的现场表，并在 `docs/windows-progress.md` 追加真实进度：手动命令静默但 ping 继续、WS 断而 AP 保持、人物 found=false 与人物数据完全静默两条路径、手势动作中的普通停止、IMU 缺失/拒绝帧/倾倒锁存、绕障各阶段失效、十分钟无线。每项分别记录软件目标归零、PWM 撤销、实体停止耗时；网页显示零不算 PWM 或实体证据。

**G01 仍是发布阻断：安全任务自身停摆后，现有同任务内 240 ms 驱动期限不能证明独立撤销 PWM。** 只有受控故障注入和实际输出测量能关闭。未通过时不落地展示运动，采用 observe/明确标注的 Mock 与独立产品页答辩；不要添加未经实测的看门狗来宣布问题已解决。

未知最终超声深度、第四舵机安装、线端和小元件外观逐项核对即可，不妨碍纯软件演示。照片是未完成装配记录；3D 是目标装配，不是扫描/医疗数据/导航能力证明。

最后交付一份现场结果表、日志目录、当前两个固件及网页版本、仍未通过的门槛和回退方法。所有未做项写 NOT RUN，不拿历史记录或模拟结果补成 PASS。
