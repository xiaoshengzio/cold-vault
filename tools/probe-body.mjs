import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 60000 });
await page.waitForTimeout(1000);

const info = (tag) => page.evaluate((tag) => {
  const s = window.__SCENE__.specimen;
  const p = s.pieces[0];
  const b = p.body;
  const v = b.linvel();
  const t = b.translation();
  return {
    tag,
    phase: s.phase,
    snapped: s.snappedCount,
    sleeping: b.isSleeping?.() ?? 'n/a',
    enabled: b.isEnabled?.() ?? 'n/a',
    bodyType: b.bodyType?.() ?? 'n/a',
    mass: b.mass?.() ?? 'n/a',
    v: [v.x, v.y, v.z].map((n) => +n.toFixed(3)),
    t: [t.x, t.y, t.z].map((n) => +n.toFixed(3)),
    home: [p.home.x, p.home.y, p.home.z].map((n) => +n.toFixed(3)),
    colliderGroups: p.collider.collisionGroups?.() ?? 'n/a',
    worldBodies: s.world.bodies.len?.() ?? 'n/a',
  };
}, tag);

const click = async () => { await page.mouse.move(700, 420); await page.mouse.down(); await page.mouse.up(); };

console.log(JSON.stringify(await info('init')));
await click();
await page.waitForTimeout(60);
console.log(JSON.stringify(await info('click1+60')));
await page.waitForTimeout(2600);
console.log(JSON.stringify(await info('after1')));

await click();
await page.waitForTimeout(60);
console.log(JSON.stringify(await info('click2+60')));
await page.waitForTimeout(300);
console.log(JSON.stringify(await info('click2+360')));

// 手动再叫一次 burst 看是否与点击无关
await page.evaluate(() => window.__SCENE__.specimen.burst(1));
await page.waitForTimeout(200);
console.log(JSON.stringify(await info('manual burst+200')));

await browser.close();
