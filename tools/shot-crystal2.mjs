
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
await page.waitForTimeout(2400);
const clip = { x: 700, y: 110, width: 420, height: 520 };
await page.screenshot({ path: 'shots/144-crystal.png', clip });
await page.evaluate(() => { window.__SCENE__.dofPass.enabled = false; });
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/145-crystal-nodof.png', clip });
console.log('ok');
await browser.close();
