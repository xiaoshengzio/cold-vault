
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: [] });
const ctx = await browser.newContext({ viewport: { width: 1146, height: 667 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5273/?q=auto', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
await page.waitForTimeout(3000);
const fpsNow = () => page.evaluate(() => new Promise(r => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else r(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); };
  requestAnimationFrame(tick);
}));
const info = await page.evaluate(() => {
  const S = window.__SCENE__;
  return S.composer.passes.map((p, i) => i + ':' + p.constructor.name + ':' + (p.effects ? p.effects.length : 0));
});
console.log('passes', JSON.stringify(info));
console.log('baseline', await fpsNow());
await page.evaluate(() => { const S = window.__SCENE__; S.composer.passes[1].enabled = false; });
console.log('no bloom/dof pass', await fpsNow());
await page.evaluate(() => { const S = window.__SCENE__; S.composer.passes[1].enabled = true; S.composer.passes[2].enabled = false; });
console.log('no grade pass', await fpsNow());
await page.evaluate(() => { const S = window.__SCENE__; S.composer.passes[2].enabled = true; S.composer.passes[3].enabled = false; });
console.log('no CA pass', await fpsNow());
await browser.close();
