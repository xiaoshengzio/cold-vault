import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu', '--enable-gpu-rasterization'],
});
const errors = [];
const watch = (page) => {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
};
const ready = async (page) => {
  await page.waitForFunction('window.__READY__ === true && document.body.classList.contains("is-ready")', { timeout: 60000 });
  await page.waitForTimeout(1800);
};

const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
watch(page);
await page.goto('http://127.0.0.1:5273/?q=auto', { waitUntil: 'load', timeout: 60000 });
await ready(page);
await page.screenshot({ path: 'shots/kimi-final-desktop.png' });
console.log('desktop', await page.evaluate(() => window.__SCENE__.getStats()));

await page.locator('.nav [data-goto="1"]').click();
await page.waitForTimeout(1900);
await page.screenshot({ path: 'shots/kimi-final-archive.png' });
await page.locator('#burst-btn').click();
await page.waitForTimeout(360);
console.log('burst phase', await page.evaluate(() => window.__SCENE__.specimen.phase));
await page.screenshot({ path: 'shots/kimi-final-burst.png' });
await page.waitForFunction('window.__SCENE__.specimen.phase === "rest"', { timeout: 12000 });
console.log('first reconstruction', await page.evaluate(() => ({ phase: window.__SCENE__.specimen.phase, formation: window.__SCENE__.specimen.formationName })));
await page.locator('#burst-btn').click();
await page.waitForFunction('window.__SCENE__.specimen.phase === "rest"', { timeout: 12000 });
console.log('second reconstruction', await page.evaluate(() => ({ phase: window.__SCENE__.specimen.phase, formation: window.__SCENE__.specimen.formationName })));

await page.locator('.nav [data-goto="2"]').click();
await page.waitForTimeout(1900);
await page.screenshot({ path: 'shots/kimi-final-works.png' });
await page.locator('[data-project="0"]').click();
await page.waitForFunction('document.getElementById("project-dialog").open');
await page.screenshot({ path: 'shots/kimi-final-dialog.png' });
await page.keyboard.press('Escape');
await page.waitForFunction('!document.getElementById("project-dialog").open');
await page.locator('.nav [data-goto="3"]').click();
await page.waitForTimeout(1900);
await page.screenshot({ path: 'shots/kimi-final-contact.png' });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
watch(mobile);
await mobile.goto('http://127.0.0.1:5273/?q=auto', { waitUntil: 'load', timeout: 60000 });
await ready(mobile);
await mobile.screenshot({ path: 'shots/kimi-final-mobile.png' });
await mobile.locator('.nav [data-goto="1"]').tap();
await mobile.waitForTimeout(1900);
await mobile.screenshot({ path: 'shots/kimi-final-mobile-archive.png' });
await mobile.locator('#burst-btn').tap();
await mobile.waitForTimeout(400);
console.log('mobile burst', await mobile.evaluate(() => window.__SCENE__.specimen.phase));
await mobile.locator('.nav [data-goto="2"]').tap();
await mobile.waitForTimeout(1900);
await mobile.screenshot({ path: 'shots/kimi-final-mobile-works.png' });
await mobile.locator('[data-project="1"]').tap();
await mobile.waitForFunction('document.getElementById("project-dialog").open');
await mobile.locator('#dialog-close').tap();
await mobile.waitForFunction('!document.getElementById("project-dialog").open');
console.log('mobile layout', await mobile.evaluate(() => ({
  viewport: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  dialogClosed: !document.getElementById('project-dialog').open,
})));

console.log('errors', errors);
await browser.close();
if (errors.length) process.exitCode = 1;
