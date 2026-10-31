import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const S = window.__SCENE__;
  const d = S.dof;
  return {
    bokehScale: d.bokehScale,
    focusDistance: d.cocMaterial ? d.cocMaterial.uniforms.focusDistance?.value : 'n/a',
    enabled: d.enabled,
    passes: S.composer.passes.length,
    pixelRatio: S.renderer.getPixelRatio(),
    size: S.renderer.getSize(new (window.__THREE__.Vector2)()).toArray(),
    inner: [innerWidth, innerHeight],
  };
});
console.log(JSON.stringify(info));
await browser.close();
