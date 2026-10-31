import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://127.0.0.1:5273/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('ERR ' + m.text()); });
page.on('pageerror', (e) => logs.push('PAGEERR ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const rect = (s) => { const el = q(s); if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const cs = (s, p) => { const el = q(s); return el ? getComputedStyle(el)[p] : null; };
  return {
    ready: document.body.className,
    fonts: {
      serif: document.fonts.check('400 40px "Instrument Serif"'),
      italicSerif: document.fonts.check('italic 400 40px "Instrument Serif"'),
      mono: document.fonts.check('400 12px "JetBrains Mono"'),
    },
    scrollH: document.documentElement.scrollHeight,
    docW: document.documentElement.scrollWidth,
    winW: innerWidth,
    rects: {
      eyebrow: rect('.sec-hero .eyebrow'),
      display: rect('.display'),
      cjk: rect('.display-cjk'),
      latin: rect('.display-latin'),
      lede: rect('.lede'),
      heroFoot: rect('.hero-foot'),
      chromeTop: rect('.chrome-top'),
      chromeBottom: rect('.chrome-bottom'),
      pre: rect('#preloader'),
      canvas: rect('#gl'),
    },
    sizes: {
      cjkFont: cs('.display-cjk', 'fontSize'),
      cjkFam: cs('.display-cjk', 'fontFamily'),
      latinFont: cs('.display-latin', 'fontSize'),
      ledeFont: cs('.lede', 'fontSize'),
      navCount: document.querySelectorAll('.nav button').length,
      secCount: document.querySelectorAll('.sec').length,
    },
    progress: (window.__SCENE__ && window.__SCENE__.rig) ? window.__SCENE__.rig.progress : null,
    readyFlag: window.__READY__ === true,
  };
});
console.log(JSON.stringify(info, null, 2));
console.log('LOGS:', logs.slice(0, 12).join('\n'));

// scroll to each section and report opacity state + screenshot
for (const [i, name] of [[1, 'archive'], [2, 'works'], [3, 'contact']]) {
  await page.evaluate((idx) => {
    const s = document.querySelectorAll('.sec')[idx];
    window.scrollTo({ top: s.offsetTop, behavior: 'instant' });
  }, i);
  await page.waitForTimeout(2200);
  const st = await page.evaluate((idx) => {
    const s = document.querySelectorAll('.sec')[idx];
    const first = s.querySelector('*');
    return {
      cls: s.className,
      opacity: first ? getComputedStyle(first).opacity : null,
      scrollY: Math.round(scrollY),
      progress: window.__SCENE__ ? +window.__SCENE__.rig.progress.toFixed(3) : null,
    };
  }, i);
  console.log(name, JSON.stringify(st));
  await page.screenshot({ path: 'shots/5' + i + '-' + name + '.png' });
}

await browser.close();
