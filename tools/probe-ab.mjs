
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
await page.waitForTimeout(3000);

async function fps(label, setup) {
  await page.evaluate(setup);
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(tick); else res({ fps: Math.round(n / ((performance.now() - t0) / 1000)) }); };
    requestAnimationFrame(tick);
  }));
  console.log(label, JSON.stringify(r));
}

await fps('fx0 dof+ca ', () => window.__SCENE__.applyFx(0));
await fps('fx1 no dof ', () => window.__SCENE__.applyFx(1));
await fps('fx2 no both', () => window.__SCENE__.applyFx(2));
await fps('fx0 again  ', () => window.__SCENE__.applyFx(0));
await browser.close();
