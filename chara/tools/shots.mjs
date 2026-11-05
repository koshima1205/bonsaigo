// 庭の確認写真を、画面を出さずに Chrome で撮る（追加の部品なし・Node 22+）。
// 使い方: node chara/tools/shots.mjs <出力フォルダ> <shots.json>
//   shots.json = [{ "name": "day_engawa", "q": "c=sakuya&at=-2,-6&yaw=200", "w": 1280, "h": 720, "mobile": false }]
//   "lang": "en-US" でブラウザの言葉を変える。"js": "…" を足すと、撮る前にそのページでスクリプトを動かす（フォームに書いて送る など。Promise を返せば待つ）
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const [outDir, listFile] = process.argv.slice(2);
const BASE = process.env.NIWA_URL || 'http://127.0.0.1:8797/niwa/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const GL = process.env.NIWA_GL || 'gpu';
const shots = JSON.parse(readFileSync(listFile, 'utf8').replace(/^﻿/, ''));
mkdirSync(outDir, { recursive: true });

const port = 9300 + Math.floor(Math.random() * 600);
const prof = mkdtempSync(join(tmpdir(), 'niwa-shot-'));
const flags = ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--mute-audio', '--ignore-gpu-blocklist', '--enable-webgl', 'about:blank'];
if (GL === 'swiftshader') flags.unshift('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
const chrome = spawn(CHROME, flags, { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ver;
for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
if (!ver) { chrome.kill(); throw new Error('Chrome が起動しませんでした'); }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const wait = new Map();
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); }
  // ページの中のエラーも出す（直すときの手がかり）
  if (d.method === 'Runtime.exceptionThrown') console.log('  ! 例外:', d.params.exceptionDetails?.exception?.description?.split(String.fromCharCode(10))[0] || d.params.exceptionDetails?.text);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') console.log('  ! console.error:', d.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const i = ++id; wait.set(i, (d) => (d.error ? rej(new Error(`${method}: ${d.error.message}`)) : res(d.result)));
  ws.send(JSON.stringify({ id: i, method, params, sessionId }));
});

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, S); await send('Runtime.enable', {}, S);
const evalJS = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, S)).result.value;

for (const s of shots) {
  const w = s.w || 1280, h = s.h || 720;
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: s.dpr || 1, mobile: !!s.mobile }, S);
  await send('Emulation.setTouchEmulationEnabled', { enabled: !!s.mobile, maxTouchPoints: s.mobile ? 5 : 1 }, S);
  // "lang": "en-US" で、ブラウザの言葉を変えて撮る（navigator.language が変わる）
  await send('Emulation.setUserAgentOverride', { userAgent: ver['User-Agent'], acceptLanguage: s.lang || 'ja-JP' }, S);
  const url = `${BASE}?${s.q}${s.q ? '&' : ''}r=${Date.now()}`;
  await send('Page.navigate', { url }, S);
  const t0 = Date.now(); let ok = false;
  while (!s.noWait && Date.now() - t0 < 60000) { await sleep(400); ok = await evalJS("document.documentElement.dataset.ready === '1'").catch(() => false); if (ok) break; }
  if (s.click) { // "click": [x, y] … 本物のマウスで1回押す（ページの中から作ったイベントでは通らない操作の確認用）
    const [x, y] = s.click;
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 }, S);
    await sleep(700);
  }
  if (s.js) { const out = await evalJS(s.js).catch((e) => `失敗: ${e.message}`); if (out !== undefined) console.log(`  js → ${typeof out === 'string' ? out : JSON.stringify(out)}`); }
  await sleep(s.settle ?? (s.noWait ? 6000 : 1200));
  const info = await evalJS(`(() => { const c = document.querySelector('canvas'); const gl = c && (c.getContext('webgl2') || c.getContext('webgl')); const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info'); return { gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?', err: document.querySelector('#err')?.textContent || '' }; })()`).catch(() => ({}));
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 86 }, S);
  const file = join(outDir, `${s.name}.jpg`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`${ok ? 'ok ' : 'TIMEOUT'} ${s.name} ${w}x${h} gpu=${info.gpu} ${info.err}`);
}
ws.close(); chrome.kill();
