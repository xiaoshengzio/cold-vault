import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  channel: 'msedge', headless: true,
  args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'],
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    window.__DRAG_LONG__ = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__DRAG_LONG__.push(Math.round(entry.duration));
    }).observe({ entryTypes: ['longtask'] });
  });
  await page.goto(process.argv[2] ?? 'http://127.0.0.1:5273/?q=auto', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__READY__ === true && document.body.classList.contains("is-ready")', { timeout: 60000 });
  await page.evaluate(() => { window.__DRAG_LONG__.length = 0; });
  const dragState = () => page.evaluate(() => window.__SCENE__.getDragState());

  await page.mouse.move(100, 410);
  await page.mouse.down();
  await page.mouse.move(1700, 410, { steps: 60 });
  await page.mouse.up();
  const fullTurn = await dragState();
  if (fullTurn.down || Math.abs(fullTurn.yaw - Math.PI * 2) > 0.16) throw new Error(`Full turn failed: ${JSON.stringify(fullTurn)}`);

  await page.mouse.move(1500, 410);
  await page.mouse.down();
  await page.mouse.move(-100, 410, { steps: 60 });
  await page.mouse.up();
  const reverseTurn = await dragState();
  if (reverseTurn.down || Math.abs(reverseTurn.yaw) > 0.20) throw new Error(`Reverse turn failed: ${JSON.stringify(reverseTurn)}`);

  await page.mouse.move(300, 410);
  await page.mouse.down();
  await page.mouse.move(1100, 410, { steps: 35 });
  await page.mouse.up();
  await page.waitForTimeout(3800);
  const settled = await dragState();
  await page.waitForTimeout(1200);
  const later = await dragState();
  if (Math.abs(later.yaw - settled.yaw) > 0.015 || Math.abs(later.yaw) < 2) {
    throw new Error(`Angle did not persist: ${JSON.stringify({ settled, later })}`);
  }

  await page.mouse.move(500, 400);
  await page.mouse.down();
  await page.mouse.move(700, 430, { steps: 8 });
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const blurred = await dragState();
  await page.mouse.up();
  if (blurred.down || await page.evaluate(() => document.body.classList.contains('is-grabbing'))) {
    throw new Error(`Drag remained latched after blur: ${JSON.stringify(blurred)}`);
  }

  await page.locator('.nav [data-goto="1"]').click();
  await page.waitForTimeout(900);
  await page.locator('#burst-btn').click();
  await page.mouse.move(300, 420);
  await page.mouse.down();
  await page.mouse.move(1300, 460, { steps: 30 });
  await page.mouse.up();
  const afterActiveDrag = await dragState();
  if (afterActiveDrag.down) throw new Error('Drag latched during formation');
  const result = await page.evaluate(() => ({
    longtasks: window.__DRAG_LONG__,
    fps: window.__SCENE__.getStats().fps,
    selection: String(getSelection()),
  }));
  if (result.longtasks.some((duration) => duration > 250)) throw new Error(`Drag longtasks: ${result.longtasks}`);
  if (result.selection) throw new Error(`Drag selected text: ${result.selection}`);
  console.log('full turn', fullTurn);
  console.log('reverse turn', reverseTurn);
  console.log('persisted angle', { settled, later });
  console.log('active drag', afterActiveDrag);
  console.log('result', result);
  console.log('errors', errors);
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
