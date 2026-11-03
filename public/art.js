// 盆栽の絵を SVG で描く。写真の代わりと、ショート動画の背景に使う。
// key は "illust:種類:番号"。同じ key なら同じ木になる。
// style: "color"＝紙の上の彩色 / "ink"＝月を背にした墨の影

const rnd = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const PAL = {
  pine: { leaf: ["#1d2a1a", "#2b3b24", "#3f5232", "#5e6f44"], bark: ["#2e231c", "#4b3a2d", "#6b5643"], pot: "#4a2c22", potHi: "#6a4334" },
  juniper: { leaf: ["#1f3326", "#2e4a35", "#456548", "#6a8a5c"], bark: ["#3a2e26", "#6b5a4a", "#d9cfbd"], pot: "#26282b", potHi: "#3b3f44" },
  maple: { leaf: ["#7d2418", "#a8361f", "#c9552c", "#e08a4a"], bark: ["#4b4a46", "#6e6c66", "#8f8c84"], pot: "#294657", potHi: "#3f6377" },
  azalea: { leaf: ["#24361f", "#36502c", "#4f6b3a", "#6d8a50"], bark: ["#3b3029", "#5d4c3e", "#7d6a57"], pot: "#d8ccb2", potHi: "#e8decb", flower: ["#e7a3b6", "#f3cfd9", "#d47c96"] },
  literati: { leaf: ["#1e2b1c", "#2f3f27", "#46593a", "#66764a"], bark: ["#2c241e", "#4c3d31", "#6c5a49"], pot: "#6e5c49", potHi: "#8a7660" },
};
const INK = { leaf: ["#0b0b0a", "#121210", "#1a1916", "#22211d"], bark: ["#0b0b0a", "#141311", "#1e1d1a"], pot: "#0b0b0a", potHi: "#1a1916", flower: ["#0b0b0a", "#141311", "#1a1916"] };

let uid = 0;

// 太さの変わる帯（幹・枝）
function ribbon(pts, w0, w1, flare = 0) {
  const n = pts.length;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const t = i / (n - 1);
    const w = (w0 + (w1 - w0) * Math.pow(t, 0.7)) / 2 + (flare * Math.pow(1 - t, 6)) / 2;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  const path = (arr) => arr.map((p, i) => {
    if (i === 0) return `M${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    const q = arr[i - 1];
    return `Q${q[0].toFixed(1)},${q[1].toFixed(1)} ${((q[0] + p[0]) / 2).toFixed(1)},${((q[1] + p[1]) / 2).toFixed(1)}`;
  }).join(" ");
  const tip = pts[n - 1];
  return `${path(L)} L${tip[0].toFixed(1)},${tip[1].toFixed(1)} ${path([...R].reverse()).replace(/^M/, "L")} Z`;
}

const bez = (a, c, b, n = 8) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
});

function spineFor(kind, r) {
  const pts = [];
  if (kind === "juniper") {
    // 懸崖：鉢の上から左へ流れ、鉢より下へ垂れる
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push([258 - 128 * Math.pow(t, 0.9) + 10 * Math.sin(t * Math.PI * 2.4 + r() * 2), 222 - 62 * Math.sin(t * Math.PI * 0.75) + 170 * Math.pow(t, 1.9)]);
    }
    return pts;
  }
  const H = kind === "literati" ? 245 : kind === "maple" ? 205 : 215;
  const A = kind === "literati" ? 34 + r() * 26 : 22 + r() * 22;
  const lean = (r() - 0.5) * (kind === "literati" ? 90 : 50);
  const ph = r() * Math.PI * 2;
  const x0 = 200 + (r() - 0.5) * 16;
  for (let i = 0; i <= 9; i++) {
    const t = i / 9;
    pts.push([x0 + A * Math.sin(t * Math.PI * 1.55 + ph) * (1 - t * 0.35) - A * Math.sin(ph) + lean * t * t, 318 - H * t]);
  }
  return pts;
}

function pad(cx, cy, W, H, r, leaf, kind, flowers) {
  const n = Math.max(4, Math.round(W / 14));
  let s = `<ellipse cx="${cx}" cy="${cy + H * 0.18}" rx="${W / 2}" ry="${H * 0.42}" fill="${leaf[0]}"/>`;
  for (let k = 0; k < n; k++) {
    const x = cx - W / 2 + (W * (k + 0.5)) / n + (r() - 0.5) * 4;
    const y = cy - H * 0.05 + (r() - 0.5) * H * 0.3 - Math.sin(((k + 0.5) / n) * Math.PI) * H * 0.22;
    s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(W / n) * 0.85 + r() * 5}" ry="${H * (0.32 + r() * 0.12)}" fill="${leaf[1]}"/>`;
  }
  for (let k = 0; k < n - 1; k++) {
    const x = cx - W / 2 + (W * (k + 0.8)) / n + (r() - 0.5) * 6;
    const y = cy - H * 0.2 - Math.sin(((k + 0.8) / n) * Math.PI) * H * 0.2 + r() * 3;
    s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(W / n) * 0.55 + r() * 3}" ry="${H * 0.2}" fill="${leaf[2]}"/>`;
  }
  // 細かい葉の粒
  const dots = kind === "maple" ? 26 : 14;
  for (let k = 0; k < dots; k++) {
    const a = r() * Math.PI, rr = r();
    const x = cx + Math.cos(a) * W * 0.46 * rr * (r() < 0.5 ? -1 : 1);
    const y = cy - Math.sin(a) * H * 0.42 * rr;
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(kind === "maple" ? 3.2 : 2.2) + r() * 2}" fill="${leaf[3]}" opacity="${0.5 + r() * 0.4}"/>`;
  }
  if (flowers) {
    for (let k = 0; k < 16; k++) {
      const x = cx + (r() - 0.5) * W * 0.9;
      const y = cy + (r() - 0.6) * H * 0.7;
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${2.6 + r() * 2.4}" fill="${flowers[Math.floor(r() * flowers.length)]}"/>`;
    }
  }
  return s;
}

export function bonsai(key = "illust:pine:1", style = "color") {
  const [, kind = "pine", n = "1"] = String(key).split(":");
  const r = rnd([...kind].reduce((a, c) => a + c.charCodeAt(0), 0) * 131 + Number(n) * 977);
  const P = style === "ink" ? INK : (PAL[kind] ?? PAL.pine);
  const id = `b${++uid}`;
  const sp = spineFor(kind, r);
  const cascade = kind === "juniper";

  // 鉢
  const potY = cascade ? 214 : 318;
  const potW = cascade ? 92 : kind === "literati" ? 108 : 150 + r() * 34;
  const potH = cascade ? 104 : kind === "literati" ? 18 : 30;
  const potX = cascade ? 262 : 200;
  const pot = `
    <ellipse cx="${potX}" cy="${potY + potH + 10}" rx="${potW * 0.62}" ry="7" fill="#000" opacity="${style === "ink" ? 0.5 : 0.18}" filter="url(#${id}s)"/>
    <path d="M${potX - potW / 2},${potY} L${potX + potW / 2},${potY} L${potX + potW / 2 - (cascade ? 8 : 10)},${potY + potH} L${potX - potW / 2 + (cascade ? 8 : 10)},${potY + potH} Z" fill="${P.pot}"/>
    <rect x="${potX - potW / 2 - 3}" y="${potY - 3}" width="${potW + 6}" height="6" rx="2" fill="${P.potHi}"/>
    <rect x="${potX - potW / 2 + 16}" y="${potY + potH}" width="12" height="6" fill="${P.pot}"/>
    <rect x="${potX + potW / 2 - 28}" y="${potY + potH}" width="12" height="6" fill="${P.pot}"/>
    <ellipse cx="${potX}" cy="${potY - 2}" rx="${potW / 2 - 4}" ry="4" fill="${style === "ink" ? P.pot : "#3a3127"}"/>
    ${style === "ink" ? "" : Array.from({ length: 7 }, () => `<ellipse cx="${(potX + (r() - 0.5) * potW * 0.8).toFixed(1)}" cy="${potY - 3}" rx="${6 + r() * 8}" ry="${2 + r() * 2}" fill="#5f7a3e" opacity=".9"/>`).join("")}`;

  // 幹
  const W0 = kind === "literati" ? 13 : cascade ? 28 : kind === "maple" ? 30 : 30 + r() * 6;
  const trunk = `<path d="${ribbon(sp, W0, kind === "literati" ? 3 : 6, cascade ? 6 : 26)}" fill="${P.bark[1]}"/>
    <path d="${ribbon(sp.map(([x, y]) => [x - W0 * 0.16, y]), W0 * 0.32, 1.5)}" fill="${P.bark[0]}" opacity=".7"/>
    ${kind === "juniper" || (kind === "pine" && r() < 0.4) ? `<path d="${ribbon(sp.slice(1, 7).map(([x, y]) => [x + W0 * 0.12, y]), W0 * 0.22, 1)}" fill="${P.bark[2]}" opacity="${style === "ink" ? 0 : 0.85}"/>` : ""}`;

  // 根張り
  const b0 = sp[0];
  const roots = cascade ? "" : [-1, 1].map((side) => `<path d="${ribbon(bez([b0[0] + side * 6, b0[1] - 4], [b0[0] + side * 22, b0[1] - 2], [b0[0] + side * (34 + r() * 14), b0[1] + 1], 6), 9, 1.5)}" fill="${P.bark[1]}"/>`).join("");

  // 枝と葉の塊
  let branches = "", pads = "", back = "";
  const idx = cascade ? [2, 4, 6, 8] : kind === "literati" ? [6, 8] : [3, 4, 5, 6, 7];
  let side = r() < 0.5 ? -1 : 1;
  idx.forEach((i, k) => {
    const p = sp[i];
    const t = i / (sp.length - 1);
    const s = cascade ? (k % 2 ? 1 : -1) : side;
    side = -side;
    const L = cascade ? 34 + r() * 26 : kind === "literati" ? 40 + r() * 24 : (62 + r() * 46) * (1 - t * 0.45);
    const end = [p[0] + s * L, p[1] + (cascade ? 6 + r() * 8 : -6 - r() * 16)];
    const ctrl = [p[0] + s * L * 0.5, p[1] + (cascade ? -6 : 10)];
    const bw = Math.max(3, W0 * (1 - t) * 0.42);
    branches += `<path d="${ribbon(bez(p, ctrl, end), bw, 1.6)}" fill="${P.bark[1]}"/>`;
    const PW = cascade ? 64 + r() * 22 : kind === "literati" ? 46 + r() * 16 : (72 + r() * 42) * (1 - t * 0.35);
    const PH = PW * (kind === "maple" || kind === "azalea" ? 0.46 : 0.34);
    pads += pad(end[0] + s * 6, end[1] - PH * 0.25, PW, PH, r, P.leaf, kind, kind === "azalea" ? P.flower : null);
    if (!cascade && r() < 0.6) back += pad(end[0] - s * PW * 0.4, end[1] - PH * 0.8, PW * 0.7, PH * 0.8, r, [P.leaf[0], P.leaf[0], P.leaf[1], P.leaf[1]], kind, null);
  });
  const top = sp[sp.length - 1];
  const apexW = cascade ? 70 : kind === "literati" ? 52 : 76 + r() * 18;
  pads += pad(top[0], top[1] - (cascade ? 4 : 10), apexW, apexW * (kind === "maple" || kind === "azalea" ? 0.58 : 0.5), r, P.leaf, kind, kind === "azalea" ? P.flower : null);
  if (cascade) pads += pad(sp[1][0] + 10, sp[1][1] - 26, 78, 34, r, P.leaf, kind, null);

  return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${kind} bonsai">
  <defs>
    <filter id="${id}r" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="${n}"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter>
    <filter id="${id}b"><feTurbulence type="fractalNoise" baseFrequency=".5 .05" numOctaves="2" seed="${n}"/><feDisplacementMap in="SourceGraphic" scale="3"/></filter>
    <filter id="${id}s"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>
  <g filter="url(#${id}r)" opacity=".9">${back}</g>
  ${pot}
  <g filter="url(#${id}b)">${roots}${trunk}${branches}</g>
  <g filter="url(#${id}r)">${pads}</g>
</svg>`;
}

export const illustURL = (key, style) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(bonsai(key, style));
export const isIllust = (src) => typeof src === "string" && src.startsWith("illust:");
export const imgSrc = (src, style = "color") => (isIllust(src) ? illustURL(src, style) : src);

// 円相（筆でひと息に描く円）
export const enso = (cls = "") => `<svg class="enso ${cls}" viewBox="0 0 200 200" aria-hidden="true">
  <defs><filter id="ensoF"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2"/><feDisplacementMap in="SourceGraphic" scale="5"/></filter></defs>
  <path filter="url(#ensoF)" d="M150 52 C 128 26, 70 22, 44 58 C 18 94, 34 152, 86 168 C 138 184, 178 140, 172 96 C 168 72, 160 60, 146 50" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" pathLength="1"/>
</svg>`;

// 落款（朱の印）
export const seal = (ch = "縁", cls = "") => `<span class="seal ${cls}" aria-hidden="true">${ch}</span>`;
