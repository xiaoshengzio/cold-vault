import * as THREE from 'three';

export interface Chapter {
  name: string;
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export const CHAPTERS: Chapter[] = [
  { name: 'COLD VAULT', pos: [0.60, 2.30, 2.80], target: [-2.40, 2.25, -5.40], fov: 42 },
  { name: 'ARCHIVE', pos: [0.20, 2.65, 2.30], target: [-2.05, 2.45, -4.35], fov: 39 },
  { name: 'WORKS', pos: [3.25, 2.25, 1.00], target: [-1.90, 2.30, -4.60], fov: 41 },
  { name: 'CONTACT', pos: [0.20, 3.00, 6.00], target: [-1.60, 2.20, -5.00], fov: 46 },
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
  release = 0;
  private releaseSmooth = 0;
  private fovScale = 1;
  private pullBack = 0;
  private dir = new THREE.Vector3();
  private offX = 0;
  private offY = 0;

  setAspect(aspect: number) {
    const k = Math.max(0, 0.92 - aspect) / 0.46;
    this.fovScale = 1 + k * 0.10;
    this.offX = k * 1.72;
    this.offY = -k * 0.55;
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
    this.releaseSmooth = damp(this.releaseSmooth, this.release, 3.2, dt);

    const pullback = this.pullBack + this.releaseSmooth * 0.85;
    if (pullback > 0.001) {
      this.dir.copy(this.posT).sub(this.lookT).normalize();
      this.posT.addScaledVector(this.dir, pullback);
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