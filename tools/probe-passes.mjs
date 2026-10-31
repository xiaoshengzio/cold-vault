import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });

async function fpsOf(page, frames = 70) {
  return page.evaluate((n) => new Promise((res) => {
    const t = []; let last = performance.now(), i = 0;
    const tick = () => { const now = performance.now(); t.push(now - last); last = now;
      if (++i < n) requestAnimationFrame(tick);
      else { const avg = t.reduce((a, b) => a + b, 0) / t.length; res(+(1000 / avg).toFixed(1)); } };
    requestAnimationFrame(tick);
  }), frames);
}

async function probe(dsf) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dsf });
  await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
  await page.evaluate(() => window.__SCENE__.setQualityMode('high'));  // 锁定上限
  await page.waitForTimeout(3500);
  console.log('--- dsf', dsf, await page.evaluate(() => ({ q: +window.__SCENE__.getQuality().toFixed(2), buf: window.__SCENE__.renderer.domElement.width })));

  const cases = [
    ['all', []],
    ['no-DOF', [1]],
    ['no-DOF/bloom', [1]],
    ['no-post(only render)', 'all'],
  ];
  // 逐 pass 开关：0=render 1=bloom+dof 2=tone/smaa/noise/vignette 3=CA
  const cfg = [
    ['P0+P1+P2+P3 全开', []],
    ['去掉 P3(色差)', [3]],
    ['去掉 P2(调色/SMAA/噪点/暗角)', [2]],
    ['去掉 P1(bloom+DOF)', [1]],
    ['只留 P0(裸渲染)', [1, 2, 3]],
  ];
  for (const [label, offs] of cfg) {
    await page.evaluate((list) => {
      const c = window.__SCENE__.composer;
      c.passes.forEach((p, i) => { if (i > 0) p.enabled = !list.includes(i); });
    }, offs);
    await page.waitForTimeout(900);
    console.log(label.padEnd(26), await fpsOf(page));
  }
  await page.close();
}

await probe(1);
await probe(1.25);
await browser.close();
