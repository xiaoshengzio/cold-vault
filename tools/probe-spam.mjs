
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('crash', () => errs.push('CRASH'));
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
await page.waitForTimeout(2000);
const box = await page.evaluate(() => {
  const S = window.__SCENE__;
  const v = S.specimen.group.getWorldPosition(new window.__THREE__.Vector3()).project(S.camera);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
});
for (let i = 0; i < 12; i++) {
  await page.mouse.click(box.x + (i % 3) * 8 - 8, box.y + (i % 2) * 8 - 4);
  await page.waitForTimeout(70);
}
const probe = () => page.evaluate(() => {
  const S = window.__SCENE__;
  const c = new window.__THREE__.Vector3(); S.specimen.group.getWorldPosition(c);
  let maxR = 0, nan = 0, maxV = 0;
  for (const p of S.specimen.pieces) {
    const w = p.mesh.getWorldPosition(new window.__THREE__.Vector3());
    const d = w.distanceTo(c);
    if (!isFinite(d)) nan++;
    maxR = Math.max(maxR, d);
    const lv = p.body.linvel();
    const v = Math.hypot(lv.x, lv.y, lv.z);
    if (!isFinite(v)) nan++;
    maxV = Math.max(maxV, v);
  }
  return { maxR: +maxR.toFixed(2), maxV: +maxV.toFixed(2), nan, fps: S.getStats().fps };
});
for (let i = 0; i < 6; i++) { await page.waitForTimeout(500); console.log('t+' + (i + 1) * 0.5, JSON.stringify(await probe())); }
await page.screenshot({ path: 'shots/182-after-spam.png' });
console.log('errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close();
