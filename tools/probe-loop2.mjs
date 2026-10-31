
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel:'msedge', headless:true, args:['--ignore-gpu-blocklist','--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport:{width:1200,height:700}, deviceScaleFactor:1 });
await page.goto('http://127.0.0.1:5273/', { waitUntil:'load' });
await page.waitForFunction('window.__READY__ === true', { timeout: 30000 });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const canvases = [...document.querySelectorAll('canvas')].map(c => ({ id: c.id, w: c.width, h: c.height, cls: c.className, z: getComputedStyle(c).zIndex }));
  const S = window.__SCENE__;
  const callsBefore = S.renderer.info.render.calls;
  S.specimen.group.visible = false;
  return { canvases, callsBefore, passes: S.composer?.passes?.length ?? -1 };
});
await page.waitForTimeout(900);
const after = await page.evaluate(() => {
  const S = window.__SCENE__;
  return { callsAfter: S.renderer.info.render.calls, vis: S.specimen.group.visible, children: S.scene.children.length, frames: window.__FRAMES__ };
});
console.log(JSON.stringify(info), JSON.stringify(after));
await browser.close();
