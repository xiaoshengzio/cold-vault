
import { chromium } from 'playwright-core';
const url = process.argv[2];
const browser = await chromium.launch({ channel: 'msedge', args: [] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__LT = [];
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__LT.push(Math.round(e.duration)); })
      .observe({ entryTypes: ['longtask'] });
  } catch {}
});
const t0 = Date.now();
await page.goto(url, { waitUntil: 'commit' });
await page.waitForTimeout(26000);
const res = await page.evaluate(() => ({
  lt: window.__LT, frames: window.__FRAMES__ || 0, ready: window.__READY__ === true,
  pre: document.getElementById('preloader')?.className,
  status: document.getElementById('pl-status')?.textContent,
}));
const big = res.lt.filter(x => x > 400);
console.log(url, '| longtasks>400ms:', JSON.stringify(big), '| count', res.lt.length, '| max', Math.max(0, ...res.lt));
console.log('   frames', res.frames, 'ready', res.ready, '| pre', res.pre, '| status', res.status, '| wait', Date.now() - t0);
await browser.close();
