
import { chromium } from 'playwright-core';

async function run(label, args) {
  const browser = await chromium.launch({ channel: 'msedge', args });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  const logs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  page.on('crash', () => errs.push('PAGE CRASHED'));
  await page.goto('http://127.0.0.1:5273/', { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 40000 });
  const gpu = await page.evaluate(() => window.__SCENE__.getStats().gpu);
  console.log(label, 'gpu:', gpu.slice(0, 60));
  await page.waitForTimeout(2500);

  // 点中心标本
  await page.mouse.click(960, 420);
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500);
    let s = null;
    try { s = await page.evaluate(() => ({ ready: !!window.__READY__, fps: window.__SCENE__.getStats().fps, alive: typeof window.__SCENE__.specimen.update })); }
    catch (e) { s = { evalError: String(e.message).slice(0, 120) }; }
    console.log(label, 't+' + (i + 1) * 0.5 + 's', JSON.stringify(s));
    if (s.evalError) break;
  }
  console.log(label, 'errors:', errs.length ? errs.join(' || ') : 'none');
  console.log(label, 'console:', logs.slice(0, 5).join(' || ') || 'none');
  await browser.close();
}

await run('igpu', ['--ignore-gpu-blocklist']);
await run('dgpu', ['--ignore-gpu-blocklist', '--force_high_performance_gpu']);
