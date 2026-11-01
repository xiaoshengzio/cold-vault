import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const port = 9334 + (process.pid % 500);
const profile = path.resolve(`tmp/visibility-profile-${process.pid}`);
fs.rmSync(profile, { recursive: true, force: true });
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const executable = fs.existsSync(edge) ? edge : chromium.executablePath();
const child = spawn(executable, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-session-crashed-bubble',
  '--ignore-gpu-blocklist', '--force_high_performance_gpu', '--remote-allow-origins=*',
  '--new-window', 'http://127.0.0.1:5273/?q=auto',
], { stdio: 'ignore' });

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.errors = [];
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') this.errors.push(message.params);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    };
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
    return new CDP(ws);
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  close() { this.ws.close(); }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let cdp;
try {
  let version;
  for (let i = 0; i < 100; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      break;
    } catch { await sleep(200); }
  }
  if (!version) throw new Error('CDP browser did not start');
  cdp = await CDP.connect(version.webSocketDebuggerUrl);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const pageTarget = targets.find((target) => target.type === 'page' && target.url.includes('5273'));
  if (!pageTarget) throw new Error('Site target not found');
  await cdp.send('Target.activateTarget', { targetId: pageTarget.id });
  const attached = await cdp.send('Target.attachToTarget', { targetId: pageTarget.id, flatten: true });
  const session = attached.sessionId;
  await cdp.send('Runtime.enable', {}, session);
  await cdp.send('Page.enable', {}, session);
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }, session);
  await cdp.send('Page.bringToFront', {}, session);
  const evaluate = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  const waitFor = async (expression, timeout = 60000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await evaluate(expression)) return;
      await sleep(180);
    }
    const state = await evaluate('({hidden:document.hidden,boot:window.__BOOT__,frames:window.__FRAMES__,body:document.body.className,url:location.href})');
    throw new Error(`Timeout: ${expression} :: ${JSON.stringify(state)}`);
  };
  await waitFor('document.visibilityState === "visible"', 10000);
  await waitFor('window.__SCENE__ && window.__READY__ === true && document.body.classList.contains("is-ready")');
  const before = await evaluate('({frames:__FRAMES__,origin:performance.timeOrigin,quality:__SCENE__.getStats()})');
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false }, session);
  const blank = await cdp.send('Target.createTarget', { url: 'about:blank' });
  await cdp.send('Target.activateTarget', { targetId: blank.targetId });
  await sleep(600);
  const hidden = await evaluate('document.visibilityState');
  if (hidden !== 'hidden') throw new Error(`Expected hidden tab, got ${hidden}`);
  const stoppedAt = await evaluate('__FRAMES__');
  await sleep(2500);
  const afterHidden = await evaluate('__FRAMES__');
  if (afterHidden !== stoppedAt) throw new Error(`Rendering continued in background: ${stoppedAt} -> ${afterHidden}`);

  await cdp.send('Target.activateTarget', { targetId: pageTarget.id });
  await cdp.send('Page.bringToFront', {}, session);
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }, session);
  await waitFor(`__FRAMES__ > ${afterHidden + 2}`, 8000);
  const resumed = await evaluate('({origin:performance.timeOrigin,quality:__SCENE__.getStats(),lost:__SCENE__.renderer.getContext().isContextLost()})');
  if (resumed.origin !== before.origin) throw new Error('Visible resume unexpectedly reloaded the page');
  if (resumed.quality.fx !== before.quality.fx || resumed.quality.res !== before.quality.res) {
    throw new Error(`Quality changed across visibility: ${JSON.stringify({ before: before.quality, after: resumed.quality })}`);
  }
  if (resumed.lost) throw new Error('Context lost during ordinary resume');
  console.log('ordinary resume', { stoppedAt, afterHidden, resumedFrames: await evaluate('__FRAMES__'), quality: resumed.quality });

  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false }, session);
  await cdp.send('Target.activateTarget', { targetId: blank.targetId });
  await sleep(300);
  await cdp.send('Page.reload', { ignoreCache: true }, session);
  await waitFor('window.__BOOT__?.pct >= 52 && document.getElementById("pl-num")?.textContent !== "000"', 30000);
  const hiddenBoot = await evaluate('({boot:window.__BOOT__?.pct ?? 0,num:document.getElementById("pl-num")?.textContent,hidden:document.hidden})');
  if (!hiddenBoot.hidden || hiddenBoot.boot <= 0 || hiddenBoot.num === '000') {
    throw new Error(`Hidden reload stalled at boot: ${JSON.stringify(hiddenBoot)}`);
  }
  console.log('hidden reload progress', hiddenBoot);
  await cdp.send('Target.activateTarget', { targetId: pageTarget.id });
  await cdp.send('Page.bringToFront', {}, session);
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }, session);
  await waitFor('window.__SCENE__ && window.__READY__ === true && document.body.classList.contains("is-ready")');

  const framesBeforeLoss = await evaluate('__FRAMES__');
  await evaluate(`(() => {
    const gl = window.__SCENE__.renderer.getContext();
    window.__restoreTest = gl.getExtension('WEBGL_lose_context');
    window.__restoreTest.loseContext();
    setTimeout(() => window.__restoreTest.restoreContext(), 300);
    return true;
  })()`);
  await sleep(500);
  await cdp.send('Target.activateTarget', { targetId: pageTarget.id });
  await cdp.send('Page.bringToFront', {}, session);
  await waitFor(`!window.__SCENE__.renderer.getContext().isContextLost() && window.__FRAMES__ > ${framesBeforeLoss + 3}`, 45000);
  const restored = await evaluate('({lost:__SCENE__.renderer.getContext().isContextLost(),env:!!__SCENE__.specimen.pieces[0].mesh.material.envMap,frames:__FRAMES__})');
  if (restored.lost || !restored.env) throw new Error(`Context did not restore materials: ${JSON.stringify(restored)}`);
  console.log('context restored', restored);
  console.log('runtime exceptions', cdp.errors.length);
  await cdp.send('Browser.close');
} finally {
  if (cdp) {
    try { await cdp.send('Browser.close'); } catch { /* browser may already be closed */ }
    cdp.close();
  }
  if (child.exitCode === null) child.kill();
  await sleep(1500);
  try {
    fs.rmSync(profile, { recursive: true, force: true });
  } catch (error) {
    console.warn('Temporary browser profile will be removed on the next run', error.code);
  }
}
