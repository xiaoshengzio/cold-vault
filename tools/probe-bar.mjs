
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5273/?q=high', { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 30000 });
await page.waitForTimeout(2000);
const hits = await page.evaluate(() => {
  const S = window.__SCENE__;
  const T = window.__THREE__;
  const rc = new T.Raycaster();
  const out = [];
  for (const [cx, cy] of [[360, 25], [380, 40], [400, 50]]) {
    const ndc = new T.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    rc.setFromCamera(ndc, S.camera);
    const hs = rc.intersectObject(S.scene, true).slice(0, 4).map(h => ({
      d: +h.distance.toFixed(2),
      geo: h.object.geometry && h.object.geometry.type,
      mat: h.object.material && h.object.material.type,
      col: h.object.material && h.object.material.color ? h.object.material.color.getHexString() : '',
      pos: h.object.position.toArray().map(v => +v.toFixed(2)),
      scale: h.object.scale.toArray().map(v => +v.toFixed(2)),
      visible: h.object.visible,
    }));
    out.push({ cx, cy, hs });
  }
  return out;
});
console.log(JSON.stringify(hits, null, 1));
await browser.close();
