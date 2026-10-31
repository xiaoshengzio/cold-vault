import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', e => console.log('[pageerror] ' + e.message + '\n' + (e.stack ?? '').split('\n').slice(0,6).join('\n')));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load' });
const r = await page.evaluate(async () => {
  try {
    const THREE = await import('/node_modules/.vite/deps/three.js').catch(() => import('three'));
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('/artifact.glb');
    const names = [];
    let meshes = 0;
    gltf.scene.traverse(o => { if (o.isMesh) { meshes++; names.push(o.name + ':' + (o.material?.type ?? 'none')); } });
    return { ok: true, meshes, names: names.slice(0, 30) };
  } catch (e) {
    return { ok: false, err: String(e && e.stack ? e.stack : e) };
  }
});
console.log(JSON.stringify(r, null, 1).slice(0, 3000));
await browser.close();
