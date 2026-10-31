
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:5273/?q=auto', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'shots/194-hero.png' });
console.log('stats', JSON.stringify(await page.evaluate(() => window.__SCENE__.getStats())));
const box = await page.evaluate(() => {
  const S = window.__SCENE__; const v = S.specimen.group.getWorldPosition(new window.__THREE__.Vector3()).project(S.camera);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
});
await page.mouse.move(box.x + 40, box.y - 20);
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(520);
await page.screenshot({ path: 'shots/194-burst.png' });
await page.waitForTimeout(2600);
await page.screenshot({ path: 'shots/194-back.png' });
console.log('err', errs[0] || 'none');
await browser.close();
