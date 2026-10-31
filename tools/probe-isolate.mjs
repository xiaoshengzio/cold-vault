import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const fpsOf = (page, n) => page.evaluate((frames) => new Promise((res) => {
  const t = []; let last = performance.now(), i = 0;
  const tick = () => { const now = performance.now(); t.push(now - last); last = now;
    if (++i < frames) requestAnimationFrame(tick);
    else { const s = t.slice().sort((a, b) => a - b); const avg = t.reduce((a, b) => a + b, 0) / t.length;
      res(+(1000 / avg).toFixed(1)); } };
  requestAnimationFrame(tick);
}), n);

async function run(label, query, dofOn, caOn) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
  await page.goto('http://127.0.0.1:5273/?q=high' + query, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
  await page.evaluate(([d, c]) => { const S = window.__SCENE__; S.dofPass.enabled = d; S.caPass.enabled = c; }, [dofOn, caOn]);
  await page.waitForTimeout(1800);
  const a = await fpsOf(page, 100);
  await page.waitForTimeout(500);
  const b = await fpsOf(page, 100);
  console.log(label.padEnd(30), a, b);
  await page.close();
}
await run('half  dof:on  ca:on', '', true, true);
await run('half  dof:off ca:on', '', false, true);
await run('half  dof:on  ca:off', '', true, false);
await run('half  dof:off ca:off', '', false, false);
await browser.close();
