
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
await page.waitForTimeout(2000);
const clip = { x: 300, y: 0, width: 520, height: 170 };
const tag = await page.evaluate(() => {
  const S = window.__SCENE__;
  S.__beamMeshes = [];
  S.room.group.traverse(o => {
    if (o.isMesh && Math.abs(o.position.y - 7.09) < 0.01) { S.__beamMeshes.push(o); o.visible = false; }
  });
  return S.__beamMeshes.length;
});
console.log('hidden beams', tag);
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/152-no-ceilbeams.png', clip });
// 恢复，改隐藏窗顶白条
await page.evaluate(() => {
  const S = window.__SCENE__;
  S.__beamMeshes.forEach(o => (o.visible = true));
  S.room.group.traverse(o => { if (o.isMesh && Math.abs(o.position.y - 6.9) < 0.01 && Math.abs(o.position.z + 15.4) < 0.01) o.visible = false; });
});
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/153-no-cove.png', clip });
console.log('done');
await browser.close();
