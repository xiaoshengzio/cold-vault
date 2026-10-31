
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
await page.waitForTimeout(2000);
const clip = { x: 300, y: 0, width: 520, height: 170 };
const list = await page.evaluate(() => {
  const S = window.__SCENE__;
  const out = [];
  S.scene.traverse(o => {
    if (o.isPoints || (o.isMesh && o.material && o.material.type === 'ShaderMaterial')) {
      out.push({ id: o.uuid, kind: o.isPoints ? 'points' : 'shaderMesh', geo: o.geometry.type, pos: o.position.toArray().map(v => +v.toFixed(2)), count: o.geometry.attributes.position ? o.geometry.attributes.position.count : 0 });
    }
  });
  return out;
});
console.log(JSON.stringify(list));
fs.writeFileSync('shots/bar-candidates.json', JSON.stringify(list, null, 1));
await page.screenshot({ path: 'shots/barbase.png', clip });
for (let i = 0; i < list.length; i++) {
  await page.evaluate((id) => {
    const S = window.__SCENE__;
    S.scene.traverse(o => { if (o.uuid === id) o.visible = false; });
  }, list[i].id);
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'shots/barc' + i + '.png', clip });
  await page.evaluate((id) => {
    const S = window.__SCENE__;
    S.scene.traverse(o => { if (o.uuid === id) o.visible = true; });
  }, list[i].id);
}
console.log('done', list.length);
await browser.close();
