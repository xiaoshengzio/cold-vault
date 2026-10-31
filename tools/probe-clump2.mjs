import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://127.0.0.1:5273/';
const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist','--force_high_performance_gpu','--use-angle=d3d11'] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__SCENE__ && window.__READY__ === true, null, { timeout: 60000 });
const snap = async (tag) => {
  const s = await page.evaluate(() => {
    const sp = window.__SCENE__.specimen;
    let boundR = 0, maxOff = 0, minPair = 9, ints = 0;
    const pos = [];
    for (const pc of sp.pieces) {
      const p = pc.mesh.position;
      pos.push([p.x, p.y, p.z]);
      boundR = Math.max(boundR, Math.hypot(p.x, p.y, p.z));
      maxOff = Math.max(maxOff, Math.hypot(p.x - pc.restPos.x, p.y - pc.restPos.y, p.z - pc.restPos.z));
    }
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
      const d = Math.hypot(pos[i][0]-pos[j][0], pos[i][1]-pos[j][1], pos[i][2]-pos[j][2]);
      if (d < minPair) minPair = d;
      if (d < 0.052) ints++;
    }
    return { phase: sp.phase, isClump: sp.isClump, settled: sp.settled, snapped: sp.snappedCount, boundR: +boundR.toFixed(3), maxOff: +maxOff.toFixed(3), minPair: +minPair.toFixed(4), tight: ints };
  });
  console.log(tag, JSON.stringify(s));
  return s;
};
await snap('rest1');
await page.evaluate(() => window.__SCENE__.specimen.burst(1));
await page.waitForTimeout(3400);
await snap('clump');
await page.evaluate(() => window.__SCENE__.specimen.burst(1));
await page.waitForTimeout(3400);
await snap('rest2');
console.log('errors', errs.length ? errs.slice(0,3) : 'none');
await b.close();
