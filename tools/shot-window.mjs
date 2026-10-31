
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
await page.waitForTimeout(2200);
const clip = { x: 1060, y: 140, width: 520, height: 460 };
await page.screenshot({ path: 'shots/157-window-base.png', clip });
const mat = await page.evaluate(() => {
  const S = window.__SCENE__;
  const m = S.room.slats[0].material;
  const info = { type: m.type, color: m.color.getHexString(), metal: m.metalness, rough: m.roughness, emissive: m.emissive ? m.emissive.getHexString() : null, ei: m.emissiveIntensity };
  return info;
});
console.log('slat mat', JSON.stringify(mat));
await page.evaluate(() => {
  const S = window.__SCENE__;
  S.room.slats.forEach(s => { s.material = s.material.clone(); s.material.metalness = 0.35; s.material.roughness = 0.85; });
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/158-window-matte.png', clip });
console.log('done');
await browser.close();
