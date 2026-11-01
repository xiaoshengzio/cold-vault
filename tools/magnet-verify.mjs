import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  channel: 'msedge', headless: true,
  args: ['--ignore-gpu-blocklist', '--force_high_performance_gpu'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
await page.addInitScript(() => {
  window.__LONG_TASKS__ = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__LONG_TASKS__.push(Math.round(entry.duration));
    }).observe({ entryTypes: ['longtask'] });
  } catch {}
});
await page.goto('http://127.0.0.1:5273/?q=auto', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true && document.body.classList.contains("is-ready")', { timeout: 60000 });
await page.waitForTimeout(1800);
await page.screenshot({ path: 'shots/magnet-00-crystal.png' });
await page.locator('.nav [data-goto="1"]').click();
await page.waitForTimeout(1500);
const baseline = await page.evaluate(() => window.__SCENE__.specimen.pieces.map((piece) => [piece.home.x, piece.home.y, piece.home.z]));

await page.evaluate(() => {
  window.__orbitGaps = () => {
    const s = window.__SCENE__;
    const v = new window.__THREE__.Vector3();
    return s.specimen.rings.map((ring) => {
      ring.holder.updateMatrix();
      const positions = ring.holder.children[0].geometry.attributes.position;
      let minimum = Infinity;
      for (let i = 0; i < positions.count; i++) {
        v.fromBufferAttribute(positions, i).applyMatrix4(ring.holder.matrix);
        for (const piece of s.specimen.pieces) {
          minimum = Math.min(minimum, v.distanceTo(piece.mesh.position) - piece.radius);
        }
      }
      return +minimum.toFixed(3);
    });
  };
  console.log('initial orbit gaps', window.__orbitGaps());
});

const states = [];
for (let i = 0; i < 9; i++) {
  await page.locator('#burst-btn').click();
  await page.waitForTimeout(330);
  const activeOrbits = await page.evaluate(() => ({
    phase: window.__SCENE__.specimen.phase,
    visible: window.__SCENE__.specimen.rings.every((ring) => ring.mat.visible),
    gaps: window.__orbitGaps(),
  }));
  if (!activeOrbits.visible) throw new Error(`${activeOrbits.phase}: orbit hidden during transformation`);
  if (activeOrbits.gaps.some((gap) => gap < 0.01)) throw new Error(`${activeOrbits.phase}: active orbit intersection ${activeOrbits.gaps}`);
  if (i === 0) await page.screenshot({ path: 'shots/magnet-scatter.png' });
  await page.waitForFunction('window.__SCENE__.specimen.phase === "rest"', { timeout: 14000 });
  await page.waitForTimeout(1200);
  const state = await page.evaluate(() => {
    const s = window.__SCENE__;
    let radius = 0;
    for (const piece of s.specimen.pieces) {
      const p = piece.mesh.position;
      if (!Number.isFinite(p.x + p.y + p.z)) throw new Error('Non-finite magnet position');
      radius = Math.max(radius, p.length());
    }
    return {
      formation: s.specimen.formation,
      name: s.specimen.formationName,
      remaining: s.specimen.remaining,
      radius: +radius.toFixed(3),
      orbitGaps: window.__orbitGaps(),
      instances: s.scene.getObjectByName('88-independent-magnets')?.count,
      fps: s.getStats().fps,
    };
  });
  if (state.radius > 4) throw new Error(`${state.name} escaped containment: radius ${state.radius}`);
  if (state.orbitGaps.some((gap) => gap < 0.01)) throw new Error(`${state.name} orbit intersection: ${state.orbitGaps}`);
  states.push(state);
  await page.screenshot({ path: `shots/magnet-${String(i + 1).padStart(2, '0')}-${state.name.toLowerCase()}.png` });
  console.log(state);
}

if (states.slice(0, 8).some((state) => state.name === 'CRYSTAL')) throw new Error('Returned to crystal before the eighth variation');
if (new Set(states.slice(0, 8).map((state) => state.name)).size !== 8) throw new Error('Variations repeated within a cycle');
if (states[8].name !== 'CRYSTAL' || states[8].remaining !== 0) throw new Error('Ninth transformation did not close the cycle');
const homeDrift = await page.evaluate((base) => Math.max(...window.__SCENE__.specimen.pieces.map((piece, i) =>
  Math.hypot(piece.home.x - base[i][0], piece.home.y - base[i][1], piece.home.z - base[i][2]))), baseline);
if (homeDrift > 0.002) throw new Error(`Opening crystal was not restored exactly: ${homeDrift}`);
console.log('home drift', homeDrift);

await page.locator('.nav [data-goto="0"]').click();
await page.waitForTimeout(1400);
await page.mouse.move(95, 450);
await page.mouse.down();
await page.mouse.move(390, 610, { steps: 14 });
await page.mouse.up();
console.log('selection', await page.evaluate(() => String(getSelection())));
console.log('longtasks', await page.evaluate(() => window.__LONG_TASKS__));
console.log('unique formations', new Set(states.map((state) => state.name)).size);
console.log('errors', errors);
await browser.close();
if (errors.length || new Set(states.map((state) => state.name)).size !== 9) process.exitCode = 1;
