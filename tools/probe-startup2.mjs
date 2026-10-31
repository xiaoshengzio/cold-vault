
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
const t0 = Date.now();
const marks = [0.5, 3, 8, 16, 26];
let last = 0;
for (const m of marks) {
  await page.waitForTimeout((m - last) * 1000);
  last = m;
  const s = await page.evaluate(() => window.__SCENE__.getStats());
  await page.screenshot({ path: 'shots/170-t' + String(m).replace('.', '_') + '.png', clip: { x: 380, y: 120, width: 620, height: 620 } });
  console.log('t+' + m + 's fps', s.fps, 'res', s.res, 'fx', s.fx);
}
await browser.close();
