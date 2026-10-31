import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist','--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(2000);
const out = await page.evaluate(() => {
  const S = window.__SCENE__;
  const p = S.specimen.pieces[0];
  const b = p.body;
  const R = window.__RAPIER__;
  b.setBodyType(0, true);           // 0 = Dynamic
  b.setTranslation({ x: p.home.x, y: p.home.y, z: p.home.z }, true);
  b.setLinvel({ x: 0, y: 0, z: 0 }, true);
  b.wakeUp();
  b.applyImpulse({ x: 0, y: 2.0, z: 0 }, true);
  const v1 = b.linvel();
  const w = S.specimen; // world not exposed
  return { v1, isSleeping: b.isSleeping(), hasWorld: typeof R };
});
console.log('TEST', JSON.stringify(out));
await page.waitForTimeout(300);
console.log('AFTER300', JSON.stringify(await page.evaluate(() => {
  const p = window.__SCENE__.specimen.pieces[0];
  return { tr: p.body.translation(), v: p.body.linvel(), mesh: p.mesh.position.toArray().map(x=>+x.toFixed(3)) };
})));
await browser.close();
