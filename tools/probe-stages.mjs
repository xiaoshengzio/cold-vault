import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://127.0.0.1:5274/';
const browser = await chromium.launch({ channel: 'msedge', headless: true,
  args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const logs = [];
const t0 = Date.now();
page.on('console', (m) => { const t = m.text(); if (t.includes('[cv]') || t.includes('warmup') || t.includes('booted')) logs.push([Date.now() - t0, t]); });
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 60000 }).catch(() => {});
const ready = await page.evaluate(() => ({ t: performance.now(), ready: !!window.__READY__, frames: window.__FRAMES__ || 0 }));
console.log(JSON.stringify({ logs, ready }));
await browser.close();
