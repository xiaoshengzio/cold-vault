import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist','--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5273/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY__ === true', { timeout: 40000 });
await page.waitForTimeout(2000);
const out = await page.evaluate(() => {
  const S = window.__SCENE__.specimen;
  const R = window.__RAPIER__;
  const world = S.world;
  // 新建一个动态球体做对照
  const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 6, 0).setCanSleep(false));
  const desc = R.ColliderDesc.ball(0.1).setDensity(1);
  world.createCollider(desc, body);
  body.applyImpulse({ x: 0, y: 1, z: 0 }, true);
  const v = body.linvel();
  const p = S.pieces[0];
  const beforeV = p.body.linvel();
  p.body.applyImpulse({ x: 0, y: 3, z: 0 }, true);
  const afterV = p.body.linvel();
  world.timestep = 1 / 60;
  world.step();
  return {
    ball: { mass: body.mass(), v, afterOneStep: body.linvel(), tr: body.translation() },
    piece: { mass: p.body.mass(), beforeV, afterV, afterStep: p.body.linvel(), tr: p.body.translation(), type: p.body.bodyType() },
  };
});
console.log('RESULT', JSON.stringify(out));
await browser.close();
