import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true,
  args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  window.__LOG__ = [];
  const S = window.__SCENE__.specimen;
  let last = S.phase;
  const t0 = performance.now();
  const tick = () => {
    const now = performance.now() - t0;
    if (S.phase !== last) { window.__LOG__.push([Math.round(now), last, S.phase]); last = S.phase; }
    if (now < 4000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  S.burst(1);
});
await page.waitForTimeout(4200);
const out = await page.evaluate(() => {
  const S = window.__SCENE__.specimen;
  let mx = 0;
  for (const p of S.pieces) { const t = p.body.translation(); mx = Math.max(mx, Math.hypot(t.x - p.home.x, t.y - p.home.y, t.z - p.home.z)); }
  return { log: window.__LOG__, finalMax: +mx.toFixed(3), fps: window.__SCENE__.getStats?.() };
});
console.log(JSON.stringify(out));
await browser.close();
