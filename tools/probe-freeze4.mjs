import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://127.0.0.1:5274/';
const browser = await chromium.launch({ channel: 'msedge', headless: true,
  args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('[error] ' + m.text().slice(0, 160)); });
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.evaluate(() => { window.__RAF__ = 0; const tick = () => { window.__RAF__++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
const rows = [];
for (let i = 0; i < 16; i++) {
  const s = await page.evaluate(() => ({
    ready: !!window.__READY__, frames: window.__FRAMES__ || 0, raf: window.__RAF__ || 0,
    cls: document.body.className, num: (document.getElementById('pl-num') || {}).textContent,
    phase: window.__SCENE__?.specimen?.phase ?? null,
  })).catch((e) => ({ err: String(e).slice(0, 80) }));
  rows.push({ t: Date.now() - t0, ...s });
  await page.waitForTimeout(700);
}
console.log(JSON.stringify(rows));
console.log('ERRS', JSON.stringify(errs.slice(0, 8)));
await browser.close();
