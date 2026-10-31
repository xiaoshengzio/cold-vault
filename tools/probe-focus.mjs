import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(2500);
const shots = [['0.02', 'shots/95-f002.png'], ['0.06', 'shots/96-f006.png'], ['0.14', 'shots/97-f014.png']];
for (const [fd, out] of shots) {
  await page.evaluate((v) => { const d = window.__SCENE__.dof; d.bokehScale = 2.2; d.cocMaterial.uniforms.focusDistance.value = Number(v); }, fd);
  await page.waitForTimeout(600);
  await page.screenshot({ path: out });
}
await browser.close();
