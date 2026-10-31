import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
page.on('console', (m) => console.log('CONSOLE', m.type(), m.text().slice(0, 200)));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load' });
for (const t of [500, 1500, 3000, 5000]) {
  await page.waitForTimeout(t === 500 ? 500 : 1000);
  const s = await page.evaluate(() => ({
    body: document.body.className,
    pre: document.getElementById('preloader')?.className,
    num: document.getElementById('pl-num')?.textContent,
    status: document.getElementById('pl-status')?.textContent,
  }));
  console.log(t, JSON.stringify(s));
}
await browser.close();
