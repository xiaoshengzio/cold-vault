import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist','--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(2000);
const out = await page.evaluate(() => {
  const S = window.__SCENE__.specimen;
  const R = window.__RAPIER__;
  S.burst(1);
  const p = S.pieces[0];
  const snap = () => ({ type: p.body.bodyType(), mass: p.body.mass(), v: p.body.linvel(), tr: p.body.translation() });
  const a = snap();
  S.world.timestep = 1 / 60;
  S.world.step();
  const b = snap();
  // 直接手动再给一次冲量
  p.body.applyImpulse({ x: 0, y: 5, z: 0 }, true);
  const c = snap();
  S.world.step();
  const d = snap();
  return { a, b, c, d, ccd: p.body.isCcdEnabled?.() };
});
console.log('BURST', JSON.stringify(out));
await browser.close();
