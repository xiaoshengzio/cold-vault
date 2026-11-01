import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://127.0.0.1:5273/?q=auto';
const port = 9700 + (process.pid % 400);
const profile = path.resolve(`tmp/real-stress-${process.pid}`);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const executable = fs.existsSync(edge) ? edge : chromium.executablePath();
const child = spawn(executable, [
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-session-crashed-bubble',
  '--remote-allow-origins=*', '--window-size=1600,900', '--new-window', 'about:blank',
], { stdio: 'ignore' });

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.errors = [];
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
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
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
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; }
    catch { await sleep(200); }
  }
  if (!version) throw new Error('Browser did not start');
  cdp = await CDP.connect(version.webSocketDebuggerUrl);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((item) => item.type === 'page');
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.id, flatten: true });
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__STRESS_LONG__=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__STRESS_LONG__.push([Math.round(e.startTime),Math.round(e.duration)])}).observe({entryTypes:['longtask']});`,
  }, sessionId);
  const evaluate = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  const waitFor = async (expression, timeout = 30000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    const state = await evaluate('({boot:window.__BOOT__,body:document.body.className,frames:window.__FRAMES__,long:window.__STRESS_LONG__,loop:window.__SCENE__?.getLoopState?.()})');
    const image = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    fs.writeFileSync('shots/real-stress-timeout.png', Buffer.from(image.data, 'base64'));
    throw new Error(`Timeout ${expression}: ${JSON.stringify(state)} exceptions=${JSON.stringify(cdp.errors)}`);
  };
  const mouse = async (type, x, y, buttons = 0) => {
    await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 }, sessionId);
  };

  for (let run = 1; run <= 3; run++) {
    const started = Date.now();
    await cdp.send('Target.activateTarget', { targetId: target.id });
    await cdp.send('Page.bringToFront', {}, sessionId);
    await cdp.send('Page.navigate', { url }, sessionId);
    await waitFor('window.__SCENE__ && window.__READY__ === true && document.body.classList.contains("is-ready")');
    const readyMs = Date.now() - started;
    const stats = await evaluate('window.__SCENE__.getStats()');
    console.log('cold start', { run, readyMs, stats });
    await mouse('mousePressed', 770, 410, 1);
    await mouse('mouseReleased', 770, 410, 0);
    await mouse('mousePressed', 300, 410, 1);
    for (let i = 1; i <= 30; i++) {
      await mouse('mouseMoved', 300 + i * 30, 410 + Math.sin(i / 4) * 30, 1);
      await sleep(8);
    }
    await mouse('mouseReleased', 1200, 410, 0);
    const framesBefore = await evaluate('__FRAMES__');
    await sleep(2500);
    await cdp.send('Target.activateTarget', { targetId: target.id });
    await cdp.send('Page.bringToFront', {}, sessionId);
    await sleep(300);
    const result = await evaluate(`({frames:__FRAMES__,long:__STRESS_LONG__,drag:__SCENE__.getDragState(),loop:__SCENE__.getLoopState(),stats:__SCENE__.getStats()})`);
    if (result.frames <= framesBefore) throw new Error(`Run ${run}: rendering stopped after input ${JSON.stringify(result)}`);
    console.log('input result', { run, framesBefore, ...result });
    const image = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    fs.writeFileSync(`shots/real-stress-${run}.png`, Buffer.from(image.data, 'base64'));
  }
  console.log('runtime exceptions', cdp.errors);
  await cdp.send('Browser.close');
} finally {
  if (cdp) {
    try { await cdp.send('Browser.close'); } catch { /* already closed */ }
    cdp.close();
  }
  if (child.exitCode === null) child.kill();
  await sleep(800);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* next run cleans its own profile */ }
}
