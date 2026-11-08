// 見本の写真の対応表（2026-11-08 箱崎さん）
// 管理する人の画面に並ぶ見本の木10本・見本の相談7件の写真が、どのファイルか（アプリ用に小さくしたもの／AIで作った元の大きいもの）を出す。
// 使い方：このフォルダで  node 見本の写真の対応表を見る.mjs
// 写真はすべて AI（fal の FLUX1.1 pro ultra）で作ったもの。園と職人の名前は架空。
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORIG = "/Users/sh/Claude/盆栽EC_ハッカソン/盆栽マッチング_AIで作り直した画像と動画_2026-11-08";
const TREES = [
  // [管理画面に出る木の名前, 園・職人（架空）, 状態, アプリ用の写真, AIで作った元の写真]
  ["空へ伸びる真柏", "霧松園 青木 義郎", "X・インスタとも発信済み", "木01.jpg", "AI_真柏_青空の下_縦_案1.jpg"],
  ["竹林の黒松", "凪松園 村上 清志", "X・インスタとも発信済み", "木02.jpg", "AI_黒松_竹林の前_縦_案1.jpg"],
  ["小さな黒松", "朝霞園 近藤 雅人", "Xだけ発信済み", "木03.jpg", "AI_形_見上げた木_横_案2.jpg"],
  ["欅の森", "汐風園 石原 敏夫", "Xだけ発信済み", "木04.jpg", "AI_形_寄せ植え_横_作り直し_案1.jpg"],
  ["まっすぐな五葉松", "月影園 森川 哲也", "まだ発信していない", "木05.jpg", "AI_形_直幹_横_案2.jpg"],
  ["模様木の黒松", "苔雫園 西村 和子", "まだ発信していない", "木06.jpg", "AI_形_模様木_横_案2.jpg"],
  ["崖から垂れる松", "霧松園 青木 義郎", "まだ発信していない", "木07.jpg", "AI_形_懸崖_横_作り直し_案1.jpg"],
  ["石を抱くかえで", "凪松園 村上 清志", "まだ発信していない", "木08.jpg", "AI_形_石付き_横_案2.jpg"],
  ["秋のもみじ", "朝霞園 近藤 雅人", "まだ発信していない", "木09.jpg", "AI_形_もみじ_横_案2.jpg"],
  ["池のほとりのもみじ", "ひだまり園 アルベルト・フェレー", "まだ発信していない", "木10.jpg", "AI_池のある庭と紅葉の盆栽_横_案1.jpg"],
];
const CONSULTS = [
  // [相談した人（架空）・言葉, 相談の中身, アプリ用の写真, AIで作った元の写真]
  ["Emma・英語", "黒松の内側の葉が黄色い（答えつき）", "黒松の葉が黄色い.jpg", "AI_形_葉が黄色くなった木_横_案1.jpg"],
  ["Emma・英語", "真柏の針金が食い込む", "真柏の針金.jpg", "AI_相談の木_小さな真柏_白い壁の前_縦_案1.jpg"],
  ["Emma・英語", "もみじの葉先が茶色い", "もみじの葉先.jpg", "AI_形_もみじ_横_案1.jpg"],
  ["李 偉・中国語", "五葉松の植え替え", "五葉松の植え替え.jpg", "AI_形_模様木_横_案1.jpg"],
  ["Camille・フランス語", "松の芽摘み", "松の芽摘み.jpg", "AI_形_直幹_横_案1.jpg"],
  ["Lucía・スペイン語", "懸崖の松の先が弱る", "懸崖の松の先が弱る.jpg", "AI_形_懸崖_横_案1.jpg"],
  ["Somchai・タイ語", "石付きのもみじの水やり", "石付きのもみじの水やり.jpg", "AI_形_石付き_横_案1.jpg"],
];

const mark = (f) => (existsSync(f) ? "" : "  ※ファイルが見つかりません");
const treeDir = path.join(HERE, "共通", "デモの木の写真");
const consultDir = path.join(HERE, "共通", "デモの相談の写真");

console.log("\n■ 管理する人の画面の見本の木（10本）\n");
TREES.forEach(([name, who, state, small, orig], i) => {
  console.log(`${String(i + 1).padStart(2)}. ${name}　（${who}／${state}）`);
  console.log(`    アプリ用：${path.join(treeDir, small)}${mark(path.join(treeDir, small))}`);
  console.log(`    元の写真：${path.join(ORIG, orig)}${mark(path.join(ORIG, orig))}`);
});
console.log("\n■ 見本の相談の写真（7件）\n");
CONSULTS.forEach(([who, what, small, orig], i) => {
  console.log(`${String(i + 1).padStart(2)}. ${what}　（${who}）`);
  console.log(`    アプリ用：${path.join(consultDir, small)}${mark(path.join(consultDir, small))}`);
  console.log(`    元の写真：${path.join(ORIG, orig)}${mark(path.join(ORIG, orig))}`);
});
console.log("\n投稿に使うときは「元の写真」（大きい方）を使うと、画質がよくなります。写真はすべてAIで作ったもの、園と職人の名前は架空です。\n");
