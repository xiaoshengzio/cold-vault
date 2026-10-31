import * as THREE from 'three';
import {
  Effect, EffectComposer, EffectPass, RenderPass, BloomEffect, SMAAEffect, VignetteEffect,
  NoiseEffect, ChromaticAberrationEffect, ToneMappingEffect, ToneMappingMode,
} from 'postprocessing';
import { createMaterials } from './world/materials';
import { buildRoom, ROOM } from './world/room';
import { buildEnvironment, buildArtefactEnvironment, buildCrystalEnvironment } from './world/env';
import { buildSpecimen } from './world/specimen';
import { buildBeams } from './world/beams';
import { buildDust } from './world/dust';
import { CameraRig } from './world/camera-rig';
import { DepthOfFieldEffect } from 'postprocessing';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { initUI } from './ui';

const T0 = performance.now();
const stage = (s: string, pct: number) => {
  (window as any).__BOOT__ = { pct, label: s };
  console.log('[cv] ' + s + ' ' + Math.round(performance.now() - T0));
};

const canvas = document.querySelector<HTMLCanvasElement>('#gl')!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage('初始化渲染器', 8);
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 120);
const rig = new CameraRig(camera);

const M = createMaterials();
stage('调制材料', 26);
const envTex = buildEnvironment(renderer);
scene.environment = envTex;

// the artefact gets its own high-contrast studio reflections
const artefactEnv = buildArtefactEnvironment(renderer);
const crystalEnv = buildCrystalEnvironment(renderer);
M.brass.envMap = artefactEnv;
M.glass.envMap = crystalEnv;
M.brass.envMapIntensity = 1.15;
stage('烘焙环境光', 42);
const room = buildRoom(M);
scene.add(room.group);
stage('浇筑库房', 52);

/* --------------------------------------------------------------- lighting */
const sunDir = new THREE.Vector3(-0.34, -0.40, 0.85).normalize();
const sun = new THREE.DirectionalLight(0xfff0d8, 3.0);
const apert = new THREE.Vector3(ROOM.APERTURE_X, (ROOM.APERTURE_Y0 + ROOM.APERTURE_Y1) / 2, ROOM.BACK_Z);
sun.position.copy(apert).addScaledVector(sunDir, -55);
sun.target.position.copy(apert);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
// 房间是静止的，阴影贴图不需要每帧重画：每 6 帧更新一次，省掉一整趟 2048² 深度渲染
sun.shadow.autoUpdate = false;
sun.shadow.needsUpdate = true;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 110;
sun.shadow.camera.left = -18;
sun.shadow.camera.right = 18;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -18;

sun.shadow.normalBias = 0.012;
sun.shadow.bias = -0.0002;
sun.shadow.radius = 2.5;
scene.add(sun, sun.target);

scene.add(new THREE.HemisphereLight(0x3b4f6d, 0x0d0c0b, 0.50));
scene.fog = new THREE.FogExp2(0x0c1118, 0.052);

/* ------------------------------------------------------------------ beams */
const beams = buildBeams({
  apertureX: ROOM.APERTURE_X,
  apertureZ: ROOM.BACK_Z + 0.05,
  apertureY0: ROOM.APERTURE_Y0,
  apertureY1: ROOM.APERTURE_Y1,
  apertureW: ROOM.APERTURE_W,
  gaps: ROOM.SLATS,
  slatDepth: ROOM.SLAT_DEPTH,
  slatTiltDeg: ROOM.SLAT_TILT,
  sunDir,
  color: new THREE.Color(1.0, 0.80, 0.56),
  intensity: 0.30,
  length: 26,
});
scene.add(beams.group);

const dust = buildDust({
  count: 900,
  bounds: { x: 7.2, y: 7.0, z: 24, z0: 6 },
  beamDir: sunDir,
  beamOffsets: beams.offsets,
  originY: ROOM.APERTURE_Y0,
  originZ: ROOM.BACK_Z,
  color: new THREE.Color(1.0, 0.9, 0.72),
});
dust.points.position.set(0, 0, 0);
dust.points.geometry.translate(0, 0.2, -15);
scene.add(dust.points);
stage('注入冷气与尘埃', 58);

/* --------------------------------------------------------------- artifact */
const specimen = buildSpecimen(M, artefactEnv, crystalEnv);
stage('锁定标本', 66);

/**
 * 真实的镜面反射。
 * 渐变棚环境只能给出一个平滑的灰度渐变，每个晶面都是同一个色值 →
 * 多面体读作一张平板。这里在标本位置用 CubeCamera 把房间（尤其是那扇亮窗）
 * 烘成一张立方体贴图，晶面反射的就是"这间屋子"，面与面之间才有明暗落差。
 * 只烘一次：静止的标本不需要每帧更新，成本一次性 6 个 256px pass。
 */
function bakeSpecimenReflection() {
  const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cam = new THREE.CubeCamera(0.1, 40, rt);
  cam.position.set(-0.34, 2.34, -4.10);
  const wasVisible = specimen.group.visible;
  specimen.group.visible = false;
  // 只在烘焙时存在的"棚拍灯"：三个高亮面板把房间的黑反射改成有方向的光斑。
  // 它们烘完立刻移除，所以永远不会出现在正式画面里。
  const target = new THREE.Vector3(-0.34, 2.34, -4.10);
  const panels: THREE.Mesh[] = [];
  // 柔光箱不能是硬边矩形：抛光晶面会把矩形原样镜射成一块贴纸。
  // 用椭圆渐变纹理把它做成"有边缘过渡的光斑"，反射到面上才是柔和的高光带。
  const softbox = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g2 = c.getContext('2d')!;
    g2.fillStyle = '#000';
    g2.fillRect(0, 0, 128, 128);
    const grd = g2.createRadialGradient(64, 64, 6, 64, 64, 64);
    grd.addColorStop(0.0, '#ffffff');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.86)');
    grd.addColorStop(0.78, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1.0, '#000000');
    g2.fillStyle = grd;
    g2.fillRect(0, 0, 128, 128);
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  })();
  const panel = (
    w: number, h: number, pos: [number, number, number], rgb: [number, number, number],
  ) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: softbox,
        color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    );
    m.position.set(pos[0], pos[1], pos[2]);
    m.lookAt(target);
    scene.add(m);
    panels.push(m);
  };
  panel(3.4, 4.6, [3.10, 3.10, -1.90], [2.10, 1.72, 1.30]);   // 右前暖柔光箱
  panel(0.70, 5.20, [-3.10, 2.70, -4.60], [0.40, 0.54, 0.84]); // 左侧冷光条
  panel(2.60, 2.60, [-0.10, 6.30, -4.10], [1.85, 1.80, 1.66]); // 顶部柔光箱
  // 大面柔光：黑曜石面上要是只有两点高光，其余全黑就成了黑板。
  // 这块低亮度大板负责把中间调填起来，让每个面的朝向都能读出不同的灰。
  panel(5.20, 6.00, [-3.90, 2.60, -6.60], [0.42, 0.46, 0.56]);
  cam.update(renderer, scene);
  for (const m of panels) { scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
  specimen.group.visible = wasVisible;
  const mat = (specimen.pieces[0]?.mesh.material as THREE.MeshPhysicalMaterial) ?? null;
  if (mat) {
    mat.envMap = rt.texture;
    mat.envMapIntensity = 2.10;
    mat.needsUpdate = true;
  }
}
specimen.group.position.set(-0.34, 2.47, -4.10);
specimen.group.scale.setScalar(0.92);
specimen.group.rotation.y = 0.6;
scene.add(specimen.group);

// area lights give polished brass long, crisp specular streaks
RectAreaLightUniformsLib.init();

// 矩形灯（RectAreaLight）会让每个受光材质多出一整套 LTC 积分循环，
// 首帧编译这些变体在本机要 6–9 秒。除了最关键的一道冷边光，其余都用聚光灯等效替代。
const warmRim = new THREE.SpotLight(0xffd8ab, 26.0, 14.0, 0.62, 0.95, 1.5);
warmRim.position.set(0.70, 4.15, -1.10);
warmRim.target.position.copy(specimen.group.position);
scene.add(warmRim, warmRim.target);

const coolKick = new THREE.SpotLight(0xa9b6c8, 9.0, 12.0, 0.95, 1.0, 1.5);
coolKick.position.set(-2.80, 2.30, -2.10);
coolKick.target.position.copy(specimen.group.position);
scene.add(coolKick, coolKick.target);

// soft halo behind the artefact: separation + something for the glass to refract
const haloMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
  uniforms: { uColor: { value: new THREE.Color(0.030, 0.011, 0.009) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    varying vec2 vUv; uniform vec3 uColor;
    void main(){
      vec2 p = (vUv - 0.5) * 2.0;
      float r = length(p * vec2(1.0, 1.25));
      float a = pow(clamp(1.0 - r, 0.0, 1.0), 2.8);
      gl_FragColor = vec4(uColor * a, a);
    }`,
});
const halo = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 6.4), haloMat);
halo.position.set(-0.34, 2.47, -9.20);
scene.add(halo);

// 背后冷光：只描标本的左缘，让黑色主体从黑底里"立"起来
const coldRim = new THREE.SpotLight(0x93b6ff, 22.0, 9.0, 0.34, 0.9, 1.6);
coldRim.position.set(-2.95, 3.75, -6.65);
coldRim.target.position.copy(specimen.group.position);
scene.add(coldRim, coldRim.target);

// click impact: one short camera shake (a ring overlay was tried and read as sci-fi noise)
let burstAge = 99;

const keySpot = new THREE.SpotLight(0xfff6ea, 8.0, 12.0, 0.46, 0.62, 1.4);
keySpot.position.set(-2.60, 5.20, 1.60);
keySpot.target.position.copy(specimen.group.position);
scene.add(keySpot);
scene.add(keySpot.target);
// 暖轮廓：从窗口那一侧打过来，把晶柱右缘烧出一道暖边，
// 与左侧冷光形成冷暖对峙——纯黑的晶面靠这两道边才读得出"厚度"。
const warmEdge = new THREE.SpotLight(0xffb478, 16.0, 12.0, 0.20, 0.92, 1.5);
warmEdge.position.set(3.25, 2.95, -7.10);
warmEdge.target.position.copy(specimen.group.position);
scene.add(warmEdge, warmEdge.target);

// 冷边光：从背后左侧擦过，把晶体从黑底里"抠"出来
const edgeRim = new THREE.RectAreaLight(0x9fc6ff, 7.4, 0.55, 3.6);
edgeRim.position.set(-3.40, 3.10, -2.60);
edgeRim.lookAt(specimen.group.position);
// TEMP-NORECT scene.add(edgeRim);

const kissTop = new THREE.SpotLight(0xfff2e0, 14.0, 9.0, 0.5, 0.92, 1.4);
kissTop.position.set(-1.00, 4.45, -1.40);
kissTop.target.position.copy(specimen.group.position);
scene.add(kissTop, kissTop.target);

/* -------------------------------------------------------------------- post */
// 全屏 pass 越少越省。bloom 与 DOF 都是卷积效果，本来就不会被合进同一个 shader，
// 因此拆成独立 pass 几乎不增加开销，却换来「可以单独关掉景深而不降分辨率」。
// 半浮点缓冲区：bloom 阈值要靠 1.0 以上的 HDR 值，8bit 会把高光压平。
// 抗锯齿用 SMAA 而不是 4x MSAA：实测在这类集显上 MSAA 的带宽开销远大于一个 SMAA pass。
const composer = new EffectComposer(renderer);
stage('预压缩缓冲', 69);
composer.addPass(new RenderPass(scene, camera));

const bloom = new BloomEffect({
  luminanceThreshold: 1.18,
  intensity: 0.62,
  mipmapBlur: true,
});
composer.addPass(new EffectPass(camera, bloom));

const dof = new DepthOfFieldEffect(camera, {
  focusDistance: 0.035,
  focalLength: 0.045,
  bokehScale: 1.35,
  resolutionScale: 0.5,   // 景深在半分辨率上算，肉眼几乎分辨不出
});
const focusTarget = new THREE.Vector3(-0.34, 2.47, -4.10);
dof.target = focusTarget;
const dofPass = new EffectPass(camera, dof);
// TEMP-NODOFPASS
// composer.addPass(dofPass);

composer.addPass(new EffectPass(camera,
  new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
  new SMAAEffect(),
  new NoiseEffect({ blendFunction: 3, premultiply: true }),
  new VignetteEffect({ offset: 0.3, darkness: 0.6 }),
));

const caPass = new EffectPass(camera,
  new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.00022, 0.00034), radialModulation: true, modulationOffset: 0.38 }),
);
composer.addPass(caPass);
stage('装配光学', 72);

/* ------------------------------------------------------------------- input */
const ndc = new THREE.Vector2(0, 0);
const raycaster = new THREE.Raycaster();
const attractorPlane = new THREE.Plane();
const attractor = new THREE.Vector3();
const attractorTarget = new THREE.Vector3();
let hasPointer = false;
const specimenCentre = new THREE.Vector3(-0.34, 2.47, -4.10);

/**
 * 交互层：拖动检视（绕标本转）+ 悬停预兆 + 点击碎裂。
 * 关键约束：拖动与点击必须能区分，否则用户想转个角度就把它打碎了。
 */
const drag = {
  down: false,
  moved: 0,
  t0: 0,
  lastT: 0,
  lastX: 0,
  lastY: 0,
  rotY: 0,
  rotX: 0,
  // 角速度（rad/s），松手后按 exp(-3.2·dt) 衰减 —— 帧率无关
  velY: 0,
  velX: 0,
  idle: 99,
};
const YAW_LIMIT = 2.10;
const PITCH_LIMIT = 0.34;
const yawPerPx = () => (Math.PI * 1.1) / Math.max(900, Math.min(innerWidth, 1600));
let hoverAmt = 0;
let isHot = false;
const projected = new THREE.Vector3();
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

addEventListener('pointermove', (e) => {
  hasPointer = true;
  const nx = (e.clientX / innerWidth) * 2 - 1;
  const ny = (e.clientY / innerHeight) * 2 - 1;
  rig.setMouse(nx, ny);
  ndc.set(nx, -ny);
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.ray.intersectPlane(attractorPlane, attractorTarget)) {
    attractor.copy(attractorTarget);
  }

  if (drag.down) {
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    const now = performance.now();
    const dtE = Math.max(0.008, (now - drag.lastT) / 1000);
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.lastT = now;
    const dYaw = dx * yawPerPx();
    const dPitch = dy * yawPerPx() * 0.55;
    drag.rotY = Math.max(-YAW_LIMIT, Math.min(YAW_LIMIT, drag.rotY + dYaw));
    drag.rotX = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, drag.rotX + dPitch));
    drag.velY = Math.max(-2.6, Math.min(2.6, dYaw / dtE));
    drag.velX = Math.max(-1.4, Math.min(1.4, dPitch / dtE));
    drag.idle = 0;
  }
});

addEventListener('pointerdown', (e) => {
  const t = e.target;
  if (t instanceof Element && t.closest('a, button, [data-hover]')) return;
  drag.down = true;
  drag.moved = 0;
  drag.t0 = performance.now();
  drag.lastT = drag.t0;
  drag.lastX = e.clientX;
  drag.lastY = e.clientY;
  drag.velY = 0;
  drag.velX = 0;
  document.body.classList.add('is-grabbing');
});

addEventListener('pointerup', () => {
  if (!drag.down) return;
  drag.down = false;
  document.body.classList.remove('is-grabbing');
  const quick = performance.now() - drag.t0 < 420;
  // 位移小于 7px 才算点击：拖动检视不应该把标本打碎
  if (drag.moved < 7 && quick) {
    specimen.burst(1);
    burstAge = 0;
  }
});

addEventListener('pointercancel', () => {
  drag.down = false;
  document.body.classList.remove('is-grabbing');
});
addEventListener('pointerleave', () => { /* keep last attractor */ });

/* --------------------------------------------------- adaptive quality */
// 清晰度优先。分辨率下限就是 CSS 像素 1:1（retina 屏上等于 0.8 倍物理像素，
// 肉眼已接近原生），永不再往下掉；不够快时先牺牲效果，最后才降分辨率。
const NATIVE_DPR = Math.min(window.devicePixelRatio || 1, 2);
// 像素预算：超大窗口（例如 2560×1440 CSS 在 125% 屏上）按上限渲染会直接压垮 GPU，
// 这里把内部像素总数限制在 6MP 以内，小窗口不受影响。
// 像素预算按 GPU 档次给：集显按 1.25MPix（约等于 1440x900 显示器的原生像素），
// 独显给 2.4MPix。宁可少画像素，也不要让 GPU 队列排满导致整个合成器卡住。
const gpuTier = (): number => {
  const n = gpuName().toLowerCase();
  if (/nvidia|geforce|rtx|radeon rx|arc a|apple m/.test(n)) return 2.4e6;
  if (/intel|uhd|iris|hd graphics|vega|mali|adreno/.test(n)) return 1.25e6;
  return 1.7e6;
};
const PIXEL_BUDGET = gpuTier();
const budgetScale = () => Math.sqrt(PIXEL_BUDGET / Math.max(1, innerWidth * innerHeight));
let RES_CEIL = Math.max(1, Math.min(NATIVE_DPR, 1.75, budgetScale()));
const RES_FLOOR = 1;

type QualityMode = 'auto' | 'high' | 'low';
const QUALITY_LABEL: Record<QualityMode, string> = { auto: '画质：自动', high: '画质：高', low: '画质：快' };
let qualityMode: QualityMode = 'auto';
let resScale = RES_CEIL;
let fxLevel = 1;          // 0 = 全开（含景深），1 = 关景深（默认：开场就要清晰），2 = 关景深 + 色差；0 只由「画质：高」或 ?q=high 触发
const FX_CAP = 2;         // 该机器上允许关到的最深层级（由自动阶梯维护）
let dofLocked = false;    // 一旦因掉帧关掉景深，就不再自动加回来，避免每几秒来回抖
let frameAcc = 0;
let frameCount = 0;
let slowStreak = 0;
let fastStreak = 0;
let lastFps = 0;

function applyRes(next: number) {
  const v = Math.min(RES_CEIL, Math.max(RES_FLOOR, Math.round(next * 100) / 100));
  resScale = v;
  renderer.setPixelRatio(v);
  composer.setSize(innerWidth, innerHeight);
}

function applyFx(level: number) {
  fxLevel = Math.min(2, Math.max(0, level));
  dofPass.enabled = fxLevel < 1;
  caPass.enabled = fxLevel < 2;
}

const qBtn = document.getElementById('q-btn');
const qLabel = () => `${QUALITY_LABEL[qualityMode]} · ${resScale.toFixed(2)}x`;

function gpuName(): string {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return 'unknown';
    return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || 'unknown');
  } catch {
    return 'unknown';
  }
}

function setQualityMode(mode: QualityMode) {
  qualityMode = mode;
  slowStreak = 0;
  fastStreak = 0;
  frameAcc = 0;
  frameCount = 0;
  if (mode === 'high') { applyRes(RES_CEIL); applyFx(0); }
  else if (mode === 'low') { applyRes(RES_FLOOR); applyFx(2); }
  if (qBtn) qBtn.textContent = qLabel();
}

const BUDGET_MS = 22;     // 帧时间超过 22ms（<45fps）视为吃力
const RELAX_MS = 14;      // 低于 14ms（>70fps）才算有余量
const WINDOW_MS = 500;    // 采样窗口按时间算：低帧率下 1 秒内就能反应，不再等 60 帧
let cooldown = 0;
let warmupMs = 900;       // 首帧的着色器编译/纹理上传别算进统计，否则一开场就误降

function sampleQuality(frameMs: number) {
  if (qualityMode !== 'auto') { lastFps = 1000 / frameMs; return; }
  if (warmupMs > 0) { warmupMs -= frameMs; lastFps = 1000 / frameMs; return; }
  frameAcc += frameMs;
  frameCount++;
  if (frameAcc < WINDOW_MS || frameCount < 12) return;
  const avg = frameAcc / frameCount;
  lastFps = 1000 / avg;
  frameAcc = 0;
  frameCount = 0;

  if (cooldown > 0) {
    cooldown--;
    slowStreak = 0;
    fastStreak = 0;
    return;
  }

  if (avg > BUDGET_MS) {
    fastStreak = 0;
    if (++slowStreak < 2) return;      // 连续两窗（约 1 秒）才动手
    slowStreak = 0;
    // 清晰度优先：先卸效果，最后才动分辨率
    if (fxLevel < FX_CAP) {
      if (fxLevel === 0) dofLocked = true;
      applyFx(fxLevel + 1);
      cooldown = 1;
    }
    else if (resScale > RES_FLOOR) { applyRes(resScale - 0.10); cooldown = 2; }
  } else if (avg < RELAX_MS) {
    slowStreak = 0;
    if (++fastStreak < 3) return;
    fastStreak = 0;
    // 恢复顺序相反：先把分辨率加回去，再慢慢加回效果
    if (resScale < RES_CEIL) { applyRes(resScale + 0.08); cooldown = 2; }
    // 自动模式不再把景深加回来：开场就该是清晰的，想要电影感请用「高」或 ?q=high
    else if (fxLevel > 1) { applyFx(fxLevel - 1); cooldown = 2; }
    else { fastStreak = 0; }
  } else {
    slowStreak = 0;
    fastStreak = 0;
  }
}

if (qBtn) {
  const order: QualityMode[] = ['auto', 'high', 'low'];
  qBtn.addEventListener('click', () => {
    setQualityMode(order[(order.indexOf(qualityMode) + 1) % order.length]);
  });
}

const urlParams = new URLSearchParams(location.search);
const urlQ = urlParams.get('q');
if (urlQ === 'high' || urlQ === 'low') setQualityMode(urlQ);

/* debug HUD：?debug=1 时显示真实渲染参数，便于远程排查 */
const DBG = urlParams.get('debug') === '1';
const debugHud = DBG ? document.createElement('div') : null;
if (debugHud) {
  debugHud.style.cssText = 'position:fixed;left:12px;bottom:64px;z-index:99;font:10px/1.6 ui-monospace,monospace;color:#9fe0b0;background:rgba(0,0,0,.72);padding:8px 10px;border:1px solid rgba(159,224,176,.3);white-space:pre;pointer-events:none';
  document.body.appendChild(debugHud);
}
setInterval(() => {
  if (debugHud) {
    debugHud.textContent = [
      `dpr ${(window.devicePixelRatio || 1).toFixed(2)}  ceil ${RES_CEIL.toFixed(2)}  res ${resScale.toFixed(2)}`,
      `buffer ${renderer.domElement.width}x${renderer.domElement.height}  css ${innerWidth}x${innerHeight}`,
      `fx ${fxLevel}  mode ${qualityMode}  fps ${lastFps.toFixed(0)}`,
      gpuName(),
    ].join('\n');
  }
}, 500);
applyRes(resScale);
applyFx(fxLevel);
if (qBtn) qBtn.textContent = qLabel();

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  rig.setAspect(camera.aspect);
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  RES_CEIL = Math.max(1, Math.min(NATIVE_DPR, 1.75, budgetScale()));
  if (resScale > RES_CEIL) applyRes(RES_CEIL);
  else applyRes(resScale);
  composer.setSize(innerWidth, innerHeight);

  // 竖屏把标本收小，别压住标题
  specimen.group.scale.setScalar(camera.aspect < 1 ? 0.86 : 0.88);
  // 竖屏：展台在近处会变成一只占满下半屏的黑鼓，且压住文案 —— 直接收起，标本浮在虚空里
  const portrait = camera.aspect < 1;
  room.group?.traverse((o: THREE.Object3D) => {
    if (o.name === 'plinth') o.visible = !portrait;
  });
  // narrow viewports: keep the frame legible instead of cinematic blur
  const narrow = innerWidth < 900;
  dof.bokehScale = narrow ? 0.55 : 1.35;
  bloom.intensity = narrow ? 0.42 : 0.62;
}
addEventListener('resize', onResize);
onResize();

/* -------------------------------------------------------------------- loop */
const clock = new THREE.Clock();
let frames = 0;

// 先把碎片材质全部编译掉：不这么做，用户第一次点击时才会现场编译 89 个程序，
// 在集显上这一下就是几秒钟的硬卡顿。放在入场之前付掉这笔钱。
try {
  specimen.pieces.forEach((pc) => { pc.mesh.visible = true; });
  specimen.solid.visible = false;
  renderer.compile(scene, camera);
} catch (e) {
  console.warn('[cold-vault] precompile failed', e);
} finally {
  // 静置画碎片（解理面常显），整块只作退化备份
  specimen.pieces.forEach((pc) => { pc.mesh.visible = true; });
  specimen.solid.visible = false;
}
// 帧率上限：144Hz 屏上原本会跑满 144 帧，白白多画一倍像素
const NO_POST = new URLSearchParams(location.search).has('nopost');
const FRAME_MIN_MS = 13.0;
let accMs = 0;
let shadowTick = 0;

// 首帧预热：把渲染管线的创建成本（着色器变体、渲染目标、驱动侧管线状态）
// 先在一个极小的尺寸上付掉。实测这一步在集显上要 1–3 秒，但如果直接在
// 主分辨率上付，驱动会把它拖到 6–10 秒并阻塞主线程 —— 用户看到的就是"卡死"。
// 小尺寸跑完之后，主分辨率首帧只剩几毫秒。
const warmComposer = async () => {
  stage('编译冷光着色器', 78);
  // 极小尺寸先跑一遍：着色器变体与渲染目标的创建成本在这里付掉，
  // 否则主分辨率首帧会被驱动拖到数秒并阻塞主线程（用户看到的是"卡死"）。
  composer.setSize(240, 150);
  composer.render(0.016);
  stage('合成第一帧', 90);
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  applyRes(resScale);
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  composer.render(0.016);
  stage('就绪', 97);
};

const startLoop = () => renderer.setAnimationLoop(() => {
  accMs += clock.getDelta() * 1000;
  if (accMs < FRAME_MIN_MS) return;
  const dt = Math.min(accMs / 1000, 0.05);
  accMs = 0;
  const t = clock.elapsedTime;

  if (++shadowTick % 6 === 0) sun.shadow.needsUpdate = true;

  // 拖动惯性：松手后按角速度滑行，帧率无关；空闲 2.6s 后缓慢回到正面
  if (!drag.down) {
    drag.rotY = Math.max(-YAW_LIMIT, Math.min(YAW_LIMIT, drag.rotY + drag.velY * dt));
    drag.rotX = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, drag.rotX + drag.velX * dt));
    drag.velY *= Math.exp(-3.2 * dt);
    drag.velX *= Math.exp(-3.2 * dt);
    drag.idle += dt;
    if (drag.idle > 2.6) {
      drag.rotY = THREE.MathUtils.damp(drag.rotY, 0, 0.55, dt);
      drag.rotX = THREE.MathUtils.damp(drag.rotX, 0, 0.55, dt);
    }
  }
  const sway = Math.hypot(drag.velY, drag.velX) > 0.02 || drag.down ? 0.16 : 1;
  specimen.group.rotation.y = 0.6 + Math.sin(t * 0.11) * 0.34 * sway + drag.rotY;
  specimen.group.rotation.x = drag.rotX;
  specimen.rings.forEach((r) => {
    r.holder.rotateOnAxis(r.axis, dt * r.speed);
  });
  specimen.group.position.y = 2.47 + Math.sin(t * 0.62) * 0.045;

  attractorPlane.setFromNormalAndCoplanarPoint(
    camera.getWorldDirection(new THREE.Vector3()).negate(),
    specimenCentre,
  );
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(attractorPlane, attractorTarget);
  // 悬停预兆：指针离标本越近，缝隙张得越开、内核越亮
  projected.copy(specimenCentre).project(camera);
  const sx = (projected.x * 0.5 + 0.5) * innerWidth;
  const sy = (-projected.y * 0.5 + 0.5) * innerHeight;
  const pointerX = ndc.x * 0.5 * innerWidth + innerWidth * 0.5;
  const pointerY = -ndc.y * 0.5 * innerHeight + innerHeight * 0.5;
  const hotR = Math.min(innerWidth, innerHeight) * 0.30;
  const distPx = hasPointer ? Math.hypot(pointerX - sx, pointerY - sy) : 9999;
  const hoverTarget = clamp01(1 - (distPx - hotR * 0.55) / (hotR * 0.95));
  hoverAmt += (hoverTarget - hoverAmt) * Math.min(1, dt * 7.0);
  const hot = hoverAmt > 0.45;
  if (hot !== isHot) {
    isHot = hot;
    document.body.classList.toggle('is-hot', isHot);
  }
  specimen.update(dt, t, hasPointer ? attractorTarget : null, camera, hoverAmt);

  warmRim.intensity = 3.35 + Math.sin(t * 1.7) * 0.30 + Math.sin(t * 4.3) * 0.12;

  rig.update(dt, t);

  // impact: expanding ring + a short camera shake, both driven by one clock
  burstAge += dt;
  const shake = Math.max(0, 1 - burstAge / 0.62);
  if (shake > 0) {
    const k = shake * shake * 0.020;
    camera.position.x += Math.sin(burstAge * 63.0) * k;
    camera.position.y += Math.sin(burstAge * 48.0 + 1.7) * k;
  }

  beams.update(t);
  beams.material.uniforms.uCam.value.copy(camera.position);
  dust.update(t, camera.position);

  if (NO_POST) renderer.render(scene, camera);
  else composer.render(dt);
  (window as any).__FRAMES__ = ((window as any).__FRAMES__ || 0) + 1;
  sampleQuality(dt * 1000);
  frames++;
  if (frames === 3) (window as any).__READY__ = true;
  // 反射烘焙必须放在画面跑起来之后：它要同步渲染 6 个立方体面，
  // 放在启动路径上会把首帧的合成挤掉（低端机会直接卡在白屏/加载页）。
  if (frames === 6) bakeOnce();
});

let reflectionBaked = false;
const bakeOnce = () => {
  if (reflectionBaked) return;
  reflectionBaked = true;
  try { bakeSpecimenReflection(); } catch (e) { console.warn('[cold-vault] reflection bake failed', e); }
};
if (NO_POST) startLoop();
else warmComposer().then(startLoop).catch((e) => {
  console.warn('[cold-vault] warmup failed', e);
  startLoop();
});

initUI({ rig });

(window as any).__THREE__ = THREE;
(window as any).__RAPIER__ = (window as any).__RAPIER__;
(window as any).__SCENE__ = {
  scene, camera, renderer, specimen, rig, beams, room, composer, dof, bloom, dofPass, caPass,
  setQualityMode, applyRes, applyFx,
  getQuality: () => resScale, getQualityMode: () => qualityMode, getFx: () => fxLevel,
  getStats: () => ({ dpr: window.devicePixelRatio || 1, ceil: RES_CEIL, res: resScale, fx: fxLevel, mode: qualityMode, buffer: [renderer.domElement.width, renderer.domElement.height], css: [innerWidth, innerHeight], fps: Math.round(lastFps), gpu: gpuName() }),
};
console.log('[cold-vault] booted');