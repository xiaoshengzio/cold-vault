import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://127.0.0.1:5273/';
const browser = await chromium.launch({
  channel: 'msedge',
  args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 60000 });
await page.waitForTimeout(1200);

const snap = () => page.evaluate(() => {
  const s = window.__SCENE__.specimen;
  let maxOff = 0, maxV = 0;
  for (const p of s.pieces) {
    const t = p.body.translation();
    const d = Math.hypot(t.x - p.home.x, t.y - p.home.y, t.z - p.home.z);
    if (d > maxOff) maxOff = d;
    const v = p.body.linvel();
    const sp = Math.hypot(v.x, v.y, v.z);
    if (sp > maxV) maxV = sp;
  }
  return { phase: s.phase, settled: s.settled, snapped: s.snappedCount, maxOff: +maxOff.toFixed(3), maxV: +maxV.toFixed(3) };
});

const clickCenter = async (label, x = 700, y = 420) => {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  console.log(label, JSON.stringify(await snap()));
};

console.log('init  ', JSON.stringify(await snap()));
await clickCenter('click1');
await page.waitForTimeout(350);
console.log(' +350ms', JSON.stringify(await snap()));
await page.waitForTimeout(2600);
console.log(' rest  ', JSON.stringify(await snap()));

await clickCenter('click2');
await page.waitForTimeout(350);
console.log(' +350ms', JSON.stringify(await snap()));
await page.waitForTimeout(2600);
console.log(' rest  ', JSON.stringify(await snap()));

await clickCenter('click3');
await page.waitForTimeout(350);
console.log(' +350ms', JSON.stringify(await snap()));
await page.waitForTimeout(2600);
console.log(' rest  ', JSON.stringify(await snap()));

console.log('DOM check', await page.evaluate(({ x, y }) => {
  const el = document.elementFromPoint(x, y);
  return el ? el.tagName + '#' + el.id + '.' + el.className : 'none';
}, { x: 700, y: 420 }));

await browser.close();
