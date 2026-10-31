
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const S = window.__SCENE__;
  return { pieces: S.specimen.pieces.length, fps: S.getStats().fps, gpu: S.getStats().gpu.slice(0, 44) };
});
console.log('rest', JSON.stringify(info));
const box = await page.evaluate(() => {
  const S = window.__SCENE__;
  const v = S.specimen.group.getWorldPosition(new window.__THREE__.Vector3()).project(S.camera);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
});
await page.mouse.click(box.x, box.y);
const shots = [[120], [300], [700], [1300], [2200]];
let prev = 0;
for (const [t] of shots) {
  await page.waitForTimeout(t - prev); prev = t;
  await page.screenshot({ path: 'shots/190-b' + t + '.png', clip: { x: 480, y: 60, width: 720, height: 760 } });
}
const end = await page.evaluate(() => {
  const S = window.__SCENE__;
  const c = new window.__THREE__.Vector3(); S.specimen.group.getWorldPosition(c);
  let maxR = 0, maxOff = 0;
  for (const p of S.specimen.pieces) {
    maxR = Math.max(maxR, p.mesh.position.distanceTo(c));
    maxOff = Math.max(maxOff, p.mesh.position.distanceTo(p.home));
  }
  return { maxR: +maxR.toFixed(3), maxOff: +maxOff.toFixed(4), fps: S.getStats().fps };
});
console.log('after', JSON.stringify(end), 'err', errs.length ? errs[0] : 'none');
await browser.close();
