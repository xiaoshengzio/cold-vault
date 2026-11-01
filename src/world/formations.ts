import * as THREE from 'three';

export const FORMATION_COUNT = 9;
export const FORMATION_NAMES = [
  'CRYSTAL', 'CLUSTER', 'TORUS', 'HELIX', 'LATTICE', 'RIBBON', 'FRAME', 'GALAXY', 'BINARY',
];

function direction(random: () => number): THREE.Vector3 {
  const z = random() * 2 - 1;
  const a = random() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(Math.cos(a) * r, z, Math.sin(a) * r);
}

function separate(points: THREE.Vector3[], spacing = 0.19, iterations = 7): THREE.Vector3[] {
  for (let pass = 0; pass < iterations; pass++) {
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i];
        const b = points[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= spacing * spacing) continue;
        const d = Math.sqrt(Math.max(d2, 1e-8));
        const push = (spacing - d) * 0.48 / d;
        a.x -= dx * push;
        a.y -= dy * push;
        a.z -= dz * push;
        b.x += dx * push;
        b.y += dy * push;
        b.z += dz * push;
      }
    }
  }
  return points;
}

function crystal(count: number, random: () => number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let guard = 0; guard < 60000 && points.length < count; guard++) {
    const y = (random() - 0.5) * 3.1;
    const t = (y + 1.55) / 3.1;
    const cap = Math.min(1, Math.min(t, 1 - t) * 3.5);
    const radius = 0.53 * Math.max(0.025, cap);
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * radius;
    const point = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    if (points.every((p) => p.distanceToSquared(point) > 0.034)) points.push(point);
  }
  while (points.length < count) {
    const i = points.length;
    points.push(new THREE.Vector3(Math.cos(i * 2.4) * 0.42, -1.45 + (i / count) * 2.9, Math.sin(i * 2.4) * 0.42));
  }
  return separate(points, 0.19, 10);
}

function cluster(count: number, random: () => number): THREE.Vector3[] {
  const centres = [
    new THREE.Vector3(-0.57, 0.38, 0.04),
    new THREE.Vector3(0.43, 0.57, -0.20),
    new THREE.Vector3(0.38, -0.49, 0.25),
    new THREE.Vector3(-0.42, -0.50, -0.25),
  ];
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const centre = centres[i % centres.length];
    const radius = Math.cbrt(random()) * (0.37 + random() * 0.18);
    points.push(centre.clone().addScaledVector(direction(random), radius));
  }
  return separate(points, 0.20, 10);
}

function torus(count: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const rings = 4;
  const segments = Math.ceil(count / rings);
  for (let i = 0; i < count; i++) {
    const a = (Math.floor(i / rings) / segments) * Math.PI * 2;
    const b = (i % rings) / rings * Math.PI * 2;
    const r = 0.96 + Math.cos(b) * 0.20;
    points.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, Math.sin(b) * 0.20));
  }
  return points;
}

function helix(count: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const perStrand = Math.floor(count / 2);
  for (let i = 0; i < count; i++) {
    const strand = i % 2;
    const step = Math.floor(i / 2);
    const t = step / Math.max(1, perStrand - 1);
    const a = t * Math.PI * 4 + strand * Math.PI;
    points.push(new THREE.Vector3(Math.cos(a) * 0.66, -1.36 + t * 2.72, Math.sin(a) * 0.66));
  }
  return points;
}

function lattice(count: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let z = 0; z < 5; z++) {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        points.push(new THREE.Vector3((x - 1.5) * 0.40, (y - 1.5) * 0.40, (z - 2) * 0.40));
      }
    }
  }
  const extras = [
    [-0.8, 0, 0], [0.8, 0, 0], [0, -0.8, 0], [0, 0.8, 0],
    [0, 0, -1.04], [0, 0, 1.04], [-0.4, 0.4, 1.04], [0.4, -0.4, -1.04],
  ];
  for (let i = 0; points.length < count; i++) points.push(new THREE.Vector3(...extras[i] as [number, number, number]));
  return points.slice(0, count);
}

function ribbon(count: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const across = [-1.5, -0.5, 0.5, 1.5];
  const segments = Math.ceil(count / across.length);
  for (let i = 0; i < count; i++) {
    const u = Math.floor(i / across.length) / segments * Math.PI * 2;
    const v = across[i % across.length] * 0.18;
    const r = 0.82 + v * Math.cos(u * 0.5);
    points.push(new THREE.Vector3(Math.cos(u) * r, Math.sin(u) * r, v * Math.sin(u * 0.5)));
  }
  return separate(points, 0.18, 3);
}

function frame(count: number): THREE.Vector3[] {
  const geometry = new THREE.IcosahedronGeometry(1.14, 0);
  const attr = geometry.attributes.position;
  const vertices: THREE.Vector3[] = [];
  const edges = new Map<string, [THREE.Vector3, THREE.Vector3]>();
  const faces: THREE.Vector3[] = [];
  const key = (v: THREE.Vector3) => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
  for (let i = 0; i < attr.count; i += 3) {
    const tri = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(attr, i + j));
    faces.push(tri[0].clone().add(tri[1]).add(tri[2]).divideScalar(3).multiplyScalar(1.04));
    for (const v of tri) if (!vertices.some((p) => key(p) === key(v))) vertices.push(v.clone());
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const ka = key(tri[a]);
      const kb = key(tri[b]);
      const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (!edges.has(id)) edges.set(id, [tri[a].clone(), tri[b].clone()]);
    }
  }
  geometry.dispose();
  const points = vertices.map((v) => v.clone());
  for (const [a, b] of edges.values()) {
    points.push(a.clone().lerp(b, 0.34), a.clone().lerp(b, 0.67));
  }
  for (let i = 0; points.length < count; i++) points.push(faces[i % faces.length].clone());
  return points.slice(0, count);
}

function galaxy(count: number, random: () => number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [new THREE.Vector3()];
  const arms = 3;
  for (let i = 1; i < count; i++) {
    const arm = i % arms;
    const t = Math.floor(i / arms) / Math.ceil(count / arms);
    const a = arm / arms * Math.PI * 2 + t * 4.4 + (random() - 0.5) * 0.20;
    const r = 0.14 + t * 1.18 + (random() - 0.5) * 0.08;
    points.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, (random() - 0.5) * 0.25 * (1.1 - t)));
  }
  return separate(points, 0.18, 5);
}

function binary(count: number, random: () => number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const left = new THREE.Vector3(-0.55, 0.12, 0);
  const right = new THREE.Vector3(0.55, -0.12, 0);
  for (let i = 0; i < 72; i++) {
    const centre = i % 2 ? left : right;
    points.push(centre.clone().addScaledVector(direction(random), Math.cbrt(random()) * 0.43));
  }
  while (points.length < count) {
    const t = (points.length - 72) / Math.max(1, count - 73);
    points.push(new THREE.Vector3(-0.38 + t * 0.76, Math.sin(t * Math.PI * 2) * 0.11, Math.cos(t * Math.PI * 2) * 0.11));
  }
  return separate(points, 0.19, 8);
}

export function createFormation(index: number, count: number, random: () => number): THREE.Vector3[] {
  const id = ((Math.floor(index) % FORMATION_COUNT) + FORMATION_COUNT) % FORMATION_COUNT;
  let points: THREE.Vector3[];
  switch (id) {
    case 0: points = crystal(count, random); break;
    case 1: points = cluster(count, random); break;
    case 2: points = torus(count); break;
    case 3: points = helix(count); break;
    case 4: points = lattice(count); break;
    case 5: points = ribbon(count); break;
    case 6: points = frame(count); break;
    case 7: points = galaxy(count, random); break;
    default: points = binary(count, random); break;
  }
  if (points.length !== count) throw new Error(`Formation ${id} returned ${points.length} points, expected ${count}`);
  return points;
}
