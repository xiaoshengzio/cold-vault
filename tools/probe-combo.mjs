import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const fpsOf = (page, n) => page.evaluate((frames) => new Promise((res) => {
  const t = []; let last = performance.now(), i = 0;
  const tick = () => { const now = performance.now(); t.push(now - last); last = now;
    if (++i < frames) requestAnimationFrame(tick);
    else { const s = t.slice().sort((a, b) => a - b); const avg = t.reduce((a, b) => a + b, 0) / t.length;
      res({ fps: +(1000 / avg).toFixed(1), p50: +s[Math.floor(s.length * 0.5)].toFixed(1) }); } };
  requestAnimationFrame(tick);
}), n);

async function run(label, query, fx, shot) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
  await page.goto('http://127.0.0.1:5273/?q=high' + query, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
  await page.evaluate((f) => window.__SCENE__.applyFx(f), fx);
  await page.waitForTimeout(1800);
  const r = await fpsOf(page, 100);
  if (shot) await page.screenshot({ path: shot });
  console.log(label.padEnd(26), JSON.stringify(r));
  await page.close();
}
await run('half + smaa + fx0', '&msaa=0', 0, 'shots/131-half-fx0.png');
await run('half + smaa + fx1', '&msaa=0', 1, null);
await run('u8   + smaa + fx0', '&msaa=0&fb=u8', 0, 'shots/132-u8-fx0.png');
await run('u8   + smaa + fx1', '&msaa=0&fb=u8', 1, null);
await run('u8   + smaa + fx2', '&msaa=0&fb=u8', 2, null);
await browser.close();
