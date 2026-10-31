
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
await page.waitForTimeout(2000);
const clip = { x: 300, y: 0, width: 520, height: 170 };
const info = await page.evaluate(() => {
  const S = window.__SCENE__;
  const out = [];
  S.scene.traverse(o => {
    if (o.isMesh && o.geometry.type === 'BoxGeometry') {
      const p = new (o.position.constructor)();
      o.getWorldPosition(p);
      if (p.y > 4.5) { o.visible = false; out.push([+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1), o.material.color.getHexString(), o.scale.toArray().map(v => +v.toFixed(1))]); }
    }
  });
  return out;
});
console.log('hidden boxes', JSON.stringify(info));
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/156-no-highboxes.png', clip });
await browser.close();
