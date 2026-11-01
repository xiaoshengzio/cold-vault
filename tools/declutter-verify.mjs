import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  channel: 'msedge', headless: true,
  args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'],
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__SCENE__ && document.body.classList.contains("is-ready")', { timeout: 60000 });
  await page.locator('.nav [data-goto="2"]').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'shots/declutter-works.png' });
  await page.locator('[data-project="4"]').click();
  await page.waitForFunction('document.getElementById("project-dialog").open');
  console.log('cursor', await page.evaluate(() => ({
    dialog: getComputedStyle(document.getElementById('project-dialog')).cursor,
    button: getComputedStyle(document.getElementById('dialog-close')).cursor,
  })));
  console.log('removed labels', await page.evaluate(() => ({
    en: !!document.getElementById('project-en'),
    credits: !!document.getElementById('project-credits'),
    tags: !!document.getElementById('project-tags'),
    foot: !!document.getElementById('project-foot'),
    spec: !!document.querySelector('.spec'),
  })));
  await page.screenshot({ path: 'shots/declutter-dialog.png' });
  console.log('errors', errors);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
  await mobile.waitForFunction('window.__SCENE__ && document.body.classList.contains("is-ready")', { timeout: 60000 });
  await mobile.locator('.nav [data-goto="2"]').tap();
  await mobile.waitForTimeout(1000);
  await mobile.locator('[data-project="4"]').tap();
  await mobile.screenshot({ path: 'shots/declutter-mobile.png' });
  console.log('mobile overflow', await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
