import * as THREE from 'three';

export interface Chapter {
  name: string;
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export const CHAPTERS: Chapter[] = [
  { name: 'COLD VAULT', pos: [0.90, 1.95, 1.20], target: [-1.80, 2.35, -6.20], fov: 46 },
  { name: 'ARCHIVE', pos: [0.72, 1.98, 0.95], target: [-1.75, 2.30, -6.15], fov: 45 },
  { name: 'WORKS', pos: [1.05, 1.90, 0.75], target: [-1.65, 2.26, -6.05], fov: 44 },
  { name: 'CONTACT', pos: [0.80, 1.78, 0.45], target: [-1.70, 2.20, -6.10], fov: 46 },
];

const damp = (current: number, target: number, lambda: number, dt: number) =>
  THREE.MathUtils.damp(current, target, lambda, dt);

export class CameraRig {
  camera: THREE.PerspectiveCamera;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private posT = new THREE.Vector3();
  private lookT = new THREE.Vector3();
  private fovT = 38;
  private fov = 38;
  private mouse = new THREE.Vector2();
  private mouseSmooth = new THREE.Vector2();
  progress = 0;
  private jump = [0, 0, 0];
  private fovScale = 1;
  private pullBack = 0;
  private dir = new THREE.Vector3();
  private offX = 0;
  private offY = 0;

  setAspect(aspect: number) {
    const k = Math.max(0, 0.92 - aspect) / 0.46;
    this.fovScale = 1 + k * 0.10;
    this.offX = -k * 0.30;
    this.offY = -k * 0.52;
    this.pullBack = k * 2.15;
  }

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.applyChapter(0);
    this.pos.copy(this.posT);
    this.look.copy(this.lookT);
    this.fov = this.fovT;
  }

  setMouse(x: number, y: number) {
    this.mouse.set(x, y);
  }

  private applyChapter(p: number) {
    const n = CHAPTERS.length - 1;
    const f = THREE.MathUtils.clamp(p, 0, 1) * n;
    const i = Math.min(Math.floor(f), n - 1);
    const t = f - i;
    const a = CHAPTERS[i];
    const b = CHAPTERS[i + 1];
    const e = t * t * (3 - 2 * t);
    this.posT.set(
      THREE.MathUtils.lerp(a.pos[0], b.pos[0], e),
      THREE.MathUtils.lerp(a.pos[1], b.pos[1], e),
      THREE.MathUtils.lerp(a.pos[2], b.pos[2], e)
    );
    this.lookT.set(
      THREE.MathUtils.lerp(a.target[0], b.target[0], e),
      THREE.MathUtils.lerp(a.target[1], b.target[1], e),
      THREE.MathUtils.lerp(a.target[2], b.target[2], e)
    );
    this.fovT = THREE.MathUtils.lerp(a.fov, b.fov, e);
  }

  update(dt: number, idleTime: number) {
    const dbg = (window as any).__CAM__;
    if (dbg) {
      this.camera.position.set(dbg.pos[0], dbg.pos[1], dbg.pos[2]);
      this.camera.lookAt(dbg.target[0], dbg.target[1], dbg.target[2]);
      if (Math.abs(this.camera.fov - dbg.fov) > 0.001) {
        this.camera.fov = dbg.fov;
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    this.applyChapter(this.progress);

    if (this.pullBack > 0.001) {
      this.dir.copy(this.posT).sub(this.lookT).normalize();
      this.posT.addScaledVector(this.dir, this.pullBack);
    }

    this.mouseSmooth.x = damp(this.mouseSmooth.x, this.mouse.x, 11.0, dt);
    this.mouseSmooth.y = damp(this.mouseSmooth.y, this.mouse.y, 11.0, dt);

    const sway = 1 - Math.min(1, Math.abs(this.progress - 0) * 3);
    this.pos.x = damp(this.pos.x, this.posT.x + Math.sin(idleTime * 0.21) * 0.07 + this.mouseSmooth.x * 0.42 * sway, 6.5, dt);
    this.pos.y = damp(this.pos.y, this.posT.y + Math.sin(idleTime * 0.17) * 0.05 - this.mouseSmooth.y * 0.26, 6.5, dt);
    this.pos.z = damp(this.pos.z, this.posT.z, 6.5, dt);

    this.look.x = damp(this.look.x, this.lookT.x + this.offX + this.mouseSmooth.x * 0.22, 7.5, dt);
    this.look.y = damp(this.look.y, this.lookT.y + this.offY - this.mouseSmooth.y * 0.18, 7.5, dt);
    this.look.z = damp(this.look.z, this.lookT.z, 7.5, dt);

    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);

    this.fov = damp(this.fov, this.fovT * this.fovScale, 5.0, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}