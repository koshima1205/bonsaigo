// 本番の API に届かない場所（試しの写し）で見せる見本。中身は src/seed.ts の SEED_THREADS・SEED_WISHES と同じ
// （写しでは訳すボタンが使えないので、Engawa の返信にだけ英訳を1つ足してある）
const H = 3600_000, D = 24 * H, now = Date.now();

export const SAMPLE_THREADS = [
  { id: 't-juniper', title: 'First winter with a juniper on my balcony', created: now - 2 * D, seed: true, posts: [
    { name: 'Marco · Milan', lang: 'en', created: now - 2 * D, body: 'My first winter with a shimpaku juniper on a 4th-floor balcony. It gets windy. Anything I should watch for?', tr: { ja: '4階のベランダで真柏を育てて初めての冬です。風が強いです。気をつけることはありますか。' } },
    { name: '職人A（見本）', lang: 'ja', created: now - 2 * D + 5 * H, master: true, body: '真柏は寒さには強いです。風で鉢が乾きやすいので、水を切らさないようにしてください。', tr: { en: "Shimpaku is strong against the cold. The wind dries the pot quickly, so don't let it run out of water.", es: 'El shimpaku resiste bien el frío. El viento seca rápido la maceta, así que no dejes que le falte agua.', zh: '真柏很耐寒。风会让盆土很快变干，请别让它缺水。' } },
  ] },
  { id: 't-nebari', title: '¿Qué significa «nebari»?', created: now - D, seed: true, posts: [
    { name: 'Lucía · Valencia', lang: 'es', created: now - D, body: 'Leo «nebari» en todas partes. ¿Es solo «raíces»?', tr: { ja: '「根張り」という言葉をよく見ます。ただの「根」という意味ですか。', en: 'I see “nebari” everywhere. Does it just mean “roots”?' } },
    { name: 'Engawa', lang: 'es', created: now - D + H, body: 'No exactamente: son las raíces que se ven sobre el sustrato, extendidas en todas direcciones. Mira el glosario: #/glossary', tr: { ja: '少し違います。土の上に見えて、四方に広がる根のことです。用語集をどうぞ。', en: 'Not quite: they are the roots you can see above the soil, spreading in every direction. See the glossary.' } },
  ] },
  { id: 't-repot', title: '第一次换盆，有点紧张', created: now - 6 * H, seed: true, posts: [
    { name: '小林 · 上海', lang: 'zh', created: now - 6 * H, body: '明年春天想给我的五针松第一次换盆，有点紧张。大家第一次都是怎么做的？', tr: { ja: '来年の春、五葉松をはじめて植え替えたいです。少し緊張しています。みなさんは最初どうしましたか。', en: "I want to repot my white pine for the first time next spring and I'm a bit nervous. How did everyone do their first time?" } },
  ] },
];

export const SAMPLE_WISHES = [
  { id: 'w-1', created: now - 2 * D, seed: true, country: 'Germany', text: 'Looking for a shohin black pine, about 20 cm, with good nebari. Budget around 300 EUR.', raised: ['職人A（見本）'],
    parsed: { species: '黒松', size: '小品（約20cm）', style: '根張りのよいもの', budget: '約300ユーロ', summary_ja: 'ドイツの方。根張りのよい小品の黒松、20cmくらい、300ユーロほど。', summary_en: 'Shohin black pine, ~20 cm, good nebari, ~300 EUR' } },
  { id: 'w-2', created: now - D, seed: true, country: 'España', text: 'Busco un arce japonés pequeño para mi balcón en Valencia. Presupuesto 150 €.', raised: [],
    parsed: { species: 'もみじ（イロハモミジ）', size: '小さめ', style: 'ベランダ向き', budget: '約150ユーロ', summary_ja: 'スペイン・バレンシアの方。ベランダに置ける小さめのもみじ、150ユーロほど。', summary_en: 'Small Japanese maple for a balcony, ~150 EUR' } },
  { id: 'w-3', created: now - 8 * H, seed: true, country: 'USA', text: 'Dream tree: a cascade juniper (kengai) for my first show. Medium size, up to $800.', raised: ['職人B（見本）'],
    parsed: { species: '真柏', size: '中品', style: '懸崖', budget: '約800ドル', summary_ja: 'アメリカの方。はじめての展示会に出す懸崖の真柏、中品、800ドルまで。', summary_en: 'Cascade juniper, medium, up to $800, for a first show' } },
];
