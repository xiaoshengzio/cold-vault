import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

await RAPIER.init();

/**
 * 《冷库》标本：一枚被封存的六棱晶体，已沿解理面崩解成楔块，正被磁场悬停托管。
 * 每块都是 Rapier 刚体，弹簧把它拉回解理位置；鼠标是引力源，点击是冲击波。
 */

const PROFILE: Array<[number, number]> = [
  [-1.55, 0.012],
  [-1.28, 0.112],
  [-1.00, 0.202],
  [-0.34, 0.256],
  [0.60, 0.250],
  [0.86, 0.196],
  [1.14, 0.108],
  [1.55, 0.014],
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
  home: THREE.Vector3;
  /** 外法线方向，展开时沿它滑开 */
  dir: THREE.Vector3;
  /** 错峰延迟（秒），按高度排 */
  wave: number;
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
  update(dt: number, t: number, pointer: THREE.Vector3 | null, camera: THREE.Camera): void;
  burst(strength?: number): void;
}

export function buildSpecimen(M: any, env: THREE.Texture): Specimen {
  const group = new THREE.Group();
  group.name = 'specimen';
  group.rotation.y = Math.PI / 6;

  const rand = rng(20261031);

  /* ------------------------------------------------------------ materials */
  const quartzMat = (M.glass as THREE.MeshPhysicalMaterial).clone();
  quartzMat.transmission = 0;
  quartzMat.color = new THREE.Color(0.760, 0.700, 0.615);
  quartzMat.emissive = new THREE.Color(0.010, 0.008, 0.006);
  quartzMat.ior = 1.52;
  quartzMat.roughness = 0.320;
  quartzMat.metalness = 0.0;
  quartzMat.iridescence = 0.10;
  quartzMat.iridescenceIOR = 1.36;
  quartzMat.envMap = env;
  quartzMat.envMapIntensity = 0.62;
  quartzMat.flatShading = true;
  quartzMat.clearcoat = 1.0;
  quartzMat.clearcoatRoughness = 0.22;
  quartzMat.transparent = false;
  quartzMat.opacity = 1.0;
  quartzMat.specularIntensity = 1.0;
  quartzMat.polygonOffset = true;
  quartzMat.polygonOffsetFactor = 1.4;
  quartzMat.polygonOffsetUnits = 1.4;

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

  const SECTORS = 6;
  const Y_BOT = -1.55;
  const Y_TOP = 1.55;
  const SAMPLES = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1];

  for (let k = 0; k < SECTORS; k++) {
    const b0 = (k / SECTORS) * Math.PI * 2;
    const b1 = b0 + (Math.PI * 2) / SECTORS;

    // 每个扇区的解理高度独立随机 → 打散砖缝的规律感
    const cuts: number[] = [Y_BOT];
    let y = Y_BOT;
    while (y < Y_TOP - 0.05) {
      y += 0.46 + rand() * 0.26;
      cuts.push(Math.min(Y_TOP, y));
    }
    cuts[cuts.length - 1] = Y_TOP;

    for (let i = 0; i < cuts.length - 1; i++) {
      const y0 = cuts[i] + 0.005;
      const y1 = cuts[i + 1] - 0.005;
      if (y1 - y0 < 0.08) continue;

      const pts: THREE.Vector3[] = [];
      for (const yy of [y0, y1]) {
        const R = radiusScaled(yy);
        if (R < 0.02) continue;
        pts.push(new THREE.Vector3(0, yy, 0));
        for (const u of SAMPLES) {
          const th = b0 + (b1 - b0) * u;
          const r = hexRadius(R, th);
          pts.push(new THREE.Vector3(Math.cos(th) * r, yy, Math.sin(th) * r));
        }
      }
      if (pts.length < 6) continue;

      const home = new THREE.Vector3();
      for (const p of pts) home.add(p);
      home.divideScalar(pts.length);

      const centred = pts.map((p) => p.clone().sub(home));
      const geo = hullGeometry(centred);
      // shrink a hair so the fractures read as open seams, not a solid block
      geo.scale(0.994, 0.998, 0.994);
      // and push each piece outward: the specimen hangs at the instant it broke
      const out = new THREE.Vector3(home.x, 0, home.z);
      if (out.lengthSq() < 1e-6) out.set(rand() - 0.5, 0, rand() - 0.5);
      out.normalize().multiplyScalar(0.010 + rand() * 0.026);
      home.add(out);
      home.y += (rand() - 0.5) * 0.009;
      if (geo.attributes.position.count < 12) continue;

      const heat = 0.30 + rand() * 0.95;
      const pMat = stoneMaterial(quartzMat, rand() * 11.0);
      pMat.emissive = new THREE.Color(0.012 * heat, 0.009 * heat, 0.007 * heat);
      const tone = 0.74 + heat * 0.40;
      pMat.color = new THREE.Color(0.760 * tone, 0.700 * tone, 0.615 * tone);
      pMat.roughness = 0.22 + rand() * 0.24;
      pMat.iridescence = 0.04 + rand() * 0.14;

      const mesh = new THREE.Mesh(geo, pMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.copy(home);
      mesh.visible = true;
      group.add(mesh);

      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(home.x, home.y, home.z)
          .setLinearDamping(2.4)
          .setAngularDamping(3.4)
          .setCanSleep(false),
      );
      const verts = new Float32Array(geo.attributes.position.array);
      const desc = RAPIER.ColliderDesc.convexHull(verts) ?? RAPIER.ColliderDesc.ball(0.08);
      desc.setRestitution(0.12).setFriction(0.9).setDensity(0);
      world.createCollider(desc, body);
      body.setAdditionalMass(1.0, true);

      const dir = home.clone();
      dir.y *= 0.22;
      if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
      dir.normalize();
      const wave = Math.max(0, Math.min(0.42, ((1.55 - home.y) / 3.1) * 0.42));
      pieces.push({ mesh, body, home, dir, wave });
    }
  }

  /* -------------------------------------------------------------- the core */
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.055, 1),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.42, 0.14), toneMapped: false }),
  );
  core.position.set(0, -0.06, 0);
  group.add(core);

  const coreLight = new THREE.PointLight(0xff5a1e, 0.9, 1.8, 2.0);
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
    { r: 0.86, tube: 0.034, axis: new THREE.Vector3(0.35, 1, 0.15).normalize(), speed: 0.16 },
    { r: 0.64, tube: 0.026, axis: new THREE.Vector3(-1, 0.25, 0.4).normalize(), speed: -0.24 },
  ];

  for (const spec of ringSpecs) {
    const holder = new THREE.Group();
    const torus = new THREE.Mesh(new THREE.TorusGeometry(spec.r, spec.tube, 12, 128), brassMat);
    torus.castShadow = true;
    holder.add(torus);

    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const boss = new THREE.Mesh(
        new THREE.CylinderGeometry(spec.tube * 2.1, spec.tube * 2.1, spec.tube * 2.8, 6),
        brassMat,
      );
      boss.position.set(Math.cos(a) * spec.r, Math.sin(a) * spec.r, 0);
      boss.rotation.z = a;
      boss.castShadow = true;
      holder.add(boss);
    }

    holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), spec.axis);
    group.add(holder);
    rings.push({ holder, axis: spec.axis, speed: spec.speed });
  }

  /* ------------------------------------------------------------- behaviour */
  // 点击不是"炸开"，而是沿解理面滑开成一张展开图：碎片按高度错峰外移，
  // 停一拍再原路合拢。没有翻滚和漂移，所以合得回原位，也不会读作积木。
  const BURST_END = 2.35;
  let burstT = -1; // -1 = 静置，>=0 = 正在展开
  let settleTimer = 0;
  let settled = true;
  const force = new THREE.Vector3();
  const local = new THREE.Vector3();
  const toP = new THREE.Vector3();
  const pointerLocal = new THREE.Vector3();
  const target = new THREE.Vector3();

  const smoothstep = (x: number) => x * x * (3 - 2 * x);
  const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

  return {
    group,
    solid,
    pieces,
    rings,
    core,
    get settled() {
      return settled;
    },
    burst(strength = 1) {
      // 整块消失、碎片接管：因为没有翻滚和漂移，这一下看上去就是"裂开"
      solidUniforms.uPull.value = 0;
      burstT = 0;
      settleTimer = 0;
      settled = false;
      for (const p of pieces) {
        // 起手给一点冲量，之后全交给弹簧：既有力道，又不会失去控制
        local.copy(p.dir).multiplyScalar(1.15 * strength);
        local.x += (Math.random() - 0.5) * 0.5;
        local.y += (Math.random() - 0.5) * 0.3;
        local.z += (Math.random() - 0.5) * 0.5;
        p.body.applyImpulse(local, true);
        p.body.applyTorqueImpulse(
          { x: (Math.random() - 0.5) * 0.01, y: (Math.random() - 0.5) * 0.01, z: (Math.random() - 0.5) * 0.01 },
          true,
        );
      }
    },
    update(dt, t, pointer, _camera) {
      const step = Math.min(dt, 1 / 45);
      if (burstT >= 0) {
        burstT += dt;
        if (burstT > BURST_END) burstT = -1;
      }
      const bursting = burstT >= 0;
      const attract = bursting ? 0 : 1;

      if (pointer) {
        pointerLocal.copy(pointer);
        group.worldToLocal(pointerLocal);
      }

      for (const p of pieces) {
        const body = p.body;
        const pos = body.translation();
        const hy = p.home.y + Math.sin(t * 0.7 + p.home.y * 3.1) * 0.008;

        // 展开包络 0 → 1 → 0，按高度错峰，读作一道自上而下的解理波
        let env = 0;
        if (bursting) {
          const rise = clamp01((burstT - p.wave) / 0.55);
          const fall = clamp01((BURST_END - burstT) / 0.8);
          env = smoothstep(Math.min(rise, fall));
        }

        target.set(
          p.home.x + p.dir.x * 0.24 * env,
          hy + p.dir.y * 0.24 * env,
          p.home.z + p.dir.z * 0.24 * env,
        );

        const k = bursting ? 46 : 42;
        const damp = bursting ? 6.4 : attract > 0 ? 4.2 : 1.8;
        force.set(target.x - pos.x, target.y - pos.y, target.z - pos.z).multiplyScalar(k);
        const v = body.linvel();
        force.x -= v.x * damp;
        force.y -= v.y * damp;
        force.z -= v.z * damp;

        if (pointer && attract > 0) {
          toP.set(pointerLocal.x - pos.x, pointerLocal.y - pos.y, pointerLocal.z - pos.z);
          const d = toP.length();
          const w = 1 / (1 + d * d * 5.0);
          toP.multiplyScalar((1.8 * w * attract) / Math.max(d, 0.08));
          force.add(toP);
        }

        if (Number.isFinite(force.x + force.y + force.z)) {
          body.applyImpulse({ x: force.x * step, y: force.y * step, z: force.z * step }, true);
        }
      }

      world.timestep = step;
      world.step();

      for (const p of pieces) {
        const tr = p.body.translation();
        const rot = p.body.rotation();
        if (Number.isFinite(tr.x + tr.y + tr.z) && Number.isFinite(rot.w)) {
          p.mesh.position.set(tr.x, tr.y, tr.z);
          p.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        }
      }

      // 归位：全部碎片安静地贴回 home 后，直接对齐到精确位置
      if (!bursting && !settled) {
        let maxOff = 0;
        for (const p of pieces) {
          const tr = p.body.translation();
          maxOff = Math.max(maxOff, Math.hypot(tr.x - p.home.x, tr.y - p.home.y, tr.z - p.home.z));
        }
        if (maxOff < 0.075) {
          settleTimer += dt;
          if (settleTimer > 0.16) {
            for (const p of pieces) {
              p.body.setTranslation({ x: p.home.x, y: p.home.y, z: p.home.z }, true);
              p.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
              p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
              p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
              p.mesh.position.copy(p.home);
              p.mesh.quaternion.identity();
            }
            settled = true;
          }
        } else {
          settleTimer = 0;
        }
      }

      core.scale.setScalar(1 + Math.sin(t * 2.4) * 0.1 + (bursting ? 0.35 : 0));
      coreLight.intensity = 0.9 + Math.sin(t * 2.4) * 0.2 + (bursting ? 2.0 : 0);
    },
  };
}
