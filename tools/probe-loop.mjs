
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel:'msedge', headless:true, args:['--ignore-gpu-blocklist','--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport:{width:1200,height:700}, deviceScaleFactor:1 });
page.on('pageerror', e=>console.log('[err]', e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil:'load' });
await page.waitForFunction('window.__READY__ === true', { timeout: 30000 });
await page.waitForTimeout(1500);
const a = await page.evaluate(() => (window.__FRAMES__||0));
await page.waitForTimeout(1200);
const b = await page.evaluate(() => (window.__FRAMES__||0));
console.log('frames', a, '->', b);
const before = await page.evaluate(() => { const S=window.__SCENE__; S.specimen.group.scale.setScalar(3); return S.specimen.group.scale.x; });
await page.waitForTimeout(500);
const after = await page.evaluate(() => { const S=window.__SCENE__; return {scale:S.specimen.group.scale.x, frames: window.__FRAMES__}; });
console.log('scale', before, '->', JSON.stringify(after));
await browser.close();
