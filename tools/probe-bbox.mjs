import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load' });
await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 40000 });
const info = await page.evaluate(() => {
  const T = window.__THREE__; const S = window.__SCENE__;
  const box = new T.Box3().setFromObject(S.specimen.group);
  const pts = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const v = new T.Vector3(x, y, z).project(S.camera);
    pts.push([(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]);
  }
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  const r = (s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect();
    return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
  return {
    specimenScreen: [Math.round(Math.min(...xs)), Math.round(Math.min(...ys)), Math.round(Math.max(...xs)), Math.round(Math.max(...ys))],
    cjk: r('.display-cjk'), latin: r('.display-latin'), lede: r('.lede'), foot: r('.hero-foot'), eyebrow: r('.eyebrow'),
    camPos: S.camera.position.toArray().map((v) => +v.toFixed(2)),
    fov: S.camera.fov,
  };
});
console.log(JSON.stringify(info));
await browser.close();
