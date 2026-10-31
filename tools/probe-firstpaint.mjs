
import { chromium } from 'playwright-core';
const url = process.argv[2];
const browser = await chromium.launch({ channel: 'msedge', args: [] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
const t0 = Date.now();
page.goto(url, { waitUntil: 'commit' }).catch(() => {});
await page.waitForTimeout(220);
try { await page.screenshot({ path: process.argv[3], timeout: 30000 }); console.log('shot at', Date.now() - t0, 'ms'); }
catch (e) { console.log('shot failed', e.message.slice(0, 80), Date.now() - t0); }
await browser.close();
