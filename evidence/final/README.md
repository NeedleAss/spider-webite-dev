# 本轮证据说明

所有 PASS 是软件/主机构建/模拟/浏览器证据，不是设备验收。基线固定为 058ce89，最终实现构建冻结在 78cc581；之后仅有验证记录和 Git 属性元数据提交。

- baseline-safety / baseline-recheck 是预期 FAIL：7/21、7/22，保留原始输出。
- baseline_reproduction.cpp 可用 baseline-source.json 指定 Git 版本中的生产头文件复现。单独编译 -DCAREROVER_TUNING_PROFILE=0 或 1，-I 指向基线 firmware/main_wireless 与 firmware/cam_tracking/main。
- firmware-tests.txt 包含修复后的全部 10 套测试；最后两行是当前独立 22/22、23/23。
- build-safe.log 是最初 x86_64 ctags 无法执行的 FAIL；build-*-final.log 和 builds/* 是冻结源码的成功 compile_only 构建。不得烧录占位密码验证包。
- environment.json 保留官方 ctags 源归档 SHA-256 与局部宏修正。arduino-native-wrapper.py 是本机实际使用的环境覆盖：配置 ARDUINO_CLI 指向该可执行 wrapper，ctags.path 指向同版本原生构建。它含 Mac Arduino IDE 默认路径，不适用于 Windows。
- browser-qa.json 是操作记录；截图在 Codex 对话中目视审阅，未作为仓库截图文件保存。真实触摸、GPU 丢失注入和系统 reduced-motion 切换未测。
- original-handoff-check / historical-replay 仅证明原始包完整性及离线回放，不能转算本轮实物 PASS。
- 此包只选取本轮证据，不混入工作区 output/evidence 中未重新验证的旧结果。
