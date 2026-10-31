
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: [] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
// 对照组：一个什么都不做的 rAF 页面
await page.setContent('<body style="background:#111"><script>window.__M={f:[]};let l=performance.now();(function t(){const n=performance.now();__M.f.push(n-l);l=n;requestAnimationFrame(t)})();<\/script></body>');
await page.waitForTimeout(18000);
const c = await page.evaluate(() => { const f = window.__M.f.slice(6).sort((a, b) => a - b); return { n: f.length, p50: +f[Math.floor(f.length * .5)].toFixed(1), p95: +f[Math.floor(f.length * .95)].toFixed(1), max: Math.round(f[f.length - 1]), over200: f.filter(x => x > 200).length }; });
console.log('control-blank', JSON.stringify(c));
await browser.close();
