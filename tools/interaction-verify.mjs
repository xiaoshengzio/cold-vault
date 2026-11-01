import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  channel: 'msedge', headless: true,
  args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'],
});
const errors = [];
const assertCycle = (sequence, label) => {
  if (sequence.length !== 9) throw new Error(`${label}: expected 9 states, got ${sequence.length}`);
  if (sequence.slice(0, 8).some((name) => name === 'CRYSTAL')) throw new Error(`${label}: early crystal`);
  if (new Set(sequence.slice(0, 8)).size !== 8) throw new Error(`${label}: repeated variation ${sequence}`);
  if (sequence[8] !== 'CRYSTAL') throw new Error(`${label}: ninth state is not crystal ${sequence}`);
};

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    window.__INTERACTION_LONG__ = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__INTERACTION_LONG__.push(Math.round(entry.duration));
    }).observe({ entryTypes: ['longtask'] });
  });
  await page.goto(process.argv[2] ?? 'http://127.0.0.1:5273/?q=auto', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__READY__ === true && document.body.classList.contains("is-ready")', { timeout: 60000 });
  await page.locator('.nav [data-goto="1"]').click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.__INTERACTION_LONG__.length = 0; });

  const direct = await page.evaluate(() => {
    const specimen = window.__SCENE__.specimen;
    const sequence = [];
    const accepted = [];
    for (let i = 0; i < 9; i++) {
      accepted.push(specimen.burst());
      sequence.push(specimen.formationName);
    }
    return { sequence, accepted, remaining: specimen.remaining };
  });
  if (direct.accepted.some((accepted) => !accepted)) throw new Error('A rapid burst was rejected');
  assertCycle(direct.sequence, 'direct retrigger');
  if (direct.remaining !== 0) throw new Error('Cycle did not drain queue');
  await page.waitForFunction('window.__SCENE__.specimen.phase === "rest"', { timeout: 12000 });

  const clicked = [];
  for (let i = 0; i < 9; i++) {
    await page.locator('#burst-btn').click();
    clicked.push(await page.evaluate(() => window.__SCENE__.specimen.formationName));
    await page.waitForTimeout(200);
  }
  assertCycle(clicked, 'pointer retrigger');
  await page.waitForFunction('window.__SCENE__.specimen.phase === "rest"', { timeout: 12000 });
  const result = await page.evaluate(() => {
    const specimen = window.__SCENE__.specimen;
    const positions = specimen.pieces.map((piece) => piece.mesh.position);
    return {
      radius: Math.max(...positions.map((position) => position.length())),
      finite: positions.every((position) => Number.isFinite(position.x + position.y + position.z)),
      snapped: specimen.snappedCount,
      longtasks: window.__INTERACTION_LONG__,
      fps: window.__SCENE__.getStats().fps,
    };
  });
  if (!result.finite || result.radius > 4 || result.snapped !== 88) throw new Error(`Unstable rapid retrigger: ${JSON.stringify(result)}`);
  if (result.longtasks.some((duration) => duration > 250)) throw new Error(`Interaction longtask: ${result.longtasks}`);

  await page.locator('.nav [data-goto="2"]').click();
  await page.waitForTimeout(1000);
  const before = await page.evaluate(() => window.__SCENE__.specimen.formationName);
  const heading = await page.locator('.works-head .h2').boundingBox();
  if (!heading) throw new Error('Works heading is not visible');
  await page.mouse.click(heading.x + heading.width * 0.5, heading.y + heading.height * 0.5);
  const after = await page.evaluate(() => window.__SCENE__.specimen.formationName);
  if (before !== after) throw new Error('Clicking project copy advanced the formation');
  console.log('direct cycle', direct.sequence);
  console.log('clicked cycle', clicked);
  console.log('rapid result', result);
  console.log('errors', errors);
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
