import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(4000);
console.log(JSON.stringify(await page.evaluate(() => {
  const S = window.__SCENE__;
  const d = S.dof;
  const cam = S.camera;
  const t = d.target;
  return {
    target: t && t.isVector3 ? t.toArray().map((v) => +v.toFixed(2)) : String(t),
    focusDistance: d.circleOfConfusionMaterial?.uniforms?.focusDistance?.value,
    bokehScale: d.bokehScale,
    camPos: cam.position.toArray().map((v) => +v.toFixed(2)),
    distToTarget: +cam.position.distanceTo(t).toFixed(2),
    near: cam.near, far: cam.far,
  };
})));
await browser.close();
