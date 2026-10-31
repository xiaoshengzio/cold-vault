
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist','--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://127.0.0.1:5273/?debug=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const frameTimes = [];
await page.evaluate(() => {
  window.__ft = [];
  let last = performance.now();
  const tick = () => { const now = performance.now(); window.__ft.push(now - last); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(1000);
  const st = await page.evaluate(() => {
    const S = window.__SCENE__;
    const ft = window.__ft.splice(0).filter(t => t > 0 && t < 500).sort((a,b)=>a-b);
    const med = ft.length ? ft[Math.floor(ft.length/2)] : 0;
    return { ...S.getStats(), fpsMed: +(1000/Math.max(0.001, med)).toFixed(1), n: ft.length };
  });
  console.log(i, JSON.stringify(st));
}
console.log('errors', errs.slice(0, 3));
await browser.close();
