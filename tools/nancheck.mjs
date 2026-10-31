import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', e => console.log('[pageerror] ' + e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load' });
await page.waitForTimeout(4000);
const out = await page.evaluate(() => {
  const s = window.__SCENE__;
  if (!s) return 'no scene';
  const bad = [];
  s.scene.traverse((o) => {
    const g = o.geometry;
    if (!g || !g.attributes?.position) return;
    const a = g.attributes.position.array;
    for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) { bad.push(o.name || o.type); break; }
  });
  return { bad, types: s.scene.children.map(c => c.type + ':' + (c.name||'')) };
});
console.log(JSON.stringify(out));
await browser.close();
