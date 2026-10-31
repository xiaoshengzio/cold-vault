import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p1 = await browser.newPage();
await p1.goto('about:blank');
const empty = await p1.evaluate(() => new Promise((resolve) => {
  const times = []; let last = performance.now(); let n = 0;
  const tick = () => { const now = performance.now(); times.push(now - last); last = now; if (++n < 100) requestAnimationFrame(tick); else { const s = times.reduce((a,b)=>a+b,0); resolve(+(1000/(s/times.length)).toFixed(1)); } };
  requestAnimationFrame(tick);
}));
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(1500);
const split = await page.evaluate(() => new Promise((resolve) => {
  const S = window.__SCENE__;
  const jsTimes = []; const frameTimes = [];
  const orig = S.renderer.render.bind(S.renderer);
  let renderMs = 0;
  S.renderer.render = (sc, cam) => { const t0 = performance.now(); orig(sc, cam); renderMs = performance.now() - t0; };
  let last = performance.now(); let n = 0;
  const tick = () => {
    const now = performance.now(); frameTimes.push(now - last); jsTimes.push(renderMs); last = now;
    if (++n < 100) requestAnimationFrame(tick);
    else {
      const avg = a => +(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2);
      resolve({ frameMs: avg(frameTimes), renderCallMs: avg(jsTimes), fps: +(1000/avg(frameTimes)).toFixed(1) });
    }
  };
  requestAnimationFrame(tick);
}));
console.log(JSON.stringify({ emptyRafFps: empty, ...split }));
await browser.close();
