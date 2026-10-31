
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
await page.waitForTimeout(2200);
const clip = { x: 700, y: 110, width: 420, height: 520 };
for (const r of [0.30, 0.45, 0.65]) {
  await page.evaluate((rv) => {
    window.__SCENE__.specimen.group.traverse(o => {
      if (o.isMesh && o.material && o.material.isMeshPhysicalMaterial) { o.material.roughness = rv; o.material.envMapIntensity = 1.15; }
    });
  }, r);
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'shots/149-rough-' + String(r).replace('.', '') + '.png', clip });
}
console.log('done');
await browser.close();
