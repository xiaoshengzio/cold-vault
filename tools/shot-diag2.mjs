
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
await page.waitForTimeout(2200);
const clip = { x: 700, y: 110, width: 420, height: 520 };
// A: 关掉三盏面光
await page.evaluate(() => { const S = window.__SCENE__; S.__rect = []; S.scene.traverse(o => { if (o.isRectAreaLight) { S.__rect.push([o, o.intensity]); o.intensity = 0; } }); });
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/146-no-rect.png', clip });
// B: 恢复面光，隐藏天空面与百叶
await page.evaluate(() => { const S = window.__SCENE__; S.__rect.forEach(([o, i]) => { o.intensity = i; }); S.room.slats.forEach(m => (m.visible = false)); S.scene.traverse(o => { if (o.material && o.material.userData && o.material.userData.isSky) o.visible = false; }); });
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/147-no-slats.png', clip });
console.log('done');
await browser.close();
