import * as THREE from 'three';

/**
 * Volumetric dust. Points are lit analytically: their brightness is derived from
 * proximity to the shaft family, so motes ignite as they drift into the light.
 */
export function buildDust(params: {
  count: number;
  bounds: { x: number; y: number; z: number; z0: number };
  beamDir: THREE.Vector3;
  beamOffsets: number[];
  originY: number;
  originZ: number;
  color: THREE.Color;
}): { points: THREE.Points; update: (t: number, camPos: THREE.Vector3) => void } {
  const { count, bounds, beamDir, beamOffsets, originY, originZ, color } = params;

  const z0 = bounds.z0 ?? 0;
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * bounds.x * 2;
    pos[i * 3 + 1] = Math.random() * bounds.y;
    pos[i * 3 + 2] = z0 + Math.random() * bounds.z;
    seed[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color.clone() },
      uSize: { value: 3.1 },
      uPixelRatio: { value: 1 },
      uDir: { value: beamDir.clone().normalize() },
      uOffsets: { value: beamOffsets },
      uOriginY: { value: originY },
      uOriginZ: { value: originZ },
      uCam: { value: new THREE.Vector3() },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uSize;
      uniform float uPixelRatio;
      uniform vec3  uDir;
      uniform float uOffsets[22];
      uniform float uOriginY;
      uniform float uOriginZ;
      varying float vGlow;

      void main(){
        vec3 p = position;
        float s = aSeed;
        // slow curving drift
        p.x += sin(uTime * 0.16 + s * 31.0) * 0.55;
        p.y += sin(uTime * 0.11 + s * 17.0) * 0.42 + sin(uTime*0.05 + s*7.0)*0.2;
        p.z += cos(uTime * 0.13 + s * 23.0) * 0.5;

        // slab coordinate perpendicular to the light (stacked beams)
        vec3 up = normalize(cross(uDir, vec3(1.0, 0.0, 0.0)));
        float u = dot(p, up);

        float glow = 0.0;
        for (int i = 0; i < 22; i++) {
          float ref = uOffsets[i] * up.y + uOriginZ * up.z;
          float d = abs(u - ref);
          glow += exp(-d * d * 34.0);
        }
        // only inside the room volume matters
        glow *= smoothstep(uOriginZ - 0.4, uOriginZ + 2.4, p.z);
        vGlow = clamp(glow, 0.0, 1.4) * (0.35 + 0.65 * s);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = uSize * (0.35 + s * 0.9);
        gl_PointSize = size * uPixelRatio * (3.2 / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uColor;
      varying float vGlow;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = dot(c, c);
        float a = smoothstep(0.25, 0.0, d);
        if (a <= 0.001) discard;
        gl_FragColor = vec4(uColor * vGlow * a, a * vGlow);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 6;

  const update = (t: number, camPos: THREE.Vector3) => {
    material.uniforms.uTime.value = t;
    material.uniforms.uCam.value.copy(camPos);
  };

  return { points, update };
}