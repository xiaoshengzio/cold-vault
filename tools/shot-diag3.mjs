
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
await page.waitForTimeout(2200);
const clip = { x: 700, y: 110, width: 420, height: 520 };
const info = await page.evaluate(() => {
  const S = window.__SCENE__;
  const out = { pieces: 0, envs: [] };
  S.specimen.group.traverse(o => {
    if (o.isMesh && o.material && o.material.isMeshPhysicalMaterial) {
      out.pieces++;
      if (o.material.envMap) out.envs.push(o.material.envMap.uuid.slice(0, 8));
    }
  });
  return out;
});
console.log('specimen', JSON.stringify(info));
await page.evaluate(() => {
  const S = window.__SCENE__;
  S.specimen.group.traverse(o => { if (o.isMesh && o.material && o.material.isMeshPhysicalMaterial) { o.material.envMapIntensity = 0; o.material.needsUpdate = true; } });
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/148-no-env.png', clip });
console.log('done');
await browser.close();
