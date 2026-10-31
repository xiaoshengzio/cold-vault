import { chromium } from 'playwright-core';
for (const tag of ['a','b']) {
  const browser = await chromium.launch({ channel:'msedge', headless:true, args:['--ignore-gpu-blocklist','--force_high_performance_gpu'] });
  const page = await browser.newPage({ viewport:{width:1200,height:700}, deviceScaleFactor:1 });
  const errs=[];
  page.on('pageerror', e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:5273/', { waitUntil:'load', timeout:60000 });
  await page.waitForTimeout(6000);
  const st = await page.evaluate(() => ({ vis: document.visibilityState, ready: !!window.__READY__, frames: window.__FRAMES__||0, pl: document.getElementById('pl-num')?.textContent, focus: document.hasFocus() }));
  console.log(tag, JSON.stringify(st), 'errs:', errs.slice(0,3).join('|'));
  await browser.close();
}
