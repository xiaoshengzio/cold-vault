import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const measure = async (page) => page.evaluate(() => new Promise((resolve) => {
  const times = []; let last = performance.now(); let n = 0;
  const tick = () => { const now = performance.now(); times.push(now - last); last = now; if (++n < 90) requestAnimationFrame(tick); else { const s = times.reduce((a,b)=>a+b,0); resolve(+(1000/(s/times.length)).toFixed(1)); } };
  requestAnimationFrame(tick);
}));
const out = {};
for (const [w, h] of [[1600,900],[1000,562],[640,360]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
  await page.waitForTimeout(1500);
  out[w+'x'+h] = await measure(page);
  if (w === 1600) {
    await page.evaluate(() => { const S = window.__SCENE__; S.renderer.setPixelRatio(0.6); S.composer.setSize(innerWidth*0.6, innerHeight*0.6); });
    await page.waitForTimeout(800);
    out['pr06'] = await measure(page);
    await page.evaluate(() => { const S = window.__SCENE__; S.renderer.setPixelRatio(1); S.composer.setSize(innerWidth, innerHeight); });
    await page.waitForTimeout(800);
    // 关闭全部 RectAreaLight 测试 LTC 开销
    const n = await page.evaluate(() => { const S = window.__SCENE__; let c = 0; S.scene.traverse(o => { if (o.isRectAreaLight) { o.visible = false; c++; } }); return c; });
    await page.waitForTimeout(800);
    out['noRectArea('+n+')'] = await measure(page);
  }
  await page.close();
}
console.log(JSON.stringify(out));
await browser.close();
