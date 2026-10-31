import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });

async function run(dsf, out) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: dsf });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  page.on('console', (m) => { if (m.type() === 'error' || /MSAA|WebGL|framebuffer/i.test(m.text())) errs.push(m.text().slice(0, 140)); });
  await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
  const trace = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(2500);
    trace.push(await page.evaluate(() => { const s = window.__SCENE__.getStats(); return [s.res, s.fx, s.buffer[0], s.fps]; }));
  }
  await page.screenshot({ path: out });
  console.log('dsf', dsf, JSON.stringify(trace), 'errs', JSON.stringify(errs.slice(0, 3)));
  await page.close();
}
await run(1, 'shots/128-auto-dpr1.png');
await run(1.25, 'shots/129-auto-dpr125.png');
await run(2, 'shots/130-auto-dpr2.png');
await browser.close();
