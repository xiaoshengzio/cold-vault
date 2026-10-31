import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge', headless: true,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(1200);

const read = () => page.evaluate(() => {
  const S = window.__SCENE__;
  const d = S.specimen.pieces.map((p) => p.mesh.position.distanceTo(p.home));
  d.sort((a, b) => a - b);
  return { n: d.length, max: +d[d.length - 1].toFixed(3), median: +d[Math.floor(d.length / 2)].toFixed(3) };
});

console.log('rest', JSON.stringify(await read()));
await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown', { clientX: 640, clientY: 360 })));
for (const ms of [120, 200, 350, 600, 1000, 1600, 2400, 3600]) {
  await page.waitForTimeout(ms === 120 ? 120 : ms - 0);
  console.log('t+', ms, JSON.stringify(await read()));
}
await browser.close();
