
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
await page.waitForTimeout(2400);
await page.screenshot({ path: 'shots/142-crystal-dof.png', clip: { x: 920, y: 130, width: 400, height: 470 } });
await page.evaluate(() => { window.__SCENE__.dofPass.enabled = false; });
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/143-crystal-nodof.png', clip: { x: 920, y: 130, width: 400, height: 470 } });
// 关掉两盏 RectAreaLight，确认白条是不是面光镜面反射
const info = await page.evaluate(() => {
  const S = window.__SCENE__;
  const rects = [];
  S.scene.traverse(o => { if (o.isRectAreaLight) rects.push({ pos: o.position.toArray().map(v => +v.toFixed(2)), w: o.width, h: o.height, i: o.intensity }); });
  return rects;
});
console.log('rect lights', JSON.stringify(info));
await browser.close();
