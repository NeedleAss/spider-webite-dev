# Windows V4 候选接手入口

当前下一轮候选为 `codex/final-polish` 的 V4 更新。请先读 [V4 实施与验收](docs/V4_ACCEPTANCE.md)，把 [V4 Windows AI 提示词](docs/V4_WINDOWS_AI_PROMPT.md) 交给实物端 AI。复审使用 [V4 提示词](docs/V4_REVIEW_PROMPT.md)。

展示无需烧录：从仓库启动本地 HTTP 后打开 `/presentation/`，详见 [启动说明](presentation/README.md)。控制台 JS 有更新，实物端须按实际配置重建 FFat。现场验收、私有配置、完整备份与 G01 门槛继续有效。

最新 V4 ZIP、冻结源码提交和完整性校验见 [交付说明](docs/V4_DELIVERY.md)。源码包不含私有配置或可直接烧录的二进制。下面保留上一版交接记录，旧冻结包不能替代 V4。

---

# 上一版冻结候选记录

本轮接手 `codex/final-polish`，冻结候选为 `1246b016e59d9fef02f342994ec24f8b53d0dc64`，审查基线为 `058ce89bd1aa5b5da0dbf89101f4625df70ca6df`。分支后续提交补充交接与证据，不改变冻结包。

1. 先读 [最终交接说明](docs/FINAL_TEAM_HANDOFF.md)，包含 Git/ZIP 两种获取方式、版本校验与私有配置移交。
2. 把 [Windows AI 接手提示词](docs/FINAL_WINDOWS_AI_PROMPT.md) 交给实物端 AI。
3. 以 [当前验收门槛](docs/FINAL_ACCEPTANCE.md) 和 [软件结果](docs/FINAL_RESULTS.json) 为当前基准；[原始日志](evidence/final/README.md) 可公开查看。
4. 使用 [0915 历史交接](docs/WINDOWS_0915_HANDOFF.md) 的环境安装、备份和工具命令；其中旧分支、时限、阈值及继续开发目标不得覆盖当前候选。

[冻结源码与证据 ZIP](deliverables/CareRover_Final_Candidate_20260917.zip) 不含设备二进制或私有配置。仅导出包解压后运行 `tools/verify_handoff.py`；普通 Git checkout 不运行它。当前构建均为 compile_only，现场需核对真实配置、完整备份后重新构建设备包。软件 PASS 不代表实物 PASS。
