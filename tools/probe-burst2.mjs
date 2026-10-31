
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('crash', () => errs.push('CRASH'));
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
await page.waitForTimeout(2000);

const stats = () => page.evaluate(() => {
  const S = window.__SCENE__;
  const g = S.specimen.group;
  const ps = S.specimen.pieces.map(p => p.mesh.getWorldPosition(new window.__THREE__.Vector3()));
  const c = new window.__THREE__.Vector3(); g.getWorldPosition(c);
  let maxR = 0, nan = 0, minY = 1e9, maxY = -1e9;
  for (const p of ps) {
    const d = p.distanceTo(c);
    if (!isFinite(d)) nan++;
    maxR = Math.max(maxR, d);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return { n: ps.length, maxR: +maxR.toFixed(3), nan, minY: +minY.toFixed(2), maxY: +maxY.toFixed(2), cam: S.camera.position.toArray().map(v => +v.toFixed(2)) };
});

console.log('rest', JSON.stringify(await stats()));
await page.screenshot({ path: 'shots/180-rest.png' });

// 真实点击标本所在屏幕位置
const box = await page.evaluate(() => {
  const S = window.__SCENE__;
  const v = S.specimen.group.getWorldPosition(new window.__THREE__.Vector3()).project(S.camera);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
});
console.log('specimen at', JSON.stringify(box));
await page.mouse.move(box.x, box.y);
await page.waitForTimeout(120);
await page.mouse.down(); await page.mouse.up();

for (const t of [200, 600, 1200, 2400, 4000, 6000]) {
  await page.waitForTimeout(t === 200 ? 200 : (t - (t === 600 ? 200 : t === 1200 ? 600 : t === 2400 ? 1200 : t === 4000 ? 2400 : 4000)));
  console.log('t+' + t, JSON.stringify(await stats()));
  await page.screenshot({ path: 'shots/181-burst-' + t + '.png' });
}
console.log('errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close();
