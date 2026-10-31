
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const browser = await chromium.launch({ channel: 'msedge', args: [] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 60000 });
const cdp = await ctx.newCDPSession(page);
const chunks = [];
cdp.on('Tracing.dataCollected', (e) => chunks.push(...e.value));
const done = new Promise(r => cdp.on('Tracing.tracingComplete', r));
await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink,v8,cc,gpu', transferMode: 'ReportEvents' });
await page.waitForTimeout(22000);
await cdp.send('Tracing.end');
await done;
const evts = chunks.filter(e => e.dur && e.dur > 400000);
evts.sort((a, b) => b.dur - a.dur);
const top = evts.slice(0, 12).map(e => `${Math.round(e.dur/1000)}ms | ${e.name} | ${(e.cat||'').slice(0,30)} | tid${e.tid} | ${JSON.stringify(e.args||{}).slice(0,80)}`);
console.log(top.join('\n'));
await browser.close();
