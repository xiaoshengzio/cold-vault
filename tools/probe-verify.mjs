
import { chromium } from 'playwright-core';
async function run(label, args) {
  const browser = await chromium.launch({ channel: 'msedge', args });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('crash', () => errs.push('CRASH'));
  await page.goto('http://127.0.0.1:5273/?q=auto', { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
  await page.waitForTimeout(2500);
  const box = await page.evaluate(() => {
    const S = window.__SCENE__; const v = S.specimen.group.getWorldPosition(new window.__THREE__.Vector3()).project(S.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  });
  for (let i = 0; i < 8; i++) { await page.mouse.click(box.x + (i % 3) * 6, box.y + (i % 4) * 5); await page.waitForTimeout(90); }
  await page.waitForTimeout(3200);
  const st = await page.evaluate(() => {
    const S = window.__SCENE__; let maxOff = 0;
    for (const p of S.specimen.pieces) maxOff = Math.max(maxOff, p.mesh.position.distanceTo(p.home));
    const g = S.getStats();
    return { pieces: S.specimen.pieces.length, maxOff: +maxOff.toFixed(4), fps: g.fps, res: g.res, fx: g.fx, gpu: g.gpu.slice(0, 34) };
  });
  console.log(label, JSON.stringify(st), 'errs', errs.length ? errs.slice(0, 2).join(' | ') : 'none');
  await browser.close();
}
await run('dgpu', ['--ignore-gpu-blocklist', '--force_high_performance_gpu']);
await run('igpu', []);
