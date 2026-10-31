import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load' });
const t0 = Date.now();
await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 40000 });
console.log('ready ms', Date.now() - t0);
const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t = performance.now();
  const loop = () => { n++; const d = performance.now() - t; if (d > 3000) res(+(n / (d / 1000)).toFixed(1)); else requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}));
console.log('fps', fps);
await page.waitForTimeout(700);
await page.screenshot({ path: 'shots/52-hero.png' });
if (errs.length) console.log('ERRS', errs.join('|'));
await browser.close();
