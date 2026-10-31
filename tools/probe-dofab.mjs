import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(4500);
for (const [bs, name] of [[0, '243-dof0'], [1.35, '244-dof135'], [0.7, '245-dof07']]) {
  await page.evaluate((v) => { window.__SCENE__.dof.bokehScale = v; }, bs);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'shots/' + name + '.png', clip: { x: 900, y: 120, width: 560, height: 640 } });
  console.log('SHOT', name);
}
await browser.close();
