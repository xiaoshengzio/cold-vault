import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const url = process.argv[2] || 'http://127.0.0.1:5273/';
const tag = process.argv[3] || 'm';
const delays = (process.argv[4] || '0,140,320,600,950,1400,2000,3200').split(',').map(Number);
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist','--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(2600);
for (const d of delays) {
  if (d === 0) {
    await page.screenshot({ path: `shots/${tag}-0-rest.png` });
    await page.evaluate(() => window.__SCENE__.specimen.burst(1));
    continue;
  }
  await page.waitForTimeout(d - (delays[delays.indexOf(d) - 1] || 0));
  const st = await page.evaluate(() => {
    const S = window.__SCENE__.specimen;
    let mx = 0;
    for (const p of S.pieces) mx = Math.max(mx, p.mesh.position.distanceTo(p.home));
    return { phase: S.phase, snapped: S.snappedCount, maxOff: +mx.toFixed(3) };
  });
  await page.screenshot({ path: `shots/${tag}-${d}.png` });
  console.log(d + 'ms', JSON.stringify(st));
}
console.log('ERRORS', errs.length ? errs.join(' | ') : 'none');
await browser.close();
