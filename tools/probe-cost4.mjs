
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: [] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5273/?q=low', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 60000 });
await page.waitForTimeout(4000);
const fps = () => page.evaluate(() => new Promise(r => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(tick); else r(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); };
  requestAnimationFrame(tick);
}));
const S = (fn) => page.evaluate(fn);
console.log('baseline      ', await fps(), JSON.stringify(await S(() => window.__SCENE__.getStats().buffer)));
await S(() => { window.__SCENE__.renderer.shadowMap.enabled = false; });
console.log('no shadow     ', await fps());
await S(() => { window.__SCENE__.renderer.shadowMap.enabled = true; const c = window.__SCENE__.composer; c.passes[1].enabled = false; });
console.log('no bloom/dof  ', await fps());
await S(() => { const c = window.__SCENE__.composer; c.passes[2].enabled = false; });
console.log('no shadow+grade', await fps());
await S(() => { const c = window.__SCENE__.composer; c.passes[1].enabled = true; c.passes[2].enabled = true; const s = window.__SCENE__.scene; s.traverse(o => { if (o.isPoints) o.visible = false; }); });
console.log('no dust       ', await fps());
await S(() => { const s = window.__SCENE__; s.beams.group.visible = false; });
console.log('dust+beams off', await fps());
await browser.close();
