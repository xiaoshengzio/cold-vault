import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });

const fpsOf = (page, n) => page.evaluate((frames) => new Promise((res) => {
  const t = []; let last = performance.now(), i = 0;
  const tick = () => { const now = performance.now(); t.push(now - last); last = now;
    if (++i < frames) requestAnimationFrame(tick);
    else { const s = t.slice().sort((a, b) => a - b); const avg = t.reduce((a, b) => a + b, 0) / t.length;
      res({ fps: +(1000 / avg).toFixed(1), p50: +s[Math.floor(s.length * 0.5)].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1) }); } };
  requestAnimationFrame(tick);
}), n);

async function run(dsf, query, label) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: dsf });
  await page.goto('http://127.0.0.1:5273/?q=high' + query, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
  await page.waitForTimeout(2000);
  const stats = await page.evaluate(() => window.__SCENE__.getStats());
  const a = await fpsOf(page, 120);
  console.log(String(dsf).padEnd(5), label.padEnd(22), String(stats.buffer[0] + 'x' + stats.buffer[1]).padEnd(11), JSON.stringify(a));
  await page.close();
}

for (const dsf of [1.25]) {
  await run(dsf, '', 'msaa4 + half');
  await run(dsf, '&msaa=0', 'msaa0 + half + SMAA');
  await run(dsf, '&msaa=0&fb=u8', 'msaa0 + u8 + SMAA');
  await run(dsf, '&fb=u8', 'msaa4 + u8');
}
await browser.close();
