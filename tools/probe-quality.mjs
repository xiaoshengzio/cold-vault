import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
async function run(dsf, url, out, settle = 7000) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dsf });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
  await page.waitForTimeout(settle);
  const info = await page.evaluate(() => {
    const S = window.__SCENE__;
    return { dpr: devicePixelRatio, mode: S.getQualityMode(), q: +S.getQuality().toFixed(3),
      pr: +S.renderer.getPixelRatio().toFixed(3),
      buf: [S.renderer.domElement.width, S.renderer.domElement.height],
      css: [S.renderer.domElement.clientWidth, S.renderer.domElement.clientHeight] };
  });
  const fps = await page.evaluate(() => new Promise((r) => { const t=[]; let l=performance.now(), n=0; const tick=()=>{const now=performance.now(); t.push(now-l); l=now; if(++n<80) requestAnimationFrame(tick); else { const s=t.reduce((a,b)=>a+b,0); r(+(1000/(s/t.length)).toFixed(1)); }}; requestAnimationFrame(tick); }));
  await page.screenshot({ path: out });
  console.log(JSON.stringify({ tag: out.split('\\').pop(), ...info, fps, errs }));
  await page.close();
}
await run(2, 'http://127.0.0.1:5273/', 'shots/123-hidpi-auto.png');
await run(2, 'http://127.0.0.1:5273/?q=high', 'shots/124-hidpi-high.png');
await run(1, 'http://127.0.0.1:5273/', 'shots/125-dpr1-auto.png');
await browser.close();
