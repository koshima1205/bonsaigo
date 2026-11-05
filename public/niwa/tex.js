// 庭で使う絵（質感）を、その場で canvas に描いて作る。外から画像を持ってこない（権利のある素材を使わないため）。
import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

export function tex(c, { rep = [1, 1], color = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep[0], rep[1]);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// つなぎ目が出ないように、端にかかる点は反対側にも描く
function dots(g, w, h, r, n, colors, rmin, rmax, alpha = 1, stretch = [0.6, 1.4]) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (0.45 + r() * 0.55);
    g.fillStyle = colors[(r() * colors.length) | 0];
    const x = r() * w, y = r() * h, rr = rmin + r() * (rmax - rmin);
    const sx = stretch[0] + r() * (stretch[1] - stretch[0]), rot = r() * Math.PI;
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
      if (x + dx < -rr * 2 || x + dx > w + rr * 2 || y + dy < -rr * 2 || y + dy > h + rr * 2) continue;
      g.beginPath(); g.ellipse(x + dx, y + dy, rr * sx, rr, rot, 0, Math.PI * 2); g.fill();
    }
  }
  g.globalAlpha = 1;
}

function strokes(g, w, h, r, n, colors, len, width, alpha, angle = null) {
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (0.4 + r() * 0.6);
    g.strokeStyle = colors[(r() * colors.length) | 0];
    g.lineWidth = width * (0.5 + r());
    const x = r() * w, y = r() * h, a = angle === null ? r() * Math.PI : angle + (r() - 0.5) * 0.5, l = len * (0.5 + r());
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
      g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); g.stroke();
    }
  }
  g.globalAlpha = 1;
}

export const T = {};

export function makeTextures() {
  const r = rng(7);
  T.moss = tex(canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#4b672e'; g.fillRect(0, 0, w, h);
    dots(g, w, h, r, 60, ['#3d5c22', '#56762f', '#425f25'], 20, 60, 0.16);
    dots(g, w, h, r, 9000, ['#36531f', '#5e8236', '#6e8f3c', '#2c4518', '#7a9643'], 0.8, 3.2, 0.8);
    dots(g, w, h, r, 120, ['#6b5a3a', '#5c5032'], 1, 3, 0.5);
  }), { rep: [22, 22] });
  T.gravelPlain = tex(canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#d8d3c6'; g.fillRect(0, 0, w, h);
    dots(g, w, h, r, 16000, ['#bdb6a8', '#efebe2', '#a69f92', '#e3ddd0'], 0.6, 1.8, 0.9);
  }), { rep: [6, 6] });
  T.wood = tex(canvas(512, 512, (g, w, h) => {
    const ph = 64;
    for (let y = 0; y < h; y += ph) {
      const v = 0.86 + r() * 0.2;
      g.fillStyle = `rgb(${154 * v | 0},${116 * v | 0},${80 * v | 0})`; g.fillRect(0, y, w, ph);
      g.strokeStyle = 'rgba(60,40,25,0.25)'; g.lineWidth = 1;
      for (let k = 0; k < 9; k++) {
        const yy = y + 4 + r() * (ph - 8); g.beginPath(); g.moveTo(0, yy);
        for (let x = 0; x <= w; x += 32) g.lineTo(x, yy + Math.sin(x * 0.02 + k) * 2.5);
        g.stroke();
      }
      g.fillStyle = 'rgba(30,20,12,0.65)'; g.fillRect(0, y, w, 2);
    }
  }), { rep: [1, 1] });
  T.darkWood = tex(canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#4b3526'; g.fillRect(0, 0, w, h);
    strokes(g, w, h, r, 500, ['#3a291d', '#5e4532', '#2f2218'], 60, 1.2, 0.6, Math.PI / 2);
  }));
  T.plaster = tex(canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#ebe4d4'; g.fillRect(0, 0, w, h);
    dots(g, w, h, r, 3000, ['#ded6c4', '#f4efe3', '#d6cdb9'], 0.8, 2.5, 0.6);
  }), { rep: [3, 1] });
  T.shoji = tex(canvas(256, 512, (g, w, h) => {
    g.fillStyle = '#f3efe3'; g.fillRect(0, 0, w, h);
    dots(g, w, h, r, 800, ['#ebe5d6', '#f8f5ec'], 1, 4, 0.5);
    g.fillStyle = '#9c7a52';
    const koshi = h * 0.84;
    g.fillRect(0, koshi, w, h - koshi);
    strokes(g, w, h - koshi, r, 0, [], 0, 0, 0);
    g.fillStyle = '#7d5f3f'; g.fillRect(0, 0, w, 10); g.fillRect(0, 0, 10, h); g.fillRect(w - 10, 0, 10, h); g.fillRect(0, koshi - 8, w, 10); g.fillRect(0, h - 10, w, 10);
    g.fillStyle = '#b4956a';
    for (let i = 1; i < 3; i++) g.fillRect(i * w / 3 - 2, 0, 4, koshi);
    for (let j = 1; j < 6; j++) g.fillRect(0, j * koshi / 6 - 2, w, 4);
  }));
  T.shojiGlow = tex(canvas(256, 512, (g, w, h) => {
    const koshi = h * 0.84;
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, koshi);
    gr.addColorStop(0, '#ffcf8a'); gr.addColorStop(1, '#ffb866');
    g.fillStyle = gr; g.fillRect(10, 10, w - 20, koshi - 18);
    g.fillStyle = '#000';
    for (let i = 1; i < 3; i++) g.fillRect(i * w / 3 - 2, 0, 4, koshi);
    for (let j = 1; j < 6; j++) g.fillRect(0, j * koshi / 6 - 2, w, 4);
  }));
  T.tiles = tex(canvas(512, 512, (g, w, h) => {
    const rh = 32, cw = 28;
    for (let y = 0; y < h; y += rh) {
      const gr = g.createLinearGradient(0, y, 0, y + rh);
      gr.addColorStop(0, '#5a5f66'); gr.addColorStop(0.75, '#3f4349'); gr.addColorStop(1, '#25282c');
      g.fillStyle = gr; g.fillRect(0, y, w, rh);
      for (let x = 0; x < w; x += cw) {
        const gx = g.createLinearGradient(x, 0, x + cw, 0);
        gx.addColorStop(0, 'rgba(0,0,0,0.28)'); gx.addColorStop(0.5, 'rgba(255,255,255,0.06)'); gx.addColorStop(1, 'rgba(0,0,0,0.28)');
        g.fillStyle = gx; g.fillRect(x, y, cw, rh);
      }
    }
    dots(g, w, h, r, 1500, ['#6b7077', '#30343a'], 0.6, 1.6, 0.4);
  }));
  T.bark = tex(canvas(256, 512, (g, w, h) => {
    g.fillStyle = '#4f4136'; g.fillRect(0, 0, w, h);
    strokes(g, w, h, r, 900, ['#3a2f27', '#6a5747', '#2b231d', '#7b6a58'], 40, 2.2, 0.7, Math.PI / 2);
    dots(g, w, h, r, 300, ['#2a221c', '#5d6b4a'], 2, 6, 0.4, [0.3, 0.6]);
  }));
  T.stone = tex(canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#8b8880'; g.fillRect(0, 0, w, h);
    dots(g, w, h, r, 120, ['#7a776f', '#9f9c94', '#6d6b65'], 15, 50, 0.4);
    dots(g, w, h, r, 9000, ['#6f6c66', '#a9a69e', '#5f5d58', '#b5b2aa'], 0.6, 2, 0.8);
    dots(g, w, h, r, 60, ['#8f9a6c', '#a3a77e'], 5, 18, 0.25);
  }));
  T.thatch = tex(canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#6e5636'; g.fillRect(0, 0, w, h);
    strokes(g, w, h, r, 2500, ['#5a442a', '#8e7149', '#a3855a', '#4a3822'], 18, 1.2, 0.8, Math.PI / 2);
  }), { rep: [3, 2] });
  T.felt = tex(canvas(128, 128, (g, w, h) => {
    g.fillStyle = '#b1252c'; g.fillRect(0, 0, w, h);
    dots(g, w, h, r, 2000, ['#9e1f26', '#c22e35'], 0.5, 1.5, 0.7);
  }), { rep: [2, 1] });
  T.bamboo = tex(canvas(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#8a8a4a'); gr.addColorStop(0.5, '#c3b97a'); gr.addColorStop(1, '#7c7a40');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(70,60,30,0.7)'; g.fillRect(0, 0, w, 5);
  }), { rep: [1, 4] });
  T.foliage = tex(canvas(256, 256, (g, w, h) => {
    // 明るめの絵にして、色は材質の色で決める（暗い絵×暗い色で真っ黒にならないように）
    g.fillStyle = '#9fb487'; g.fillRect(0, 0, w, h);
    strokes(g, w, h, r, 2600, ['#7f9868', '#b6c99c', '#c4d4a8', '#64804f', '#8aa472'], 10, 1.4, 0.9);
  }), { rep: [2, 2] });
  T.water = waterNormal();
  return T;
}

// 砂紋: 直線の砂紋と、石のまわりの輪の砂紋。凹凸の絵（bump）もいっしょに作る
export function rakedGravel(wM, hM, rocks, px = 64) {
  const w = Math.round(wM * px), h = Math.round(hM * px);
  const draw = (bump) => canvas(w, h, (g) => {
    const r = rng(11);
    if (bump) { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); }
    else { g.fillStyle = '#d9d4c7'; g.fillRect(0, 0, w, h); dots(g, w, h, r, w * h / 18, ['#bdb6a8', '#efebe2', '#a69f92'], 0.5, 1.4, 0.8); }
    const step = px * 0.16;
    const ridge = (path) => {
      g.lineWidth = step * 0.38;
      g.strokeStyle = bump ? '#e8e8e8' : 'rgba(255,253,246,0.55)'; path(0); g.stroke();
      g.lineWidth = step * 0.22;
      g.strokeStyle = bump ? '#202020' : 'rgba(120,112,98,0.35)'; path(step * 0.38); g.stroke();
    };
    g.save();
    g.beginPath(); g.rect(0, 0, w, h);
    for (const k of rocks) g.arc(k.x * px, k.z * px, (k.r + 0.9) * px, 0, Math.PI * 2, true);
    g.clip('evenodd');
    for (let y = step / 2; y < h; y += step) ridge((o) => { g.beginPath(); g.moveTo(0, y + o); g.lineTo(w, y + o); });
    g.restore();
    for (const k of rocks) for (let rr = k.r * px + step; rr < (k.r + 0.9) * px; rr += step)
      ridge((o) => { g.beginPath(); g.arc(k.x * px, k.z * px, rr + o * 0.5, 0, Math.PI * 2); });
  });
  const map = tex(draw(false)); map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  const bump = tex(draw(true), { color: false }); bump.wrapS = bump.wrapT = THREE.ClampToEdgeWrapping;
  return { map, bump };
}

// 水面のさざ波（法線の絵）
function waterNormal() {
  const N = 256, data = new Uint8Array(N * N * 4);
  const hgt = (x, y) => {
    const u = x / N * Math.PI * 2, v = y / N * Math.PI * 2;
    return Math.sin(u * 3 + v * 2) * 0.5 + Math.sin(u * 5 - v * 4 + 1.3) * 0.3 + Math.sin(u * 9 + v * 7 + 0.4) * 0.15 + Math.sin(-u * 13 + v * 11) * 0.08;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1);
    const n = new THREE.Vector3(-dx * 2, -dy * 2, 1).normalize();
    const i = (y * N + x) * 4;
    data[i] = (n.x * 0.5 + 0.5) * 255; data[i + 1] = (n.y * 0.5 + 0.5) * 255; data[i + 2] = (n.z * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.needsUpdate = true;
  return t;
}

// 掲示板の札・説明の板などの文字の絵
export function textBoard(lines, { w = 512, h = 256, bg = '#f4efe2', fg = '#2b2420', size = 34, font = 'serif', vertical = false } = {}) {
  return tex(canvas(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.textBaseline = 'top';
    g.font = `600 ${size}px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",${font}`;
    if (vertical) {
      let x = w - size * 1.4;
      for (const line of lines) {
        let y = size * 0.6;
        for (const ch of line) { g.fillText(ch, x, y); y += size * 1.1; }
        x -= size * 1.5;
      }
    } else {
      lines.forEach((l, i) => g.fillText(l, size * 0.6, size * 0.5 + i * size * 1.35));
    }
  }));
}
