
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
await page.waitForTimeout(2000);
const clip = { x: 300, y: 0, width: 520, height: 170 };
const cases = {
  base: () => {},
  noBeams: (S) => { S.beams.group.visible = false; },
  noDust: (S) => { S.dust.points.visible = false; },
  noRoom: (S) => { S.room.group.visible = false; },
};
for (const [name, fn] of Object.entries(cases)) {
  await page.evaluate((src) => {
    const S = window.__SCENE__;
    S.beams.group.visible = true;
    if (S.dust && S.dust.points) S.dust.points.visible = true;
    S.room.group.visible = true;
    new Function('S', '(' + src + ')(S)')(S);
  }, fn.toString());
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'shots/150-bar-' + name + '.png', clip });
}
console.log('done');
await browser.close();
