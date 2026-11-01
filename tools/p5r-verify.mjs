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
  if (await page.locator('body').innerText().then((text) => text.includes('冷库'))) throw new Error('Cold Vault Chinese label still visible');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'shots/p5r-hero.png' });
  await page.locator('.nav [data-goto="1"]').click();
  await page.waitForTimeout(900);
  console.log('archive title', await page.locator('.sec-archive .h2').innerText());
  await page.locator('.nav [data-goto="2"]').click();
  await page.waitForTimeout(900);
  await page.locator('[data-project="0"]').click();
  await page.waitForFunction('document.getElementById("project-dialog").open && document.getElementById("project-image").naturalWidth > 0', { timeout: 15000 });
  console.log('project', await page.locator('#project-title').textContent());
  console.log('algorithm', await page.locator('#project-description').textContent());
  console.log('description paragraphs', await page.locator('#project-description p').count());
  console.log('image', await page.locator('#project-image').evaluate((image) => ({ visible: !image.hidden, width: image.naturalWidth })));
  await page.screenshot({ path: 'shots/p5r-dialog.png' });
  console.log('errors', errors);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
  await mobile.waitForFunction('window.__SCENE__ && document.body.classList.contains("is-ready")', { timeout: 60000 });
  await mobile.waitForTimeout(1800);
  await mobile.screenshot({ path: 'shots/p5r-mobile.png' });
  console.log('mobile overflow', await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
