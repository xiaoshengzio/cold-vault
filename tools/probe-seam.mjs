
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
await page.waitForTimeout(2200);
const clip = { x: 560, y: 140, width: 380, height: 480 };
const lights = await page.evaluate(() => {
  const S = window.__SCENE__; const out = [];
  S.specimen.group.traverse(o => { if (o.isLight) out.push(o.type + ':' + o.intensity); });
  return out;
});
console.log('lights in group', JSON.stringify(lights));
await page.screenshot({ path: 'shots/193-a.png', clip });
await page.evaluate(() => {
  const S = window.__SCENE__;
  S.specimen.group.traverse(o => { if (o.isLight) o.intensity = 0; });
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/193-b.png', clip });
await page.evaluate(() => {
  const S = window.__SCENE__;
  S.specimen.group.traverse(o => { if (o.isMesh && o.geometry.type === 'IcosahedronGeometry') o.visible = false; });
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/193-c.png', clip });
await browser.close();
