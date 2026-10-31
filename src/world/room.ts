import * as THREE from 'three';
import type { VaultMaterials } from './materials';

export const ROOM = {
  W: 12,
  H: 7.4,
  BACK_Z: -15,
  FRONT_Z: 6,
  APERTURE_X: 2.8,
  APERTURE_W: 4.8,
  APERTURE_Y0: 0.8,
  APERTURE_Y1: 6.4,
  SLATS: 11,
  SLAT_DEPTH: 0.42,
  SLAT_TILT: 42,
};

/** Scale box UVs so a texture of `unit` metres tiles without stretching. */
export function scaleBoxUV(geo: THREE.BoxGeometry, w: number, h: number, d: number, unit = 2.2) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const arr = uv.array as Float32Array;
  const sizes: [number, number][] = [
    [d / unit, h / unit], [d / unit, h / unit],
    [w / unit, d / unit], [w / unit, d / unit],
    [w / unit, h / unit], [w / unit, h / unit],
  ];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = (f * 4 + v) * 2;
      arr[i] *= sizes[f][0];
      arr[i + 1] *= sizes[f][1];
    }
  }
  uv.needsUpdate = true;
}

export function box(w: number, h: number, d: number, mat: THREE.Material, opts: { unit?: number; pos?: [number, number, number]; rot?: [number, number, number] } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  scaleBoxUV(geo, w, h, d, opts.unit ?? 2.2);
  const m = new THREE.Mesh(geo, mat);
  if (opts.pos) m.position.set(...opts.pos);
  if (opts.rot) m.rotation.set(...opts.rot);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export interface RoomBuild {
  group: THREE.Group;
  strips: THREE.Mesh[];
  slats: THREE.Mesh[];
  apertureCenter: THREE.Vector3;
}

const skyVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const skyFrag = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  void main(){
    // 天空面比窗口大很多，衰减必须按「窗口尺度」算，否则整块窗是一片死平的灰白
    vec2 p = vUv - vec2(0.52, 0.58);
    float r = length(p * vec2(1.15, 0.90)) * 7.0;
    float core = exp(-r * r * 0.75);
    float horizon = exp(-pow((vUv.y - 0.30) / 0.10, 2.0));
    float veil = smoothstep(1.25, 0.0, r);
    float g = core + horizon * 0.24 + veil * 0.18;

    vec3 warm = vec3(1.0, 0.78, 0.52);
    vec3 cool = vec3(0.22, 0.30, 0.48);
    vec3 col = mix(cool, warm, clamp(core * 1.30 + veil * 0.45, 0.0, 1.0));
    col *= 0.05 + g * 0.62;
    // faint drifting veils so the glare is not a flat plate
    float band = sin(vUv.y * 9.0 + uTime * 0.25 + sin(vUv.x * 5.0) * 0.6);
    col *= 1.0 + band * 0.05;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function buildRoom(M: VaultMaterials): RoomBuild {
  const g = new THREE.Group();
  g.name = 'vault';
  const { W, H, BACK_Z, FRONT_Z, APERTURE_W: AW, APERTURE_Y0: AY0, APERTURE_Y1: AY1 } = ROOM;
  const D = FRONT_Z - BACK_Z;
  const cz = (FRONT_Z + BACK_Z) / 2;

  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D, 1, 1), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = cz;
  floor.receiveShadow = true;
  g.add(floor);

  // ceiling slab + coffer beams
  g.add(box(W + 2, 1.1, D, M.ceiling, { pos: [0, H + 0.55, cz] }));
  for (let i = -3; i <= 3; i++) {
    g.add(box(0.5, 0.62, D, M.ceiling, { pos: [i * 1.62, H - 0.31, cz] }));
  }

  // side walls: poured panels with reveals
  for (const side of [-1, 1]) {
    const n = 8;
    const seg = D / n;
    for (let i = 0; i < n; i++) {
      const z = BACK_Z + seg * (i + 0.5);
      g.add(box(0.5, H, seg - 0.055, M.wall, { pos: [side * (W / 2 + 0.25), H / 2, z], unit: 3.4 }));
    }
    // low skirting
    g.add(box(0.62, 0.28, D, M.wallDark, { pos: [side * (W / 2 + 0.19), 0.14, cz], unit: 2 }));
  }

  // back wall with slatted aperture (offset to the right, leaving a dark field)
  const AX = ROOM.APERTURE_X;
  const leftW = (AX - AW / 2) - (-W / 2 - 0.25);
  const rightW = (W / 2 + 0.25) - (AX + AW / 2);
  g.add(box(leftW, H, 0.8, M.wall, { pos: [-W / 2 - 0.25 + leftW / 2, H / 2, BACK_Z - 0.4], unit: 3.4 }));
  g.add(box(rightW, H, 0.8, M.wall, { pos: [W / 2 + 0.25 - rightW / 2, H / 2, BACK_Z - 0.4], unit: 3.4 }));
  g.add(box(AW, H - AY1, 0.8, M.wall, { pos: [AX, (H + AY1) / 2, BACK_Z - 0.4], unit: 3.4 }));
  g.add(box(AW, AY0, 0.8, M.wall, { pos: [AX, AY0 / 2, BACK_Z - 0.4], unit: 3.4 }));

  // slats
  const slats: THREE.Mesh[] = [];
  for (let i = 0; i < ROOM.SLATS; i++) {
    const t = (i + 0.5) / ROOM.SLATS;
    const y = AY0 + t * (AY1 - AY0);
    const s = box(AW - 0.04, 0.085, ROOM.SLAT_DEPTH, M.steel, {
      pos: [AX, y, BACK_Z],
      rot: [THREE.MathUtils.degToRad(ROOM.SLAT_TILT), 0, 0],
      unit: 0.7,
    });
    slats.push(s);
    g.add(s);
  }

  // aperture frame
  g.add(box(AW + 0.36, 0.2, 0.28, M.steel, { pos: [AX, AY1 + 0.1, BACK_Z + 0.3], unit: 1 }));
  g.add(box(AW + 0.36, 0.2, 0.28, M.steel, { pos: [AX, AY0 - 0.1, BACK_Z + 0.3], unit: 1 }));
  for (const side of [-1, 1]) {
    g.add(box(0.2, AY1 - AY0 + 0.4, 0.28, M.steel, { pos: [AX + side * (AW / 2 + 0.16), (AY0 + AY1) / 2, BACK_Z + 0.3], unit: 1 }));
  }

  // sky behind the aperture
  const skyUniforms = { uTime: { value: 0 } };
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    uniforms: skyUniforms,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(26, 17), skyMat);
  sky.position.set(AX, 3.6, BACK_Z - 3.4);
  sky.castShadow = false;
  sky.receiveShadow = false;
  g.add(sky);

  // distant haze card to soften the aperture edges
  const hazeMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.0, 0.82, 0.62).multiplyScalar(0.16),
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(AW + 1.2, AY1 - AY0 + 1.0), hazeMat);
  haze.position.set(AX, (AY0 + AY1) / 2, BACK_Z - 0.9);
  haze.renderOrder = 2;
  g.add(haze);

  // recessed wall strips (cool, low intensity)
  const strips: THREE.Mesh[] = [];
  // 左墙顶部的冷光灯槽在低机位下会在画面左上角拉出一道悬空亮刃，已被去掉；只保留右墙下方一条。
  const dimCool = M.stripCool.clone();
  dimCool.emissiveIntensity = 0.42;

  // a matching low reveal on the right wall keeps the architecture legible
  const coveR = box(0.05, 0.045, 7.5, dimCool, { pos: [W / 2 - 0.02, 2.35, -4.0] });
  coveR.castShadow = false;
  coveR.receiveShadow = false;
  strips.push(coveR);
  g.add(coveR);

  // plinth
  g.add(box(2.2, 0.16, 2.2, M.wallDark, { pos: [3.2, 0.08, -12.6], unit: 2 }));
  g.add(box(1.55, 0.62, 1.55, M.plinth, { pos: [3.2, 0.47, -12.6], unit: 2 }));

  return { group: g, strips, slats, apertureCenter: new THREE.Vector3(0, (AY0 + AY1) / 2, BACK_Z) };
}