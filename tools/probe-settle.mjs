
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5273/?q=auto', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
await page.waitForTimeout(2200);
const box = await page.evaluate(() => {
  const S = window.__SCENE__; const v = S.specimen.group.getWorldPosition(new window.__THREE__.Vector3()).project(S.camera);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
});
await page.mouse.move(box.x, box.y - 260);
console.log('before', await page.evaluate(() => window.__SCENE__.specimen.settled));
await page.mouse.click(box.x, box.y);
await page.mouse.move(box.x, box.y - 260);
await page.waitForTimeout(3400);
const st = await page.evaluate(() => {
  const S = window.__SCENE__; let maxOff = 0;
  for (const p of S.specimen.pieces) maxOff = Math.max(maxOff, p.mesh.position.distanceTo(p.home));
  let maxRot = 0;
  for (const p of S.specimen.pieces) { const q = p.mesh.quaternion; maxRot = Math.max(maxRot, Math.abs(q.w)); }
  return { settled: S.specimen.settled, maxOff: +maxOff.toFixed(4), maxQuatW: +maxRot.toFixed(4) };
});
console.log('after', JSON.stringify(st));
await browser.close();
