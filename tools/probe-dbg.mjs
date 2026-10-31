import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true,
  args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(2500);
const before = await page.evaluate(() => {
  const p = window.__SCENE__.specimen.pieces[0];
  return { type: p.body.bodyType(), mass: p.body.mass(), dyn: p.body.isDynamic?.(), fixed: p.body.isFixed?.() };
});
console.log('BEFORE', JSON.stringify(before));
await page.mouse.move(450, 300); await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(120);
const after = await page.evaluate(() => {
  const S = window.__SCENE__.specimen;
  const p = S.pieces[0];
  return { phase: S.phase, type: p.body.bodyType(), mass: p.body.mass(),
    dyn: p.body.isDynamic?.(), tr: p.body.translation(), v: p.body.linvel(),
    mesh: p.mesh.position.toArray().map(x => +x.toFixed(3)) };
});
console.log('AFTER', JSON.stringify(after));
await page.waitForTimeout(600);
const later = await page.evaluate(() => {
  const S = window.__SCENE__.specimen; const p = S.pieces[0];
  return { phase: S.phase, type: p.body.bodyType(), tr: p.body.translation(), v: p.body.linvel() };
});
console.log('LATER', JSON.stringify(later));
await browser.close();
