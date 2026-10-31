import * as THREE from 'three';

export interface BeamField {
  group: THREE.Group;
  /** unit vector along which light travels */
  dir: THREE.Vector3;
  /** offsets of each beam along the perpendicular axis */
  offsets: number[];
  perp: THREE.Vector3;
  material: THREE.ShaderMaterial;
  update: (t: number) => void;
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.x *= 1.0 + uv.y * 0.55;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorld;

  uniform float uTime;
  uniform vec3  uColor;
  uniform float uIntensity;
  uniform vec3  uCam;
  uniform float uFloorY;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
  }

  void main(){
    float across = pow(clamp(sin(3.14159265 * clamp(vUv.x, 0.0, 1.0)), 0.0, 1.0), 2.15);
    float head = smoothstep(0.0, 0.22, vUv.y);
    // shafts thin out with distance instead of running as glowing tubes
    float tail = exp(-vUv.y * 3.4);
    float n = noise(vec2(vUv.x * 3.0 + uTime * 0.03, vUv.y * 5.0 - uTime * 0.06));
    n = 0.55 + 0.85 * n;
    float a = across * head * tail * n;

    // the shaft dies where it meets the floor
    a *= smoothstep(uFloorY - 0.10, uFloorY + 0.65, vWorld.y);

    // fade anything that gets close to the lens so shafts never clip the camera
    float d = distance(vWorld, uCam);
    a *= smoothstep(1.6, 6.5, d);

    if (!(a > 0.0)) discard;
    gl_FragColor = vec4(uColor * uIntensity * a, a);
  }
`;

/**
 * Builds the light shafts that fall through the slatted aperture.
 * Each gap produces a slab built from two crossed quads aligned with the light.
 */
export function buildBeams(params: {
  apertureX: number;
  apertureZ: number;
  apertureY0: number;
  apertureY1: number;
  apertureW: number;
  gaps: number;
  slatDepth: number;
  slatTiltDeg: number;
  sunDir: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
  length: number;
}): BeamField {
  const { apertureX, apertureZ, apertureY0, apertureY1, apertureW, gaps, slatDepth, slatTiltDeg, sunDir, color, intensity, length } = params;

  const group = new THREE.Group();
  group.name = 'beams';

  const dir = sunDir.clone().normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize();

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color.clone() },
      uIntensity: { value: intensity },
      uFloorY: { value: 0 },
      uCam: { value: new THREE.Vector3() },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const spacing = (apertureY1 - apertureY0) / gaps;
  const blockH = Math.abs(slatDepth * Math.sin(THREE.MathUtils.degToRad(slatTiltDeg))) + 0.075 * Math.cos(THREE.MathUtils.degToRad(slatTiltDeg));
  const gapH = Math.max(0.06, spacing - blockH);

  const offsets: number[] = [];
  for (let i = 0; i < gaps; i++) {
    const y = apertureY0 + spacing * (i + 0.5);
    const origin = new THREE.Vector3(apertureX, y, apertureZ);
    offsets.push(y);

    const g = new THREE.Group();
    g.position.copy(origin);
    // align local +Y with the light direction
    g.quaternion.setFromUnitVectors(up, dir);

    for (let k = 0; k < 2; k++) {
      const geo = new THREE.PlaneGeometry(gapH * 0.92, length, 1, 1);
      geo.translate(0, length / 2, 0);
      const m = new THREE.Mesh(geo, material);
      m.rotation.y = (k * Math.PI) / 2;
      m.frustumCulled = false;
      m.renderOrder = 5;
      g.add(m);
    }
    group.add(g);
  }

  const update = (t: number) => {
    material.uniforms.uTime.value = t;
  };

  return { group, dir, offsets, perp, material, update };
}