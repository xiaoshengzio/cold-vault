import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(3000);
const info = await page.evaluate(() => {
  const S = window.__SCENE__;
  const c = S.camera;
  return {
    pos: c.position.toArray().map((v) => +v.toFixed(2)),
    fov: +c.fov.toFixed(2),
    dir: c.getWorldDirection(new (window.__THREE__.Vector3)()).toArray().map((v) => +v.toFixed(2)),
    progress: +S.rig.progress.toFixed(3),
    sun: +S.scene.children.find((o) => o.isDirectionalLight)?.intensity.toFixed(2),
    fog: S.scene.fog ? [S.scene.fog.color.getHexString(), S.scene.fog.density] : null,
  };
});
console.log(JSON.stringify(info));
await page.screenshot({ path: 'shots/90-probe.png' });
await browser.close();
