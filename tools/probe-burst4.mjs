
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
await page.waitForTimeout(2200);
await page.screenshot({ path: 'shots/192-s0.png', clip: { x: 520, y: 100, width: 660, height: 700 } });
const box = await page.evaluate(() => {
  const S = window.__SCENE__; const v = S.specimen.group.getWorldPosition(new window.__THREE__.Vector3()).project(S.camera);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
});
await page.mouse.click(box.x, box.y);
let prev = 0;
for (const t of [220, 500, 950, 1500, 2200, 3000]) {
  await page.waitForTimeout(t - prev); prev = t;
  await page.screenshot({ path: 'shots/192-s' + t + '.png', clip: { x: 520, y: 100, width: 660, height: 700 } });
}
const st = await page.evaluate(() => {
  const S = window.__SCENE__; let maxOff = 0;
  for (const p of S.specimen.pieces) maxOff = Math.max(maxOff, p.mesh.position.distanceTo(p.home));
  return { pieces: S.specimen.pieces.length, maxOff: +maxOff.toFixed(4) };
});
console.log('end', JSON.stringify(st), 'err', errs[0] || 'none');
await browser.close();
