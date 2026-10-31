
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://127.0.0.1:5274/';
const browser = await chromium.launch({ channel: 'msedge', args: process.argv[3] === 'dgpu' ? ['--ignore-gpu-blocklist','--force_high_performance_gpu'] : [] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__EV = [];
  const mark = (s) => window.__EV.push(Math.round(performance.now()) + 'ms ' + s);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) mark('LONG ' + Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); } catch {}
});
await page.goto(url, { waitUntil: 'commit' });
await page.screenshot({ path: 'shots/200-loading.png' });
await page.waitForTimeout(14000);
await page.screenshot({ path: 'shots/201-hero.png' });
console.log((await page.evaluate(() => window.__EV)).join('\n'));
await browser.close();
