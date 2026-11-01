import * as THREE from 'three';
import {
  Effect, EffectComposer, EffectPass, RenderPass, BloomEffect, SMAAEffect, VignetteEffect,
  NoiseEffect, ChromaticAberrationEffect, ToneMappingEffect, ToneMappingMode,
} from 'postprocessing';
import { createMaterials } from './world/materials';
import { buildRoom, ROOM } from './world/room';
import { buildArtefactEnvironment } from './world/env';
import { buildChamber } from './world/chamber';
import { buildBeams } from './world/beams';
import { buildDust } from './world/dust';
import { CameraRig } from './world/camera-rig';
import { DepthOfFieldEffect } from 'postprocessing';
import { initUI } from './ui';

const T0 = performance.now();
const stage = (s: string, pct: number) => {
  (window as any).__BOOT__ = { pct, label: s };
  console.log('[cv] ' + s + ' ' + Math.round(performance.now() - T0));
};
const yieldToBrowser = () => new Promise<void>((resolve) => {
  if (document.hidden) setTimeout(resolve, 0);
  else requestAnimationFrame(() => resolve());
});
const whenVisible = () => document.hidden
  ? new Promise<void>((resolve) => document.addEventListener('visibilitychange', () => {
    if (!document.hidden) resolve();
  }, { once: true }))
  : Promise.resolve();
await yieldToBrowser();

const canvas = document.querySelector<HTMLCanvasElement>('#gl')!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.debug.checkShaderErrors = new URLSearchParams(window.location.search).has('shaderdebug');
stage('初始化渲染器', 8);
const scene = new THREE.Scene();
const specimenModule = import('./world/magnet-field');

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 120);
const rig = new CameraRig(camera);
await yieldToBrowser();

const M = createMaterials();
stage('调制材料', 26);
await yieldToBrowser();
const artefactEnv = buildArtefactEnvironment(renderer);
scene.environment = artefactEnv;
M.brass.envMap = artefactEnv;
M.glass.envMap = artefactEnv;
M.brass.envMapIntensity = 1.15;
stage('烘焙环境光', 42);
await yieldToBrowser();
const room = buildRoom(M);
scene.add(room.group);
const chamber = buildChamber(M);
scene.add(chamber.group);
stage('浇筑库房', 52);

/* --------------------------------------------------------------- lighting */
const sunDir = new THREE.Vector3(-0.34, -0.40, 0.85).normalize();
const sun = new THREE.DirectionalLight(0xfff0d8, 2.1);
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

scene.add(new THREE.HemisphereLight(0x56789e, 0x0d0c0b, 0.72));
scene.fog = new THREE.FogExp2(0x070b12, 0.034);

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
  intensity: 0.17,
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
const { buildSpecimen } = await specimenModule;
const specimen = buildSpecimen(M, artefactEnv, artefactEnv);
stage('锁定标本', 66);

/**
 * 真实的镜面反射。
 * 渐变棚环境只能给出一个平滑的灰度渐变，每个晶面都是同一个色值 →
 * 多面体读作一张平板。这里在标本位置用 CubeCamera 把房间（尤其是那扇亮窗）
 * 烘成一张立方体贴图，晶面反射的就是"这间屋子"，面与面之间才有明暗落差。
 * 只烘一次：静止的标本不需要每帧更新，成本一次性 6 个 128px pass。
 */
function bakeSpecimenReflection() {
  const rt = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
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
  panel(3.4, 4.6, [3.10, 3.10, -1.90], [0.45, 0.38, 0.29]);   // 右前暖柔光箱
  panel(0.70, 5.20, [-3.10, 2.70, -4.60], [0.40, 0.54, 0.84]); // 左侧冷光条
  panel(2.60, 2.60, [-0.10, 6.30, -4.10], [1.85, 1.80, 1.66]); // 顶部柔光箱
  // 大面柔光：黑曜石面上要是只有两点高光，其余全黑就成了黑板。
  // 这块低亮度大板负责把中间调填起来，让每个面的朝向都能读出不同的灰。
  panel(5.20, 6.00, [-3.90, 2.60, -6.60], [0.42, 0.46, 0.56]);
  // 左右两条竖直灯管：让竖直晶面各自对到不同的色温，面与面之间才拉开明暗差
  panel(1.20, 5.60, [4.40, 2.60, -4.60], [0.66, 0.52, 0.36]);
  panel(1.00, 5.60, [-4.20, 2.50, -4.20], [0.36, 0.48, 0.76]);
  panel(2.20, 5.20, [0.40, 2.80, 1.20], [0.22, 0.34, 0.56]);
  cam.update(renderer, scene);
  for (const m of panels) { scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
  specimen.group.visible = wasVisible;
  // CubeTexture 直接赋给 envMap 是无效的：r186 的 getIBLIrradiance / getIBLRadiance
  // 对非 CUBE_UV 映射直接 return vec3(0.0)，等于所有 IBL 项乘 0。
  // 必须过 PMREM 拿到 CubeUV 贴图。
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const envRT = pmrem.fromCubemap(rt.texture);
  pmrem.dispose();
  const mat = (specimen.pieces[0]?.mesh.material as THREE.MeshPhysicalMaterial) ?? null;
  if (mat) {
    mat.envMap = envRT.texture;
    mat.envMapIntensity = 1.50;
  }
  (specimen as any).__bakedEnv = envRT.texture;
}
specimen.group.position.set(-0.34, 2.47, -4.10);
specimen.group.scale.setScalar(0.98);
specimen.group.rotation.y = 0.6;
scene.add(specimen.group);

stage('灯光就绪', 68);

const LIGHT_BUDGET = Number(new URLSearchParams(window.location.search).get('lights') ?? 2);
const warmRim = new THREE.SpotLight(0xffd8ab, 26.0, 14.0, 0.62, 0.95, 1.5);
warmRim.position.set(0.70, 4.15, -1.10);
warmRim.target.position.copy(specimen.group.position);
scene.add(warmRim, warmRim.target);

const coolKick = new THREE.SpotLight(0xa9b6c8, 9.0, 12.0, 0.95, 1.0, 1.5);
coolKick.position.set(-2.80, 2.30, -2.10);
coolKick.target.position.copy(specimen.group.position);
if (LIGHT_BUDGET >= 3) scene.add(coolKick, coolKick.target);

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

const coldRim = new THREE.SpotLight(0x93b6ff, 22.0, 9.0, 0.34, 0.9, 1.6);
coldRim.position.set(-2.95, 3.75, -6.65);
coldRim.target.position.copy(specimen.group.position);
if (LIGHT_BUDGET >= 6) scene.add(coldRim, coldRim.target);

// click impact: one short camera shake (a ring overlay was tried and read as sci-fi noise)
let burstAge = 99;

const keySpot = new THREE.SpotLight(0xfff6ea, 6.4, 12.0, 0.42, 0.66, 1.4);
keySpot.position.set(-2.60, 5.20, 1.60);
keySpot.target.position.copy(specimen.group.position);
scene.add(keySpot);
scene.add(keySpot.target);
// 暖轮廓：从窗口那一侧打过来，把晶柱右缘烧出一道暖边，
// 与左侧冷光形成冷暖对峙——纯黑的晶面靠这两道边才读得出"厚度"。
const warmEdge = new THREE.SpotLight(0xffb478, 16.0, 12.0, 0.20, 0.92, 1.5);
warmEdge.position.set(3.25, 2.95, -7.10);
warmEdge.target.position.copy(specimen.group.position);
if (LIGHT_BUDGET >= 5) scene.add(warmEdge, warmEdge.target);

const kissTop = new THREE.SpotLight(0xfff2e0, 14.0, 9.0, 0.5, 0.92, 1.4);
kissTop.position.set(-1.00, 4.45, -1.40);
kissTop.target.position.copy(specimen.group.position);
if (LIGHT_BUDGET >= 4) scene.add(kissTop, kissTop.target);

/* -------------------------------------------------------------------- post */
// 全屏 pass 越少越省。bloom 与 DOF 都是卷积效果，本来就不会被合进同一个 shader，
// 因此拆成独立 pass 几乎不增加开销，却换来「可以单独关掉景深而不降分辨率」。
// 半浮点缓冲区：bloom 阈值要靠 1.0 以上的 HDR 值，8bit 会把高光压平。
// 抗锯齿用 SMAA 而不是 4x MSAA：实测在这类集显上 MSAA 的带宽开销远大于一个 SMAA pass。
// frameBufferType 必须是 HalfFloat：RGBA8 会把 >1.0 截断，BloomEffect 的
// luminanceThreshold 1.18 就永远达不到，泛光等于失效。
const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
stage('预压缩缓冲', 69);
composer.addPass(new RenderPass(scene, camera));

const bloom = new BloomEffect({
  luminanceThreshold: 1.18,
  intensity: 0.20,
  mipmapBlur: true,
});
const bloomPass = new EffectPass(camera, bloom);
composer.addPass(bloomPass);
const BLOOM_ALLOWED = new URLSearchParams(location.search).get('bloom') === '1';

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

const drag = {
  down: false,
  pointerId: null as number | null,
  moved: 0,
  t0: 0,
  lastT: 0,
  lastX: 0,
  lastY: 0,
  rotY: 0,
  rotX: 0,
  velY: 0,
  velX: 0,
};
const PITCH_LIMIT = 0.55;
const yawPerPx = () => (Math.PI * 2) / Math.max(900, Math.min(innerWidth, 1600));
let hoverAmt = 0;
let isHot = false;
const projected = new THREE.Vector3();
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

const cancelDrag = () => {
  drag.down = false;
  drag.pointerId = null;
  drag.velY = 0;
  drag.velX = 0;
  document.body.classList.remove('is-grabbing');
};

addEventListener('pointermove', (e) => {
  if (drag.down && e.pointerId !== drag.pointerId) return;
  hasPointer = true;
  const nx = (e.clientX / innerWidth) * 2 - 1;
  const ny = (e.clientY / innerHeight) * 2 - 1;
  if (!drag.down) rig.setMouse(nx, ny);
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
    drag.rotY += dYaw;
    drag.rotX = THREE.MathUtils.clamp(drag.rotX + dPitch, -PITCH_LIMIT, PITCH_LIMIT);
    drag.velY = THREE.MathUtils.clamp(dYaw / dtE, -2.6, 2.6);
    drag.velX = THREE.MathUtils.clamp(dPitch / dtE, -1.4, 1.4);
  }
});

addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !e.isPrimary || drag.down || document.body.classList.contains('dialog-open')) return;
  const t = e.target;
  if (t instanceof Element && t.closest('a, button, [data-hover]')) return;
  drag.down = true;
  drag.pointerId = e.pointerId;
  drag.moved = 0;
  drag.t0 = performance.now();
  drag.lastT = drag.t0;
  drag.lastX = e.clientX;
  drag.lastY = e.clientY;
  drag.velY = 0;
  drag.velX = 0;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* capture is optional on older touch browsers */ }
  document.body.classList.add('is-grabbing');
});

addEventListener('pointerup', (e) => {
  if (!drag.down || e.pointerId !== drag.pointerId) return;
  drag.down = false;
  drag.pointerId = null;
  document.body.classList.remove('is-grabbing');
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  const quick = performance.now() - drag.t0 < 420;
  const chapter = document.body.dataset.chapter ?? '0';
  if (drag.moved < 7 && quick && (chapter === '0' || chapter === '1') && specimen.burst(1)) {
    burstAge = 0;
  }
});

addEventListener('pointercancel', cancelDrag);
addEventListener('lostpointercapture', () => { if (drag.down) cancelDrag(); });
addEventListener('blur', cancelDrag);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelDrag(); });

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
  warmupMs = 600;
}

function applyFx(level: number) {
  fxLevel = Math.min(2, Math.max(0, level));
  bloomPass.enabled = BLOOM_ALLOWED;
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

const BUDGET_MS = 18.5;
const RELAX_MS = 13.5;
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
    else if (resScale > RES_FLOOR) { applyRes(resScale - 0.15); cooldown = 2; }
  } else if (avg < RELAX_MS) {
    slowStreak = 0;
    if (++fastStreak < 3) return;
    fastStreak = 0;
    if (resScale < RES_CEIL) { applyRes(resScale + 0.10); cooldown = 2; }
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

  specimen.group.scale.setScalar(camera.aspect < 1 ? 0.78 : 1.02);
  const portrait = camera.aspect < 1;
  chamber.group.traverse((o: THREE.Object3D) => {
    if (o.name === 'plinth') o.visible = !portrait;
  });
  const narrow = innerWidth < 900;
  dof.bokehScale = narrow ? 0.55 : 1.35;
  bloom.intensity = narrow ? 0.20 : 0.32;
}
addEventListener('resize', onResize);
onResize();

/* -------------------------------------------------------------------- loop */
const timer = new THREE.Timer();
timer.connect(document);
let frames = 0;
let displayYaw = 0.92;

specimen.pieces.forEach((pc) => { pc.mesh.visible = true; });
specimen.solid.visible = false;
// 帧率上限：144Hz 屏上原本会跑满 144 帧，白白多画一倍像素
const NO_POST = !new URLSearchParams(location.search).has('post');
renderer.toneMapping = NO_POST ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
const FRAME_MIN_MS = 13.0;
let accMs = 0;

const warmComposer = async () => {
  await whenVisible();
  stage('编译冷光着色器', 78);
  composer.setSize(240, 150);
  const effects = BLOOM_ALLOWED ? [bloomPass, caPass] : [caPass];
  for (const pass of effects) pass.enabled = false;
  composer.render(0.016);
  await yieldToBrowser();
  for (const pass of effects) {
    pass.enabled = true;
    composer.render(0.016);
    await yieldToBrowser();
  }
  stage('合成第一帧', 90);
  applyFx(fxLevel);
  applyRes(resScale);
  await yieldToBrowser();
  composer.render(0.016);
  stage('就绪', 97);
};

const tick = () => {
  timer.update();
  const frameMs = timer.getDelta() * 1000;
  accMs += frameMs;
  if (accMs < FRAME_MIN_MS) return;
  const renderMs = accMs;
  const dt = Math.min(renderMs / 1000, 0.05);
  accMs = 0;
  const t = timer.getElapsed();

  if (!drag.down) {
    drag.rotY += drag.velY * dt;
    drag.rotX = THREE.MathUtils.clamp(drag.rotX + drag.velX * dt, -PITCH_LIMIT, PITCH_LIMIT);
    drag.velY *= Math.exp(-3.2 * dt);
    drag.velX *= Math.exp(-3.2 * dt);
  }
  const sway = Math.hypot(drag.velY, drag.velX) > 0.02 || drag.down ? 0.16 : 1;
  const planar = [2, 5, 6, 7].includes(specimen.formation);
  if (!drag.down) displayYaw = THREE.MathUtils.damp(displayYaw, planar ? 0.24 : 0.92, 2.2, dt);
  specimen.group.rotation.y = displayYaw + Math.sin(t * 0.11) * 0.30 * sway + drag.rotY;
  specimen.group.rotation.x = drag.rotX;
  specimen.rings.forEach((r) => {
    r.holder.rotateZ(dt * r.speed);
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

  rig.release = specimen.phase === 'rest' ? 0 : 1;
  rig.update(dt, t);

  // impact: expanding ring + a short camera shake, both driven by one clock
  burstAge += dt;
  const shake = Math.max(0, 1 - burstAge / 0.62);
  if (shake > 0) {
    const k = shake * shake * 0.020;
    camera.position.x += Math.sin(burstAge * 63.0) * k;
    camera.position.y += Math.sin(burstAge * 48.0 + 1.7) * k;
  }

  chamber.update(t, dt, specimen.phase === 'rest' ? hoverAmt : 1);
  beams.update(t);
  beams.material.uniforms.uCam.value.copy(camera.position);
  dust.update(t, camera.position);

  if (NO_POST) renderer.render(scene, camera);
  else composer.render(dt);
  (window as any).__FRAMES__ = ((window as any).__FRAMES__ || 0) + 1;
  sampleQuality(renderMs);
  frames++;
  if (frames === 3) (window as any).__READY__ = true;
};

let loopStarted = false;
let loopRunning = false;
const startLoop = () => {
  loopStarted = true;
  if (loopRunning) return;
  loopRunning = true;
  renderer.setAnimationLoop(tick);
};
const stopLoop = () => {
  loopRunning = false;
  renderer.setAnimationLoop(null);
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopLoop();
    return;
  }
  timer.reset();
  accMs = 0;
  warmupMs = 900;
  frameAcc = 0;
  frameCount = 0;
  slowStreak = 0;
  fastStreak = 0;
  cooldown = 0;
  if (loopStarted) startLoop();
});

let reflectionBaked = false;
const bakeOnce = () => {
  if (reflectionBaked) return;
  reflectionBaked = true;
  try { bakeSpecimenReflection(); } catch (e) { console.warn('[cold-vault] reflection bake failed', e); }
};
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  stopLoop();
});
canvas.addEventListener('webglcontextrestored', () => {
  whenVisible().then(async () => {
    const restoredArtefact = buildArtefactEnvironment(renderer);
    scene.environment = restoredArtefact;
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial && material.envMap === artefactEnv) {
          material.envMap = restoredArtefact;
          material.needsUpdate = true;
        }
      }
    });
    sun.shadow.needsUpdate = true;
    reflectionBaked = false;
    bakeOnce();
    if (!NO_POST) await warmComposer();
    startLoop();
  }).catch((error) => console.warn('[cold-vault] context restore failed', error));
});
initUI({
  rig,
  onBurst: () => {
    if (specimen.burst(1)) burstAge = 0;
  },
  getPhase: () => specimen.phase,
  getFormation: () => specimen.formationName,
});
(window as any).__SCENE__ = {
  scene, camera, renderer, specimen, rig, beams, room, composer, dof, bloom, dofPass, caPass,
  setQualityMode, applyRes, applyFx,
  getQuality: () => resScale, getQualityMode: () => qualityMode, getFx: () => fxLevel,
  getDragState: () => ({ down: drag.down, yaw: drag.rotY, pitch: drag.rotX, velocityY: drag.velY }),
  getLoopState: () => ({ started: loopStarted, running: loopRunning, hidden: document.hidden, contextLost: renderer.getContext().isContextLost(), frames }),
  getStats: () => ({ dpr: window.devicePixelRatio || 1, ceil: RES_CEIL, res: resScale, fx: fxLevel, mode: qualityMode, buffer: [renderer.domElement.width, renderer.domElement.height], css: [innerWidth, innerHeight], fps: Math.round(lastFps), gpu: gpuName() }),
};
await whenVisible();
composer.passes[1].enabled = false;
caPass.enabled = false;
stage('合成第一帧', 90);
startLoop();
while (!(window as any).__READY__) await yieldToBrowser();
while (!document.body.classList.contains('is-ready')) await yieldToBrowser();
await new Promise<void>((resolve) => setTimeout(resolve, 450));
const enhanceStartup = async () => {
  stage('预热物理引擎', 76);
  await yieldToBrowser();
  specimen.prewarm();
  await yieldToBrowser();
  if (!NO_POST) await warmComposer();
  stage('就绪', 97);
};
enhanceStartup().catch((error) => {
  console.warn('[cold-vault] startup enhancement failed', error);
});

(window as any).__THREE__ = THREE;
(window as any).__RAPIER__ = (window as any).__RAPIER__;
console.log('[cold-vault] booted');