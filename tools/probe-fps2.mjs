
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5273/?q=auto', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
await page.waitForTimeout(3000);
const fpsNow = () => page.evaluate(() => new Promise(r => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else r(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); };
  requestAnimationFrame(tick);
}));
console.log('rest fps', await fpsNow(), JSON.stringify(await page.evaluate(() => window.__SCENE__.getStats())));
const box = await page.evaluate(() => {
  const S = window.__SCENE__; const v = S.specimen.group.getWorldPosition(new window.__THREE__.Vector3()).project(S.camera);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
});
await page.mouse.click(box.x, box.y);
await page.waitForTimeout(600);
console.log('burst fps', await fpsNow());
await page.waitForTimeout(2000);
console.log('after fps', await fpsNow());
for (const t of [0, 150, 400, 900]) {
  if (t) await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(t === 0 ? 0 : t);
  await page.screenshot({ path: 'shots/191-b' + t + '.png', clip: { x: 520, y: 100, width: 660, height: 700 } });
}
await browser.close();
