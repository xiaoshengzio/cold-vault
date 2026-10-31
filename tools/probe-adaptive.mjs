import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(6000);
const q = await page.evaluate(() => window.__SCENE__.getQuality());
const fps = await page.evaluate(() => new Promise((resolve) => {
  const times = []; let last = performance.now(); let n = 0;
  const tick = () => { const now = performance.now(); times.push(now - last); last = now; if (++n < 120) requestAnimationFrame(tick); else { const s = times.reduce((a,b)=>a+b,0); resolve(+(1000/(s/times.length)).toFixed(1)); } };
  requestAnimationFrame(tick);
}));
await page.screenshot({ path: 'shots/100-adaptive.png' });
console.log(JSON.stringify({ qualityScale: q, fps, errs }));
await browser.close();
