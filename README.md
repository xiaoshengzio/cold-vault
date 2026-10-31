# 冷库 / COLD VAULT

一个以「恒定零度的私人档案馆」为设定的个人主页：混凝土房间、百叶窗斜切进来的体积光、悬浮的黄铜环与被解理成数十块、靠真实物理悬停的晶体标本。点击标本会把它炸开，松手后碎片在弹簧场里重新聚拢。

- 技术栈：Vite 8 + TypeScript + three.js r186 + postprocessing 6.39 + Rapier3D（零重力刚体）
- 无框架、无 UI 库；DOM 排版与 WebGL 共存，滚动驱动镜头推拉

## 运行

```bash
npm install
npm run dev      # http://127.0.0.1:5273
npm run build    # tsc --noEmit + vite build
npm run preview
```

## 结构

```
index.html            页面骨架：四章节 DOM、页眉页脚、预加载、自定义光标
src/main.ts           渲染器 / 灯光 / 后处理 / 交互 / 主循环 / 自适应分辨率
src/ui.ts             预加载计数、时钟、滚动进度、章节导航、光标、作品列表交互
src/style.css         全部排版与动画样式
src/world/
  room.ts             程序化房间：地面、天花梁、墙板、窗洞、百叶、天空发光面、灯槽
  materials.ts        共享材质（混凝土、钢材、石材）
  env.ts              PMREM 环境贴图（室内反射光源）
  beams.ts            体积光柱（每条窗缝两片交叉加法面 + 自定义 shader）
  dust.ts             尘埃粒子（高斯聚光 + 近似流体漂移）
  specimen.ts         标本：六棱柱解理成楔块 + Rapier 刚体 + 弹簧场 + 点击爆发
  camera-rig.ts       四章节机位、鼠标视差、窄屏取景补偿
public/fonts/         自托管字体（Instrument Serif / JetBrains Mono，拉丁子集）
tools/                基于 playwright-core 驱动本机 Edge 的截图与探针脚本
```

## 渲染管线

RenderPass → EffectPass(Bloom + DepthOfField) → EffectPass(ACES 色调映射 + SMAA + 噪点 + 暗角) → EffectPass(色差)

- 色调映射在 WebGLRenderer 里关闭，交给 postprocessing，保证 Bloom 在线性空间里工作
- 雾（FogExp2 0x0c1118 / 0.052）是场景的统合层：低机位下它有体积感，去掉就会变成「黑屋子里放了几个盒子」
- 标本金属材质 anisotropy 必须为 0（凸包几何没有切线，各向异性 GGX 会产出 NaN 并经 Bloom 扩散成全屏黑）
- 景深用 target（Vector3 每帧同步到标本世界坐标）而非手动 focusDistance，手动值在这个距离上对不准
- 渲染分辨率：以物理像素为准，上限 `min(devicePixelRatio, 1.75)`，下限 `max(0.9, min(上限, dpr × 0.66))`；初始值取上限的 90%
- 自适应调节：每 48 帧统计平均帧时长，>23ms 降 10%，<16ms 升 5%，在上下限之间浮动；页脚「画质：自动 / 高 / 快」可手动锁定，也可用 `?q=high`、`?q=low` 直接指定（手动模式不再自动调节）

## 交互

- 鼠标 = 引力源：射线与过标本的平面交点作为吸引中心，碎片被拽向光标
- 点击 = burst：外推冲量 + 随机扰动 + 扭矩，同时把弹簧刚度从 34 降到 15，0.9 秒后恢复
- 滚动 = 四章节：镜头小幅前推 + 画面左侧压暗遮罩，文字分区淡入
- 触摸屏同样支持点击碎裂；窄屏自动补偿取景（拉远 + 缩小 fov 变化）

## 已知限制

- **文案全部是占位内容**：中文标题、段落、邮箱 `hello@coldvault.studio`、五个作品条目均为示意，需要替换成真实资料
- 帧率与清晰度存在取舍：1440×900 窗口在 dpr 1 屏上自动画质约 0.90（1296×810）约 40fps；dpr 2 屏上自动画质稳定在 1.32（1900×1188）约 23–30fps，锁定「画质：高」会到 1.75（2520×1575）但帧率明显下降。数值来自 headless Edge + Intel Iris Xe，真机会有差异
- 生产包 5.5MB（gzip 2.05MB），体量主要来自 Rapier WASM 与 three；尚未做代码分割
- 截图脚本依赖本机安装的 Edge（playwright-core 不下载浏览器）

## 截图

`shots/` 下按序号保存各轮迭代：107-hero.png（桌面首屏）、108–110（档案/作品/联系）、103（碎裂瞬间）、106（移动端）。
