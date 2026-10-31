
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
await page.waitForTimeout(2000);
const clip = { x: 300, y: 0, width: 520, height: 170 };
const meta = await page.evaluate(() => {
  const S = window.__SCENE__;
  const g = S.beams.group;
  const mat = S.beams.material;
  return { kids: g.children.length, inScene: !!g.parent, uniforms: mat && mat.uniforms ? Object.keys(mat.uniforms) : null };
});
console.log('beams meta', JSON.stringify(meta));
await page.evaluate(() => { window.__SCENE__.beams.group.visible = false; });
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/154-beams-off.png', clip });
await page.evaluate(() => {
  const S = window.__SCENE__;
  S.beams.group.visible = true;
  const u = S.beams.material.uniforms;
  if (u.uIntensity) u.uIntensity.value = 0;
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/155-beams-zero.png', clip });
console.log('done');
await browser.close();
