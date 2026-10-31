import * as THREE from 'three';

/**
 * Builds a tiny emissive "room" and pre-filters it into an environment map, so
 * brass reflections describe the same architecture the camera sees.
 */
export function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x05060a);

  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(40, 18, 40),
    new THREE.MeshBasicMaterial({ color: 0x0d0e12, side: THREE.BackSide })
  );
  env.add(shell);

  // the bright aperture: warm daylight source behind the slats
  const win = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 9),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 1.0, 0.8) })
  );
  win.position.set(0, 2.6, -19.6);
  env.add(win);

  // slat shadows inside the window glow
  for (let i = 0; i < 9; i++) {
    const bar = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 0.55),
      new THREE.MeshBasicMaterial({ color: 0x0a0b0e })
    );
    bar.position.set(0, -1.4 + i * 1.05, -19.5);
    env.add(bar);
  }

  // cool wall strips
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 0.5),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.26, 0.34) })
    );
    strip.rotation.y = side * Math.PI / 2;
    strip.position.set(side * 19.5, 4.5, 0);
    env.add(strip);
  }

  // faint floor bounce
  const bounce = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.10, 0.095, 0.09) })
  );
  bounce.rotation.x = Math.PI / 2;
  bounce.position.y = -8.9;
  env.add(bounce);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromScene(env, 0.035, 0.1, 120);
  pmrem.dispose();
  shell.geometry.dispose();

  return rt.texture;
}
/**
 * High-contrast studio environment used ONLY by the artefact (brass + crystal).
 * A small, very bright warm aperture gives polished metal crisp specular streaks
 * and gives the glass something worth refracting.
 */
export function buildArtefactEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x010204);

  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(24, 14, 24),
    new THREE.MeshBasicMaterial({ color: 0x04050a, side: THREE.BackSide })
  );
  env.add(shell);

  const panel = (w: number, h: number, color: THREE.Color, pos: [number, number, number], rot: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.rotation.set(...rot);
    env.add(m);
  };

  // key: warm slot of daylight, slightly behind right
  panel(7.0, 1.5, new THREE.Color(9.5, 6.4, 3.6), [6.0, 4.2, -6.0], [0, -Math.PI / 2.4, 0]);
  // two thinner siblings read as the slats
  panel(6.6, 0.35, new THREE.Color(6.0, 4.0, 2.3), [6.2, 2.2, -5.6], [0, -Math.PI / 2.4, 0]);
  panel(6.6, 0.35, new THREE.Color(6.0, 4.0, 2.3), [6.2, 6.2, -5.6], [0, -Math.PI / 2.4, 0]);
  // cool kicker opposite
  panel(5.0, 1.1, new THREE.Color(0.50, 0.56, 0.63), [-8.0, 2.0, 2.0], [0, Math.PI / 2.1, 0]);
  // overhead softbox
  panel(6.0, 3.0, new THREE.Color(1.5, 1.45, 1.35), [0, 6.9, 0], [Math.PI / 2, 0, 0]);
  // faint brass-warm floor bounce
  panel(10.0, 10.0, new THREE.Color(0.10, 0.075, 0.05), [0, -6.9, 0], [-Math.PI / 2, 0, 0]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02, 0.1, 90);
  pmrem.dispose();
  shell.geometry.dispose();
  return rt.texture;
}

/**
 * 晶体专用环境：**渐变棚**，不是一堆点光源。
 * 抛光金属面只反射环境，若环境本身是黑的，每个面就都是同一个灰值 —— 多面体立刻塌成一张纸。
 * 这里用一张等距柱状渐变图（顶部亮 / 地平线暗 / 底部纯黑）+ 两条细亮条：
 * 每个晶面的明度由它的法线朝向决定，形体就"刻"出来了；两条亮条负责锐利高光。
 */
export function buildCrystalEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const W = 512;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 天顶 -> 地平线 -> 底部的垂直渐变
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.0, 'rgb(255, 246, 230)');
  grad.addColorStop(0.16, 'rgb(196, 190, 182)');
  grad.addColorStop(0.36, 'rgb(96, 96, 100)');
  grad.addColorStop(0.5, 'rgb(26, 27, 30)');
  grad.addColorStop(0.66, 'rgb(8, 8, 10)');
  grad.addColorStop(1.0, 'rgb(0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 顶棚柔光箱：给朝上的锥面一个渐隐的亮块
  const box = ctx.createLinearGradient(0, 0, 0, H * 0.2);
  box.addColorStop(0, 'rgba(255,255,255,1)');
  box.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = box;
  ctx.fillRect(W * 0.22, 0, W * 0.36, H * 0.2);

  // 两条竖向细亮条（一暖一冷），在棱面上拖出干净的高光线
  ctx.fillStyle = 'rgba(255, 236, 208, 0.95)';
  ctx.fillRect(W * 0.055, H * 0.12, W * 0.022, H * 0.44);
  ctx.fillStyle = 'rgba(196, 224, 255, 0.85)';
  ctx.fillRect(W * 0.71, H * 0.16, W * 0.016, H * 0.38);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromEquirectangular(tex);
  pmrem.dispose();
  tex.dispose();
  return rt.texture;
}
