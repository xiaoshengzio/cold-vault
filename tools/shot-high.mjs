
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
await page.waitForTimeout(2000);
const clip = { x: 300, y: 0, width: 520, height: 170 };
// 列出房间组里 y>4.5 的网格
const high = await page.evaluate(() => {
  const S = window.__SCENE__;
  const out = [];
  S.room.group.traverse(o => {
    if (o.isMesh) {
      o.updateWorldMatrix(true, false);
      const p = o.position.clone().applyMatrix4(o.parent.matrixWorld);
      if (o.position.y > 4.5) out.push({ y: +o.position.y.toFixed(2), z: +o.position.z.toFixed(2), x: +o.position.x.toFixed(2), geo: o.geometry.type, mat: o.material.type, col: o.material.color ? o.material.color.getHexString() : '' });
    }
  });
  return out;
});
console.log('high meshes', JSON.stringify(high));
await page.evaluate(() => {
  const S = window.__SCENE__;
  S.room.group.traverse(o => { if (o.isMesh && o.position.y > 4.5) o.visible = false; });
});
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/151-no-high.png', clip });
console.log('done');
await browser.close();
