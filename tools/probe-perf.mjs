import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load' });
const t0 = Date.now();
await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 30000 });
console.log('time-to-ready ms', Date.now() - t0);
const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t = performance.now();
  const loop = () => { n++; if (performance.now() - t > 3000) res({ frames: n, ms: performance.now() - t, fps: +(n / ((performance.now() - t) / 1000)).toFixed(1) }); else requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}));
console.log('fps', JSON.stringify(fps));
const budget = await page.evaluate(() => {
  const r = window.__SCENE__.renderer;
  return { pr: r.getPixelRatio(), size: r.getDrawingBufferSize(new window.__THREE__.Vector2()).toArray(), calls: r.info.render.calls, tris: r.info.render.triangles };
});
console.log('renderer', JSON.stringify(budget));
await page.screenshot({ path: 'shots/50-ui.png' });
await browser.close();
