import { chromium } from 'playwright-core';

const delay = Number(process.argv[2] ?? 180);
const out = process.argv[3] ?? 'shots/burst-verify.png';
const browser = await chromium.launch({ channel: 'msedge', headless: true,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(2600);

const spread = () => page.evaluate(() => {
  const S = window.__SCENE__;
  const pts = S.specimen.pieces.map((p) => p.mesh.position.clone());
  const c = pts.reduce((a, b) => a.add(b), pts[0].clone()).multiplyScalar(1 / pts.length);
  let maxR = 0, minPair = Infinity;
  for (let i = 0; i < pts.length; i++) {
    maxR = Math.max(maxR, pts[i].distanceTo(c));
    for (let j = i + 1; j < pts.length; j++) minPair = Math.min(minPair, pts[i].distanceTo(pts[j]));
  }
  return { maxR: +maxR.toFixed(3), minPair: +minPair.toFixed(3) };
});

console.log('rest', JSON.stringify(await spread()));
await page.mouse.move(800, 430);
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(delay);
console.log('t+' + delay, JSON.stringify(await spread()));
await page.screenshot({ path: out });
console.log('SHOT', out);
await browser.close();
