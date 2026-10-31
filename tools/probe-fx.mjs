import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(2500);

const fpsOf = (n) => page.evaluate((frames) => new Promise((res) => {
  const t = []; let last = performance.now(), i = 0;
  const tick = () => { const now = performance.now(); t.push(now - last); last = now;
    if (++i < frames) requestAnimationFrame(tick);
    else { const avg = t.reduce((a, b) => a + b, 0) / t.length; res({ fps: +(1000 / avg).toFixed(1), p95: +t.slice().sort((a,b)=>a-b)[Math.floor(t.length*0.95)].toFixed(1) }); } };
  requestAnimationFrame(tick);
}), n);

console.log('msaa samples:', await page.evaluate(() => { const c = window.__SCENE__.composer; return { input: c.inputBuffer && c.inputBuffer.samples, rt: c.renderTarget1 && c.renderTarget1.samples }; }));

for (const [label, fn] of [['fx0 全开', 'applyFx(0)'], ['fx1 关景深', 'applyFx(1)'], ['fx2 关景深+色差', 'applyFx(2)']]) {
  await page.evaluate(`window.__SCENE__.${fn}; window.__SCENE__.setQualityMode ? window.__SCENE__.setQualityMode('high') : 0;`);
  await page.evaluate(fn.replace('applyFx', 'window.__SCENE__.applyFx'));
  await page.waitForTimeout(1200);
  console.log(label.padEnd(18), JSON.stringify(await fpsOf(80)));
}
await page.evaluate(() => window.__SCENE__.setQualityMode('auto'));
await page.waitForTimeout(12000);
console.log('auto 稳态', JSON.stringify(await page.evaluate(() => window.__SCENE__.getStats())), JSON.stringify(await fpsOf(80)));
await browser.close();
