import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(2000);
const stats = await page.evaluate(() => new Promise((resolve) => {
  const times = [];
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    times.push(now - last);
    last = now;
    if (times.length < 180) requestAnimationFrame(tick);
    else {
      const sum = times.reduce((a, b) => a + b, 0);
      const sorted = [...times].sort((a, b) => a - b);
      resolve({
        avgMs: +(sum / times.length).toFixed(2),
        fps: +(1000 / (sum / times.length)).toFixed(1),
        p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
        drawCalls: window.__SCENE__.renderer.info.render.calls,
        triangles: window.__SCENE__.renderer.info.render.triangles,
        textures: window.__SCENE__.renderer.info.memory.textures,
        geometries: window.__SCENE__.renderer.info.memory.geometries,
      });
    }
  };
  requestAnimationFrame(tick);
}));
console.log(JSON.stringify(stats));
await browser.close();
