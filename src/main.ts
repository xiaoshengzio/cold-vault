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

const canvas = document.querySelector<HTMLCanvasElement>('#gl')!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 120);
const rig = new CameraRig(camera);

const M = createMaterials();
const envTex = buildEnvironment(renderer);
scene.environment = envTex;

// the artefact gets its own high-contrast studio reflections
const artefactEnv = buildArtefactEnvironment(renderer);
const crystalEnv = buildCrystalEnvironment(renderer);
M.brass.envMap = artefactEnv;
M.glass.envMap = crystalEnv;
M.brass.envMapIntensity = 1.15;
const room = buildRoom(M);
scene.add(room.group);

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
  intensity: 0.40,
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

/* --------------------------------------------------------------- artifact */
const specimen = buildSpecimen(M, artefactEnv);
specimen.group.position.set(-0.62, 2.30, -4.30);
specimen.group.scale.setScalar(0.78);
specimen.group.rotation.y = 0.6;
scene.add(specimen.group);

// area lights give polished brass long, crisp specular streaks
RectAreaLightUniformsLib.init();

const warmRim = new THREE.RectAreaLight(0xffd8ab, 4.6, 2.6, 1.0);
warmRim.position.set(0.70, 4.15, -1.10);
warmRim.lookAt(specimen.group.position);
scene.add(warmRim);

const coolKick = new THREE.RectAreaLight(0xa9b6c8, 1.05, 1.8, 2.4);
coolKick.position.set(-2.80, 2.30, -2.10);
coolKick.lookAt(specimen.group.position);
scene.add(coolKick);

// soft halo behind the artefact: separation + something for the glass to refract
const haloMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
  uniforms: { uColor: { value: new THREE.Color(0.105, 0.026, 0.020) } },
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
const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.8), haloMat);
halo.position.set(-0.62, 2.42, -7.30);
scene.add(halo);

const kissTop = new THREE.RectAreaLight(0xfff2e0, 4.0, 0.9, 0.9);
kissTop.position.set(-1.00, 4.45, -1.40);
kissTop.lookAt(specimen.group.position);
scene.add(kissTop);

/* -------------------------------------------------------------------- post */
// 全屏 pass 越少越省。bloom 与 DOF 都是卷积效果，本来就不会被合进同一个 shader，
// 因此拆成独立 pass 几乎不增加开销，却换来「可以单独关掉景深而不降分辨率」。
// 半浮点缓冲区：bloom 阈值要靠 1.0 以上的 HDR 值，8bit 会把高光压平。
// 抗锯齿用 SMAA 而不是 4x MSAA：实测在这类集显上 MSAA 的带宽开销远大于一个 SMAA pass。
const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
composer.addPass(new RenderPass(scene, camera));

const bloom = new BloomEffect({
  intensity: 0.62,
  luminanceThreshold: 1.15,
  luminanceSmoothing: 0.4,
  mipmapBlur: true,
  radius: 0.78,
  levels: 5,          // 原 8 级 mip，集显上纯浪费
  resolutionScale: 0.5, // 泛光缓冲减半，观感几乎不变
});
composer.addPass(new EffectPass(camera, bloom));

const dof = new DepthOfFieldEffect(camera, {
  focusDistance: 0.035,
  focalLength: 0.045,
  bokehScale: 1.35,
  resolutionScale: 0.5,   // 景深在半分辨率上算，肉眼几乎分辨不出
});
const focusTarget = new THREE.Vector3(-0.62, 2.30, -4.30);
dof.target = focusTarget;
const dofPass = new EffectPass(camera, dof);
composer.addPass(dofPass);

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

/* ------------------------------------------------------------------- input */
const ndc = new THREE.Vector2(0, 0);
const raycaster = new THREE.Raycaster();
const attractorPlane = new THREE.Plane();
const attractor = new THREE.Vector3();
const attractorTarget = new THREE.Vector3();
let hasPointer = false;
const specimenCentre = new THREE.Vector3(-0.62, 2.30, -4.30);

addEventListener('pointermove', (e) => {
  hasPointer = true;
  rig.setMouse((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.ray.intersectPlane(attractorPlane, attractorTarget)) {
    attractor.copy(attractorTarget);
  }
});
addEventListener('pointerdown', (e) => {
  const t = e.target;
  if (t instanceof Element && t.closest('a, button, [data-hover]')) return;
  specimen.burst(1);
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
  specimen.group.scale.setScalar(camera.aspect < 1 ? 0.62 : 0.78);
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
  // 碎片始终可见（首版观感），整块只是退化备份
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
  const t0 = performance.now();
  composer.setSize(240, 150);
  composer.render(0.016);
  
  composer.render(0.016);
  
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  applyRes(resScale);
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  const t1 = performance.now();
  composer.render(0.016);
  
  if (DBG) console.log('[cold-vault] warmup', Math.round(t1 - t0), 'full', Math.round(performance.now() - t1));
};

const startLoop = () => renderer.setAnimationLoop(() => {
  accMs += clock.getDelta() * 1000;
  if (accMs < FRAME_MIN_MS) return;
  const dt = Math.min(accMs / 1000, 0.05);
  accMs = 0;
  const t = clock.elapsedTime;

  if (++shadowTick % 6 === 0) sun.shadow.needsUpdate = true;

  specimen.group.rotation.y = 0.6 + Math.sin(t * 0.11) * 0.34;
  specimen.rings.forEach((r) => {
    r.holder.rotateOnAxis(r.axis, dt * r.speed);
  });
  specimen.group.position.y = 2.30 + Math.sin(t * 0.62) * 0.05;

  attractorPlane.setFromNormalAndCoplanarPoint(
    camera.getWorldDirection(new THREE.Vector3()).negate(),
    specimenCentre,
  );
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(attractorPlane, attractorTarget);
  specimen.update(dt, t, hasPointer ? attractorTarget : null, camera);

  warmRim.intensity = 3.35 + Math.sin(t * 1.7) * 0.30 + Math.sin(t * 4.3) * 0.12;

  rig.update(dt, t);
  beams.update(t);
  beams.material.uniforms.uCam.value.copy(camera.position);
  dust.update(t, camera.position);

  if (NO_POST) renderer.render(scene, camera);
  else composer.render(dt);
  (window as any).__FRAMES__ = ((window as any).__FRAMES__ || 0) + 1;
  sampleQuality(dt * 1000);
  frames++;
  if (frames === 3) (window as any).__READY__ = true;
});

if (NO_POST) startLoop();
else warmComposer().then(startLoop).catch((e) => {
  console.warn('[cold-vault] warmup failed', e);
  startLoop();
});

initUI({ rig });

(window as any).__THREE__ = THREE;
(window as any).__SCENE__ = {
  scene, camera, renderer, specimen, rig, beams, room, composer, dof, bloom, dofPass, caPass,
  setQualityMode, applyRes, applyFx,
  getQuality: () => resScale, getQualityMode: () => qualityMode, getFx: () => fxLevel,
  getStats: () => ({ dpr: window.devicePixelRatio || 1, ceil: RES_CEIL, res: resScale, fx: fxLevel, mode: qualityMode, buffer: [renderer.domElement.width, renderer.domElement.height], css: [innerWidth, innerHeight], fps: Math.round(lastFps), gpu: gpuName() }),
};
console.log('[cold-vault] booted');