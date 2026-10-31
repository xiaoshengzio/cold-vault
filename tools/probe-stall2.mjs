import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://127.0.0.1:5273/';
const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist','--force_high_performance_gpu'] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__SCENE__ && window.__READY__ === true, null, { timeout: 60000 });
await page.waitForTimeout(600);
const t0 = Date.now();
await page.evaluate(() => { window.__SCENE__.specimen.burst(1); window.__T0__ = performance.now(); });
const samples = [];
for (let i = 0; i < 22; i++) {
  const s = await page.evaluate(() => ({
    f: window.__FRAMES__, ph: window.__SCENE__.specimen.phase,
    t: Math.round(performance.now() - window.__T0__),
    maxOff: (() => { let m = 0; for (const pc of window.__SCENE__.specimen.pieces) { const p = pc.mesh.position; m = Math.max(m, Math.hypot(p.x - pc.restPos.x, p.y - pc.restPos.y, p.z - pc.restPos.z)); } return +m.toFixed(3); })(),
  })).catch(() => ({}));
  samples.push(s);
  await page.waitForTimeout(200);
}
console.log(samples.map((s)=>s.t+'ms f='+s.f+' '+s.ph+' off='+s.maxOff).join('\n'));
await b.close();
