import { chromium } from 'playwright-core';

const idx = Number(process.argv[2] ?? 1);
const out = process.argv[3] ?? 'shots/scroll.png';
const settle = Number(process.argv[4] ?? 2200);
const browser = await chromium.launch({ channel: 'msedge', headless: true,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(2400);

const info = await page.evaluate((i) => {
  const s = document.querySelectorAll('.sec')[i];
  const top = s ? s.offsetTop : 0;
  window.scrollTo(0, top);
  return { top, scrollHeight: document.documentElement.scrollHeight, inner: window.innerHeight };
}, idx);
await page.waitForTimeout(settle);
const prog = await page.evaluate(() => +window.__SCENE__.rig.progress.toFixed(3));
const active = await page.evaluate(() => Array.from(document.querySelectorAll('.nav button')).findIndex((b) => b.classList.contains('is-active')));
console.log(JSON.stringify({ ...info, progress: prog, activeNav: active }));
await page.screenshot({ path: out });
console.log('SHOT', out);
await browser.close();
