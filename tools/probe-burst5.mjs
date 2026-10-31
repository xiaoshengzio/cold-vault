import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(2600);
const state = () => page.evaluate(() => {
  const S = window.__SCENE__;
  const ps = S.specimen.pieces;
  let solidVis = null, maxOff = 0, sum = 0;
  const solid = S.specimen.solid;
  const target = ps[0].mesh.position.clone();
  return {
    settled: S.specimen.settled,
    solidVisible: solid ? solid.visible : 'n/a',
    pieceVisible: ps.filter((p) => p.mesh.visible).length,
    n: ps.length,
    maxOff: +Math.max(...ps.map((p) => p.mesh.position.distanceTo(p.home))).toFixed(3),
  };
});
console.log('before', JSON.stringify(await state()));
await page.mouse.move(800, 430);
await page.mouse.down();
await page.mouse.up();
for (const t of [60, 150, 300, 600]) {
  await page.waitForTimeout(t === 60 ? 60 : 150);
  console.log('t+' + t, JSON.stringify(await state()));
}
await page.screenshot({ path: 'shots/213-burst.png' });
console.log('SHOT shots/213-burst.png');
await browser.close();
