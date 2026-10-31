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
}

export interface Specimen {
  group: THREE.Group;
  /** 静止态整块晶体（碎片隐藏时显示） */
  solid: THREE.Mesh;
  pieces: SpecimenPiece[];
  rings: Array<{ holder: THREE.Object3D; axis: THREE.Vector3; speed: number }>;
  core: THREE.Object3D;
  /** 全部碎片是否已精确归位（供测试与交互判断） */
  readonly settled: boolean;
  /** 当前阶段：rest / scatter / pull */
  readonly phase: string;
  /** 物理世界（仅供测试探针） */
  readonly world: RAPIER.World;
  /** 已归位的片数 */
  readonly snappedCount: number;
  update(dt: number, t: number, pointer: THREE.Vector3 | null, camera: THREE.Camera): void;
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
  quartzMat.color = new THREE.Color(0.760, 0.735, 0.685);
  quartzMat.emissive = new THREE.Color(0.010, 0.008, 0.006);
  quartzMat.ior = 1.52;
  quartzMat.roughness = 0.300;
  quartzMat.metalness = 0.0;
  quartzMat.iridescence = 0.16;
  quartzMat.iridescenceIOR = 1.36;
  quartzMat.envMap = stoneEnv;
  quartzMat.envMapIntensity = 0.85;
  quartzMat.flatShading = true;
  quartzMat.clearcoat = 0.65;
  quartzMat.clearcoatRoughness = 0.16;
  quartzMat.transparent = false;
  quartzMat.opacity = 1.0;
  quartzMat.specularIntensity = 1.0;
  quartzMat.polygonOffset = true;
  quartzMat.polygonOffsetFactor = 1.4;
  quartzMat.polygonOffsetUnits = 1.4;

  // 菲涅耳棱光：掠射角把棱提亮一点点，读作"透明晶体的边"，而不是靠额外的壳层几何
  const fresUniform = { value: new THREE.Color(0.30, 0.36, 0.46) };
  const quartzBaseCompile = quartzMat.onBeforeCompile;
  quartzMat.onBeforeCompile = (shader, renderer) => {
    quartzBaseCompile?.call(quartzMat, shader, renderer);
    shader.uniforms.uFres = fresUniform;
    shader.fragmentShader = 'uniform vec3 uFres;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
      float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.2);
      gl_FragColor.rgb += uFres * fres;`,
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
  const solidUniforms = {
    uPoint: { value: new THREE.Vector3(0, 0, 0) },
    uPull: { value: 0 },
  };
  const solidMat = stoneMaterial(quartzMat, 4.7);
  const solidStone = solidMat.onBeforeCompile;
  solidMat.onBeforeCompile = (shader: any, renderer: any) => {
    solidStone?.call(solidMat, shader, renderer);
    shader.uniforms.uPoint = solidUniforms.uPoint;
    shader.uniforms.uPull = solidUniforms.uPull;
    shader.vertexShader =
      'uniform vec3 uPoint;\nuniform float uPull;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float cvD = distance(transformed, uPoint);
        float cvW = exp(-cvD * cvD * 3.4);
        vec3 cvDir = uPoint - transformed;
        float cvL = max(length(cvDir), 0.001);
        transformed += (cvDir / cvL) * (cvW * uPull);`,
      );
  };
  const solid = new THREE.Mesh(prismSolidGeometry(), solidMat);
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
    const emberMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.30, 0.045, 0.020), toneMapped: false });
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
    const geo = facesToGeometry(localFaces, new THREE.Vector3());
    // 朝自身中心收 0.4%：静止态留一道发丝缝，读作"被解理线切开"，不是"拼装"
    geo.scale(0.9982, 0.9982, 0.9982);
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
          .setLinearDamping(1.35)
          .setAngularDamping(3.4)
          .setCanSleep(false),
      );
      const hullVerts = new Float32Array(geo.attributes.position.array);
      const desc = RAPIER.ColliderDesc.convexHull(hullVerts) ?? RAPIER.ColliderDesc.ball(0.06);
      desc.setRestitution(0.18).setFriction(0.55).setDensity(0);
      const collider = world.createCollider(desc, body);
      body.setAdditionalMass(1.0, true);
      // 注意：body.mass() 在首次 world.step() 之前读到 0（Rapier 延迟更新质量属性），
      // 因此这里按刻意设置的 additionalMass = 1.0 记质量，冲量换算才有意义。
      const mass = 1.0;

      const dir = home.clone();
      dir.y *= 0.22;
      if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
      dir.normalize();
      // 中段先吸、两端后吸：磁吸波从晶体的腰部长出来
      const wave = Math.min(0.62, (Math.abs(home.y) / 1.55) * 0.44 + rand() * 0.10);
      pieces.push({
        mesh, body, collider, home, dir, wave, mass,
        snapped: true, captured: false, captureT: 0,
        from: new THREE.Vector3(), fromQ: new THREE.Quaternion(),
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
  const rings: Specimen['rings'] = [];
  const ringSpecs = [
    { r: 0.790, tube: 0.0095, y: 0.30, axis: new THREE.Vector3(0.03, 1, 0.015).normalize(), speed: 0.070 },
    { r: 0.680, tube: 0.0072, y: -0.34, axis: new THREE.Vector3(0.62, 1, 0.34).normalize(), speed: -0.105 },
  ];

  for (const spec of ringSpecs) {
    const holder = new THREE.Group();
    const torus = new THREE.Mesh(new THREE.TorusGeometry(spec.r, spec.tube, 12, 128), brassMat);
    torus.castShadow = true;
    holder.add(torus);

    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const boss = new THREE.Mesh(
        new THREE.CylinderGeometry(spec.tube * 1.8, spec.tube * 1.8, spec.tube * 2.2, 6),
        brassMat,
      );
      boss.position.set(Math.cos(a) * spec.r, Math.sin(a) * spec.r, 0);
      boss.rotation.z = a;
      boss.castShadow = true;
      holder.add(boss);
    }

    holder.position.y = spec.y;
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), spec.axis);
    group.add(holder);
    rings.push({ holder, axis: spec.axis, speed: spec.speed });
  }

  /* ------------------------------------------------------------- behaviour */
  // 三段式：①真实弹飞（物理、互碰、CCD）②磁场吸附（弹簧，F ∝ 1/d²，碎片互不碰撞）
  // ③运动学精准归位（代码驱动到 home，严丝合缝）。归位后刚体转 Fixed，物理完全停摆。
  type Phase = 'rest' | 'scatter' | 'pull';
  let phase: Phase = 'rest';
  let phaseT = 0;
  let settled = true;
  let snapFlash = 0;
  let accumulate = 0;
  const FIXED = 1 / 60;
  const SCATTER_TIME = 0.42;
  const CAPTURE_TIME = 0.17;
  const GROUPS_TOUCHING = (1 << 16) | 1;
  const GROUPS_NONE = 0;
  const IDENTITY = new THREE.Quaternion();

  const force = new THREE.Vector3();
  const local = new THREE.Vector3();
  const toP = new THREE.Vector3();
  const pointerLocal = new THREE.Vector3();
  const homeDelta = new THREE.Vector3();
  const qPiece = new THREE.Quaternion();
  const qErr = new THREE.Quaternion();
  const spinAxis = new THREE.Vector3();

  const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smoothstep = (x: number) => x * x * (3 - 2 * x);

  const pinPiece = (p: SpecimenPiece) => {
    p.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    p.body.setTranslation({ x: p.home.x, y: p.home.y, z: p.home.z }, true);
    p.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    p.collider.setCollisionGroups(GROUPS_NONE);
    p.mesh.position.copy(p.home);
    p.mesh.quaternion.identity();
    p.captured = false;
    p.snapped = true;
  };

  const beginCapture = (p: SpecimenPiece) => {
    p.captured = true;
    p.captureT = 0;
    p.from.copy(p.mesh.position);
    p.fromQ.copy(p.mesh.quaternion);
    p.collider.setCollisionGroups(GROUPS_NONE);
    p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  };

  const syncPiece = (p: SpecimenPiece) => {
    const tr = p.body.translation();
    const rot = p.body.rotation();
    if (!Number.isFinite(tr.x + tr.y + tr.z) || !Number.isFinite(rot.w)) return;
    p.mesh.position.set(tr.x, tr.y, tr.z);
    p.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  };

  const stepPhysics = (h: number) => {
    const pulling = phase === 'pull';
    for (const p of pieces) {
      if (p.snapped || p.captured) continue;
      const body = p.body;
      const pos = body.translation();
      const v = body.linvel();

      if (pulling) {
        homeDelta.set(p.home.x - pos.x, p.home.y - pos.y, p.home.z - pos.z);
        const d = homeDelta.length();
        // 磁场：远处几乎不拉、近处指数暴涨，读作"啪"地吸住而不是均匀弹簧
        const ramp = clamp01((phaseT - p.wave) / 0.30);
        const k = (6.0 + 2.6 / (d * d + 0.0042)) * ramp;
        const damp = 2.05 * Math.sqrt(k + 0.5) * 0.92;
        force.copy(homeDelta).multiplyScalar(k).addScaledVector(v, -damp);
        const fm = force.length();
        if (fm > 190) force.multiplyScalar(190 / fm);
        const mm = p.mass;
        body.applyImpulse({ x: force.x * h * mm, y: force.y * h * mm, z: force.z * h * mm }, true);

        // 磁矩：让碎片在飞回来的路上自己转正，归位瞬间不留残余倾角
        qPiece.set(body.rotation().x, body.rotation().y, body.rotation().z, body.rotation().w).normalize();
        qErr.copy(qPiece).conjugate();
        spinAxis.set(qErr.x, qErr.y, qErr.z);
        if (qErr.w < 0) spinAxis.negate();
        const angle = 2 * Math.acos(Math.min(1, Math.abs(qErr.w)));
        if (spinAxis.lengthSq() > 1e-8 && angle > 0.03) {
          spinAxis.normalize();
          const spin = Math.min(angle * 13, 28) * ramp;
          body.setAngvel({ x: spinAxis.x * spin, y: spinAxis.y * spin, z: spinAxis.z * spin }, true);
        } else {
          body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }

        if (d < 0.15 && ramp > 0.5) beginCapture(p);
      } else {
        // 飞散期只加一点空气阻力，剩下的交给刚体与碰撞
        body.applyImpulse({ x: -v.x * 0.55 * h * p.mass, y: -v.y * 0.55 * h * p.mass, z: -v.z * 0.55 * h * p.mass }, true);
      }
    }

    world.timestep = h;
    world.step();

    let pending = 0;
    for (const p of pieces) {
      if (p.snapped) continue;
      if (p.captured) {
        p.captureT += h;
        const u = Math.min(1, p.captureT / CAPTURE_TIME);
        const e = 1 - Math.pow(1 - u, 5);
        p.mesh.position.lerpVectors(p.from, p.home, e);
        p.mesh.quaternion.slerpQuaternions(p.fromQ, IDENTITY, clamp01(u * 1.5));
        p.body.setTranslation(p.mesh.position, true);
        p.body.setRotation(p.mesh.quaternion, true);
        if (u >= 1) {
          pinPiece(p);
          snapFlash += 1;
        } else {
          pending++;
        }
        continue;
      }
      syncPiece(p);
      pending++;
    }

    if (pending === 0) {
      phase = 'rest';
      settled = true;
    }
  };

  return {
    group,
    solid,
    pieces,
    rings,
    core,
    world,
    get settled() {
      return settled;
    },
    get phase() {
      return phase;
    },
    get snappedCount() {
      let n = 0;
      for (const p of pieces) if (p.snapped) n++;
      return n;
    },
    burst(strength = 1) {
      solidUniforms.uPull.value = 0;
      const fromRest = phase === 'rest';
      for (const p of pieces) {
        const body = p.body;
        p.captured = false;
        p.snapped = false;
        p.collider.setCollisionGroups(GROUPS_TOUCHING);
        body.enableCcd(true);
        if (fromRest) {
          body.setTranslation({ x: p.home.x, y: p.home.y, z: p.home.z }, true);
          body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
          body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          p.mesh.position.copy(p.home);
          p.mesh.quaternion.identity();
        }
        // 直接赋初速（m/s）：刚体刚创建时 mass 尚未生效，applyImpulse 会被静默丢弃
        const sp = (1.15 + Math.random() * 0.55) * strength;
        body.setLinvel(
          {
            x: p.dir.x * sp - p.dir.z * 0.18 + (Math.random() - 0.5) * 0.50,
            y: p.dir.y * sp + (p.home.y > 0 ? 0.24 : -0.24) + (Math.random() - 0.5) * 0.42,
            z: p.dir.z * sp + p.dir.x * 0.18 + (Math.random() - 0.5) * 0.50,
          },
          true,
        );
        body.setAngvel(
          {
            x: (Math.random() - 0.5) * 1.35,
            y: (Math.random() - 0.5) * 1.35,
            z: (Math.random() - 0.5) * 1.35,
          },
          true,
        );
      }
      phase = 'scatter';
      phaseT = 0;
      accumulate = 0;
      settled = false;
      snapFlash = 0;
    },
    update(dt, t, pointer, _camera) {
      if (pointer) {
        pointerLocal.copy(pointer);
        group.worldToLocal(pointerLocal);
      }

      /* ---- 静置：纯视觉，不跑物理 ---- */
      if (phase === 'rest') {
        for (const p of pieces) {
          const breathe = 0.0014 + Math.sin(t * 0.9 + p.wave * 26) * 0.0012;
          p.mesh.position.set(p.home.x + p.dir.x * breathe, p.home.y + p.dir.y * breathe, p.home.z + p.dir.z * breathe);
          p.mesh.quaternion.identity();
        }
        if (pointer) {
          for (const p of pieces) {
            toP.set(pointerLocal.x - p.home.x, pointerLocal.y - p.home.y, pointerLocal.z - p.home.z);
            const d = toP.length();
            if (d < 1e-4) continue;
            const w = 1 / (1 + d * d * 26);
            p.mesh.position.addScaledVector(toP.normalize(), 0.026 * w);
          }
        }
        for (const p of pieces) {
          p.mesh.position.y += Math.sin(t * 0.62 + p.home.y * 3.1) * 0.0012;
        }
        core.scale.setScalar(1 + Math.sin(t * 2.4) * 0.1);
        coreLight.intensity = 0.16 + Math.sin(t * 2.4) * 0.04;
        const ringScale = 1 + Math.sin(t * 0.9) * 0.004;
        for (const r of rings) r.holder.scale.setScalar(ringScale);
        return;
      }

      phaseT += dt;
      if (phase === 'scatter' && phaseT > SCATTER_TIME) {
        phase = 'pull';
        phaseT = 0;
        for (const p of pieces) {
          if (p.snapped || p.captured) continue;
          p.collider.setCollisionGroups(GROUPS_NONE);
          p.body.enableCcd(false);
        }
      }

      accumulate = Math.min(accumulate + Math.min(dt, 0.05), 0.10);
      let sub = 0;
      while (accumulate >= FIXED && sub < 3) {
        stepPhysics(FIXED);
        accumulate -= FIXED;
        sub++;
        if (settled) break;
      }
      if (sub === 3) accumulate = 0;

      // 吸附期的"磁场感"：环收紧一点、内核随归位片数闪一下
      const pullPhase = phase === 'pull' ? clamp01(phaseT / 2.0) : 0;
      const ringScale = 1 + 0.035 * Math.sin(Math.PI * pullPhase) + (phase === 'scatter' ? 0.05 * clamp01(phaseT / SCATTER_TIME) : 0);
      for (const r of rings) r.holder.scale.setScalar(ringScale);

      snapFlash = Math.max(0, snapFlash - dt * 6.0);
      core.scale.setScalar(1 + Math.sin(t * 2.4) * 0.1 + Math.min(1.4, snapFlash * 0.06));
      coreLight.intensity = 0.16 + Math.sin(t * 2.4) * 0.04 + Math.min(2.4, snapFlash * 0.22);
    },
  };
}
