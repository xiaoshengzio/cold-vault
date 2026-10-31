import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const url = process.argv[2] || 'http://127.0.0.1:5273/';
const out = process.argv[3] || 'shots/grab.png';
const waitMs = Number(process.argv[4] || 2600);
const serverScript = process.argv[5] || '';
const w = Number(process.argv[6] || 1600);
const h = Number(process.argv[7] || 900);

const browser = await chromium.launch({
  channel: 'msedge', headless: true,
  args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'],
});
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const logs = [];
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push('[' + m.type() + '] ' + m.text().slice(0, 200)); });
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(waitMs);
const res = await page.evaluate(async ({ script }) => {
  const S = window.__SCENE__;
  let extra = null;
  if (script) {
    try { extra = new Function('S', script)(S); } catch (e) { extra = 'ERR ' + e.message; }
  }
  // 直接在主线程里同步渲染一帧并立刻取像素：
  // headless 的合成器截图经常取到旧的 canvas 图层，toDataURL 才能拿到真实当前帧。
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  S.composer.render(0.016);
  const url = S.renderer.domElement.toDataURL('image/png');
  return { url, extra };
}, { script: serverScript });
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(resolve(out), Buffer.from(res.url.split(',')[1], 'base64'));
console.log('GRAB ' + out + ' ' + (res.extra === null ? '' : JSON.stringify(res.extra)));
console.log(logs.slice(0, 12).join('\n'));
await browser.close();
