import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(3000);

const info = await page.evaluate(() => {
  const S = window.__SCENE__.specimen;
  return { pieces: S.pieces.length, settled: S.settled, phase: S.phase };
});
console.log('INIT', JSON.stringify(info));

await page.mouse.move(800, 450);
await page.mouse.down();
await page.mouse.up();

const shots = [ { ms: 1600, name: '251-scatter-late' }, { ms: 2600, name: '252-pull' }, { ms: 3400, name: '253-assembling' }, { ms: 6000, name: '254-rest' } ];
let elapsed = 0;
const samples = [];
const t0 = Date.now();
while (Date.now() - t0 < 6200) {
  const snap = await page.evaluate(() => {
    const S = window.__SCENE__.specimen;
    let maxOff = 0, maxV = 0;
    for (const p of S.pieces) {
      const tr = p.body.translation();
      const v = p.body.linvel();
      maxOff = Math.max(maxOff, Math.hypot(tr.x - p.home.x, tr.y - p.home.y, tr.z - p.home.z));
      maxV = Math.max(maxV, Math.hypot(v.x, v.y, v.z));
    }
    return { phase: S.phase, snapped: S.snappedCount, maxOff: +maxOff.toFixed(3), maxV: +maxV.toFixed(2) };
  });
  samples.push({ t: Date.now() - t0, ...snap });
  for (const s of shots) {
    if (!s.done && Date.now() - t0 >= s.ms) { s.done = true; await page.screenshot({ path: 'shots/' + s.name + '.png' }); }
  }
  await page.waitForTimeout(120);
}
console.log('SAMPLES', JSON.stringify(samples.filter((s, i) => i % 3 === 0)));
console.log('FPS', JSON.stringify(await page.evaluate(() => window.__SCENE__.getStats())));
await browser.close();
