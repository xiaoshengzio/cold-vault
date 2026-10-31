
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge', args: [] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
const log = [];
page.on('pageerror', e => log.push('PAGEERROR ' + e.message));
page.on('crash', () => log.push('CRASH'));
page.on('console', m => { if (m.type() === 'error') log.push('CONSOLE ' + m.text().slice(0, 200)); });

await page.addInitScript(() => {
  window.__MON = { frames: [], longtasks: [], homicides: [], lost: 0, heap: [] };
  const push = (d) => { const a = window.__MON.frames; a.push(d); if (a.length > 4000) a.shift(); };
  let last = performance.now();
  const tick = () => { const now = performance.now(); push(now - last); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__MON.longtasks.push(Math.round(e.duration) + '@' + Math.round(e.startTime)); })
      .observe({ entryTypes: ['longtask'] });
  } catch {}
  addEventListener('webglcontextlost', () => { window.__MON.lost++; }, true);
});

await page.goto('http://127.0.0.1:5273/', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 60000 });
for (let i = 0; i < 9; i++) {
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => {
    const M = window.__MON; const f = M.frames.slice(-300);
    f.sort((a, b) => a - b);
    return {
      t: Math.round(performance.now() / 1000),
      frames: M.frames.length,
      p50: +(f[Math.floor(f.length * 0.5)] || 0).toFixed(1),
      p95: +(f[Math.floor(f.length * 0.95)] || 0).toFixed(1),
      max: +(f[f.length - 1] || 0).toFixed(1),
      long: M.longtasks.length,
      worst: M.longtasks.slice(-3),
      lost: M.lost,
      heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1,
      stats: window.__SCENE__ ? window.__SCENE__.getStats() : null,
    };
  });
  console.log(JSON.stringify(s));
}
console.log(log.slice(0, 6).join(' | ') || 'no errors');
await browser.close();
