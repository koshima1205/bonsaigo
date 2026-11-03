// 縁側の BGM。音源ファイルは使わず、その場で鳴らす（著作権の心配がない・毎回少しずつ違う）。
// 琴（都節の音階・D）を間をあけて爪弾き、ときどき尺八が長く鳴り、低い音と風が下に流れる。

const BASE = 146.83; // D3
const IN = [0, 1, 5, 7, 8]; // 都節：D Eb G A Bb
const deg = (i) => BASE * Math.pow(2, (12 * Math.floor(i / 5) + IN[((i % 5) + 5) % 5]) / 12);

let ctx, master, dry, send, rec, running = false, level = 0.5;
const timers = new Set();
const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const cache = new Map();

function init() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 3;
  master.connect(comp);
  comp.connect(ctx.destination);
  rec = ctx.createMediaStreamDestination();
  comp.connect(rec);

  const conv = ctx.createConvolver();
  conv.buffer = impulse(5, 2.4);
  const wet = ctx.createGain();
  wet.gain.value = 0.6;
  conv.connect(wet).connect(master);
  send = conv;
  dry = ctx.createGain();
  dry.gain.value = 0.75;
  dry.connect(master);
}

function impulse(sec, decay) {
  const len = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 300 ? i / 300 : 1);
  }
  return b;
}

// 琴の弦（Karplus-Strong）
function string(freq) {
  const k = Math.round(freq);
  if (cache.has(k)) return cache.get(k);
  const sr = ctx.sampleRate, N = Math.round(sr / freq), len = Math.floor(sr * 5);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
  // 爪で弾いた明るさを少し残す
  for (let i = 1; i < N; i++) ring[i] = ring[i] * 0.6 + ring[i - 1] * 0.4;
  const damp = 0.9975 - freq / 60000;
  let idx = 0, peak = 0;
  for (let i = 0; i < len; i++) {
    const a = ring[idx], b = ring[(idx + 1) % N];
    ring[idx] = (a + b) * 0.5 * damp;
    d[i] = a;
    peak = Math.max(peak, Math.abs(a));
    idx = (idx + 1) % N;
  }
  for (let i = 0; i < len; i++) d[i] /= peak || 1;
  cache.set(k, buf);
  return buf;
}

function out(node, wetAmt = 0.5) {
  node.connect(dry);
  const g = ctx.createGain();
  g.gain.value = wetAmt;
  node.connect(g).connect(send);
}

function koto(freq, t, vel = 0.35, bend = false) {
  const src = ctx.createBufferSource();
  src.buffer = string(freq);
  if (bend) {
    // 押し手：弦を押して半音上げる
    src.playbackRate.setValueAtTime(1, t + 0.28);
    src.playbackRate.linearRampToValueAtTime(1.0595, t + 0.5);
  }
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 3200; lp.Q.value = 0.3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 4.6);
  src.connect(lp).connect(g);
  out(g, 0.55);
  src.start(t);
  src.stop(t + 5);
  // 爪が弦に当たる小さな音
  const n = noiseSrc(0.03);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 3800; bp.Q.value = 2;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(vel * 0.18, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  n.connect(bp).connect(ng);
  out(ng, 0.3);
  n.start(t);
}

function noiseSrc(sec, loop = false) {
  const len = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.loop = loop;
  return s;
}

// 尺八：息の音と、少し低く入ってから音程に寄る（メリからカリへ）
function shakuhachi(freq, t, dur) {
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(freq * 0.955, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.7);
  const o2 = ctx.createOscillator();
  o2.type = "triangle";
  o2.frequency.setValueAtTime(freq * 1.91, t);
  o2.frequency.exponentialRampToValueAtTime(freq * 2, t + 0.7);
  const vib = ctx.createOscillator();
  vib.frequency.value = 4.6;
  const vg = ctx.createGain();
  vg.gain.setValueAtTime(0, t);
  vg.gain.linearRampToValueAtTime(freq * 0.011, t + dur * 0.7);
  vib.connect(vg);
  vg.connect(o.frequency);
  vg.connect(o2.frequency);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 1700;
  const g2 = ctx.createGain(); g2.gain.value = 0.12;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.13, t + 0.9);
  g.gain.linearRampToValueAtTime(0.1, t + dur * 0.55);
  g.gain.linearRampToValueAtTime(0.14, t + dur * 0.8);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.6);
  o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g);
  const br = noiseSrc(dur + 2);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = freq * 2; bp.Q.value = 1.2;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, t);
  bg.gain.linearRampToValueAtTime(0.05, t + 0.25);
  bg.gain.linearRampToValueAtTime(0.018, t + 1.2);
  bg.gain.linearRampToValueAtTime(0.0001, t + dur + 1.4);
  br.connect(bp).connect(bg);
  out(g, 0.8);
  out(bg, 0.8);
  [o, o2, vib, br].forEach((n) => { n.start(t); n.stop(t + dur + 2); });
}

// 鹿威し：竹が石を打つ音
function knock(t) {
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(760, t);
  o.frequency.exponentialRampToValueAtTime(420, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g);
  out(g, 1.2);
  o.start(t);
  o.stop(t + 0.2);
}

function drone() {
  const t = ctx.currentTime;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 380;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const lg = ctx.createGain();
  lg.gain.value = 0.025;
  lfo.connect(lg).connect(g.gain);
  [73.42, 110, 146.83].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.frequency.value = f * (1 + (i - 1) * 0.0015);
    const og = ctx.createGain();
    og.gain.value = [1, 0.55, 0.22][i];
    o.connect(og).connect(lp);
    o.start(t);
  });
  lp.connect(g);
  out(g, 0.4);
  lfo.start(t);
  // 風
  const w = noiseSrc(4, true);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 520; bp.Q.value = 0.6;
  const wg = ctx.createGain();
  wg.gain.value = 0.012;
  const wl = ctx.createOscillator();
  wl.frequency.value = 0.045;
  const wlg = ctx.createGain();
  wlg.gain.value = 0.01;
  wl.connect(wlg).connect(wg.gain);
  w.connect(bp).connect(wg);
  out(wg, 0.6);
  w.start(t);
  wl.start(t);
}

// 琴のひと節：下りがちに歩き、D か A で長く終わる
function phrase() {
  if (!running) return;
  let i = pick([7, 8, 9, 10, 11]);
  let t = ctx.currentTime + 0.1;
  const n = 3 + Math.floor(Math.random() * 4);
  for (let k = 0; k < n; k++) {
    const last = k === n - 1;
    if (last) i = pick([5, 8, 10]);
    const vel = 0.22 + Math.random() * 0.18;
    koto(deg(i), t, vel, !last && Math.random() < 0.18 && IN[i % 5] === 7);
    if (Math.random() < 0.2) koto(deg(i - 5), t + 0.02, vel * 0.6);
    if (last && Math.random() < 0.5) koto(deg(i + 5), t + 0.9, vel * 0.5);
    t += last ? 0 : pick([0.42, 0.55, 0.55, 0.85, 1.25]);
    i += pick([-1, -1, -1, -2, 1, 1, 2]);
    i = Math.max(3, Math.min(13, i));
  }
  later(phrase, (t - ctx.currentTime) * 1000 + 3800 + Math.random() * 5200);
}

function flute() {
  if (!running) return;
  shakuhachi(deg(pick([8, 10, 10, 11, 13])) , ctx.currentTime + 0.2, 3.5 + Math.random() * 2.5);
  later(flute, 19000 + Math.random() * 17000);
}

function water() {
  if (!running) return;
  if (Math.random() < 0.6) knock(ctx.currentTime + 0.05);
  later(water, 36000 + Math.random() * 30000);
}

export const bgm = {
  get on() { return running; },
  async start() {
    init();
    await ctx.resume();
    if (running) return;
    running = true;
    if (!this._drone) { drone(); this._drone = true; }
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(level, ctx.currentTime + 3);
    later(phrase, 900);
    later(flute, 6500);
    later(water, 14000);
    document.dispatchEvent(new CustomEvent("bgm", { detail: true }));
  },
  stop() {
    if (!ctx || !running) return;
    running = false;
    timers.forEach(clearTimeout);
    timers.clear();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
    setTimeout(() => { if (!running) ctx.suspend(); }, 1400);
    document.dispatchEvent(new CustomEvent("bgm", { detail: false }));
  },
  toggle() { return running ? this.stop() : this.start(); },
  // 声を聞くとき・話すときは小さくする
  duck(down) {
    if (!ctx || !running) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(down ? level * 0.15 : level, ctx.currentTime + 0.6);
  },
  // 動画の書き出し用
  stream() { init(); return rec.stream; },
};
