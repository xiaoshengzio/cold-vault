import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load' });
await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 40000 });
await page.waitForTimeout(900);
await page.screenshot({ path: 'shots/51-hero.png' });
const names = ['archive', 'works', 'contact'];
for (let i = 1; i < 4; i++) {
  await page.evaluate((idx) => window.scrollTo({ top: (document.querySelectorAll('.sec')[idx]).offsetTop, behavior: 'instant' }), i);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'shots/5' + (i + 1) + '-' + names[i - 1] + '.png' });
}
await browser.close();
