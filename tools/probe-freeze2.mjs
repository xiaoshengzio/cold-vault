
import { chromium } from 'playwright-core';

async function run(url, label) {
  const browser = await chromium.launch({ channel: 'msedge', args: [] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    window.__MON = { frames: [], tasks: [] };
    let last = performance.now();
    const tick = () => { const now = performance.now(); const d = now - last; last = now; if (window.__MON.frames.length < 5000) window.__MON.frames.push(d); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__MON.tasks.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); } catch {}
  });
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(28000);
  const s = await page.evaluate(() => {
    const M = window.__MON; const f = M.frames.slice(6).sort((a, b) => a - b);
    const over200 = f.filter(x => x > 200).length;
    return {
      n: f.length,
      p50: +(f[Math.floor(f.length * .5)] || 0).toFixed(1),
      p95: +(f[Math.floor(f.length * .95)] || 0).toFixed(1),
      max: +(f[f.length - 1] || 0).toFixed(0),
      stallsOver200ms: over200,
      longtasks: M.tasks.length,
      top: M.tasks.sort((a, b) => b - a).slice(0, 5),
      fx: window.__SCENE__ ? window.__SCENE__.getFx() : -1,
      res: window.__SCENE__ ? window.__SCENE__.getQuality() : -1,
    };
  });
  console.log(label, JSON.stringify(s), errs[0] ? 'ERR ' + errs[0] : '');
  await browser.close();
}

await run('http://127.0.0.1:5273/?q=high', 'high');
await run('http://127.0.0.1:5273/', 'auto');
await run('http://127.0.0.1:5273/?q=low', 'low');
