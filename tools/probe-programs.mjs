import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist','--force_high_performance_gpu'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(process.argv[2] || 'http://127.0.0.1:5273/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__SCENE__ && window.__READY__ === true, null, { timeout: 90000 });
await page.waitForTimeout(1500);
const out = await page.evaluate(() => {
  const r = window.__SCENE__.renderer;
  const progs = (r.info.programs || []).map((p) => ({ name: p.name, used: p.usedTimes, cache: String(p.cacheKey).slice(0, 64) }));
  const mats = new Set();
  window.__SCENE__.scene.traverse((o) => { if (o.isMesh || o.isPoints) { const m = o.material; if (m) mats.add((m.type || '') + ':' + (m.name || '') + ':' + (m.uuid.slice(0, 6))); } });
  return { count: progs.length, names: progs.map((p) => p.name + ' x' + p.used), matCount: mats.size, calls: r.info.render.calls, tris: r.info.render.triangles, programs: r.info.programs.length };
});
console.log(JSON.stringify(out, null, 1));
await b.close();
