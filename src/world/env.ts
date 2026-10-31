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
 * A deliberately tiny, high-contrast studio for the crystal alone.
 * Large soft sources make glass read as opaque cream; a black room with a
 * handful of tight emitters is what makes facets sparkle.
 */
export function buildCrystalEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x000000);

  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(10, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x030405, side: THREE.BackSide }),
  );
  env.add(shell);

  const emitter = (w: number, h: number, color: number, intensity: number, pos: THREE.Vector3) => {
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    tex.needsUpdate = true;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), map: tex }),
    );
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };

  // three tight specular sources so each facet catches a different one
  emitter(1.1, 2.6, 0xfff0d2, 16, new THREE.Vector3(2.6, 3.1, 2.2));
  emitter(0.9, 0.9, 0xffe2b4, 22, new THREE.Vector3(-2.2, 4.2, 1.4));
  emitter(0.7, 2.2, 0x9dc2ff, 9, new THREE.Vector3(-3.1, -0.6, 2.0));
  emitter(3.2, 0.35, 0xff7a2a, 7, new THREE.Vector3(0.0, -2.6, 3.0));
  emitter(0.35, 3.4, 0xffffff, 12, new THREE.Vector3(-3.4, 0.4, -2.6));

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromScene(env, 0.006, 0.1, 60);
  pmrem.dispose();
  return rt.texture;
}
