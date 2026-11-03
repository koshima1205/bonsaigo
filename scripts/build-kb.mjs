// content/articles/*.md を public/kb/*.json にする（知識の記事・5言語）。node scripts/build-kb.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SRC = new URL("../content/articles/", import.meta.url).pathname;
const OUT = new URL("../public/kb/", import.meta.url).pathname;
const LANGS = ["ja", "easy", "en", "es", "zh"];
mkdirSync(OUT, { recursive: true });

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const unq = (s) => s.trim().replace(/^["']|["']$/g, "");

function front(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error("no front matter");
  const fm = { sources: [] };
  let src = null;
  for (const line of m[1].split(/\r?\n/)) {
    let x;
    if ((x = line.match(/^\s+-\s+title:\s*(.*)$/))) { src = { title: unq(x[1]) }; fm.sources.push(src); }
    else if ((x = line.match(/^\s+url:\s*(.*)$/)) && src) src.url = unq(x[1]);
    else if ((x = line.match(/^\s+-\s+(https?:\/\/\S+)/))) fm.sources.push({ title: x[1], url: x[1] });
    else if ((x = line.match(/^([a-z_]+):\s*(.*)$/)) && x[1] !== "sources") fm[x[1]] = unq(x[2].replace(/\s+#.*$/, ""));
  }
  return [fm, m[2]];
}

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function md(body) {
  const out = [];
  let para = [], list = null;
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(" ").trim())}</p>`);
    para = [];
    if (list) out.push(`<${list.t}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.t}>`);
    list = null;
  };
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trimEnd();
    let x;
    if (!line.trim()) { flush(); continue; }
    if ((x = line.match(/^(#{2,4})\s+(.*)$/))) { flush(); const n = x[1].length; out.push(`<h${n}>${inline(x[2])}</h${n}>`); continue; }
    if ((x = line.match(/^\s*[-*・]\s+(.*)$/))) { if (para.length) { const l = list; list = null; flush(); list = l; } if (!list || list.t !== "ul") { flush(); list = { t: "ul", items: [] }; } list.items.push(x[1]); continue; }
    if ((x = line.match(/^\s*\d+[.)]\s+(.*)$/))) { if (!list || list.t !== "ol") { flush(); list = { t: "ol", items: [] }; } list.items.push(x[1]); continue; }
    if ((x = line.match(/^>\s?(.*)$/))) { flush(); out.push(`<blockquote>${inline(x[1])}</blockquote>`); continue; }
    if (list) flush();
    para.push(line.trim());
  }
  flush();
  return out.join("\n");
}

const files = readdirSync(SRC).filter((f) => /^\d\d-.+\.(ja|easy|en|es|zh)\.md$/.test(f)).sort();
const bySlug = new Map();
for (const f of files) {
  const [, no, slug, lg] = f.match(/^(\d\d)-(.+)\.([a-z]+)\.md$/);
  let [fm, body] = front(readFileSync(join(SRC, f), "utf8"));
  const a = bySlug.get(slug) ?? { no: Number(no), slug, group: fm.group, tree: fm.tree || "none", sources: [], langs: {} };
  if (lg === "ja" || !a.sources.length) a.sources = fm.sources.filter((s) => /^https?:\/\//.test(s.url ?? ""));
  // 末尾の「職人に聞いてみたいこと」は記事の下の欄で出すので本文から外す。「まとめ（3行）」の（3行）も外す
  body = body.replace(/\n#{2,3}\s*[^\n]*(職人に聞|しょくにんに|question for|pregunta para|请教匠人|想问匠人|想请教|问问匠人)[^\n]*\n[\s\S]*$/i, "\n")
    .replace(/^(#{2,3}\s*[^\n]*?)\s*[（(]\s*(3行|3 lines|3 líneas|3行|三行|3ぎょう)\s*[)）]/gim, "$1");
  const words = body.replace(/\s/g, "").length;
  a.langs[lg] = { title: fm.title, lead: fm.lead, voice_hook: fm.voice_hook, html: md(body), len: words };
  bySlug.set(slug, a);
}
const all = [...bySlug.values()].sort((a, b) => a.no - b.no);
for (const a of all) writeFileSync(join(OUT, `${a.slug}.json`), JSON.stringify(a));
writeFileSync(join(OUT, "index.json"), JSON.stringify(all.map(({ no, slug, group, tree, langs }) => ({ no, slug, group, tree, t: Object.fromEntries(Object.entries(langs).map(([k, v]) => [k, { title: v.title, lead: v.lead }])) }))));
console.log(all.length, "articles", all.map((a) => `${a.no}:${Object.keys(a.langs).join("")}`).join(" "));
