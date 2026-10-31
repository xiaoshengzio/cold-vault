
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:5273/?q=auto', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
await page.waitForTimeout(2500);
const box = await page.evaluate(() => {
  const S = window.__SCENE__; const v = S.specimen.group.getWorldPosition(new window.__THREE__.Vector3()).project(S.camera);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
});
// 鼠标压在标本上：验证视觉吸附
await page.mouse.move(box.x - 30, box.y);
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/195-hover.png', clip: { x: 640, y: 120, width: 460, height: 600 } });
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(430);
await page.screenshot({ path: 'shots/195-burst.png', clip: { x: 560, y: 90, width: 640, height: 700 } });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'shots/195-back.png', clip: { x: 640, y: 120, width: 460, height: 600 } });
const st = await page.evaluate(() => {
  const S = window.__SCENE__; const g = S.getStats();
  return { settled: S.specimen.settled, solidVisible: S.specimen.solid.visible, fps: g.fps, res: g.res };
});
console.log('state', JSON.stringify(st), 'err', errs[0] || 'none');
await browser.close();
