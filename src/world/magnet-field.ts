import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { VaultMaterials } from './materials';
import { createFormation, FORMATION_COUNT, FORMATION_NAMES } from './formations';

await RAPIER.init();

const COUNT = 88;
const FIXED = 1 / 60;
const GROUPS_TOUCHING = (1 << 16) | 1;
const GROUPS_NONE = 0;
const ORGANIC = new Set([1, 8]);

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export interface SpecimenPiece {
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  home: THREE.Vector3;
  restPos: THREE.Vector3;
  restQuat: THREE.Quaternion;
  dir: THREE.Vector3;
  target: THREE.Vector3;
  radius: number;
  locked: boolean;
  quietT: number;
}

export interface Specimen {
  group: THREE.Group;
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
  readonly settled: boolean;
  readonly phase: string;
  readonly isClump: boolean;
  readonly formation: number;
  readonly formationName: string;
  readonly world: RAPIER.World;
  readonly snappedCount: number;
  readonly remaining: number;
  readonly pendingNames: string[];
  update(dt: number, t: number, pointer: THREE.Vector3 | null, camera: THREE.Camera, hover?: number): void;
  prewarm(): void;
  burst(strength?: number): boolean;
}

export function buildSpecimen(M: VaultMaterials, env: THREE.Texture, stoneEnv: THREE.Texture = env): Specimen {
  const random = seededRandom(20261031);
  const group = new THREE.Group();
  group.name = 'magnet-field';

  const magnetMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.20, 0.245, 0.31),
    metalness: 0.82,
    roughness: 0.235,
    envMap: stoneEnv,
    envMapIntensity: 1.65,
    flatShading: true,
  });

  const fresnel = { value: new THREE.Color(0.14, 0.23, 0.34) };
  magnetMat.onBeforeCompile = (shader) => {
    shader.uniforms.uMagnetFresnel = fresnel;
    shader.fragmentShader = `uniform vec3 uMagnetFresnel;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      #include <opaque_fragment>
      float magnetFres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
      gl_FragColor.rgb += uMagnetFresnel * magnetFres;
    `);
  };

  const brassMat = new THREE.MeshStandardMaterial({
    color: M.brass.color.clone(),
    metalness: 1,
    roughness: 0.25,
    envMap: env,
    envMapIntensity: 1.55,
  });

  const geometry = new THREE.DodecahedronGeometry(1, 0);
  geometry.scale(0.82, 1.0, 0.82);
  geometry.computeVertexNormals();
  const instances = new THREE.InstancedMesh(geometry, magnetMat, COUNT);
  instances.name = '88-independent-magnets';
  instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instances.castShadow = false;
  instances.receiveShadow = true;
  instances.frustumCulled = false;
  group.add(instances);

  const solid = new THREE.Mesh(geometry, magnetMat);
  solid.visible = false;
  group.add(solid);

  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.numSolverIterations = 4;
  const pieces: SpecimenPiece[] = [];
  const initial = createFormation(0, COUNT, random);
  const homeTargets = initial.map((point) => point.clone());
  const basePositions = geometry.attributes.position;

  for (let i = 0; i < COUNT; i++) {
    const radius = 0.092 + random() * 0.026;
    const mesh = new THREE.Mesh(geometry, magnetMat);
    mesh.position.copy(initial[i]);
    mesh.scale.setScalar(radius);
    mesh.quaternion.setFromEuler(new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI));
    mesh.updateMatrix();
    instances.setMatrixAt(i, mesh.matrix);
    const shade = 0.74 + random() * 0.30;
    const color = i % 13 === 0
      ? new THREE.Color(1.30 * shade, 0.92 * shade, 0.55 * shade)
      : new THREE.Color(0.72 * shade, 0.86 * shade, 1.05 * shade);
    instances.setColorAt(i, color);

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(initial[i].x, initial[i].y, initial[i].z)
        .setLinearDamping(1.15)
        .setAngularDamping(2.6)
        .setCanSleep(false),
    );
    const verts = new Float32Array(basePositions.count * 3);
    for (let v = 0; v < basePositions.count; v++) {
      verts[v * 3] = basePositions.getX(v) * radius;
      verts[v * 3 + 1] = basePositions.getY(v) * radius;
      verts[v * 3 + 2] = basePositions.getZ(v) * radius;
    }
    const desc = RAPIER.ColliderDesc.convexHull(verts) ?? RAPIER.ColliderDesc.ball(radius);
    desc.setDensity(1.0).setFriction(0.54).setRestitution(0.24).setContactSkin(0.004);
    const collider = world.createCollider(desc, body);
    body.setBodyType(RAPIER.RigidBodyType.Fixed, false);
    collider.setCollisionGroups(GROUPS_NONE);

    const dir = initial[i].clone().normalize();
    if (dir.lengthSq() < 0.01) dir.set(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
    pieces.push({
      mesh, body, collider,
      home: initial[i].clone(),
      restPos: initial[i].clone(),
      restQuat: mesh.quaternion.clone(),
      dir,
      target: initial[i].clone(),
      radius,
      locked: true,
      quietT: 0,
    });
  }
  instances.instanceMatrix.needsUpdate = true;
  if (instances.instanceColor) instances.instanceColor.needsUpdate = true;

  const core = new THREE.Group();
  group.add(core);

  const rings: Specimen['rings'] = [];
  const ringSpecs = [
    { r: 0.82, y: 0.24, axis: new THREE.Vector3(0.08, 1, 0.04).normalize(), speed: 0.065 },
    { r: 0.72, y: -0.28, axis: new THREE.Vector3(0.62, 1, 0.34).normalize(), speed: -0.09 },
  ];
  for (const spec of ringSpecs) {
    const holder = new THREE.Group();
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 192; i++) {
      const a = i / 192 * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a) * spec.r, Math.sin(a) * spec.r, 0));
    }
    const orbit = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineDashedMaterial({
        color: new THREE.Color(0.90, 0.66, 0.36),
        dashSize: 0.095,
        gapSize: 0.060,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    orbit.computeLineDistances();
    holder.add(orbit);
    holder.position.copy(spec.axis).multiplyScalar(spec.y);
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), spec.axis);
    group.add(holder);
    rings.push({ holder, axis: spec.axis, speed: spec.speed, mat: orbit.material, baseY: spec.y });
  }

  const satelliteCount = 10;
  const satellites = new THREE.InstancedMesh(geometry, brassMat, satelliteCount);
  satellites.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  satellites.castShadow = false;
  satellites.frustumCulled = false;
  group.add(satellites);
  const satelliteDummy = new THREE.Object3D();
  const satelliteData = Array.from({ length: satelliteCount }, (_, i) => ({
    radius: 1.08 + random() * 0.28,
    angle: i / satelliteCount * Math.PI * 2,
    height: -1.1 + random() * 2.2,
    speed: (0.045 + random() * 0.04) * (i % 2 ? 1 : -1),
    scale: 0.026 + random() * 0.026,
  }));

  let phase: 'rest' | 'burst' | 'drift' | 'gather' = 'rest';
  let phaseT = 0;
  let formationIndex = 0;
  let targets = initial.map((p) => p.clone());
  let order: number[] = [];
  let accumulate = 0;
  let hoverAmount = 0;
  const pointerLocal = new THREE.Vector3();
  const toTarget = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const errorQ = new THREE.Quaternion();

  const shuffleOrder = () => {
    order = Array.from({ length: FORMATION_COUNT - 1 }, (_, i) => i + 1);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    order.push(0);
  };

  const syncBody = (piece: SpecimenPiece) => {
    const p = piece.body.translation();
    const q = piece.body.rotation();
    piece.mesh.position.set(p.x, p.y, p.z);
    piece.mesh.quaternion.set(q.x, q.y, q.z, q.w);
  };

  const syncInstances = () => {
    for (let i = 0; i < pieces.length; i++) {
      pieces[i].mesh.updateMatrix();
      instances.setMatrixAt(i, pieces[i].mesh.matrix);
    }
    instances.instanceMatrix.needsUpdate = true;
  };

  const finishGather = () => {
    const organic = ORGANIC.has(formationIndex);
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      if (!organic) {
        piece.body.setTranslation({ x: targets[i].x, y: targets[i].y, z: targets[i].z }, true);
        piece.body.setRotation({
          x: piece.restQuat.x, y: piece.restQuat.y, z: piece.restQuat.z, w: piece.restQuat.w,
        }, true);
      }
      piece.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      piece.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      piece.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
      piece.collider.setCollisionGroups(GROUPS_NONE);
      piece.locked = true;
      syncBody(piece);
      piece.home.copy(piece.mesh.position);
    }
    world.numSolverIterations = 4;
    phase = 'rest';
    phaseT = 0;
  };

  const stepPhysics = (h: number) => {
    if (phase === 'drift') {
      const drag = Math.exp(-6.5 * h);
      const spinDrag = Math.exp(-7.5 * h);
      for (const piece of pieces) {
        const v = piece.body.linvel();
        const w = piece.body.angvel();
        piece.body.setLinvel({ x: v.x * drag, y: v.y * drag, z: v.z * drag }, true);
        piece.body.setAngvel({ x: w.x * spinDrag, y: w.y * spinDrag, z: w.z * spinDrag }, true);
      }
    }
    if (phase === 'gather') {
      const alpha = 1 - Math.exp(-6.5 * h);
      const organic = ORGANIC.has(formationIndex);
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        if (piece.locked) continue;
        const body = piece.body;
        const p = body.translation();
        const target = targets[i];
        toTarget.set(target.x - p.x, target.y - p.y, target.z - p.z);
        const gap = toTarget.length();
        if (gap > 1e-5) {
          toTarget.divideScalar(gap);
          const speed = Math.min(3.0, Math.sqrt(2 * 3.6 * gap)) * (0.28 + 0.72 * Math.min(1, gap / 0.38));
          const v = body.linvel();
          const mass = Math.max(0.0001, body.mass());
          tmp.set(toTarget.x * speed - v.x, toTarget.y * speed - v.y, toTarget.z * speed - v.z).multiplyScalar(alpha * mass);
          const impulse = tmp.length();
          const impulseCap = mass * 42 * h;
          if (impulse > impulseCap) tmp.multiplyScalar(impulseCap / impulse);
          body.applyImpulse({ x: tmp.x, y: tmp.y, z: tmp.z }, true);
        }
        const w = body.angvel();
        const angularDrag = Math.exp(-(organic ? 4.5 : 7.0) * h);
        body.setAngvel({ x: w.x * angularDrag, y: w.y * angularDrag, z: w.z * angularDrag }, true);
        if (!organic && gap < 0.34) {
          const q = body.rotation();
          tmpQ.set(q.x, q.y, q.z, q.w);
          errorQ.copy(piece.restQuat).multiply(tmpQ.invert());
          if (errorQ.w < 0) errorQ.set(-errorQ.x, -errorQ.y, -errorQ.z, -errorQ.w);
          const angle = 2 * Math.acos(THREE.MathUtils.clamp(errorQ.w, -1, 1));
          const s = Math.sqrt(Math.max(0, 1 - errorQ.w * errorQ.w));
          if (s > 1e-4) {
            const k = Math.min(7, angle * 5) * Math.min(1, 0.25 / Math.max(gap, 0.02)) / s;
            body.setAngvel({ x: errorQ.x * k, y: errorQ.y * k, z: errorQ.z * k }, true);
          }
        }
      }
    }

    world.timestep = h;
    world.step();
    for (const piece of pieces) if (!piece.locked) syncBody(piece);

    if (phase === 'gather') {
      let locked = 0;
      const organic = ORGANIC.has(formationIndex);
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        if (piece.locked) {
          locked++;
          continue;
        }
        const p = piece.mesh.position;
        const gap = p.distanceTo(targets[i]);
        const v = piece.body.linvel();
        const speed = Math.hypot(v.x, v.y, v.z);
        const near = organic ? gap < 0.14 && speed < 0.65 : gap < 0.065 && speed < 1.15;
        piece.quietT = near ? piece.quietT + FIXED : Math.max(0, piece.quietT - FIXED * 2);
        if (piece.quietT > 0.075 || gap < (organic ? 0.025 : 0.018)) {
          if (!organic) {
            piece.body.setTranslation({ x: targets[i].x, y: targets[i].y, z: targets[i].z }, true);
            piece.body.setRotation({
              x: piece.restQuat.x, y: piece.restQuat.y, z: piece.restQuat.z, w: piece.restQuat.w,
            }, true);
            syncBody(piece);
          }
          piece.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          piece.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          piece.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
          piece.locked = true;
          locked++;
        }
      }
      if (locked === pieces.length || phaseT > 4.8) finishGather();
    }
  };

  const updateSatellites = (t: number) => {
    for (let i = 0; i < satelliteData.length; i++) {
      const data = satelliteData[i];
      const a = data.angle + t * data.speed;
      const radius = data.radius * (phase === 'rest' ? 1 : 1.35);
      satelliteDummy.position.set(
        Math.cos(a) * radius,
        data.height + Math.sin(t * 0.42 + i) * 0.06,
        Math.sin(a) * radius,
      );
      satelliteDummy.rotation.set(t * 0.15 + i, a, t * 0.1 + i * 0.4);
      satelliteDummy.scale.set(data.scale * 0.7, data.scale * 2.2, data.scale * 0.7);
      satelliteDummy.updateMatrix();
      satellites.setMatrixAt(i, satelliteDummy.matrix);
    }
    satellites.instanceMatrix.needsUpdate = true;
  };

  return {
    group,
    solid,
    pieces,
    rings,
    core,
    world,
    get settled() { return phase === 'rest'; },
    get phase() { return phase; },
    get isClump() { return formationIndex !== 0; },
    get formation() { return formationIndex; },
    get formationName() { return FORMATION_NAMES[formationIndex]; },
    get snappedCount() { return pieces.filter((piece) => piece.locked).length; },
    get remaining() { return order.length; },
    get pendingNames() { return order.map((index) => FORMATION_NAMES[index]); },
    prewarm() {
      for (const piece of pieces) {
        piece.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        piece.collider.setCollisionGroups(GROUPS_TOUCHING);
        piece.body.enableCcd(true);
      }
      world.numSolverIterations = 4;
      world.timestep = FIXED;
      for (let i = 0; i < 3; i++) world.step();
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        const target = homeTargets[i];
        piece.body.setTranslation({ x: target.x, y: target.y, z: target.z }, true);
        piece.body.setRotation({
          x: piece.restQuat.x, y: piece.restQuat.y, z: piece.restQuat.z, w: piece.restQuat.w,
        }, true);
        piece.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        piece.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        piece.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
        piece.body.enableCcd(false);
        piece.collider.setCollisionGroups(GROUPS_NONE);
        piece.locked = true;
        piece.mesh.position.copy(target);
        piece.mesh.quaternion.copy(piece.restQuat);
      }
      syncInstances();
    },
    burst(strength = 1) {
      if (order.length === 0) shuffleOrder();
      const next = order.shift() ?? 0;
      formationIndex = next;
      targets = next === 0 ? homeTargets.map((point) => point.clone()) : createFormation(next, COUNT, random);
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        piece.target.copy(targets[i]);
        piece.body.setTranslation({
          x: piece.mesh.position.x, y: piece.mesh.position.y, z: piece.mesh.position.z,
        }, true);
        piece.body.setRotation({
          x: piece.mesh.quaternion.x, y: piece.mesh.quaternion.y, z: piece.mesh.quaternion.z, w: piece.mesh.quaternion.w,
        }, true);
        piece.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        piece.collider.setCollisionGroups(GROUPS_TOUCHING);
        piece.body.enableCcd(false);
        piece.locked = false;
        piece.quietT = 0;
        tmp.copy(piece.mesh.position);
        tmp.y *= 0.42;
        if (tmp.lengthSq() < 0.005) tmp.copy(piece.dir);
        tmp.normalize();
        const radial = piece.mesh.position.length();
        const speed = (1.65 + random() * 0.85) * strength * THREE.MathUtils.clamp(1.25 - radial * 0.28, 0.30, 1);
        piece.body.setLinvel({
          x: tmp.x * speed - tmp.z * 0.28 + (random() - 0.5) * 0.48,
          y: tmp.y * speed + (random() - 0.5) * 0.52,
          z: tmp.z * speed + tmp.x * 0.28 + (random() - 0.5) * 0.48,
        }, true);
        piece.body.setAngvel({
          x: (random() - 0.5) * 2.4,
          y: (random() - 0.5) * 2.4,
          z: (random() - 0.5) * 2.4,
        }, true);
      }
      world.numSolverIterations = 4;
      phase = 'burst';
      phaseT = 0;
      accumulate = 0;
      return true;
    },
    update(dt, t, pointer, _camera, hover = 0) {
      hoverAmount = THREE.MathUtils.damp(hoverAmount, THREE.MathUtils.clamp(hover, 0, 1), 6, dt);
      if (pointer) {
        pointerLocal.copy(pointer);
        group.worldToLocal(pointerLocal);
      }
      if (phase === 'rest') {
        for (let i = 0; i < pieces.length; i++) {
          const piece = pieces[i];
          piece.mesh.position.copy(piece.home);
          const breathe = Math.sin(t * 0.72 + i * 0.83) * 0.0045;
          piece.mesh.position.addScaledVector(piece.dir, breathe + hoverAmount * 0.012);
          if (pointer) {
            tmp.copy(pointerLocal).sub(piece.home);
            const distance = tmp.length();
            if (distance > 0.001 && distance < 1.4) {
              piece.mesh.position.addScaledVector(tmp.normalize(), 0.055 * (1 - distance / 1.4));
            }
          }
        }
      } else {
        phaseT += dt;
        if (phase === 'burst' && phaseT > 0.32) {
          phase = 'drift';
          phaseT = 0;
        } else if (phase === 'drift' && phaseT > 0.58) {
          phase = 'gather';
          phaseT = 0;
          for (const piece of pieces) piece.body.enableCcd(false);
        }
        accumulate = Math.min(accumulate + Math.min(dt, 0.05), 0.10);
        let steps = 0;
        while (accumulate >= FIXED && steps < 3) {
          stepPhysics(FIXED);
          accumulate -= FIXED;
          steps++;
        }
        if (steps === 3) accumulate = 0;
      }

      let liveBound = 0.6;
      for (const piece of pieces) {
        liveBound = Math.max(liveBound, piece.mesh.position.length() + piece.radius);
      }
      const orbitScale = liveBound * 1.14 / 0.72;
      for (const ring of rings) {
        ring.holder.scale.setScalar(orbitScale);
        ring.mat.opacity = 0.68;
        ring.mat.visible = true;
        ring.holder.position.copy(ring.axis).multiplyScalar(ring.baseY);
      }
      fresnel.value.setRGB(0.14 + hoverAmount * 0.14, 0.23 + hoverAmount * 0.18, 0.34 + hoverAmount * 0.24);
      updateSatellites(t);
      syncInstances();
    },
  };
}
