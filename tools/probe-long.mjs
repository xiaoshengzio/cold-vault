
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: [] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
const marks = [];
page.on('console', m => { const t = m.text(); if (t.startsWith('__T') || t.startsWith('__LONG')) marks.push(Math.round(Date.now() - t0) + 'ms ' + t); });
const t0 = Date.now();
await page.addInitScript(() => {
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        const a = (e.attribution || []).map(x => x.name + ':' + x.containerType + ':' + (x.containerSrc || '')).join(',');
        console.log('__LONG ' + Math.round(e.duration) + 'ms start=' + Math.round(e.startTime) + ' [' + a + ']');
      }
    }).observe({ entryTypes: ['longtask'] });
  } catch {}
});
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'commit' });
await page.waitForTimeout(22000);
console.log(marks.join('\n'));
await browser.close();
