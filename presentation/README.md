# CareRover 离线结构展示

这是独立电脑端展示页，不连接机器人、不请求 WebSocket、不发送任何控制命令，也不进入 ESP32 FFat 网页包。所有模型、预览、字体回退和 Three.js 都在本目录内，不依赖 CDN。

从仓库根目录运行：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8765/presentation/`。Windows 可使用 `py -m http.server 8765 --bind 127.0.0.1`。不直接双击 HTML（模块与 GLB 需要 HTTP）。断开互联网后仍可使用；本机 HTTP 服务需要保持运行。

默认完整装配，桌面鼠标移入拆解、移出收拢；选中零件后固定展开，关闭说明或完整装配解除。目录按钮可键盘访问；手机使用显式拆解按钮、目录与拖动旋转。Escape 关闭说明。系统减少动态效果偏好生效时，拆解直接切换、原理动画静止；也可取消「原理动画」。

相机视锥/检测框、超声往返回波、主控信息流均为**示意动画**，不是标定结果或实时传感器数据。当前没有身份识别、自动搜人、侧后方测距、编码器轮速或真实电池低压测量。加载失败时保留保存的装配预览和说明；`?static=1` 可主动使用静态版。

## 真实资产与可复现性

输入是用户提供的 15 个 `.SLDPRT` 与 `小车.SLDASM`。原件未修改，未上传第三方。导出命令：

```sh
python3 tools/export_cad.py /path/to/3D建模 --output presentation/assets/cad
```

`export_cad.py` 独立读取 CRC 校验通过的容器流、完整保存的显示网格表及装配矩阵。支持范围限于已验证的这套现代 SolidWorks 保存格式；不是通用 CAD/B-rep 转换器。文件格式参考 [cadmpeg 的 sldprt 文档](https://github.com/cadmpeg/cadmpeg/blob/main/docs/formats/sldprt.md)（CC BY 4.0，格式说明作者 cadmpeg contributors）；本项目没有复制其转换器代码。

`assets/cad/cad-manifest.json` 固定输入 SHA-256、每种零件顶点/三角形数量/包围盒、实例变换、隐藏实例与输出 SHA-256。GLB 有 15 类网格、20 个可见实例、15,110 个唯一网格三角形，约 0.70 MB。源装配有 21 个引用，其中第 4 个舵机隐藏；因此显示 4 个轮子、3 个舵机。未补造隐藏实例。中性配色是展示材料，位置、比例、原始姿态来自保存的装配数据。

Khronos glTF Validator `2.0.0-dev.3.10`：0 errors / 0 warnings / 0 hints（有一个恒等矩阵信息提示）。原生 SolidWorks 中的引用、配合、配置和加工正确性：**NOT RUN**。保存网格可能落后于参数模型；现场团队应打开原装配核对最新状态。

Three.js 固定 `0.180.0`（MIT），只包含核心、GLTFLoader、OrbitControls、BufferGeometryUtils 及 LICENSE。`vendor/three` 从官方 npm `three@0.180.0` 原样复制，未修改源码。GLB 不使用 Draco/纹理/外部 buffer，因此无需解码器或远端资源。

浏览器验收与设备验收界限见 `docs/FINAL_ACCEPTANCE.md`。
