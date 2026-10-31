
import { chromium } from 'playwright-core';
const gpu = process.argv[2] === 'dgpu' ? ['--ignore-gpu-blocklist','--force_high_performance_gpu'] : [];
const browser = await chromium.launch({ channel: 'msedge', args: gpu });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__EV = [];
  const mark = (s) => window.__EV.push([Math.round(performance.now()), s]);
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) mark('LONG ' + Math.round(e.duration) + ' (start ' + Math.round(e.startTime) + ')'); })
      .observe({ entryTypes: ['longtask'] });
  } catch {}
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.body;
    const pre = document.getElementById('preloader');
    new MutationObserver(() => mark('body="' + b.className + '"')).observe(b, { attributes: true, attributeFilter: ['class'] });
    if (pre) new MutationObserver(() => mark('pre="' + pre.className + '"')).observe(pre, { attributes: true, attributeFilter: ['class'] });
  });
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    const d = now - last; last = now;
    if (d > 300) mark('GAP ' + Math.round(d));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.goto(process.argv[3] || 'http://127.0.0.1:5273/', { waitUntil: 'commit' });
await page.waitForTimeout(14000);
const ev = await page.evaluate(() => window.__EV);
console.log((gpu.length ? 'dgpu' : 'igpu') + ' ' + (process.argv[3] || 'dev') + ' timeline:');
console.log(ev.map(([t, s]) => '  ' + t + 'ms ' + s).join('\n'));
await browser.close();
