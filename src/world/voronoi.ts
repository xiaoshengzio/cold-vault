import * as THREE from 'three';

/**
 * 3D Voronoi 切割：把一块凸多面体按种子点切成互相严丝合缝的凸胞。
 * 用途：晶体被击碎后的解理碎块必须在静止时拼回一块整料，
 * 只有真正的 Voronoi 胞才能既保证"每块都是凸的"又保证"没有缝"。
 */

export type PolyFaces = THREE.Vector3[][];

/** 用平面 n·x = d 裁剪凸多面体，保留 n·x <= d 的一侧 */
function clipPolyhedron(faces: PolyFaces, n: THREE.Vector3, d: number): PolyFaces {
  const out: PolyFaces = [];
  const cut: THREE.Vector3[] = [];
  const EPS = 1e-7;

  for (const face of faces) {
    const poly: THREE.Vector3[] = [];
    for (let i = 0; i < face.length; i++) {
      const a = face[i];
      const b = face[(i + 1) % face.length];
      const da = n.dot(a) - d;
      const db = n.dot(b) - d;
      if (da <= EPS) poly.push(a);
      if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) {
        const t = da / (da - db);
        const p = new THREE.Vector3().lerpVectors(a, b, t);
        poly.push(p);
        cut.push(p);
      }
    }
    if (poly.length >= 3) out.push(poly);
  }

  // 用切口上的点补一个盖面，否则切出来的胞会漏底
  if (cut.length >= 3) {
    const centre = new THREE.Vector3();
    for (const p of cut) centre.add(p);
    centre.divideScalar(cut.length);

    const helper = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(n, helper).normalize();
    const v = new THREE.Vector3().crossVectors(n, u).normalize();

    const uniq: THREE.Vector3[] = [];
    for (const p of cut) {
      if (!uniq.some((q) => q.distanceToSquared(p) < 1e-10)) uniq.push(p);
    }
    if (uniq.length >= 3) {
      const ang = new Map<THREE.Vector3, number>();
      const tmp = new THREE.Vector3();
      for (const p of uniq) {
        tmp.subVectors(p, centre);
        ang.set(p, Math.atan2(tmp.dot(v), tmp.dot(u)));
      }
      uniq.sort((a, b) => (ang.get(a) as number) - (ang.get(b) as number));
      out.push(uniq);
    }
  }

  return out;
}

/** 把一个凸多面体转成三角面几何（面数很少，无需索引），并保证法线朝外 */
export function facesToGeometry(faces: PolyFaces, centre: THREE.Vector3): THREE.BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const tri = new THREE.Triangle();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const fn = new THREE.Vector3();
  const fc = new THREE.Vector3();

  for (const face of faces) {
    if (face.length < 3) continue;
    for (let i = 1; i < face.length - 1; i++) {
      const a = face[0];
      const b = face[i];
      const c = face[i + 1];
      tri.set(a, b, c);
      tri.getNormal(fn);
      if (fn.lengthSq() < 1e-12) continue;
      fc.copy(a).add(b).add(c).divideScalar(3);
      // 法线必须背离心：面朝里说明这个面的绕序反了
      const flip = fn.dot(fc.clone().sub(centre)) < 0;
      const p0 = flip ? a : a;
      const p1 = flip ? c : b;
      const p2 = flip ? b : c;
      e1.subVectors(p1, p0);
      e2.subVectors(p2, p0);
      fn.crossVectors(e1, e2).normalize();
      pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      nrm.push(fn.x, fn.y, fn.z, fn.x, fn.y, fn.z, fn.x, fn.y, fn.z);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return g;
}

/** 对每个种子点求其 Voronoi 胞（限制在给定凸多面体内） */
export function voronoiCells(base: PolyFaces, seeds: THREE.Vector3[]): PolyFaces[] {
  const cells: PolyFaces[] = [];
  const n = new THREE.Vector3();
  const mid = new THREE.Vector3();

  for (let i = 0; i < seeds.length; i++) {
    let faces: PolyFaces = base.map((f) => f.map((v) => v.clone()));
    const si = seeds[i];
    for (let j = 0; j < seeds.length && faces.length > 0; j++) {
      if (i === j) continue;
      n.subVectors(seeds[j], si);
      const len = n.length();
      if (len < 1e-6) continue;
      n.divideScalar(len);
      mid.addVectors(si, seeds[j]).multiplyScalar(0.5);
      // 只保留离 si 更近的一侧
      faces = clipPolyhedron(faces, n, n.dot(mid));
    }
    if (faces.length >= 4) cells.push(faces);
  }

  return cells;
}
