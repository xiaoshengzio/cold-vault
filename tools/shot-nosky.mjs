
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
await page.waitForTimeout(2000);
const clip = { x: 1060, y: 140, width: 520, height: 460 };
let sky = null;
await page.evaluate(() => {
  const S = window.__SCENE__;
  S.scene.traverse(o => { if (o.isMesh && o.material && o.material.type === 'ShaderMaterial' && Math.abs(o.position.z + 18.4) < 0.1) { window.__SKY__ = o; } });
});
const uni = await page.evaluate(() => {
  const o = window.__SKY__;
  return o && o.material.uniforms ? Object.keys(o.material.uniforms) : null;
});
console.log('sky uniforms', JSON.stringify(uni));
await page.evaluate(() => { window.__SKY__.visible = false; });
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/159-no-sky.png', clip });
await page.evaluate(() => { window.__SKY__.visible = true; });
await page.waitForTimeout(200);
console.log('done');
await browser.close();
