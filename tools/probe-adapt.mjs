
import { chromium } from 'playwright-core';
async function run(label, args, vp, dsf) {
  const browser = await chromium.launch({ channel: 'msedge', args });
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:5273/?q=auto', { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
  await page.waitForTimeout(2600);
  const s1 = await page.evaluate(() => window.__SCENE__.getStats());
  await page.waitForTimeout(2500);
  const s2 = await page.evaluate(() => window.__SCENE__.getStats());
  console.log(label, JSON.stringify({ gpu: s2.gpu.slice(0, 30), res: s2.res, fx: s2.fx, fps: s2.fps, buffer: s2.buffer, css: s2.css }), 'errs', errs.length ? errs[0] : 'none');
  await page.screenshot({ path: 'shots/196-' + label + '.png' });
  await browser.close();
}
await run('igpu-user', [], { width: 1146, height: 667 }, 1.25);
await run('dgpu-user', ['--ignore-gpu-blocklist', '--force_high_performance_gpu'], { width: 1146, height: 667 }, 1.25);
