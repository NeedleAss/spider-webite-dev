# Windows 最终候选接手入口

本轮接手 `codex/final-polish`，冻结候选为 `1246b016e59d9fef02f342994ec24f8b53d0dc64`，审查基线为 `058ce89bd1aa5b5da0dbf89101f4625df70ca6df`。分支后续提交补充交接与证据，不改变冻结包。

1. 先读 [最终交接说明](docs/FINAL_TEAM_HANDOFF.md)，包含 Git/ZIP 两种获取方式、版本校验与私有配置移交。
2. 把 [Windows AI 接手提示词](docs/FINAL_WINDOWS_AI_PROMPT.md) 交给实物端 AI。
3. 以 [当前验收门槛](docs/FINAL_ACCEPTANCE.md) 和 [软件结果](docs/FINAL_RESULTS.json) 为当前基准；[原始日志](evidence/final/README.md) 可公开查看。
4. 使用 [0915 历史交接](docs/WINDOWS_0915_HANDOFF.md) 的环境安装、备份和工具命令；其中旧分支、时限、阈值及继续开发目标不得覆盖当前候选。

[冻结源码与证据 ZIP](deliverables/CareRover_Final_Candidate_20260917.zip) 不含设备二进制或私有配置。仅导出包解压后运行 `tools/verify_handoff.py`；普通 Git checkout 不运行它。当前构建均为 compile_only，现场需核对真实配置、完整备份后重新构建设备包。软件 PASS 不代表实物 PASS。
