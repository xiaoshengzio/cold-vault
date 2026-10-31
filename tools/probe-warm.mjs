
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://127.0.0.1:5273/';
const browser = await chromium.launch({ channel: 'msedge', args: [] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
const marks = []; const t0 = Date.now();
page.on('console', (m) => { const t = m.text(); if (t.startsWith('__W') || t.startsWith('__T')) marks.push(((Date.now() - t0) / 1000).toFixed(1) + 's ' + t); });
await page.addInitScript(() => { window.__LT = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__LT.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); } catch {} });
await page.goto(url, { waitUntil: 'commit' });
await page.waitForTimeout(26000);
console.log(marks.join('\n'));
const res = await page.evaluate(() => ({ lt: window.__LT.filter((x) => x > 400) }));
console.log('longtasks>400ms', JSON.stringify(res.lt));
await browser.close();
