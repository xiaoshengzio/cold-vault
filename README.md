# 冷库 / COLD VAULT

一座「恒定零度的私人数字档案馆」。立式封存舱、日食刻度环与冷光尘埃构成实时场景；主体不是实心晶体，而是 **88 枚彼此独立、可碰撞的小磁体**。

## 运行

```bash
npm install
npm run dev       # http://127.0.0.1:5273
npm run build     # TypeScript 检查 + Vite 生产构建
npm run preview   # 预览生产包
```

技术栈：Vite 8、TypeScript、three.js r186、postprocessing 6.39、Rapier3D。无前端框架或 UI 库。

## 磁体与交互

- 88 枚十二面体共享一份几何和材质，通过一次 `InstancedMesh` 绘制；每枚磁体仍有独立 Rapier 刚体、质量、凸包碰撞、速度与角速度。
- 没有隐藏晶体、附着内壳或实心宿主。初始晶体同样由独立磁体组成。
- 每轮以随机顺序展示 8 种非晶体形态，第 9 次精确回到开场时缓存的晶体位置；下一轮再重新洗牌。
- rest / burst / drift / gather 任意阶段都立即接受下一次点击，起爆速度随扩散半径衰减，避免连点飞出场景。
- 数学结构精确吸附，有机结构保留碰撞结果；磁吸冲量按真实质量计算。
- 水平拖动可连续旋转 360°并无限续转，松手后不回正；拖动时暂停镜头视差，窗口外松手、失焦或隐藏会正确释放状态。
- 指针局部引力、点击重组；释放时镜头后移，平面形态缓慢转到可辨认角度。
- 全局禁止误选文字，邮箱仍允许选择复制。

页面另含四章节镜头、作品详情弹窗、移动端专用构图和自动画质档。

## 性能设计

- 磁体 1 次实例化绘制，不投射实时阴影；84 个舱体刻度合并为 3 次实例化绘制；静态房间只烘一次阴影。
- 两条虚线轨道仅 2 次绘制，半径逐帧跟随磁体实时包络，变形全程显示并保持安全间隙。
- 物理缓存在加载阶段预热；交互期使用 4 次求解迭代并关闭当前速度下无收益的 CCD。
- Rapier 动态拆包并行加载；启动只生成一份环境贴图，不做首屏 CubeCamera 反射烘焙。
- 默认使用 Three.js 原生 ACES 渲染，基础场景先出帧，再预热物理；`?post=1` 才启用后处理合成，`?bloom=1` 才启用 Bloom，避免冷缓存下重复或昂贵的光学编译。
- 墙面使用 Lambert，金属与地面使用 Standard；混凝土程序纹理为 256。
- Three.Timer 管理帧时间，隐藏时停止渲染，恢复时重置计时与画质采样；画质按实际渲染帧间隔调节。
- 隐藏重载不再死等 rAF，加载条使用前台 rAF / 后台低频定时器；WebGL 恢复会重建环境反射。
- shader 同步日志默认关闭，需要排查时使用 `?shaderdebug=1`。

## 结构

```text
index.html                 四章节页面、作品对话框与预加载
src/main.ts                渲染、输入、镜头反馈与自适应画质
src/ui.ts                  导航、形态状态、作品弹窗与加载
src/style.css              排版、动效、触屏与防误选
src/world/
  magnet-field.ts          88 枚实例化磁体与 Rapier 物理（当前实现）
  formations.ts            九种确定性目标形态
  chamber.ts               封存舱、日食环、基座与冷光粒子
  camera-rig.ts            章节机位、释放后移与竖屏补偿
  room.ts                  混凝土房间与百叶窗
  beams.ts / dust.ts       体积光与空气尘埃
  materials.ts / env.ts    材质与 PMREM 环境
  specimen.ts / voronoi.ts 旧版解理标本（保留作历史参考，当前不引用）
tools/kimi-verify.mjs      桌面 / 移动端交互验收
tools/magnet-verify.mjs    九形态、轨道间隙、半径、NaN、选区与长任务验收
```

## 验收

开发服务运行时：

```bash
node tools/magnet-verify.mjs       # 8+1 顺序、精确复原、轨道间隙、NaN、选区
node tools/interaction-verify.mjs  # 任意阶段连点、点击来源、交互长任务
node tools/drag-verify.mjs         # 360°续转、越界松手、失焦释放、角度保持
node tools/kimi-verify.mjs         # 桌面章节、移动端与弹窗
node tools/visibility-verify.mjs   # 真标签页隐藏/重载/WebGL 恢复（会打开测试浏览器）
node tools/real-stress.mjs         # 默认显卡下三轮冷启动、点击与拖动压测
```

本机结果：前 8 种形态不重复，第 9 次逐块复原误差约 `5.8e-8`；200ms 连续 9 次点击无交互长任务，88 枚全部落位。真实标签页的普通隐藏/恢复、隐藏重载与 WebGL 恢复均通过，无运行时异常。生产环境 RTX 4050、1600×900 交互测试约 63–72 FPS，其他设备与冷缓存状态会有差异。

## 作品：Fly, My Wings

首项作品为实际完成的《Fly, My Wings》MV，而非示例项目。观看版视频和封面位于 `public/works/`，弹窗使用 `preload="none"`，仅在打开作品时加载视频。

- 规格：27 镜、194.63 秒、1920×1080、30fps、5839 帧。
- 管线：15 张 AI 底板 → Blender 5.2 EEVEE 空气与镜头运动 → NumPy 后期 → 分块编码与混音。
- 原曲：MILI；非官方粉丝二创，仅作学习交流。
- 制作依据：`C:/工作区/Projects/Fly,my wings/MV/docs/交付说明.md` 与 `Wiki/analyses/Fly-My-Wings-MV-项目经验.md`。

## 作品：P5R 合成工具

第二项作品为 `P5R 合成工具`（PHANTOM SYNTH），使用真实合成树与执行顺序截图。

- 有界 DFS + 环剪枝搜索合成树，并按深度、候选数、节点数和时间预算截断。
- 普通二体使用基础等级与 23×23 阿尔卡纳合成范式；固定多体配方精确匹配，宝魔按当前等级查排名。
- 技能与特性按供体传播、8 槽容量和继承预算规划，最后通过正向重放验证路线。
- 算法依据：`C:/工作区/Projects/P5r合成工具/Wiki/concepts/合成规则.md` 与 `继承规则.md`。

## 部署

当前正式部署由 **GitHub + Vercel Git 集成**完成：仓库 `https://github.com/xiaoshengzio/cold-vault` 已连接现有 Vercel 项目 `cold-vault`。向 `master` 推送提交会自动触发 Vercel 构建，使用 `npm ci`、`npm run build`，输出目录为 `dist`。无需 GitHub Pages 或手动上传部署包。

线上验证以 Vercel 生产地址为准：`https://cold-vault-xiaoshengzio.vercel.app`（备用：`https://sonic-lilac-2g25ciz.tmp.now`）。首页 3D、P5R 图片与算法说明、Fly, My Wings 视频均已验证。联系邮箱为 `18239690584@163.com`；其余作品名称与描述仍为示例内容。
