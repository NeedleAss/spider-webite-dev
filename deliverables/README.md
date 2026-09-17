# CareRover 交付包

当前 V4：

- [源码与完整证据 ZIP](CareRover_V4_Candidate_20260918.zip)
- [ZIP SHA-256](CareRover_V4_Candidate_20260918.zip.sha256)
- [冻结源码与导出信息](V4_RELEASE.json)
- [交付/复审/离线演示说明](../docs/V4_DELIVERY.md)
- [给实物端 AI 的提示词](../docs/V4_WINDOWS_AI_PROMPT.md)

仅 ZIP 解压目录运行 `py tools/verify_handoff.py`。普通 Git checkout 依据提交版本和资产清单；无导出清单时不运行 ZIP 校验工具。V4 源码包不含设备二进制、私有密码或标定配置。组员需要现场核验、备份和重新构建，不是收到 ZIP 就直接烧录。

20260917 包继续保留为上一轮冻结候选，不能当 V4。具体物理门槛见 [当前验收表](../docs/V4_ACCEPTANCE.md)。
