import { chromium } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] || 'http://127.0.0.1:5273/';
const runs = Number(process.argv[3] || 3);
const profile = 'C:/工作区/Projects/个人站·冷库/tmp-profile';

const ctx = await chromium.launchPersistentContext(profile, {
  channel: 'msedge',
  headless: true,
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1.25,
  args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'],
});

const out = [];
for (let i = 0; i < runs; i++) {
  const page = await ctx.newPage();
  const longtasks = [];
  await page.addInitScript(() => {
    window.__LT__ = [];
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__LT__.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] });
    } catch {}
    window.__BOOTLOG__ = [];
    const t0 = performance.now();
  });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const domMs = Date.now() - t0;
  let firstFrame = null, ready = null;
  for (let k = 0; k < 600; k++) {
    const st = await page.evaluate(() => ({ f: window.__FRAMES__ || 0, r: window.__READY__ === true, b: window.__BOOT__ || null })).catch(() => ({}));
    if (firstFrame === null && st.f > 0) firstFrame = Date.now() - t0;
    if (st.r) { ready = Date.now() - t0; break; }
    await page.waitForTimeout(100);
  }
  const lt = await page.evaluate(() => ({ lt: window.__LT__ || [], stats: window.__SCENE__?.getStats?.() || null })).catch(() => ({}));
  const ltSum = (lt.lt || []).reduce((a, b) => a + b, 0);
  const ltMax = (lt.lt || []).reduce((a, b) => Math.max(a, b), 0);
  out.push({ run: i + 1, domMs, firstFrame, ready, longtasks: (lt.lt || []).length, ltSum, ltMax, gpu: lt.stats?.gpu, res: lt.stats?.res, fx: lt.stats?.fx });
  await page.close();
}
console.log(JSON.stringify(out, null, 1));
await ctx.close();
