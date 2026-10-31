import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist','--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(1500);
const out = await page.evaluate(() => {
  const S = window.__SCENE__.specimen;
  const log = [];
  const p0 = S.pieces[0];
  log.push({ where: 'init', mass: p0.body.mass(), pm: p0.mass, type: p0.body.bodyType() });
  S.burst(1);
  log.push({ where: 'afterBurst', mass: p0.body.mass(), v: p0.body.linvel() });
  S.world.timestep = 1 / 60;
  for (let i = 0; i < 4; i++) {
    S.world.step();
    log.push({ where: 'step' + i, mass: p0.body.mass(), v: p0.body.linvel(), tr: p0.body.translation() });
  }
  return log;
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
