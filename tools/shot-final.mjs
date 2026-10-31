
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });

async function run(name, viewport, dsf, out, wait) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message)));
  await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
  await page.waitForTimeout(wait);
  const stats = await page.evaluate(() => window.__SCENE__.getStats());
  await page.screenshot({ path: out });
  console.log(name, JSON.stringify(stats), 'errors:', errs.length ? errs.join(' | ') : 'none');
  await ctx.close();
}

await run('desk125', { width: 1600, height: 900 }, 1.25, 'shots/160-final-desk.png', 4000);
await run('mobile', { width: 390, height: 844 }, 3, 'shots/161-final-mobile.png', 4000);
await browser.close();
