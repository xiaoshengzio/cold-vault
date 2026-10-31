
import { chromium } from 'playwright-core';
async function run(label, url, extraArgs = []) {
  const browser = await chromium.launch({ channel: 'msedge', args: extraArgs });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    window.__MON = { frames: [], tasks: [] };
    let last = performance.now();
    const tick = () => { const now = performance.now(); if (window.__MON.frames.length < 6000) window.__MON.frames.push(now - last); last = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__MON.tasks.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); } catch {}
  });
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 60000 });
  const tReady = Date.now();
  await page.waitForTimeout(20000);
  const s = await page.evaluate(() => {
    const M = window.__MON; const f = M.frames.slice(6).sort((a, b) => a - b);
    return {
      n: f.length,
      p50: +(f[Math.floor(f.length * .5)] || 0).toFixed(1),
      p95: +(f[Math.floor(f.length * .95)] || 0).toFixed(1),
      max: Math.round(f[f.length - 1] || 0),
      over200: f.filter(x => x > 200).length,
      longtasks: M.tasks.length,
      top: M.tasks.sort((a, b) => b - a).slice(0, 3),
      stats: window.__SCENE__.getStats(),
    };
  });
  console.log(label, JSON.stringify({ ...s, stats: { res: s.stats.res, ceil: s.stats.ceil, fx: s.stats.fx, buffer: s.stats.buffer, fps: s.stats.fps } }));
  await page.screenshot({ path: 'shots/198-' + label + '.png' });
  // 点击爆发，看是否还有编译卡顿
  const box = await page.evaluate(() => {
    const S = window.__SCENE__; const v = S.specimen.group.getWorldPosition(new window.__THREE__.Vector3()).project(S.camera);
    return { x: (v.x * .5 + .5) * innerWidth, y: (-v.y * .5 + .5) * innerHeight };
  });
  const before = await page.evaluate(() => window.__MON.frames.length);
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(3500);
  const after = await page.evaluate((b) => {
    const f = window.__MON.frames.slice(b).sort((a, c) => a - c);
    return { max: Math.round(f[f.length - 1] || 0), p95: +(f[Math.floor(f.length * .95)] || 0).toFixed(1) };
  }, before);
  console.log(label + ' burst-stall', JSON.stringify(after), 'readyIn', Math.round((tReady - Date.now() + 20000) / 1000) + 's');
  console.log(label, 'err', errs[0] || 'none');
  await browser.close();
}
await run('igpu', 'http://127.0.0.1:5273/');
await run('dgpu', 'http://127.0.0.1:5273/', ['--ignore-gpu-blocklist', '--force_high_performance_gpu']);
