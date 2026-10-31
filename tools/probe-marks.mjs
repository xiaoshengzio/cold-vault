
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://127.0.0.1:5274/';
const browser = await chromium.launch({ channel: 'msedge', args: [] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
const marks = [];
const t0 = Date.now();
page.on('console', (m) => { const t = m.text(); if (t.startsWith('[mk]')) marks.push(((Date.now() - t0)) + 'ms ' + t); });
page.on('pageerror', (e) => marks.push('ERR ' + e.message));
await page.goto(url, { waitUntil: 'commit' });
await page.waitForTimeout(16000);
console.log(marks.join('\n'));
await browser.close();
