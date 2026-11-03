// ショート動画（縦 9:16）を canvas に描いて再生する。書き出しは MediaRecorder（.webm）。
import { illustURL, imgSrc, isIllust } from "./art.js";
import { bgm } from "./bgm.js";

const W = 720, H = 1280;
const SUMI = "#0e0e0c", WASHI = "#efe8d8", GOLD = "#c4a46a", SHU = "#b5432f";
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

function wrap(ctx, text, max) {
  const lines = [];
  const latin = /^[\x00-ɏ -⁯]+$/.test(text);
  const units = latin ? text.split(/(\s+)/) : [...text];
  let cur = "";
  for (const u of units) {
    if (ctx.measureText(cur + u).width > max && cur.trim()) { lines.push(cur.trim()); cur = u.trimStart(); }
    else cur += u;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

function cover(ctx, img, zoom, dim = 0) {
  if (!img) return;
  const s = Math.max(W / img.width, H / img.height) * zoom;
  ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
  if (dim) { ctx.fillStyle = `rgba(14,14,12,${dim})`; ctx.fillRect(0, 0, W, H); }
}

function vertical(ctx, text, x, y, size, p, color) {
  ctx.font = `600 ${size}px "Shippori Mincho", serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const chars = [...text.replace(/[「」]/g, "")];
  const perCol = Math.floor((H * 0.56) / (size * 1.08));
  const shown = Math.floor(chars.length * Math.min(1, p * 1.6));
  chars.slice(0, shown).forEach((c, i) => {
    const col = Math.floor(i / perCol), row = i % perCol;
    const cx = x - col * size * 1.35, cy = y + row * size * 1.08;
    if ("、。，".includes(c)) ctx.fillText(c, cx + size * 0.35, cy - size * 0.45);
    else if ("ーー〜…".includes(c)) { ctx.save(); ctx.translate(cx, cy + size / 2); ctx.rotate(Math.PI / 2); ctx.fillText(c, 0, -size / 2); ctx.restore(); }
    else ctx.fillText(c, cx, cy);
  });
}

function caption(ctx, en, ja, p, y = H - 300) {
  const a = ease(p * 2.2);
  ctx.globalAlpha = a;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  if (ja) {
    ctx.font = `500 30px "Shippori Mincho", serif`;
    ctx.fillStyle = GOLD;
    wrap(ctx, ja, W - 140).forEach((l, i) => ctx.fillText(l, W / 2, y - 70 + i * 40 + (1 - a) * 20));
  }
  ctx.font = `500 44px "Cormorant Garamond", serif`;
  ctx.fillStyle = WASHI;
  const lines = wrap(ctx, en, W - 120);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * 54 + (1 - a) * 20));
  ctx.globalAlpha = 1;
}

function sealMark(ctx, x, y, r) {
  ctx.fillStyle = SHU;
  ctx.beginPath(); ctx.roundRect(x - r, y - r, r * 2, r * 2, r * 0.22); ctx.fill();
  ctx.fillStyle = WASHI;
  ctx.font = `800 ${r * 1.2}px "Shippori Mincho", serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("縁", x, y + r * 0.06);
}

export async function makePlayer(canvas, short, opts = {}) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  await Promise.all([document.fonts.load('600 40px "Shippori Mincho"'), document.fonts.load('500 40px "Cormorant Garamond"')]).catch(() => {});
  const coverSrc = opts.cover || "illust:pine:7";
  const kind = isIllust(coverSrc) ? coverSrc : "illust:pine:7";
  const [photo, ink, color] = await Promise.all([load(imgSrc(coverSrc)), load(illustURL(kind, "ink")), load(illustURL(kind.replace(/:(\d+)$/, (_, n) => `:${Number(n) + 3}`)))]);
  const scenes = short.scenes;
  const total = scenes.reduce((s, x) => s + x.sec, 0);
  const link = opts.link || "";

  function scene(sc, p, idx) {
    ctx.fillStyle = SUMI;
    ctx.fillRect(0, 0, W, H);
    if (sc.visual === "title") {
      // 月と墨の木
      const g = ctx.createRadialGradient(W / 2, H * 0.36, 10, W / 2, H * 0.36, 300);
      g.addColorStop(0, "#f1ead8"); g.addColorStop(0.98, "#e4dac2"); g.addColorStop(1, "rgba(228,218,194,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(W / 2, H * 0.36, 280 + p * 10, 0, Math.PI * 2); ctx.fill();
      if (ink) ctx.drawImage(ink, W / 2 - 380, H * 0.36 - 420 + (1 - ease(p * 2)) * 30, 760, 760);
      caption(ctx, sc.text_en, sc.text_ja, p, H - 280);
    } else if (sc.visual === "tree") {
      ctx.fillStyle = WASHI; ctx.fillRect(0, 0, W, H);
      if (color) { const z = 1.05 + p * 0.08; ctx.drawImage(color, W / 2 - 400 * z, H * 0.33 - 400 * z, 800 * z, 800 * z); }
      const gr = ctx.createLinearGradient(0, H * 0.55, 0, H);
      gr.addColorStop(0, "rgba(14,14,12,0)"); gr.addColorStop(0.45, "rgba(14,14,12,.88)"); gr.addColorStop(1, SUMI);
      ctx.fillStyle = gr; ctx.fillRect(0, H * 0.55, W, H * 0.45);
      caption(ctx, sc.text_en, sc.text_ja, p);
    } else if (sc.visual === "photo") {
      if (isIllust(coverSrc)) { ctx.fillStyle = WASHI; ctx.fillRect(0, 0, W, H); if (photo) { const z = 1.6 + p * 0.12; ctx.drawImage(photo, W / 2 - 200 * z, H * 0.42 - 200 * z, 400 * z, 400 * z); } }
      else cover(ctx, photo, 1.04 + p * 0.08);
      const gr = ctx.createLinearGradient(0, H * 0.5, 0, H);
      gr.addColorStop(0, "rgba(14,14,12,0)"); gr.addColorStop(0.5, "rgba(14,14,12,.9)"); gr.addColorStop(1, SUMI);
      ctx.fillStyle = gr; ctx.fillRect(0, H * 0.5, W, H * 0.5);
      caption(ctx, sc.text_en, sc.text_ja, p);
    } else if (sc.visual === "quote") {
      ctx.fillStyle = "#14130f"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(196,164,106,.35)"; ctx.lineWidth = 1.5;
      ctx.strokeRect(36, 36, W - 72, H - 72);
      ctx.font = `600 120px "Shippori Mincho", serif`;
      ctx.fillStyle = SHU; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText("「", W - 120, 90);
      vertical(ctx, sc.text_ja, W - 150, 230, 62, p, WASHI);
      ctx.font = `500 22px "Noto Sans JP", sans-serif`;
      ctx.fillStyle = GOLD; ctx.textAlign = "left";
      ctx.fillText("職人の言葉 — THE MASTER'S WORDS", 80, 110);
      caption(ctx, sc.text_en, "", Math.max(0, p - 0.25), H - 240);
    } else {
      // しめ：落款と行き先
      const a = ease(p * 2);
      ctx.globalAlpha = a;
      sealMark(ctx, W / 2, H * 0.36, 70);
      ctx.font = `600 64px "Cormorant Garamond", serif`;
      ctx.fillStyle = WASHI; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText("ENGAWA", W / 2, H * 0.36 + 170);
      ctx.font = `500 30px "Shippori Mincho", serif`;
      ctx.fillStyle = GOLD;
      ctx.fillText(sc.text_ja, W / 2, H * 0.36 + 230);
      ctx.font = `italic 500 40px "Cormorant Garamond", serif`;
      ctx.fillStyle = WASHI;
      wrap(ctx, sc.text_en, W - 140).forEach((l, i) => ctx.fillText(l, W / 2, H * 0.36 + 310 + i * 50));
      if (link) {
        ctx.font = `500 24px "Noto Sans JP", sans-serif`;
        ctx.fillStyle = "rgba(239,232,216,.7)";
        ctx.fillText(link, W / 2, H - 170);
      }
      ctx.globalAlpha = 1;
    }
    // 上の進み具合
    const n = scenes.length, gap = 8, bw = (W - 80 - gap * (n - 1)) / n;
    scenes.forEach((_, i) => {
      ctx.fillStyle = "rgba(239,232,216,.25)";
      ctx.fillRect(40 + i * (bw + gap), 34, bw, 4);
      ctx.fillStyle = WASHI;
      ctx.fillRect(40 + i * (bw + gap), 34, bw * (i < idx ? 1 : i === idx ? p : 0), 4);
    });
    ctx.font = `600 22px "Cormorant Garamond", serif`;
    ctx.fillStyle = "rgba(239,232,216,.6)"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText("ENGAWA", 44, H - 44);
  }

  function frame(t) {
    let acc = 0;
    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      if (t < acc + sc.sec || i === scenes.length - 1) {
        const p = Math.min(1, (t - acc) / sc.sec);
        scene(sc, p, i);
        // 場面の切り替わりは墨がにじむように暗転
        const edge = Math.min(t - acc, acc + sc.sec - t);
        if (edge < 0.35 && i > 0 && t - acc < 0.35) { ctx.fillStyle = `rgba(14,14,12,${1 - edge / 0.35})`; ctx.fillRect(0, 0, W, H); }
        return;
      }
      acc += sc.sec;
    }
  }

  let raf = 0, start = 0, offset = 0, playing = false;
  const api = {
    total,
    onend: null,
    get playing() { return playing; },
    play() {
      if (playing) return;
      playing = true;
      start = performance.now() - offset * 1000;
      const tick = (now) => {
        const t = (now - start) / 1000;
        if (t >= total) { offset = 0; playing = false; frame(total - 0.001); api.onend?.(); return; }
        offset = t;
        frame(t);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    },
    pause() { playing = false; cancelAnimationFrame(raf); },
    restart() { api.pause(); offset = 0; frame(0); api.play(); },
    // 動画ファイルにする（実際の長さぶん時間がかかる）
    async record(onProgress) {
      if (!window.MediaRecorder || !canvas.captureStream) throw new Error("unsupported");
      await bgm.start();
      const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...bgm.stream().getAudioTracks()]);
      const type = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
      const mr = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5_000_000 });
      const chunks = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const done = new Promise((res) => (mr.onstop = res));
      api.pause(); offset = 0;
      mr.start(250);
      const prog = setInterval(() => onProgress?.(Math.min(1, offset / total)), 200);
      await new Promise((res) => { api.onend = res; api.play(); });
      api.onend = null;
      clearInterval(prog);
      mr.stop();
      await done;
      return new Blob(chunks, { type: "video/webm" });
    },
  };
  frame(opts.at ?? 0);
  if (opts.at) offset = 0;
  return api;
}
