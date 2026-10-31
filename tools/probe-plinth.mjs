import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist','--force_high_performance_gpu'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await p.goto('http://127.0.0.1:5273/?nopost=0', { waitUntil: 'load' });
await p.waitForFunction(() => window.__READY__ === true, null, { timeout: 60000 });
await p.waitForTimeout(1200);
const out = await p.evaluate(() => {
  const S = window.__SCENE__; const THREE = window.__THREE__;
  const pts = [[-0.62,1.0,-4.3],[-0.62,0.4,-4.3],[-0.62,0.0,-4.3],[-0.62,0.4,-9.0]];
  const res = pts.map(([x,y,z]) => { const v = new THREE.Vector3(x,y,z).project(S.camera); return [Math.round((v.x*0.5+0.5)*1600), Math.round((-v.y*0.5+0.5)*900), +v.z.toFixed(2)]; });
  const kids = []; S.room.group.traverse(o => { if (o.isMesh && o.geometry.type === 'CylinderGeometry') kids.push([o.geometry.parameters.radiusTop, o.position.toArray().map(n=>+n.toFixed(2)), o.material.color ? o.material.color.getHexString() : 'x']); });
  return { res, kids };
});
console.log(JSON.stringify(out));
await b.close();