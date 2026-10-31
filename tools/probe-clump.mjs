import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 60000 });
await page.waitForTimeout(1200);

const snap = () => page.evaluate(() => {
  const s = window.__SCENE__.specimen;
  let maxV = 0, maxR = 0, meanR = 0, n = 0;
  for (const p of s.pieces) {
    const t = p.body.translation();
    const r = Math.hypot(t.x, t.y, t.z);
    if (r > maxR) maxR = r;
    meanR += r;
    const v = p.body.linvel();
    const sp = Math.hypot(v.x, v.y, v.z);
    if (sp > maxV) maxV = sp;
    n++;
  }
  return { phase: s.phase, clump: s.isClump, maxV: +maxV.toFixed(3), maxR: +maxR.toFixed(3), meanR: +(meanR / n).toFixed(3) };
});

console.log('init    ', JSON.stringify(await snap()));
await page.mouse.move(800, 450);
await page.mouse.down();
await page.mouse.up();
for (const ms of [250, 250, 300, 400, 500, 800, 1000, 1200, 1500]) {
  await page.waitForTimeout(ms);
  console.log('+' + ms, JSON.stringify(await snap()));
}
await page.screenshot({ path: 'shots/clump-rest.png' });
console.log('after ', JSON.stringify(await snap()));

// 再点一次：从团块重新爆开
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(400);
console.log('reburst', JSON.stringify(await snap()));
await page.waitForTimeout(2600);
console.log('resettle', JSON.stringify(await snap()));
await page.screenshot({ path: 'shots/clump-rest2.png' });

// 拖动检视：按下移动 200px 不应触发碎裂
await page.mouse.move(800, 450);
await page.mouse.down();
await page.mouse.move(900, 470, { steps: 8 });
await page.mouse.move(1000, 480, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(120);
console.log('after drag (should stay rest)', JSON.stringify(await snap()));
await browser.close();
