
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const errs = [];
async function grab(dsf, tag) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: dsf });
  page.on('pageerror', e => errs.push(tag + ': ' + String(e)));
  await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'shots/' + tag + '-full.png' });
  // 标本 + 窗格区域 1:1 裁切
  await page.screenshot({ path: 'shots/' + tag + '-crop.png', clip: { x: 980, y: 260, width: 420, height: 330 } });
  const st = await page.evaluate(() => window.__SCENE__.getStats());
  console.log(tag, JSON.stringify(st));
  await page.close();
}
await grab(1, '140-dsf1');
await grab(1.25, '141-dsf125');
console.log('errors', errs.slice(0, 3));
await browser.close();
