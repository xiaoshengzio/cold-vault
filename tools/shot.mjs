import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:5273/';
const outArg = process.argv[3] ?? 'shots/shot.png';
const waitMs = Number(process.argv[4] ?? 2500);
const w = Number(process.argv[5] ?? 1600);
const h = Number(process.argv[6] ?? 900);
const shotScript = process.argv[7] ?? '';

const outPath = path.resolve(outArg);
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: [
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
page.on('requestfailed', (r) => logs.push('[reqfail] ' + r.url() + ' ' + (r.failure()?.errorText ?? '')));

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
try {
  await page.waitForFunction('window.__READY__ === true', { timeout: 30000 });
} catch { logs.push('[warn] __READY__ not set in 30s'); }
await page.waitForTimeout(waitMs);

if (shotScript) {
  const res = await page.evaluate(new Function('return (' + shotScript + ')()'));
  if (res !== undefined) logs.push('[shotscript] ' + JSON.stringify(res));
  await page.waitForTimeout(600);
}

const webgl = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2');
  if (!gl) return 'no-webgl2';
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'webgl2-ok';
});
await page.screenshot({ path: outPath });
console.log('RENDERER: ' + webgl);
console.log('SHOT: ' + outPath);
console.log(logs.slice(0, 40).join('\n'));
await browser.close();
