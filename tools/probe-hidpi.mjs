import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(7000);
const info = await page.evaluate(() => {
  const S = window.__SCENE__;
  return {
    dpr: devicePixelRatio,
    qualityScale: S.getQuality(),
    rendererPR: S.renderer.getPixelRatio(),
    drawingBuffer: [S.renderer.domElement.width, S.renderer.domElement.height],
    cssSize: [S.renderer.domElement.clientWidth, S.renderer.domElement.clientHeight],
  };
});
console.log(JSON.stringify(info));
await page.screenshot({ path: 'shots/122-hidpi.png' });
const fps = await page.evaluate(() => new Promise((r) => { const t=[]; let l=performance.now(), n=0; const tick=()=>{const now=performance.now(); t.push(now-l); l=now; if(++n<90) requestAnimationFrame(tick); else { const s=t.reduce((a,b)=>a+b,0); r(+(1000/(s/t.length)).toFixed(1)); }}; requestAnimationFrame(tick); }));
console.log('fps', fps);
await browser.close();
