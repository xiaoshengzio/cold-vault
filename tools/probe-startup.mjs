
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
const t0 = Date.now();
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'commit' });
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(200);
  const s = await page.evaluate(() => (window.__SCENE__ && window.__SCENE__.getStats) ? window.__SCENE__.getStats() : null);
  console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(s));
  if (i > 8 && s && s.fps > 55 && s.res >= s.ceil - 0.001) { /* keep sampling */ }
}
await browser.close();
