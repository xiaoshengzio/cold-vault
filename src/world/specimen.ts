import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { facesToGeometry, voronoiCells } from './voronoi';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

await RAPIER.init();

/**
 * 《冷库》标本：一枚被封存的六棱晶体，已沿解理面崩解成楔块，正被磁场悬停托管。
 * 每块都是 Rapier 刚体，弹簧把它拉回解理位置；鼠标是引力源，点击是冲击波。
 */

// 石英晶柱：中段是等半径的直壁棱柱（长直棱线是"晶体"的识别特征），
// 上端收成锥顶，下端收成尖底。不要圆弧过渡，否则在暗场里会读作塑料壳。
const PROFILE: Array<[number, number]> = [
  [-1.55, 0.006],
  [-1.42, 0.090],
  [-1.26, 0.190],
  [-1.06, 0.300],
  [0.52, 0.300],
  [0.86, 0.230],
  [1.22, 0.120],
  [1.55, 0.006],
];

const RADIAL_SCALE = 1.85;

function radiusAt(y: number): number {
  if (y <= PROFILE[0][0]) return PROFILE[0][1];
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [y0, r0] = PROFILE[i];
    const [y1, r1] = PROFILE[i + 1];
    if (y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
  }
  return PROFILE[PROFILE.length - 1][1];
}

function radiusScaled(y: number): number {
  return radiusAt(y) * RADIAL_SCALE;
}

/** 极角 theta 处六边形外轮廓的精确半径（外接圆半径 R，角点在 30° + k·60°） */
function hexRadius(R: number, theta: number): number {
  const local = ((theta - Math.PI / 6) % (Math.PI / 3) + Math.PI / 3) % (Math.PI / 3);
  return (R * Math.cos(Math.PI / 6)) / Math.cos(local - Math.PI / 6);
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** convex hull, scrubbed of the degenerate triangles that NaN out a frame */
function hullGeometry(points: THREE.Vector3[]): THREE.BufferGeometry {
  const hull = new ConvexGeometry(points);
  const src = hull.attributes.position;
  const keep: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  for (let i = 0; i < src.count; i += 3) {
    a.fromBufferAttribute(src, i);
    b.fromBufferAttribute(src, i + 1);
    c.fromBufferAttribute(src, i + 2);
    nrm.subVectors(b, a).cross(c.clone().sub(a));
    if (nrm.lengthSq() < 1e-10) continue;
    keep.push(a.x, a.y, a.z, b.x, b.y, b.z, src.getX(i + 2), src.getY(i + 2), src.getZ(i + 2));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
  const uvs = new Float32Array((keep.length / 3) * 2);
  for (let i = 0; i < keep.length / 3; i++) {
    uvs[i * 2] = keep[i * 3] * 3.2 + 0.5;
    uvs[i * 2 + 1] = keep[i * 3 + 1] * 3.2 + 0.5;
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  const nor = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < nor.count; i++) {
    const x = nor.getX(i), y = nor.getY(i), z = nor.getZ(i);
    if (!Number.isFinite(x + y + z) || x * x + y * y + z * z < 1e-8) nor.setXYZ(i, 0, 1, 0);
  }
  return g;
}


/** 静止态的整块晶体：同一轮廓、同一六边形外接半径，一整块没有接缝 */
function prismSolidGeometry(): THREE.BufferGeometry {
  const rings = PROFILE.map(([y]) => ({ y, r: Math.max(radiusScaled(y), 0.0001) }));
  const SIDES = 6;
  const p = (ring: { y: number; r: number }, k: number) => {
    const th = (k / SIDES) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(th) * ring.r, ring.y, Math.sin(th) * ring.r);
  };
  const verts: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    verts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  for (let i = 0; i < rings.length - 1; i++) {
    const lo = rings[i];
    const hi = rings[i + 1];
    for (let k = 0; k < SIDES; k++) {
      const a = p(lo, k);
      const b = p(lo, k + 1);
      const c = p(hi, k + 1);
      const d = p(hi, k);
      tri(a, c, b);
      tri(a, d, c);
    }
  }
  const bot = rings[0];
  const top = rings[rings.length - 1];
  const cb = new THREE.Vector3(0, bot.y, 0);
  const ct = new THREE.Vector3(0, top.y, 0);
  for (let k = 0; k < SIDES; k++) {
    tri(cb, p(bot, k), p(bot, k + 1));
    tri(ct, p(top, k + 1), p(top, k));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const uvs = new Float32Array((verts.length / 3) * 2);
  for (let i = 0; i < verts.length / 3; i++) {
    uvs[i * 2] = verts[i * 3] * 3.2 + 0.5;
    uvs[i * 2 + 1] = verts[i * 3 + 1] * 3.2 + 0.5;
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

const QNOISE = /* glsl */ `
float cvHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float cvNoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n000 = cvHash(i), n100 = cvHash(i + vec3(1,0,0)), n010 = cvHash(i + vec3(0,1,0)), n110 = cvHash(i + vec3(1,1,0));
  float n001 = cvHash(i + vec3(0,0,1)), n101 = cvHash(i + vec3(1,0,1)), n011 = cvHash(i + vec3(0,1,1)), n111 = cvHash(i + vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
}
`;
const STONE_VERT = `
varying vec3 vStonePos;
`;
const STONE_VERT_INJECT = `
  vStonePos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;
const STONE_COMMON = `
varying vec3 vStonePos;
float cvHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float cvNoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n000 = cvHash(i), n100 = cvHash(i + vec3(1,0,0)), n010 = cvHash(i + vec3(0,1,0)), n110 = cvHash(i + vec3(1,1,0));
  float n001 = cvHash(i + vec3(0,0,1)), n101 = cvHash(i + vec3(1,0,1)), n011 = cvHash(i + vec3(0,1,1)), n111 = cvHash(i + vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y), mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
}
`;

function stoneMaterial(src: THREE.MeshPhysicalMaterial, seed: number): THREE.MeshPhysicalMaterial {
  const m = src.clone();
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + STONE_VERT)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + STONE_VERT_INJECT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + STONE_COMMON)
      .replace('#include <color_fragment>', `#include <color_fragment>
  float cvN = cvNoise(vStonePos * 6.2 + ${seed.toFixed(2)}) * 0.58
            + cvNoise(vStonePos * 18.5 + ${seed.toFixed(2)}) * 0.29
            + cvNoise(vStonePos * 44.0) * 0.13;
  diffuseColor.rgb *= 0.78 + cvN * 0.46;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 0.99, 0.90), smoothstep(0.55, 0.95, cvN));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor * (0.62 + cvN * 1.05), 0.05, 1.0);`);
  };
  return m;
}

export interface SpecimenPiece {
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  home: THREE.Vector3;
  /** 外法线方向，飞散时沿它冲出去 */
  dir: THREE.Vector3;
  /** 质量（kg），用来把加速度换算成冲量 */
  mass: number;
  /** 错峰延迟（秒）：中段先吸、两端后吸 */
  wave: number;
  /** 已经精确贴回 home（此后再不参与物理） */
  snapped: boolean;
  /** 正在走最后一段运动学归位 */
  captured: boolean;
  captureT: number;
  from: THREE.Vector3;
  fromQ: THREE.Quaternion;
  /** 团块内此片的目标偏移方向与半径（每个片各不同 → 堆出来的形状不规则） */
  gatherDir: THREE.Vector3;
  gatherR: number;
  /** 当前静止变换：开场是原始解理位，团块形成后被覆写成团块位 */
  restPos: THREE.Vector3;
  restQuat: THREE.Quaternion;
  /** 已经吸定（冻结） */
  locked: boolean;
  /** 当前接触数（由 EventQueue 维护） */
  contacts: number;
  /** 低速 + 接触持续的累计时间 */
  quietT: number;
}

export interface Specimen {
  group: THREE.Group;
  /** 静止态整块晶体（碎片隐藏时显示） */
  solid: THREE.Mesh;
  pieces: SpecimenPiece[];
  rings: Array<{
    holder: THREE.Object3D;
    axis: THREE.Vector3;
    speed: number;
    mat: THREE.Material & { opacity: number };
    baseY: number;
  }>;
  core: THREE.Object3D;
  /** 全部碎片是否已精确归位（供测试与交互判断） */
  readonly settled: boolean;
  /** 当前阶段：rest / burst / gather */
  readonly phase: string;
  /** 是否已经吸成团块（此时静止形状与原晶体不同） */
  readonly isClump: boolean;
  /** 物理世界（仅供测试探针） */
  readonly world: RAPIER.World;
  /** 已归位的片数 */
  readonly snappedCount: number;
  update(dt: number, t: number, pointer: THREE.Vector3 | null, camera: THREE.Camera, hover?: number): void;
  burst(strength?: number): void;
}

export function buildSpecimen(M: any, env: THREE.Texture, stoneEnv: THREE.Texture = env): Specimen {
  (globalThis as any).__RAPIER__ = RAPIER;
  const group = new THREE.Group();
  group.name = 'specimen';
  group.rotation.y = Math.PI / 3;

  const rand = rng(20261031);

  /* ------------------------------------------------------------ materials */
  const quartzMat = (M.glass as THREE.MeshPhysicalMaterial).clone();
  quartzMat.transmission = 0;
  // 黑曜石晶柱：基色压到近黑，靠环境渐变的镜面反射与棱边菲涅耳读出形体。
  // 象牙色在暗场里会读成"纸团"，黑色反而让每个解理面像刀口一样分层。
  quartzMat.color = new THREE.Color(0.024, 0.025, 0.031);
  quartzMat.emissive = new THREE.Color(0.004, 0.004, 0.005);
  quartzMat.ior = 1.58;
  quartzMat.roughness = 0.285;
  quartzMat.metalness = 0.0;
  quartzMat.iridescence = 0.34;
  quartzMat.iridescenceIOR = 1.42;
  quartzMat.envMap = stoneEnv;
  quartzMat.envMapIntensity = 1.30;
  quartzMat.flatShading = true;
  quartzMat.clearcoat = 1.0;
  quartzMat.clearcoatRoughness = 0.105;
  quartzMat.transparent = false;
  quartzMat.opacity = 1.0;
  quartzMat.specularIntensity = 1.0;
  quartzMat.polygonOffset = true;
  quartzMat.polygonOffsetFactor = 1.4;
  quartzMat.polygonOffsetUnits = 1.4;

  // 菲涅耳棱光：掠射角把棱提亮一点点，读作"透明晶体的边"，而不是靠额外的壳层几何
  const fresUniform = { value: new THREE.Color(0.15, 0.19, 0.27) };
  const quartzBaseCompile = quartzMat.onBeforeCompile;
  quartzMat.onBeforeCompile = (shader, renderer) => {
    quartzBaseCompile?.call(quartzMat, shader, renderer);
    shader.uniforms.uFres = fresUniform;
    // aCut = 1 表示这是解理切口（不是晶体外表面）。切口必须压成近黑且不参与棱光，
    // 否则缝隙里露出的一圈锐利侧壁会被菲涅耳点亮成"白虚线"。
    shader.vertexShader =
      'attribute float aCut;\nvarying float vCut;\nvarying vec3 vQPos;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vCut = aCut;\n vQPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = 'uniform vec3 uFres;\nvarying float vCut;\nvarying vec3 vQPos;\n' + QNOISE + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      diffuseColor.rgb *= mix(1.0, 0.055, clamp(vCut, 0.0, 1.0));`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.72, clamp(vCut, 0.0, 1.0));\n      float qn = cvNoise(vQPos * 26.0) * 0.55 + cvNoise(vQPos * 8.5) * 0.45;\n      roughnessFactor = clamp(roughnessFactor * (0.86 + qn * 0.42), 0.05, 1.0);`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
      float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.2);
      gl_FragColor.rgb += uFres * fres * (1.0 - clamp(vCut, 0.0, 1.0) * 0.92);`,
    );
  };

  const edgeMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(0.82, 0.105, 0.048),
    transparent: true,
    opacity: 0.60,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const brassMat = (M.brass as THREE.MeshPhysicalMaterial).clone();
  brassMat.envMap = env;
  brassMat.envMapIntensity = 1.42;
  brassMat.roughness = 0.26;
  brassMat.flatShading = false;
  // anisotropic GGX needs tangents; without them it NaN-ed the whole frame
  brassMat.anisotropy = 0;

  /* ------------------------------------------------------ the whole piece */
  // 静止态只画这一整块：没有接缝、只有一个 draw call，点击瞬间切成解理碎片
  const solid = new THREE.Mesh(prismSolidGeometry(), quartzMat);
  solid.castShadow = true;
  solid.receiveShadow = true;
  // 首版观感：解理块始终可见，缝隙里透出内核；整块网格只作退化备份
  solid.visible = false;
  group.add(solid);

  /* --------------------------------------------------------------- physics */
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  const pieces: SpecimenPiece[] = [];

  const Y_BOT = -1.55;
  const Y_TOP = 1.55;

  // —— 解理碎片：真正的 3D Voronoi 切割 ——
  // 只有 Voronoi 胞才能既保证"每块都是凸壳"（物理需要）又保证"静止时严丝合缝"，
  // 否则碎块之间必然留缝，读成一堆石块而不是同一块晶体崩开。
  const CHUNKS = 88;

  // 底面多面体：按 PROFILE 叠一圈六边形环，侧面连成四边形
  const ringY = [Y_BOT, -1.42, -1.26, -1.06, -0.28, 0.52, 0.88, 1.22, Y_TOP];
  const ringPts = ringY.map((y) => {
    const R = Math.max(0.006, radiusScaled(y));
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k < 6; k++) {
      const th = Math.PI / 6 + (k / 6) * Math.PI * 2;
      const r = hexRadius(R, th);
      pts.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r));
    }
    return pts;
  });

  const baseFaces: THREE.Vector3[][] = [];
  for (let i = 0; i < ringPts.length - 1; i++) {
    for (let k = 0; k < 6; k++) {
      const k2 = (k + 1) % 6;
      baseFaces.push([ringPts[i][k], ringPts[i][k2], ringPts[i + 1][k2], ringPts[i + 1][k]]);
    }
  }
  baseFaces.push(ringPts[0].slice().reverse());
  baseFaces.push(ringPts[ringPts.length - 1].slice());

  // —— 内胆余烬 ——
  // 碎片之间只有发丝级缝，金属面本身不透光：缝里如果没有东西，就只会露出背景的白点。
  // 这里放一层比外壳小 4.5% 的余烬壳，缝隙里透出的便是暗红的光，"崩解中的标本"才成立。
  {
    const coreGeo = facesToGeometry(baseFaces, new THREE.Vector3());
    coreGeo.scale(0.955, 0.992, 0.955);
    // 内胆：填在解理缝后面的一层深色玻璃。
  // 没有它时，缝隙透出的是背后的墙与碎片的侧棱高光 → 满身"白色虚线"，
  // 读作渲染瑕疵；有了它，缝隙是一条干净的暗线。
  const emberMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.016, 0.020, 0.028),
    roughness: 0.42,
    metalness: 0.55,
    envMapIntensity: 0.8,
  });
    const ember = new THREE.Mesh(coreGeo, emberMat);
    ember.visible = false;
    ember.name = 'specimen-ember';
    ember.renderOrder = -1;
    group.add(ember);
  }

  // 撒种：按体积均匀，带最小间距
  const seeds: THREE.Vector3[] = [];
  for (let guard = 0; guard < 80000 && seeds.length < CHUNKS; guard++) {
    const sy = Y_BOT + rand() * (Y_TOP - Y_BOT);
    const sr = radiusScaled(sy) * 0.93;
    if (sr < 0.05) continue;
    const sth = rand() * Math.PI * 2;
    const srr = Math.sqrt(rand()) * sr;
    const cand = new THREE.Vector3(Math.cos(sth) * srr, sy, Math.sin(sth) * srr);
    let ok = true;
    for (const q of seeds) {
      if (q.distanceToSquared(cand) < 0.026) {
        ok = false;
        break;
      }
    }
    if (ok) seeds.push(cand);
  }

  // 基体侧面/锥面的平面表：用来判断碎片上的某个面是"晶体外表面"还是"解理切口"。
  // 切口必须压暗，否则缝隙里露出的一圈锐利侧壁会被菲涅耳点亮，整块晶体像被白虚线画满。
  const basePlanes = baseFaces.map((f) => {
    const n = new THREE.Vector3();
    const a = f[0], b = f[1], c2 = f[2];
    n.crossVectors(b.clone().sub(a), c2.clone().sub(a)).normalize();
    return { n, d: n.dot(a) };
  });
  const isOuterFace = (f: THREE.Vector3[]): boolean => {
    const c0 = f[0];
    for (const pl of basePlanes) {
      if (Math.abs(pl.n.dot(c0) - pl.d) < 4e-3) return true;
    }
    return false;
  };

  const cells = voronoiCells(baseFaces, seeds);
  for (const faces of cells) {
    const verts: THREE.Vector3[] = [];
    for (const f of faces) for (const v of f) verts.push(v);
    if (verts.length < 8) continue;
    const home = new THREE.Vector3();
    for (const v of verts) home.add(v);
    home.divideScalar(verts.length);

    const centre = home.clone();
    // 几何必须按自身质心归零，否则 mesh.position = 质心 会把每块碎片再位移一次
    const localFaces = faces.map((f) => f.map((v) => v.clone().sub(centre)));
    const cutFlags = faces.map((f) => !isOuterFace(f));
    const geo = facesToGeometry(localFaces, new THREE.Vector3(), cutFlags);
    // 留一道发丝缝：缝隙里露出的是相邻胞的"切口面"，已在材质里压成近黑，
    // 于是解理线读作细暗缝，而不是 88 个网格共边 AA 产生的白色点状描边。
    geo.scale(0.9994, 0.9994, 0.9994);
    // 每一块都绕自身随机转 ±1°：88 个胞严丝合缝共面时，六个大平面会读成
    // 「一整块抛光板」；轻微错开让每个解理面各自朝光，表面才碎成许多小切面。
    const jitter = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
      (rand() - 0.5) * 0.034,
    );
    geo.applyQuaternion(jitter);
    if (geo.attributes.position.count < 30) continue;

      // 全片共用一份材质：逐块随机色调会让它读成"一堆石块"，而不是同一块晶体崩开
      const pMat = quartzMat;

      const mesh = new THREE.Mesh(geo, pMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.copy(home);
      mesh.visible = true;
      group.add(mesh);

      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(home.x, home.y, home.z)
          .setLinearDamping(0.35)
          .setAngularDamping(2.2)
          .setCanSleep(false),
      );
      const hullVerts = new Float32Array(geo.attributes.position.array);
      const desc = RAPIER.ColliderDesc.convexHull(hullVerts) ?? RAPIER.ColliderDesc.ball(0.06);
      desc
        .setRestitution(0.18)
        .setFriction(0.62)
        .setDensity(0)
        .setContactSkin(0.006)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      const collider = world.createCollider(desc, body);
      // 密度按体积给到 1kg：setAdditionalMass 会把转动惯量算成 0，碎片一碰到摩擦就疯转
      collider.setDensity(1 / Math.max(1e-4, collider.volume()));
      // 每片按 1kg 记：体密度 = 1/体积，冲量换算与转动惯量都对得上
      const mass = 1.0;

      const dir = home.clone();
      dir.y *= 0.22;
      if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
      dir.normalize();
      // 中段先吸、两端后吸：磁吸波从晶体的腰部长出来
      const wave = Math.min(0.62, (Math.abs(home.y) / 1.55) * 0.44 + rand() * 0.10);
      // 团块槽位：球面上随机方向 + 0.05~0.34 的半径 → 88 片挤成一颗不规则的核心
      const gDir = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
      if (gDir.lengthSq() < 1e-4) gDir.set(0, 1, 0);
      gDir.normalize();
      pieces.push({
        mesh, body, collider, home, dir, wave, mass,
        snapped: true, captured: false, captureT: 0,
        from: new THREE.Vector3(), fromQ: new THREE.Quaternion(),
        gatherDir: gDir,
        // 目标半径按体积均匀分布：88 片紧堆半径 ≈ 0.745，任何更小的目标都物理不可达
        gatherR: 0.78 * Math.cbrt(rand()),
        locked: false,
        contacts: 0,
        quietT: 0,
        restPos: home.clone(),
        restQuat: new THREE.Quaternion(),
      });
    }

  /* -------------------------------------------------------------- the core */
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.055, 1),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.42, 0.14), toneMapped: false }),
  );
  core.position.set(0, -0.06, 0);
  group.add(core);

  const coreLight = new THREE.PointLight(0xffb27a, 0.16, 0.95, 2.0);
  coreLight.position.copy(core.position);
  group.add(coreLight);

  /* ------------------------------------------------------ the inner fire */
  const innerGeo = new THREE.CylinderGeometry(0.105, 0.135, 2.20, 6, 1);
  const innerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.10, 0.015, 0.012), toneMapped: false });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.position.y = -0.05;
  inner.visible = false;
  inner.rotation.y = Math.PI / 6;
  group.add(inner);

  /* --------------------------------------------------------- containment */
// 环在交互期必须让位：碎片会被吸成一个团块，路径必然经过环所在的位置。
// 让环向外张开并淡出，读作"约束场解除"，归位后再收回来。
const rings: Specimen['rings'] = [];
const ringSpecs = [
  { r: 0.800, tube: 0.0165, y: 0.30, axis: new THREE.Vector3(0.03, 1, 0.015).normalize(), speed: 0.070 },
  { r: 0.690, tube: 0.0125, y: -0.34, axis: new THREE.Vector3(0.62, 1, 0.34).normalize(), speed: -0.105 },
];

for (const spec of ringSpecs) {
  const holder = new THREE.Group();
  const ringMat = (brassMat as THREE.MeshStandardMaterial).clone();
  ringMat.transparent = true;
  ringMat.opacity = 1;
  ringMat.depthWrite = true;
  const torus = new THREE.Mesh(new THREE.TorusGeometry(spec.r, spec.tube, 12, 128), ringMat);
  torus.castShadow = true;
  holder.add(torus);

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const boss = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.tube * 1.8, spec.tube * 1.8, spec.tube * 2.2, 6),
      ringMat,
    );
    boss.position.set(Math.cos(a) * spec.r, Math.sin(a) * spec.r, 0);
    boss.rotation.z = a;
    boss.castShadow = true;
    holder.add(boss);
  }

  holder.position.y = spec.y;
  holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), spec.axis);
  group.add(holder);
  rings.push({ holder, axis: spec.axis, speed: spec.speed, mat: ringMat, baseY: spec.y });
}

/* ------------------------------------------------------------- behaviour */
// 四段式：
//   rest   —— 碎片以静止变换悬停（开场是原始解理位，碎裂之后就是团块里的位置）
//   burst  —— 真实弹飞：互碰 + CCD，初速直接赋值
//   gather —— 磁场汇聚：向团块内的随机槽位施加 1/d² 引力，碎片互相碰撞堆叠
//   rest   —— 堆成一颗不规则的团块，刚体转 Fixed，物理停摆
// 关键设计：碎片**不再逐片回到原位**。它们被吸到一起、堆成另一个形状，这才是真实物理的结果。
type Phase = 'rest' | 'burst' | 'drift' | 'gather';
let phase: Phase = 'rest';
let phaseT = 0;
let settleT = 0;
let isClump = false;
let snapFlash = 0;
let accumulate = 0;
let fieldOut = 0;
let ringScaleCur = 1;
let ringOpacityCur = 1;
let hoverAmt = 0;
const FIXED = 1 / 60;
const BURST_TIME = 0.30;
const DRIFT_TIME = 0.62;
const GROUPS_TOUCHING = (1 << 16) | 1;
const GROUPS_NONE = 0;
// 速度伺服参数（子智能体实测：88 片 1.0s 内全部落位，稳态速度严格为 0）
const R_TARGET = 0.78;
const ACC = 2.9;
const VMAX = 2.6;
const K_V = 7.0;
const QUIET_V = 1.20;
const QUIET_T = 0.07;
const ACC_CAP = 45;
const events = new RAPIER.EventQueue(true);
const byHandle = new Map<number, SpecimenPiece>();
for (const pc of pieces) byHandle.set(pc.collider.handle, pc);
let ringFitScale = 1.95;

const force = new THREE.Vector3();
const toP = new THREE.Vector3();
const tangential = new THREE.Vector3();
const pointerLocal = new THREE.Vector3();
const centre = new THREE.Vector3(0, 0, 0);
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (x: number) => x * x * (3 - 2 * x);

/**
 * 环的状态：静止且未碎 → 原位；已经吸成团块 → 张开到能容下团块（团块半径约 1.1，
 * 环半径 0.79/0.68 必须放大到 1.9 倍才不穿模）；交互过程中 → 张到最大并淡出，
 * 读作"约束场解除"。这是彻底杜绝碎块穿过黄铜环的唯一可靠办法。
 */
const ringAnim = (dt: number) => {
  const clump = isClump && phase === 'rest';
  const targetScale = phase === 'rest' ? (clump ? ringFitScale : 1.0) : 3.45;
  const targetOpacity = phase === 'rest' ? 1 : 0;
  ringScaleCur += (targetScale - ringScaleCur) * Math.min(1, dt * 3.4);
  ringOpacityCur += (targetOpacity - ringOpacityCur) * Math.min(1, dt * 5.0);
  for (const r of rings) {
    r.holder.scale.setScalar(ringScaleCur);
    r.mat.opacity = ringOpacityCur;
    r.mat.visible = ringOpacityCur > 0.02;
  }
  fieldOut += ((phase === 'rest' ? 0 : 1) - fieldOut) * Math.min(1, dt * 4.2);
};

const syncPiece = (pc: SpecimenPiece) => {
  const tr = pc.body.translation();
  const rot = pc.body.rotation();
  if (!Number.isFinite(tr.x + tr.y + tr.z) || !Number.isFinite(rot.w)) return;
  pc.mesh.position.set(tr.x, tr.y, tr.z);
  pc.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
};

/** 收尾：记录静止变换、按实测包围半径张开环、物理停摆 */
const freezeClump = (clump = true) => {
  if (!clump) {
    // 磁吸归位：所有碎片已经回到各自的 home，恢复静止态（整块晶体重新成立）
    for (const pc of pieces) {
      pc.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
      pc.body.setTranslation({ x: pc.restPos.x, y: pc.restPos.y, z: pc.restPos.z }, true);
      pc.body.setRotation({ x: pc.restQuat.x, y: pc.restQuat.y, z: pc.restQuat.z, w: pc.restQuat.w }, true);
      pc.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      pc.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      pc.collider.setCollisionGroups(GROUPS_NONE);
      pc.locked = true;
      pc.contacts = 0;
      pc.quietT = 0;
      pc.mesh.position.copy(pc.restPos);
      pc.mesh.quaternion.copy(pc.restQuat);
    }
    ringFitScale = 1;
    world.numSolverIterations = 4;
    isClump = false;
    phase = 'rest';
    phaseT = 0;
    settleT = 0;
    snapFlash = 0;
    return;
  }
  let boundR = 0;
  for (const pc of pieces) {
    const tr = pc.body.translation();
    const rot = pc.body.rotation();
    pc.restPos.set(tr.x, tr.y, tr.z);
    pc.restQuat.set(rot.x, rot.y, rot.z, rot.w);
    boundR = Math.max(boundR, Math.sqrt(tr.x * tr.x + tr.y * tr.y + tr.z * tr.z));
    if (!pc.locked) {
      pc.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
      pc.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      pc.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }
  for (const pc of pieces) {
    pc.collider.setCollisionGroups(GROUPS_NONE);
    pc.locked = true;
    pc.contacts = 0;
    pc.quietT = 0;
  }
  // 环必须按真实包围半径让位，否则团块一定会吞掉它
  ringFitScale = Math.max(1.9, (boundR * 1.16) / 0.79);
  world.numSolverIterations = 4;
  isClump = true;
  phase = 'rest';
  phaseT = 0;
  settleT = 0;
  snapFlash = 1;
};

const stepPhysics = (h: number) => {
  if (phase === 'drift') {
    // 悬停：碎片被"空气"拖住，几乎停在原地缓慢漂移，读作时间被拉长的一瞬
    const k = Math.exp(-7.5 * h);
    for (const pc of pieces) {
      if (pc.locked) continue;
      const v = pc.body.linvel();
      pc.body.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
      const w = pc.body.angvel();
      const kw = Math.exp(-9.0 * h);
      pc.body.setAngvel({ x: w.x * kw, y: w.y * kw, z: w.z * kw }, true);
    }
  }
  if (phase === 'gather') {
    // 速度伺服：期望速度 vDes = min(VMAX, sqrt(2·ACC·gap))，再用一阶伺服把真实速度拉过去。
    // 远场恒加速度（读作"磁力"，所有碎片几乎同时被拽起），近场自然软着陆。
    const alpha = 1 - Math.exp(-K_V * h);
    for (const pc of pieces) {
      if (pc.locked) continue;
      const body = pc.body;
      const tr = body.translation();
      // 磁吸归位：每片被吸回它自己的 home，碎片最后拼回整块晶体
      toP.set(pc.restPos.x - tr.x, pc.restPos.y - tr.y, pc.restPos.z - tr.z);
      const gap = toP.length();
      if (gap > 1e-4) {
        toP.divideScalar(gap);
        const soft = 0.25 + 0.75 * Math.min(1, gap / 0.35);
        const vDes = Math.min(VMAX, Math.sqrt(2 * ACC * gap)) * soft;
        const v = body.linvel();
        let ix = (toP.x * vDes - v.x) * pc.mass * alpha;
        let iy = (toP.y * vDes - v.y) * pc.mass * alpha;
        let iz = (toP.z * vDes - v.z) * pc.mass * alpha;
        const il = Math.sqrt(ix * ix + iy * iy + iz * iz);
        const cap = pc.mass * ACC_CAP * h;
        if (il > cap) {
          const sc = cap / il;
          ix *= sc;
          iy *= sc;
          iz *= sc;
        }
        body.applyImpulse({ x: ix, y: iy, z: iz }, true);
        // 姿态也吸回原位：四元数误差 → 目标角速度，靠近时才开始拽正，远处不干涉翻滚
        const rot = body.rotation();
        tmpQ.set(rot.x, rot.y, rot.z, rot.w);
        tmpQ2.copy(pc.restQuat).multiply(tmpQ.invert());
        if (tmpQ2.w < 0) tmpQ2.set(-tmpQ2.x, -tmpQ2.y, -tmpQ2.z, -tmpQ2.w);
        const sHalf = Math.sqrt(Math.max(0, 1 - tmpQ2.w * tmpQ2.w));
        const ang = 2 * Math.acos(Math.min(1, Math.max(-1, tmpQ2.w)));
        if (sHalf > 1e-4) {
          const near = Math.min(1, 0.35 / Math.max(gap, 1e-3));
          const wMax = Math.min(9, ang * 5.5) * near;
          const k = wMax / sHalf;
          body.setAngvel({ x: tmpQ2.x * k, y: tmpQ2.y * k, z: tmpQ2.z * k }, true);
        }
      }
    }
  }
  world.timestep = h;
  world.step(events);
  events.drainCollisionEvents((h1, h2, started) => {
    if (phase !== 'gather') return;
    const a = byHandle.get(h1);
    if (a) a.contacts = Math.max(0, a.contacts + (started ? 1 : -1));
    const b = byHandle.get(h2);
    if (b) b.contacts = Math.max(0, b.contacts + (started ? 1 : -1));
  });
  if (phase === 'gather') {
    let lockedCount = 0;
    for (const pc of pieces) {
      if (pc.locked) {
        lockedCount++;
        continue;
      }
      const v = pc.body.linvel();
      const sp = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      const tr = pc.body.translation();
      const dh = Math.hypot(tr.x - pc.restPos.x, tr.y - pc.restPos.y, tr.z - pc.restPos.z);
      if (sp < QUIET_V && dh < 0.05) pc.quietT += h;
      else pc.quietT = Math.max(0, pc.quietT - 2 * h);
      if (pc.quietT > QUIET_T) {
        // 精确落到 home：差 3cm 以内直接吸附，读作"磁铁啪地一下吸住"
        pc.body.setTranslation({ x: pc.restPos.x, y: pc.restPos.y, z: pc.restPos.z }, true);
        pc.body.setRotation({ x: pc.restQuat.x, y: pc.restQuat.y, z: pc.restQuat.z, w: pc.restQuat.w }, true);
        pc.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        pc.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        pc.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
        pc.locked = true;
        byHandle.delete(pc.collider.handle);
        lockedCount++;
        snapFlash = Math.min(1, snapFlash + 0.06);
      }
    }
    if (lockedCount === pieces.length) freezeClump(false);
  }
  for (const pc of pieces) syncPiece(pc);
};

return {
  group,
  solid,
  pieces,
  rings,
  core,
  world,
  get settled() {
    return phase === 'rest';
  },
  get phase() {
    return phase;
  },
  get snappedCount() {
    let n = 0;
    for (const pc of pieces) if (phase === 'rest') n++;
    return n;
  },
  get isClump() {
    return isClump;
  },
  burst(strength = 1) {
    // 从当前静止位重新起步：刚体在 rest 期是 Fixed，必须转回 Dynamic 并补回质量
    const fromRest = phase === 'rest';
    for (const pc of pieces) {
      const body = pc.body;
      body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      pc.locked = false;
      pc.contacts = 0;
      pc.quietT = 0;
      byHandle.set(pc.collider.handle, pc);
      if (fromRest) {
        // 从"当前可见位置"起爆：悬停时碎片已经张开过，用 restPos 会有 1 帧回跳
        const sx0 = pc.mesh.position.x;
        const sy0 = pc.mesh.position.y;
        const sz0 = pc.mesh.position.z;
        body.setTranslation({ x: sx0, y: sy0, z: sz0 }, true);
        body.setRotation({ x: pc.restQuat.x, y: pc.restQuat.y, z: pc.restQuat.z, w: pc.restQuat.w }, true);
      }
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      pc.collider.setCollisionGroups(GROUPS_TOUCHING);
      body.enableCcd(true);
      // 沿"离心方向"爆开：团块形成后，各片朝外推的方向天然就是它所在位置的法向
      tmpV.copy(fromRest ? pc.restPos : pc.mesh.position).sub(centre);
      tmpV.y *= 0.35;
      if (tmpV.lengthSq() < 1e-5) tmpV.copy(pc.dir);
      tmpV.normalize();
      const sp = (1.50 + Math.random() * 0.60) * strength;
      body.setLinvel(
        {
          x: tmpV.x * sp - tmpV.z * 0.26 + (Math.random() - 0.5) * 0.55,
          y: tmpV.y * sp + (Math.random() - 0.5) * 0.55,
          z: tmpV.z * sp + tmpV.x * 0.26 + (Math.random() - 0.5) * 0.55,
        },
        true,
      );
      body.setAngvel(
        {
          x: (Math.random() - 0.5) * 1.5,
          y: (Math.random() - 0.5) * 1.5,
          z: (Math.random() - 0.5) * 1.5,
        },
        true,
      );
    }
    phase = 'burst';
    phaseT = 0;
    solid.visible = false;
    accumulate = 0;
    settleT = 0;
    snapFlash = 0;
    world.numSolverIterations = 8;
  },
  update(dt, t, pointer, _camera, hover = 0) {
    if (pointer) {
      pointerLocal.copy(pointer);
      group.worldToLocal(pointerLocal);
    }
    hoverAmt += (clamp01(hover) - hoverAmt) * Math.min(1, dt * 6.0);

    /* ---- 静止：碎片悬停在各自的静止变换上，纯视觉 ---- */
    if (phase === 'rest') {
      const swell = hoverAmt * 0.030;
      for (const pc of pieces) {
        const breathe = 0.0013 + Math.sin(t * 0.85 + pc.wave * 24) * 0.001;
        const push = breathe + swell;
        pc.mesh.position.set(
          pc.restPos.x + pc.dir.x * push,
          pc.restPos.y + pc.dir.y * push,
          pc.restPos.z + pc.dir.z * push,
        );
        pc.mesh.quaternion.copy(pc.restQuat);
        pc.mesh.position.y += Math.sin(t * 0.62 + pc.restPos.y * 3.1) * 0.0012;
      }
      if (pointer) {
        for (const pc of pieces) {
          toP.set(pointerLocal.x - pc.restPos.x, pointerLocal.y - pc.restPos.y, pointerLocal.z - pc.restPos.z);
          const d = toP.length();
          if (d < 1e-4) continue;
          const w = 1 / (1 + d * d * 26);
          pc.mesh.position.addScaledVector(toP.normalize(), 0.026 * w);
        }
      }
      // 悬停预兆：整块轻微鼓胀 + 棱光提亮（碎片此刻是隐藏的，预兆只能由整块表达）
      solid.scale.setScalar(1 + hoverAmt * 0.012);
      fresUniform.value.setRGB(0.15 + hoverAmt * 0.16, 0.19 + hoverAmt * 0.21, 0.27 + hoverAmt * 0.30);
      core.scale.setScalar(1 + Math.sin(t * 2.4) * 0.1);
      coreLight.intensity = 0.16 + Math.sin(t * 2.4) * 0.04 + hoverAmt * 0.55;
      ringAnim(dt);
      for (const r of rings) {
        r.holder.scale.multiplyScalar(1 + Math.sin(t * 0.9) * 0.003 - hoverAmt * 0.008);
        r.holder.position.y = r.baseY;
      }
      return;
    }

    phaseT += dt;
    // 三段式：爆开 → 悬停（碎片在空中几乎失速、缓缓漂移，这一刻才看得清解理面）
    // → 磁吸归位（几乎瞬时的收拢，末端"啪"地吸住）
    if (phase === 'burst' && phaseT > BURST_TIME) {
      phase = 'drift';
      phaseT = 0;
    }
    if (phase === 'drift' && phaseT > DRIFT_TIME) {
      phase = 'gather';
      phaseT = 0;
      settleT = 0;
      // 吸附阶段关闭碎片之间的碰撞：它们各自飞回自己的 home，不需要互相推挤。
      // 保留碰撞会让先到的碎片把后来的挡住，卡在离原位几厘米处永远归不了位。
      for (const pc of pieces) {
        pc.body.enableCcd(false);
        pc.collider.setCollisionGroups(GROUPS_NONE);
      }
    }

    accumulate = Math.min(accumulate + Math.min(dt, 0.05), 0.10);
    let sub = 0;
    while (accumulate >= FIXED && sub < 3) {
      stepPhysics(FIXED);
      accumulate -= FIXED;
      sub++;
    }
    if (sub === 3) accumulate = 0;

    /* ---- 约束场解除：环向外张开并淡出，碎片可以自由穿过它的位置 ---- */
    ringAnim(dt);
    for (const r of rings) {
      r.holder.position.y = r.baseY;
    }
    /* ---- 兜底：极端情况下最多吸 3.2 秒 ---- */
    if (phase === 'gather' && phaseT > 4.6) freezeClump(false);

    snapFlash = Math.max(0, snapFlash - dt * 3.0);
    core.scale.setScalar(1 + Math.sin(t * 2.4) * 0.1 + Math.min(1.2, snapFlash * 0.8));
    coreLight.intensity = 0.16 + Math.sin(t * 2.4) * 0.04 + fieldOut * 0.9 + snapFlash * 0.7;
  },
};
}
