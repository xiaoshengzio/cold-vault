
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: [] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__EV = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.duration > 250) window.__EV.push(Math.round(e.startTime) + ':LONG ' + Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); } catch {}
});
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'commit' });
await page.waitForTimeout(9000);
const before = await page.evaluate(() => window.__EV.length);
await page.evaluate(() => { window.__SCENE__.setQualityMode('high'); });
await page.waitForTimeout(4000);
const ev = await page.evaluate(() => window.__EV);
console.log('all longtasks:', JSON.stringify(ev));
console.log('after-load:', JSON.stringify(ev.slice(before)));
console.log('stats', JSON.stringify(await page.evaluate(() => window.__SCENE__.getStats())));
await browser.close();
