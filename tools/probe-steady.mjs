import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
const samples = [];
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(4000);
  samples.push(await page.evaluate(() => {
    const S = window.__SCENE__;
    return { q: +S.getQuality().toFixed(3), buf: S.renderer.domElement.width };
  }));
}
console.log(JSON.stringify(samples));
await browser.close();
