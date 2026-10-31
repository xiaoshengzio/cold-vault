
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });

// 光标是否同步跟随
const cur = await page.evaluate(async () => {
  const el = document.getElementById('cursor');
  const ev = (x, y) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
  ev(500, 400);
  const a = el.style.transform;
  ev(700, 300);
  const b = el.style.transform;
  return { a, b };
});
console.log('cursor', JSON.stringify(cur));

// 相机响应延迟
const cam = await page.evaluate(async () => {
  const S = window.__SCENE__;
  const p0 = S.camera.position.clone();
  const ev = (x, y) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
  ev(1200, 700);
  await new Promise(r => setTimeout(r, 120));
  const p1 = S.camera.position.clone();
  await new Promise(r => setTimeout(r, 400));
  const p2 = S.camera.position.clone();
  return { d120: +p0.distanceTo(p1).toFixed(3), d520: +p0.distanceTo(p2).toFixed(3) };
});
console.log('cam', JSON.stringify(cam));

// 启动阶段画质轨迹
const t0 = Date.now();
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(700);
  const s = await page.evaluate(() => window.__SCENE__.getStats());
  console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', 'fx', s.fx, 'res', s.res, 'fps', s.fps);
}
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/171-nodof.png' });
await browser.close();
