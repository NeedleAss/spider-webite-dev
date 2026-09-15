# Windows 接手入口

> **0915 更新：** 已合并现场修复并加入可选 Demo 优化。先读 [0915 开发与验收记录](docs/0915-demo-development.md)。根目录为当前开发源，原包保持归档；新代码未做本轮实物验收。以下 0912 说明保留为历史环境与联调流程。

当前推荐从 GitHub 拉取 `feat/main-wireless`。主控/CAM/网页/超声波功能已提交，功能基线 `67fea55` 的 CI 全部通过；真实设备、Windows 和机械标定仍需现场验收。

**首先阅读 [Windows 整机与超声波交接](docs/WINDOWS_ULTRASONIC_HANDOFF.md)。** 其中包含资源清单、PowerShell/CMD 命令、模块分工、引脚占用、验收顺序，以及可直接复制给 Windows Agent 的提示词。

## 从 Git 获取

先安装 Git，在 PowerShell 执行。`C:\CareRover` 应是新目录：

```powershell
git clone --branch feat/main-wireless --single-branch https://github.com/NeedleAss/spider-webite-dev.git C:\CareRover
Set-Location C:\CareRover
git status --short
git rev-parse HEAD
```

已有工程先保存本机改动和私有配置，再核对当前分支；不要覆盖旧目录或强制重置。打开该项目，把交接文档第 7 节提示词交给 Windows Agent。

## 阅读顺序

1. [当前交接与提示词](docs/WINDOWS_ULTRASONIC_HANDOFF.md)
2. [构建、校准与联调](docs/tracking-development.md)
3. [超声波状态机、接线与标定](docs/ultrasonic-development.md)
4. [通信协议](docs/protocol.md)
5. [原集成软件验收](docs/tracking-acceptance.md)及[超声波软件验收](docs/ultrasonic-acceptance.md)

[WINDOWS_AI_HANDOFF.md](docs/WINDOWS_AI_HANDOFF.md) 保留为早期集成改动索引；其旧版本号、未提交状态和历史设备信息不代表当前 Git/实物状态。

## Git 之外的资料

按当前交接文档资源表，另传实际硬件照片/接线图、HC-SR04 说明书，以及已经存在的私有配置、实测校准记录与固件/NVS 备份。当前没有已验证的超声波安装参数。不要复制 Mac 的 `.venv` 或编译缓存；Windows 重新建立工具链。

本地原始参考包和恢复镜像不随 Git 提交，当前源码不依赖该目录即可构建。私有配置和 `output/` 证据也不在 Git；缺失资料保持未知，不伪造 PASS。

## 如果使用离线导出包

只有实际收到带 `SOURCE_MANIFEST.json`、`EVIDENCE_MANIFEST.json` 的导出包时，才按所收包名核对 ZIP SHA-256，并在解压目录运行 `py -3.12 tools\verify_handoff.py`。普通 Git checkout 不带这些清单，不适用该检查。旧导出包是否包含最新超声波代码，应以包内来源记录与实际文件核对，不能只看文件名日期。
