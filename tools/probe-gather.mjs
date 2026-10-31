import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true,
  args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(2500);
await page.evaluate(() => window.__SCENE__.specimen.burst(1));
const t0 = Date.now();
const out = [];
while (Date.now() - t0 < 6000) {
  const snap = await page.evaluate(() => {
    const S = window.__SCENE__.specimen;
    const rows = [];
    for (const p of S.pieces) {
      const tr = p.body.translation();
      const v = p.body.linvel();
      rows.push({
        d: Math.hypot(tr.x - p.home.x, tr.y - p.home.y, tr.z - p.home.z),
        v: Math.hypot(v.x, v.y, v.z),
        locked: !!p.locked,
      });
    }
    const ds = rows.map((r) => r.d).sort((a, b) => a - b);
    const vs = rows.map((r) => r.v).sort((a, b) => a - b);
    return {
      phase: S.phase,
      n: rows.length,
      locked: rows.filter((r) => r.locked).length,
      dMax: +ds[ds.length - 1].toFixed(3),
      dMed: +ds[Math.floor(ds.length / 2)].toFixed(3),
      vMax: +vs[vs.length - 1].toFixed(2),
      vMed: +vs[Math.floor(vs.length / 2)].toFixed(2),
      near: rows.filter((r) => r.d < 0.035 && r.v < 0.85).length,
    };
  });
  out.push({ t: Date.now() - t0, ...snap });
  await page.waitForTimeout(250);
}
console.log(JSON.stringify(out.filter((o, i) => i % 2 === 0), null, 0));
await browser.close();
