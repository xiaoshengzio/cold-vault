
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });

async function shot(name, url, viewport, dsf, out, wait) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message)));
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
  await page.waitForTimeout(wait);
  const s = await page.evaluate(() => window.__SCENE__.getStats());
  await page.screenshot({ path: out });
  console.log(name, JSON.stringify({ fx: s.fx, res: s.res, ceil: s.ceil, fps: s.fps, gpu: s.gpu.slice(0, 40) }), 'err', errs.length ? errs[0] : 'none');
  await ctx.close();
}

await shot('auto-desktop', 'http://127.0.0.1:5273/', { width: 1600, height: 900 }, 1.25, 'shots/172-auto.png', 3000);
await shot('high-desktop', 'http://127.0.0.1:5273/?q=high', { width: 1600, height: 900 }, 1.25, 'shots/173-high.png', 3000);
await shot('auto-mobile', 'http://127.0.0.1:5273/', { width: 390, height: 844 }, 3, 'shots/174-mobile.png', 3000);
await browser.close();
