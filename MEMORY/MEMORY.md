# 冷库 / COLD VAULT — 项目备忘

## 当前状态

可运行的四章节单页个人站原型（http://127.0.0.1:5273/），3D 首屏、滚动章节、点击碎裂、窄屏适配均已跑通并通过截图验证。**文案全部为占位内容**，尚未替换真实资料，也未部署。

## 事实

- 目录：C:\工作区\Projects\个人站·冷库
- 依赖锁定：three 0.186.0 / postprocessing 6.39.5 / @dimforge/rapier3d-compat 0.21.0（postprocessing 6.39 要求 three < 0.187）
- 构建：`npm run build` = tsc --noEmit + vite build，当前通过；产物 dist/ 5.5MB（gzip 2.05MB）
- 本机测试条件：headless Edge（channel:'msedge'）、视口 1600×900；**必须加 --ignore-gpu-blocklist --force_high_performance_gpu 才会用独显 RTX 4050，默认走 Intel Iris Xe**
- 标本：**碎片常显**的骨白矿石解理柱（约 34 块粗解理片，solid 整块只在退化时使用）+ 黄铜双环；点击 = 解理展开包络（2.35s）+ 精确归位（settled 后 setTranslation(home)/rotation 恒等）。观感基准是 shots/121-hero.png，见决策点「标本观感以首版为准」
- 像素预算按 GPU 分档：gpuTier() 读 UNMASKED_RENDERER_WEBGL，nvidia/rtx/radeon → 2.4e6，intel/iris/uhd → 1.25e6，其它 1.7e6；RES_CEIL = max(1, min(dpr, 1.75, sqrt(预算 / 视口面积)))，初始即上限；500ms 一窗（开头 900ms warmup 不计），慢则连续 2 窗先关景深（默认就是关的）再关色差、最后 res−0.10；快则连续 3 窗且 <14ms 才 res+0.08。fxLevel 默认 1（景深关，开场即清晰）；自动模式不会把景深加回来；要电影感景深用「高」或 ?q=high
- 实测（headless Edge + Iris Xe，1600×900）：dsf=1 → 1600×900，res 1.0，63–102fps；dsf=1.25 → 2000×1125，res 1.25（物理像素 1:1），2 个特效全开约 27–31fps；阶梯轨迹显示 4s 关景深、11s 关色差，分辨率全程未降
- 2026-10 修复（首帧卡死）：首帧渲染一次性编译全部 WebGL 管线，实测集显上阻塞 4.6–10s，用户在遮罩收起后看到死页面。现已改为：小尺寸（240×150）先把 composer 整条管线跑热再切回主分辨率、遮罩留到 `__FRAMES__ >= 4` 才收、加载条改用纯 CSS 扫描动画、`body.is-loading` 由内联脚本立即加上。生产包首发长任务 10064ms → 960ms（集显）。
- 2026-10 修复：早先自适应从 1.0 起跳、下限 0.62，在 dpr 2 屏上把 1166×656 的缓冲拉满 1600×900 显示 → 用户反馈画面糊；已改为以物理像素为基准（见上）
- Blender 5.2 只用于早期晶体/碎片资产，房间与标本已全部改为 Three.js 程序化生成（public/artifact.glb、shards.glb 已不再被 main.ts 使用）

## 关键文件

- src/main.ts：渲染器、灯光、后处理、交互、主循环、自适应分辨率
- src/world/specimen.ts：标本几何（六棱柱解理）、Rapier 物理、弹簧场、burst
- src/world/camera-rig.ts：四章节机位与窄屏补偿
- src/world/room.ts / beams.ts / dust.ts / materials.ts / env.ts
- src/ui.ts / src/style.css / index.html：排版层
- tools/shot.mjs、shot-scroll.mjs、shot-burst.mjs、probe-*.mjs：截图与诊断脚本

详见 `决策点.md`、`待办.md`、`README.md`。
