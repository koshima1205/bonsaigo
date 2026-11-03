// ショート動画（縦 9:16）を canvas に描いて再生する。書き出しは MediaRecorder（.webm）。
import { bgm } from "./bgm.js";

const W = 720, H = 1280;
// 特集号の色：紙・墨・深緑・朱（朱は一点だけ）
const PAPER = "#EFE9DD", INK = "#111111", GREEN = "#1F3A2E", HOT = "#E4572E", MUTE = "#6d675c";
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const WORD = { pine: "Pine", "white-pine": "Goyo", juniper: "Shimpaku", maple: "Maple", azalea: "Satsuki", ume: "Ume", zelkova: "Keyaki", "needle-juniper": "Nezu" };
const SP_OF = (ja = "") => (/五葉/.test(ja) ? "white-pine" : /杜松|ネズ/.test(ja) ? "needle-juniper" : /松/.test(ja) ? "pine" : /真柏/.test(ja) ? "juniper" : /もみじ|楓/.test(ja) ? "maple" : /サツキ|皐月/.test(ja) ? "azalea" : /梅/.test(ja) ? "ume" : /欅/.test(ja) ? "zelkova" : "pine");

const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

function wrap(ctx, text, max) {
  const lines = [];
  const latin = /^[\x00-ɏ -⁯]+$/.test(text);
  const units = latin ? text.split(/(\s+)/) : [...text];
  let cur = "";
  for (const u of units) {
    if (ctx.measureText(cur + u).width > max && cur.trim()) { lines.push(cur.trim()); cur = u.trimStart(); }
    else cur += u;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

function cover(ctx, img, zoom) {
  if (!img) return;
  const s = Math.max(W / img.width, H / img.height) * zoom;
  ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
}

// 下の字幕：日本語（小）と英語（大）。紙の上に墨で
function caption(ctx, en, ja, p, y = H - 300, color = INK) {
  const a = ease(p * 2.2);
  ctx.globalAlpha = a;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const x = 56;
  if (ja) {
    ctx.font = `400 30px "Zen Antique", serif`;
    ctx.fillStyle = color === INK ? GREEN : "rgba(239,233,221,.8)";
    wrap(ctx, ja, W - 112).forEach((l, i) => ctx.fillText(l, x, y - 76 + i * 42 + (1 - a) * 18));
  }
  ctx.font = `500 50px "Fraunces", serif`;
  ctx.fillStyle = color;
  wrap(ctx, en, W - 112).forEach((l, i) => ctx.fillText(l, x, y + i * 58 + (1 - a) * 18));
  ctx.globalAlpha = 1;
}

export async function makePlayer(canvas, short, opts = {}) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  await Promise.all(['500 40px "Fraunces"', 'italic 400 40px "Fraunces"', '900 40px "Fraunces"', '400 40px "Zen Antique"', '600 20px "Inter"'].map((f) => document.fonts.load(f))).catch(() => {});
  const coverSrc = opts.cover || "";
  const realPhoto = /^data:image\/(jpeg|png|webp)/.test(coverSrc);
  const sp = WORD[opts.tree] ? opts.tree : SP_OF(opts.treeJa);
  const [photo, ...turn] = await Promise.all([realPhoto ? load(coverSrc) : null, ...Array.from({ length: 24 }, (_, i) => load(`/trees/${sp}/t${String(i).padStart(2, "0")}.webp`))]);
  const scenes = short.scenes;
  const total = scenes.reduce((s, x) => s + x.sec, 0);
  const link = opts.link || "";
  let now = 0;
  // 3Dの木：時間で少しずつ回る（8秒で一周）
  const tree = (cx, cy, size) => { const img = turn[Math.floor(now * 3) % 24] || turn[0]; if (img) ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size); };

  function scene(sc, p, idx) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    if (sc.visual === "title") {
      ctx.font = `900 ${Math.min(300, 1500 / WORD[sp].length)}px "Fraunces", serif`;
      ctx.fillStyle = GREEN; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText(WORD[sp], 30, H * 0.62);
      const ww = ctx.measureText(WORD[sp]).width;
      ctx.font = `italic 300 ${Math.min(300, 1500 / WORD[sp].length)}px "Fraunces", serif`;
      ctx.fillStyle = HOT; ctx.fillText(".", 30 + ww, H * 0.62);
      tree(W / 2 + 60, H * 0.36 + (1 - ease(p * 2)) * 30, 760);
      ctx.fillStyle = INK; ctx.fillRect(56, 120, 230, 40);
      ctx.font = `600 18px "Inter", sans-serif`; ctx.fillStyle = PAPER; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("ENGAWA · ISSUE 01", 72, 141);
      caption(ctx, sc.text_en, sc.text_ja, p, H - 250);
    } else if (sc.visual === "tree" || (sc.visual === "photo" && !photo)) {
      ctx.fillStyle = "#E7E0D1"; ctx.fillRect(0, 0, W, H * 0.66);
      tree(W / 2, H * 0.34, 880 + p * 60);
      ctx.fillStyle = INK; ctx.fillRect(0, H * 0.66, W, 3);
      caption(ctx, sc.text_en, sc.text_ja, p, H - 250);
    } else if (sc.visual === "photo") {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H * 0.66); ctx.clip();
      cover(ctx, photo, 1.04 + p * 0.08);
      ctx.restore();
      ctx.fillStyle = INK; ctx.fillRect(0, H * 0.66, W, 3);
      caption(ctx, sc.text_en, sc.text_ja, p, H - 250);
    } else if (sc.visual === "quote") {
      ctx.fillStyle = GREEN; ctx.fillRect(0, 0, W, H);
      ctx.font = `600 18px "Inter", sans-serif`; ctx.fillStyle = "#F2A58E"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText("THE MASTER'S WORDS · 職人の言葉", 56, 130);
      ctx.font = `900 200px "Fraunces", serif`; ctx.fillStyle = HOT;
      ctx.fillText("“", 40, 330);
      ctx.font = `400 56px "Zen Antique", serif`; ctx.fillStyle = PAPER;
      const lines = wrap(ctx, sc.text_ja.replace(/[「」]/g, ""), W - 112);
      const shown = Math.ceil(lines.length * Math.min(1, p * 1.8));
      lines.slice(0, shown).forEach((l, i) => ctx.fillText(l, 56, 380 + i * 82));
      caption(ctx, sc.text_en, "", Math.max(0, p - 0.25), H - 260, PAPER);
    } else {
      // しめ：誌名と行き先
      const a = ease(p * 2);
      ctx.globalAlpha = a;
      tree(W / 2, H * 0.3, 560);
      ctx.font = `900 150px "Fraunces", serif`;
      ctx.fillStyle = GREEN; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText("Engawa", W / 2 - 18, H * 0.66);
      ctx.font = `italic 300 150px "Fraunces", serif`; ctx.fillStyle = HOT;
      ctx.fillText(".", W / 2 + ctx.measureText("Engawa").width / 2 + 36, H * 0.66);
      ctx.font = `400 32px "Zen Antique", serif`; ctx.fillStyle = INK;
      ctx.fillText(sc.text_ja, W / 2, H * 0.66 + 76);
      ctx.font = `italic 400 40px "Fraunces", serif`;
      wrap(ctx, sc.text_en, W - 140).forEach((l, i) => ctx.fillText(l, W / 2, H * 0.66 + 150 + i * 50));
      if (link) {
        ctx.font = `600 22px "Inter", sans-serif`;
        ctx.fillStyle = MUTE;
        ctx.fillText(link, W / 2, H - 120);
      }
      ctx.globalAlpha = 1;
    }
    // 上の進み具合
    const dark = sc.visual === "quote";
    const n = scenes.length, gap = 8, bw = (W - 112 - gap * (n - 1)) / n;
    scenes.forEach((_, i) => {
      ctx.fillStyle = dark ? "rgba(239,233,221,.25)" : "rgba(17,17,17,.15)";
      ctx.fillRect(56 + i * (bw + gap), 50, bw, 4);
      ctx.fillStyle = dark ? PAPER : INK;
      ctx.fillRect(56 + i * (bw + gap), 50, bw * (i < idx ? 1 : i === idx ? p : 0), 4);
    });
    ctx.font = `800 26px "Fraunces", serif`;
    ctx.fillStyle = dark ? PAPER : INK; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText("Engawa.", 56, H - 50);
  }

  function frame(t) {
    let acc = 0;
    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      if (t < acc + sc.sec || i === scenes.length - 1) {
        now = t;
        const p = Math.min(1, (t - acc) / sc.sec);
        scene(sc, p, i);
        // 場面の切り替わりは紙をめくるように白へ
        if (i > 0 && t - acc < 0.3) { ctx.fillStyle = `rgba(239,233,221,${1 - (t - acc) / 0.3})`; ctx.fillRect(0, 0, W, H); }
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
