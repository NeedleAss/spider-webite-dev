// Functional descriptions are deliberately separate from CAD and runtime control.
export const parts = [
 {id:'camera',name:'摄像头',en:'VISION',category:'感知 / VISION',description:'为主控提供人脸位置与手势检测结果。跟随依据是画面中的位置和面积变化；系统不进行身份识别。',principle:'从画面得到目标',detail:'视锥与方框示意检测过程。真实功能受帧率、光照与目标有效性限制。',offset:[-100,55,85],effect:'vision'},
 {id:'ultrasonic',name:'超声模块',en:'DISTANCE',category:'感知 / DISTANCE',description:'测量前方障碍距离，为前向保护提供依据。有限场景的绕障演示仍依赖有效测距与安全条件。',principle:'发出声波，接收回波',detail:'圆环示意往返测距，不代表真实声波形状或当前距离，也不是全向避障。',offset:[90,25,100],effect:'sonar'},
 {id:'controller',name:'主板',en:'CONTROL',category:'控制 / CONTROL',description:'汇集感知结果与网页指令，执行模式、所有权、数据时效和停止条件的裁决，再向底盘提交运动目标。',principle:'有效输入 → 判断 → 输出',detail:'流动光点示意信息传递。失效输入不能持续授权非零运动。',offset:[-95,30,-75],effect:'flow'},
 {id:'imu',name:'加速度计',en:'ORIENTATION',category:'感知 / ORIENTATION',description:'提供姿态与转向信息，参与倾倒保护与转角控制。当前安装按 +X 竖直方向解释传感器数据。',principle:'姿态也有有效期',detail:'数据缺失不应清除已经锁存的倾倒故障；恢复依赖新的有效测量。',offset:[85,60,-85]},
 {id:'health',name:'心率血氧计',en:'HEALTH',category:'感知 / HEALTH',description:'通过接触式光学信号采集心率与血氧相关数据。界面区分无手指、采集中、测量中与有效结果。',principle:'先有信号，再谈读数',detail:'课程原型的测量展示；信号质量与手指接触状态会影响结果。',offset:[-85,100,-5]},
 {id:'display',name:'屏幕',en:'FEEDBACK',category:'反馈 / DISPLAY',description:'在机器人端提供状态反馈，让现场操作不必完全依赖网页。网页遥测与本地显示应共同反映真实状态。',principle:'让状态可见',detail:'待机、控制模式和停止原因需要清楚可辨。',offset:[0,130,35]},
 {id:'wheel',name:'全向轮',en:'MOBILITY',category:'行动 / MOBILITY',description:'四个轮子配合底盘实现平移与转向。网页中的速度是归一化指令，不是编码器测得的实际轮速。',principle:'轮组协作，形成运动',detail:'装配中保留四个实例与各自的原始姿态。',offset:[0,-10,0]},
 {id:'servo',name:'舵机',en:'ACTUATION',category:'行动 / ACTUATION',description:'驱动轮组，把主控输出转为机械运动。实际中位、方向与死区必须通过架空校准和现场验证确定。',principle:'校准后，才允许驱动',detail:'源装配保存了 4 个舵机实例，其中 1 个隐藏；本展示遵循源文件的可见性。',offset:[0,-35,0]},
 {id:'battery',name:'电池',en:'POWER',category:'供电 / POWER',description:'为整机供电，位置来自原始装配。供电稳定性需要在接线、负载和无线运行条件下检查。',principle:'稳定供电是运行前提',detail:'当前项目不提供真实电池低压采样；这里不展示虚构电量。',offset:[0,-80,-20]},
 {id:'chassis',name:'底盘',en:'FOUNDATION',category:'结构 / FOUNDATION',description:'承载驱动、电池和上层结构，是各部件装配位置的基础。拆解仅改变展示位置，收拢后回到保存的装配姿态。',principle:'把部件连接成整机',detail:'这里展示真实 CAD 保存的网格，不是重新生成的参数化实体。',offset:[0,-48,0]},
 {id:'shell',name:'外骨骼',en:'ENCLOSURE',category:'结构 / ENCLOSURE',description:'为内部模块提供外部支撑与保护。拆解后可以观察内部部件的相对布置。',principle:'结构为功能留出空间',detail:'展示颜色为统一配色，几何与装配位置来自源文件。',offset:[125,30,0]},
 {id:'lid',name:'顶盖',en:'TOP COVER',category:'结构 / TOP COVER',description:'完成顶部覆盖，与屏幕及内部模块的布置共同构成整机外形。',principle:'从完整外观到内部结构',detail:'选择零件后保持展开；关闭说明后可重新收拢。',offset:[0,80,0]},
 {id:'board-mount',name:'主板支架',en:'MOUNT',category:'结构 / MOUNT',description:'固定主控模块，保持其与底盘及周围部件之间的相对位置。',principle:'把安装位置固定下来',detail:'配合关系仍需在原生 CAD 中核验。',offset:[-65,5,-75]},
 {id:'camera-mount',name:'摄像头架',en:'VISION MOUNT',category:'结构 / VISION MOUNT',description:'固定相机位置与朝向。相机安装会影响观察范围与跟随时的画面解释。',principle:'观察从安装开始',detail:'视锥动画是独立原理示意，不是相机标定结果。',offset:[-65,25,85]},
 {id:'board-frame',name:'主板外骨骼',en:'FRAME',category:'结构 / FRAME',description:'支撑内部电子模块，连接板件与外部机身。通过展开可查看内部结构的层次。',principle:'为模块安排位置',detail:'使用源装配变换，未补造隐藏或缺失零件。',offset:[65,25,-25]},
];
