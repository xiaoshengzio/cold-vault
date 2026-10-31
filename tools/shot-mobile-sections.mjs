import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(4000);
for (const [i, out] of [[1,'shots/116-m-arch.png'],[2,'shots/117-m-works.png'],[3,'shots/118-m-contact.png']]) {
  await page.evaluate((n) => { document.querySelectorAll('.sec')[n].scrollIntoView({ behavior: 'instant', block: 'start' }); }, i);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: out });
}
console.log(JSON.stringify({ errs }));
await browser.close();
