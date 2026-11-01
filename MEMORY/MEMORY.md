# 冷库 / COLD VAULT — 项目备忘

## 当前状态

当前主体为 88 枚独立十二面体磁体（InstancedMesh + 独立 Rapier 凸包刚体），无隐藏内核。形态队列已改为**每轮 8 种非晶体随机排列，第 9 次回到开场缓存的 homeTargets**，不再随机中途复原；复原误差实测约 5.8e-8。burst 在任意 phase 均可立即重触发，按当前半径衰减起爆速度，200ms 连续 9 次点击无长任务、88 枚最终全部落位。

2026-11 完成生命周期与性能修复：Rapier 首次 step 移到加载预热；交互期 4 solver、关 CCD；84 个舱体刻度改 3 个 InstancedMesh。Three.Timer + visibilitychange 显式暂停/恢复，隐藏启动与加载条不再死等 rAF，WebGL 恢复重建环境反射。真实 CDP 标签页测试通过普通隐藏/恢复、隐藏重载、context lost/restore，无运行时异常。**已添加真实作品 Fly, My Wings，邮箱为 18239690584@163.com；Vercel 临时公开部署已上线并验证，待用户认领长期保留。**

## 关键事实

- 质量 bug：初版新磁体按密度 1 得到小质量，但磁吸冲量漏乘 `body.mass()`，导致不规则形态飞到半径 90–112。现按真实质量计算冲量与上限；九形态半径稳定约 1.0–1.53。不要用最终强制吸附掩盖物理发散。
- 实例化：`88-independent-magnets` 是一个 InstancedMesh；`pieces[].mesh` 是矩阵/探针用的独立 dummy，不加入场景。物理与实例矩阵每帧同步。
- 轨道：实体 Torus + 6 环座已替换为 2 条 LineLoop 虚线（8→2 draw calls）。偏移沿 axis；main 用 `holder.rotateZ` 绕局部法线旋转，不能用父空间 axis 调 `rotateOnAxis`。后续按用户要求取消安全淡入等待，改为每帧由所有磁体实时位置计算 `orbitScale = liveBound*1.14/0.72`，变形全程 `visible=true` 且动态避让。九形态在飞散中和静止后的采样间隙均为正，最小约 0.21。
- 性能：磁体不投影；静态阴影只烘一次。墙体 Lambert、磁体/地面/黄铜 Standard，无 Physical clearcoat/iridescence 分支；纹理 256。这样既降编译也保留金属 env 反射和自定义菲涅耳。
- 启动：Rapier 动态 import 拆包；仅生成 artefactEnv，首屏不再做 CubeCamera 烘焙。默认使用 Three.js 原生 ACES，先出 3 帧再退出加载层并预热物理；`?post=1` 才启用 composer，`?bloom=1` 才启用 Bloom。已移除未使用的 RectAreaLightUniformsLib 初始化及 RectAreaLight。尘埃 uOffsets 改为 22 并同步循环次数，修复越界。纹理/PMREM 间仍让帧，`?shaderdebug=1` 才开同步日志。
- 镜头：释放时 CameraRig.release=1 后移 0.85m；档案页机位已放宽。formation 2/5/6/7 使用 displayYaw 0.24 面向镜头，其他 0.92，避免平面形态停在不可读的侧角。
- 拖动：已移除 ±2.10rad 限制和 2.6s 自动回正；yawPerPx=2π/视口宽度，可无限续转。pointer capture + pointerId 防止多指/越界锁死，pointercancel/lostcapture/blur/hidden 统一 cancelDrag。拖动时暂停 rig 鼠标视差与 displayYaw 变化。`tools/drag-verify.mjs` 测正反转、越界松手、角度保持和变形中拖动。
- 竖屏：offX `k*1.72`、offY `-k*0.55`、pullBack `k*2.15`，主体居中在标题上方。
- 画质：GPU 像素预算、自动效果/分辨率阶梯仍保留；生产 RTX 4050 测试约 72 FPS。
- 测试：headless Edge 加 `--ignore-gpu-blocklist --force_high_performance_gpu` 才使用独显。`tools/magnet-verify.mjs` 跑完整九形态并断言 radius<4、轨道间隙>=0.01、无 NaN、九种唯一形态、空选区；`tools/kimi-verify.mjs` 测桌面/触屏与弹窗。
- 旧 `specimen.ts` / `voronoi.ts` 仅作历史参考，main.ts 当前动态导入 `magnet-field.ts` 并与材质/环境初始化并行。
- 参考视频已下载抽帧分析：用户参考的是独立金属单元可拖拽、碰撞、聚散的手感，不是实心晶体表面附着。临时视频与截图应在交付前清理。

## 关键文件

- `src/main.ts`：渲染器、灯光、后处理、输入与自适应画质
- `src/world/magnet-field.ts` / `formations.ts`：当前磁体物理与九形态
- `src/world/chamber.ts`：封存舱美术
- `src/world/camera-rig.ts`：章节、释放与窄屏机位
- `src/world/materials.ts` / `textures.ts` / `env.ts`：材质与启动成本
- `src/ui.ts` / `src/style.css` / `index.html`：排版与交互

详见 `决策点.md`、`README.md`。
