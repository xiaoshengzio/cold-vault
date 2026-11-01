import * as THREE from 'three';
import type { VaultMaterials } from './materials';

const portalVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const portalFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uEnergy;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 p = vUv - 0.5;
    float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(0.0, 0.16, 1.0 - vUv.x);
    edge *= smoothstep(0.0, 0.12, vUv.y) * smoothstep(0.0, 0.12, 1.0 - vUv.y);
    float aura = exp(-dot(p * vec2(2.0, 1.2), p * vec2(2.0, 1.2)) * 7.0);
    float horizon = exp(-abs(p.y + 0.18) * 8.0) * exp(-abs(p.x) * 4.0);
    float slit = exp(-abs(p.x) * 290.0) * smoothstep(0.50, 0.05, abs(p.y));
    float veil = sin(p.y * 19.0 + uTime * 0.10 + sin(p.x * 8.0)) * 0.5 + 0.5;
    float grain = hash(floor(vUv * vec2(620.0, 840.0)) + floor(uTime * 2.0)) - 0.5;

    vec3 color = vec3(0.003, 0.006, 0.012);
    color += vec3(0.022, 0.052, 0.092) * aura * (0.72 + veil * 0.28);
    color += vec3(0.016, 0.027, 0.045) * horizon;
    color += vec3(0.40, 0.67, 0.92) * slit * (0.52 + uEnergy * 0.75);
    color += grain * 0.004;
    color *= 0.35 + edge * 0.65;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface CryoChamber {
  group: THREE.Group;
  update: (time: number, dt: number, energy?: number) => void;
}

export function buildChamber(M: VaultMaterials): CryoChamber {
  const group = new THREE.Group();
  group.name = 'cryo-chamber';
  group.position.set(-0.34, 2.47, -4.10);

  const darkMetal = (M.steel as THREE.MeshStandardMaterial).clone();
  darkMetal.color.set(0x080b10);
  darkMetal.roughness = 0.38;
  darkMetal.envMapIntensity = 0.42;

  const blackStone = new THREE.MeshStandardMaterial({
    color: 0x05070a,
    roughness: 0.58,
    metalness: 0.24,
    envMapIntensity: 0.45,
  });

  const champagne = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.54, 0.39, 0.20),
    metalness: 1,
    roughness: 0.28,
    envMap: M.brass.envMap,
    envMapIntensity: 1.8,
  });

  const coldLight = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.36, 0.66, 1.0).multiplyScalar(2.2),
    toneMapped: false,
  });
  const warmLight = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.0, 0.67, 0.32).multiplyScalar(1.8),
    toneMapped: false,
  });

  const portalUniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0 },
  };
  const portal = new THREE.Mesh(
    new THREE.PlaneGeometry(3.72, 5.55),
    new THREE.ShaderMaterial({
      vertexShader: portalVertex,
      fragmentShader: portalFragment,
      uniforms: portalUniforms,
      depthWrite: true,
      toneMapped: false,
    }),
  );
  portal.position.set(0, 0.27, -2.58);
  group.add(portal);

  const addBox = (
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = material !== coldLight && material !== warmLight;
    mesh.receiveShadow = material === darkMetal || material === blackStone;
    group.add(mesh);
    return mesh;
  };

  for (const side of [-1, 1]) {
    addBox(0.24, 5.88, 0.42, side * 1.99, 0.27, -2.43, darkMetal);
    addBox(0.055, 5.34, 0.055, side * 1.82, 0.27, -2.16, coldLight);
    addBox(0.018, 5.34, 0.018, side * 1.86, 0.27, -2.12, champagne);
    addBox(0.52, 0.12, 0.72, side * 1.99, -2.67, -2.36, blackStone);
  }
  addBox(4.22, 0.24, 0.42, 0, 3.09, -2.43, darkMetal);
  addBox(4.22, 0.16, 0.52, 0, -2.55, -2.43, darkMetal);
  addBox(3.58, 0.018, 0.04, 0, 2.93, -2.15, warmLight);

  const eclipse = new THREE.Group();
  eclipse.position.set(0, 0.20, -2.06);
  const haloMaterial = champagne.clone();
  haloMaterial.emissive = new THREE.Color(0.20, 0.12, 0.045);
  haloMaterial.emissiveIntensity = 0.55;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.009, 8, 192), haloMaterial);
  eclipse.add(halo);

  const arcMaterial = warmLight.clone();
  arcMaterial.transparent = true;
  arcMaterial.opacity = 0.72;
  const arc = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.004, 6, 112, Math.PI * 0.72), arcMaterial);
  arc.rotation.z = Math.PI * 0.16;
  eclipse.add(arc);

  const arcCold = new THREE.Mesh(new THREE.TorusGeometry(1.59, 0.003, 6, 96, Math.PI * 0.40), coldLight);
  arcCold.rotation.z = Math.PI * 1.12;
  eclipse.add(arcCold);

  const tickGeometry = new THREE.BoxGeometry(1, 1, 1);
  const tickDummy = new THREE.Object3D();
  const majorTicks = new THREE.InstancedMesh(tickGeometry, champagne, 12);
  const minorTicks = new THREE.InstancedMesh(tickGeometry, darkMetal, 24);
  let majorIndex = 0;
  let minorIndex = 0;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const major = i % 3 === 0;
    tickDummy.position.set(Math.cos(a) * 1.66, Math.sin(a) * 1.66, 0);
    tickDummy.rotation.set(0, 0, a);
    tickDummy.scale.set(major ? 0.065 : 0.027, 0.005, 0.005);
    tickDummy.updateMatrix();
    if (major) majorTicks.setMatrixAt(majorIndex++, tickDummy.matrix);
    else minorTicks.setMatrixAt(minorIndex++, tickDummy.matrix);
  }
  eclipse.add(majorTicks, minorTicks);
  group.add(eclipse);

  const dais = new THREE.Group();
  dais.name = 'plinth';
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.18, 0.13, 96), blackStone);
  base.position.y = -2.36;
  base.castShadow = true;
  base.receiveShadow = true;
  dais.add(base);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.97, 1.04, 0.075, 96), darkMetal);
  top.position.y = -2.255;
  top.castShadow = true;
  top.receiveShadow = true;
  dais.add(top);

  for (const [radius, y, material] of [
    [1.04, -2.285, warmLight],
    [0.86, -2.212, champagne],
    [0.68, -2.210, darkMetal],
  ] as Array<[number, number, THREE.Material]>) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.006, 6, 128), material);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    dais.add(ring);
  }

  const daisTicks = new THREE.InstancedMesh(tickGeometry, champagne, 48);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    tickDummy.position.set(Math.sin(a) * 0.91, -2.208, Math.cos(a) * 0.91);
    tickDummy.rotation.set(0, a, 0);
    tickDummy.scale.set(0.006, 0.006, i % 4 === 0 ? 0.075 : 0.035);
    tickDummy.updateMatrix();
    daisTicks.setMatrixAt(i, tickDummy.matrix);
  }
  dais.add(daisTicks);
  group.add(dais);

  const underglow = new THREE.PointLight(0x73a7ff, 2.8, 4.2, 2);
  underglow.position.set(0, -2.05, 0);
  group.add(underglow);

  const dustCount = 220;
  const positions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 3.5;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 5.1 + 0.25;
    positions[i * 3 + 2] = -2.1 + Math.random() * 1.4;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const motes = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: 0xa8c7e8,
      size: 0.013,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  group.add(motes);

  let energy = 0;
  return {
    group,
    update(time, dt, targetEnergy = 0) {
      energy = THREE.MathUtils.damp(energy, targetEnergy, 4, dt);
      portalUniforms.uTime.value = time;
      portalUniforms.uEnergy.value = energy;
      eclipse.rotation.z = Math.sin(time * 0.075) * 0.035;
      arc.rotation.z = Math.PI * 0.16 + time * 0.025;
      arcCold.rotation.z = Math.PI * 1.12 - time * 0.018;
      haloMaterial.emissiveIntensity = 0.48 + Math.sin(time * 0.65) * 0.08 + energy * 0.35;
      underglow.intensity = 2.3 + Math.sin(time * 0.8) * 0.35 + energy * 2.0;
      motes.rotation.y = Math.sin(time * 0.055) * 0.045;
      motes.position.y = Math.sin(time * 0.16) * 0.045;
    },
  };
}
