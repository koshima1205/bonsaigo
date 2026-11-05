// Engawa の庭 — 歩いて回る3Dの日本庭園。
// 操作: 地面をタップ／クリックでそこへ歩く・WASD／矢印キー・スマホは左下のスティック。ドラッグで見回す・ホイール／2本指で寄る。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { makeTextures } from './tex.js';
import { buildWorld } from './world.js';
import { makeSheet } from './sheet.js';

const $ = (s) => document.querySelector(s);
// Engawa の本体（/niwa/ 以外の場所で開いたとき＝試しの写しなど は、本番の Engawa へつなぐ）
const APP = location.pathname.includes('/niwa/') ? '' : 'https://engawa.igdeploy.workers.dev';
const mobile = matchMedia('(pointer:coarse)').matches || /iPhone|iPad|Android/i.test(navigator.userAgent);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 保存できない環境では覚えない */ } },
};

// ---------- 文言（日本語と英語） ----------
const SPOTS = {
  engawa: { ja: '縁側', en: 'The Engawa', lead: '親方に相談する', leadEn: 'Ask the master',
    text: '木の写真と質問を送ると、弟子が下書きし、親方が一言を足して印を押します。その日のうちに、あなたの言葉で届きます。',
    textEn: 'Send a photo and your question. The apprentice drafts, the master adds a word and a seal — in your language, the same day.',
    actions: [['相談する', 'Ask', '/#/ask'], ['届いた手紙の見本', 'Sample letter', '/#/c/sample']] },
  learn: { ja: '学びの東屋', en: 'Learning pavilion', lead: '盆栽を学ぶ', leadEn: 'Learn bonsai',
    text: '出典つきの盆栽の知識と、回して見られる木、解説の動画があります。',
    textEn: 'Sourced bonsai knowledge, trees you can turn around, and short films.',
    actions: [['学びの部屋へ', 'Open', '/#/learn']] },
  night: { ja: '夜の盆栽棚', en: 'Night bonsai shelf', lead: 'ライトアップを見る', leadEn: 'See the light-up',
    text: '夜になると、棚の盆栽と紅葉に明かりが入ります。石灯籠と障子にも灯がともります。',
    textEn: 'At night the bonsai and the maple are lit, and the lanterns and shoji glow.',
    actions: [['夜にする', 'Make it night', '#night']] },
  board: { ja: '茶屋の掲示板', en: 'Tea-house board', lead: '持ち主どうしで話す', leadEn: 'Talk with other growers',
    text: '世界の持ち主どうしが、木の話を書きこむ掲示板です。どの言葉で書いても、読む人の言葉に訳せます。',
    textEn: 'Growers around the world share notes here. Write in any language; readers can translate it into theirs.',
    actions: [['掲示板をひらく', 'Open the board', '#sheet-board']] },
  market: { ja: '市の縁側', en: 'The market engawa', lead: '欲しい木を伝える', leadEn: 'Tell us the tree you want',
    text: '欲しい木を書くと、AI が職人向けに整理して、市の台に札を下げます。ここでお支払いはしません。',
    textEn: 'Describe the tree you want; AI hangs it as a tag on the table. No payment here.',
    actions: [['欲しい木を伝える', 'Make a wish', '#sheet-market']] },
};
const CHARAS = [
  { id: 'sakuya', ja: '咲耶', en: 'Sakuya', note: '甲賀' },
  { id: 'kohaku', ja: '琥珀', en: 'Kohaku', note: '風魔' },
  { id: 'shiba', ja: '柴', en: 'Shiba', note: '雑賀' },
];

// ---------- 描画の土台 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.6 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('#stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

makeTextures();

// 空と光（昼）
const sky = new Sky(); sky.scale.setScalar(300); scene.add(sky);
const sun = new THREE.Vector3();
const su = sky.material.uniforms;
su.turbidity.value = 5; su.rayleigh.value = 1.4; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.82;
const elev = THREE.MathUtils.degToRad(32), azim = THREE.MathUtils.degToRad(205);
sun.setFromSphericalCoords(1, Math.PI / 2 - elev, azim);
su.sunPosition.value.copy(sun);
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene(); const sky2 = new Sky(); sky2.scale.setScalar(300); envScene.add(sky2);
Object.assign(sky2.material.uniforms.sunPosition.value, sun);
for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) sky2.material.uniforms[k].value = su[k].value;
const dayEnv = pmrem.fromScene(envScene).texture;
scene.environment = dayEnv;

const hemi = new THREE.HemisphereLight('#dfe8ff', '#4a5a32', 0.55); scene.add(hemi);
const light = new THREE.DirectionalLight('#fff4e2', 3.0);
light.position.copy(sun).multiplyScalar(40);
light.castShadow = true;
light.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
Object.assign(light.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 100 });
light.shadow.bias = -0.0004; light.shadow.normalBias = 0.03;
scene.add(light); scene.add(light.target);
scene.fog = new THREE.Fog('#cdd6cf', 40, 120);

// 夜の空（星と月）
const nightSky = new THREE.Mesh(new THREE.SphereGeometry(250, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: {},
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'varying vec3 vP; void main(){ float h = clamp(vP.y,0.0,1.0); vec3 c = mix(vec3(0.05,0.07,0.13), vec3(0.008,0.012,0.035), pow(h,0.5)); gl_FragColor = vec4(c,1.0); }',
}));
nightSky.visible = false; scene.add(nightSky);
const starG = new THREE.BufferGeometry(); const sp = [];
for (let i = 0; i < 1400; i++) { const v = new THREE.Vector3().randomDirection(); if (v.y < 0.08) { i--; continue; } v.multiplyScalar(240); sp.push(v.x, v.y, v.z); }
starG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
const stars = new THREE.Points(starG, new THREE.PointsMaterial({ color: '#ffffff', size: 1.3, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
stars.visible = false; scene.add(stars);
const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 16), new THREE.MeshBasicMaterial({ color: '#fff6dc', fog: false }));
moon.position.set(-90, 120, -170); moon.visible = false; scene.add(moon);

const W = buildWorld(scene, { mobile });

// ---------- 昼と夜 ----------
let night = false;
function setNight(on) {
  night = on;
  sky.visible = !on; nightSky.visible = stars.visible = moon.visible = on;
  scene.environmentIntensity = on ? 0.12 : 1;
  light.color.set(on ? '#9db4ff' : '#fff4e2'); light.intensity = on ? 0.35 : 3.0;
  light.position.copy(on ? new THREE.Vector3(-0.45, 0.7, -0.55).normalize() : sun).multiplyScalar(40);
  hemi.intensity = on ? 0.12 : 0.55;
  scene.fog.color.set(on ? '#0b1224' : '#cdd6cf');
  renderer.toneMappingExposure = on ? 1.05 : 0.85;
  for (const l of W.night.lights) l.visible = on;
  for (const [m, d, n] of W.night.emissive) m.emissiveIntensity = on ? n : d;
  $('#daynight').textContent = on ? '昼にする' : '夜にする';
  $('#daynight').setAttribute('aria-pressed', String(on));
  if (cardSpot) showCard(cardSpot, true);
}
$('#daynight').addEventListener('click', () => setNight(!night));

// ---------- キャラ ----------
const loader = new GLTFLoader();
const player = { obj: new THREE.Group(), mixer: null, acts: {}, cur: null, pos: new THREE.Vector3(0, 0, 7.2), yaw: Math.PI, speed: 0, target: null };
scene.add(player.obj);
const cache = {};
async function loadChara(id) {
  if (!cache[id]) cache[id] = APP
    // 試しの写し（GLB をそのまま置けない場所）では、文字にした GLB を読む
    ? await fetch(`./chara/${id}.glb.txt`).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then((t) => loader.parseAsync(Uint8Array.from(atob(t.trim()), (c) => c.charCodeAt(0)).buffer, './'))
    : await loader.loadAsync(`./chara/${id}.glb`, (e) => {
      if (e.total) $('#bar i').style.width = `${Math.round(e.loaded / e.total * 100)}%`;
    });
  const gltf = cache[id];
  player.obj.clear();
  const model = gltf.scene;
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  player.obj.add(model);
  player.mixer = new THREE.AnimationMixer(model);
  player.acts = {};
  for (const clip of gltf.animations) player.acts[clip.name] = player.mixer.clipAction(clip);
  player.cur = null;
  play('Idle');
}
function play(name, fade = 0.25) {
  const a = player.acts[name]; if (!a || player.cur === a) return;
  a.reset().play();
  if (player.cur) player.cur.crossFadeTo(a, fade, false);
  player.cur = a;
}

// ---------- 当たり判定 ----------
const RAD = 0.28;
function collide(p) {
  for (const c of W.colliders) {
    if (c.type === 'circle') {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + RAD;
      if (d < m && d > 1e-5) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
    } else if (c.type === 'rect') {
      const x0 = c.x0 - RAD, x1 = c.x1 + RAD, z0 = c.z0 - RAD, z1 = c.z1 + RAD;
      if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) {
        const o = [p.x - x0, x1 - p.x, p.z - z0, z1 - p.z], k = o.indexOf(Math.min(...o));
        if (k === 0) p.x = x0; else if (k === 1) p.x = x1; else if (k === 2) p.z = z0; else p.z = z1;
      }
    } else if (c.type === 'pond') {
      const dx = p.x - c.cx, dz = p.z - c.cz, a = Math.atan2(dz, dx), d = Math.hypot(dx, dz), m = c.rf(a) + RAD;
      if (d < m) { p.x = c.cx + Math.cos(a) * m; p.z = c.cz + Math.sin(a) * m; }
    }
  }
  const b = W.bounds;
  p.x = Math.min(b.x1, Math.max(b.x0, p.x)); p.z = Math.min(b.z1, Math.max(b.z0, p.z));
}

// ---------- 入力 ----------
const keys = new Set();
addEventListener('keydown', (e) => { if (!e.target.closest('input,textarea')) keys.add(e.key.toLowerCase()); });
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
const cam = { yaw: 0, pitch: 0.38, dist: mobile ? 7.2 : 6.2, look: new THREE.Vector3() };
// 札などを見せるときは、カメラの見る先を一時だけキャラから外す。歩く・押す・ドラッグで、もとの距離と角度に戻る
function focusOn(pos, { yaw, pitch, dist }) {
  if (!cam.focus) cam.saved = { pitch: cam.pitch, dist: cam.dist };
  cam.focus = pos.clone(); cam.goal = THREE.MathUtils.degToRad(yaw); cam.pitch = pitch; cam.dist = dist;
}
function freeCam() {
  cam.goal = null;
  if (cam.focus) { cam.focus = null; Object.assign(cam, cam.saved); }
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const pointers = new Map(); let drag = null, pinch = null;
const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, moved: 0, t: performance.now() };
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: cam.dist }; drag = null; }
});
cv.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    cam.dist = THREE.MathUtils.clamp(pinch.dist * pinch.d / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), 3, 14);
  } else if (drag) {
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved > 6) { freeCam(); cam.yaw -= dx * 0.006; cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.004, 0.08, 1.2); }
  }
});
const endPointer = (e) => {
  if (drag && drag.moved <= 6 && performance.now() - drag.t < 500) tapAt(e.clientX, e.clientY);
  pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (!pointers.size) drag = null;
};
cv.addEventListener('pointerup', endPointer); cv.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); drag = pinch = null; });
cv.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 3, 14); }, { passive: false });

const marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
marker.rotation.x = -Math.PI / 2; scene.add(marker);
function tapAt(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  // 3Dの掲示板・市の台を押したら、その画面を開く
  const obj = ray.intersectObjects(W.clickables.map((c) => c.obj), true)[0];
  if (obj && obj.distance < 25) {
    const c = W.clickables.find((k) => { let o = obj.object; while (o) { if (o === k.obj) return true; o = o.parent; } return false; });
    if (c) return sheet.open(c.kind);
  }
  // 見どころの輪をタップしたら、そこへ歩く
  for (const s of W.spots) {
    const sp2 = s.pos.clone().setY(1.2).project(camera);
    if (Math.hypot((sp2.x - ndc.x) * innerWidth / 2, (sp2.y - ndc.y) * innerHeight / 2) < 40 && sp2.z < 1) return walkTo(s.pos);
  }
  const hit = ray.intersectObject(W.ground)[0];
  if (hit) walkTo(hit.point);
}
function walkTo(p) {
  player.target = new THREE.Vector3(p.x, 0, p.z); freeCam();
  marker.position.set(p.x, 0.08, p.z); marker.material.opacity = 0.9;
  stuck = 0;
}

// スマホのスティック
const stick = { on: false, x: 0, y: 0 };
if (mobile) {
  const pad = $('#stick'), knob = $('#stick i');
  pad.hidden = false;
  const move = (e) => {
    const r = pad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    stick.x = dx; stick.y = dy; knob.style.transform = `translate(${dx * 34}px,${dy * 34}px)`;
  };
  pad.addEventListener('pointerdown', (e) => { e.stopPropagation(); pad.setPointerCapture(e.pointerId); stick.on = true; player.target = null; move(e); });
  pad.addEventListener('pointermove', (e) => { if (stick.on) move(e); });
  const up = () => { stick.on = false; stick.x = stick.y = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
}

// ---------- 見どころの札と案内 ----------
const labels = W.spots.map((s) => {
  const el = document.createElement('button');
  el.className = 'label'; el.type = 'button';
  el.innerHTML = `<b>${SPOTS[s.id].ja}</b><small>${SPOTS[s.id].en}</small>`;
  el.addEventListener('click', () => walkTo(s.pos));
  $('#labels').appendChild(el); return el;
});
let cardSpot = null, dismissed = null, arrived = null;
function showCard(id, force) {
  if (cardSpot === id && !force) return;
  cardSpot = id;
  const s = SPOTS[id];
  $('#card').innerHTML = `<button class="x" type="button" aria-label="閉じる">×</button>
    <p class="kicker">${s.ja}<span>${s.en}</span></p>
    <h2>${s.lead}<small>${s.leadEn}</small></h2>
    <p>${s.text}</p><p class="en">${s.textEn}</p>
    <div class="acts">${s.actions.map(([ja, en, href]) => href === '#night'
      ? `<button type="button" class="go" data-night>${night ? '昼にもどす' : ja}<small>${night ? 'Back to day' : en}</small></button>`
      : href.startsWith('#sheet-')
        ? `<button type="button" class="go" data-sheet="${href.slice(7)}">${ja}<small>${en}</small></button>`
        : `<a class="go" href="${APP}${href}"${APP ? ' target="_blank" rel="noopener"' : ''}>${ja}<small>${en}</small></a>`).join('')}</div>`;
  $('#card').hidden = false;
  $('#card .x').onclick = () => { dismissed = id; hideCard(); };
  const nb = $('#card [data-night]'); if (nb) nb.onclick = () => setNight(!night);
  const sb = $('#card [data-sheet]'); if (sb) sb.onclick = () => sheet.open(sb.dataset.sheet);
}

// 掲示板と市（下から出る画面）。読みこんだ話題と札は、3Dの掲示板と市の台にも出す
const sheet = makeSheet({
  app: APP,
  onThreads: (list) => W.setBoard(list),
  onWishes: (list) => W.setWishes(list),
  onOpen: () => { hideCard(); player.target = null; freeCam(); document.body.classList.add('sheet-open'); },
  onClose: () => document.body.classList.remove('sheet-open'),
  // 欲しい木を送ったあと「台の札を見に行く」: 市の台の手前が見える向きへ寄って、新しい札を光らせる
  onSeeTag: () => {
    dismissed = 'market'; // 札を見ている間は、市のカードを出さない
    focusOn(W.tagPos(0), { yaw: 180, pitch: 0.26, dist: 2.3 });
    W.flashTag(0, 6);
  },
});
sheet.loadThreads().catch(() => {});
sheet.loadWishes().catch(() => {});
function hideCard() { cardSpot = null; $('#card').hidden = true; }

// ---------- 毎コマ ----------
const clock = new THREE.Clock();
let stuck = 0, last = new THREE.Vector3();
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), mv = new THREE.Vector3(), tmp = new THREE.Vector3();
const camRay = new THREE.Ray(), hitP = new THREE.Vector3();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  // 歩く向き（カメラから見た前後左右）
  fwd.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)); right.set(-fwd.z, 0, fwd.x);
  mv.set(0, 0, 0);
  if (keys.has('w') || keys.has('arrowup')) mv.add(fwd);
  if (keys.has('s') || keys.has('arrowdown')) mv.sub(fwd);
  if (keys.has('d') || keys.has('arrowright')) mv.add(right);
  if (keys.has('a') || keys.has('arrowleft')) mv.sub(right);
  if (stick.on) mv.addScaledVector(fwd, -stick.y).addScaledVector(right, stick.x);
  if (mv.lengthSq() > 0.01) { player.target = null; freeCam(); } // 自分で歩き出したら、カメラの自動回転はやめる
  else if (player.target) {
    mv.subVectors(player.target, player.pos); mv.y = 0;
    if (mv.length() < 0.15) { player.target = null; mv.set(0, 0, 0); }
  }
  const want = Math.min(1, mv.length());
  const MAX = 2.1;
  player.speed = THREE.MathUtils.damp(player.speed, want * MAX, 10, dt);
  if (want > 0.01) {
    mv.normalize();
    const yaw = Math.atan2(mv.x, mv.z);
    let d = yaw - player.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    player.yaw += d * Math.min(1, dt * 12);
  }
  last.copy(player.pos);
  player.pos.addScaledVector(tmp.set(Math.sin(player.yaw), 0, Math.cos(player.yaw)), player.speed * dt);
  collide(player.pos);
  if (player.target) {
    stuck = last.distanceTo(player.pos) < player.speed * dt * 0.3 ? stuck + dt : 0;
    if (stuck > 0.6) player.target = null;
  }
  player.obj.position.copy(player.pos); player.obj.rotation.y = player.yaw;
  if (player.mixer) {
    if (player.speed > 0.2) { play('Walk', 0.18); player.acts.Walk.timeScale = 0.9 + player.speed * 1.1; }
    else play('Idle', 0.3);
    player.mixer.update(dt);
  }
  marker.material.opacity = Math.max(0, marker.material.opacity - dt * (player.target ? 0.3 : 2));
  // 見どころに着いたら、見せたい向きへカメラをゆっくり回す（ドラッグしたらやめる）
  if (cam.goal != null) {
    const d = Math.atan2(Math.sin(cam.goal - cam.yaw), Math.cos(cam.goal - cam.yaw));
    cam.yaw += d * (1 - Math.exp(-dt * 2.5));
    if (Math.abs(d) < 0.004) cam.goal = null;
  }
  // カメラはやわらかく追う
  if (cam.focus) cam.look.lerp(cam.focus, 1 - Math.exp(-dt * 3));
  else cam.look.lerp(tmp.copy(player.pos).add(new THREE.Vector3(0, 0.75, 0)), 1 - Math.exp(-dt * 8));
  const cx = cam.look.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
  const cz = cam.look.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
  const cy = cam.look.y + Math.sin(cam.pitch) * cam.dist;
  // 建物にさえぎられるときは、カメラを手前に寄せる（寄るのは速く、戻るのはゆっくり）
  tmp.set(cx, Math.max(0.5, cy), cz);
  camRay.origin.copy(cam.look); camRay.direction.subVectors(tmp, cam.look);
  const full = camRay.direction.length(); camRay.direction.divideScalar(full || 1);
  let lim = full;
  for (const b of W.camBoxes) { if (camRay.intersectBox(b, hitP)) lim = Math.min(lim, Math.max(1.2, cam.look.distanceTo(hitP) - 0.3)); }
  cam.cur = cam.cur === undefined ? lim : (lim < cam.cur ? THREE.MathUtils.damp(cam.cur, lim, 18, dt) : THREE.MathUtils.damp(cam.cur, lim, 3, dt));
  tmp.copy(cam.look).addScaledVector(camRay.direction, cam.cur);
  camera.position.lerp(tmp, 1 - Math.exp(-dt * 10));
  camera.lookAt(cam.look);
  light.target.position.copy(player.pos); light.position.copy(player.pos).add((night ? new THREE.Vector3(-0.45, 0.7, -0.55).normalize() : sun).clone().multiplyScalar(40));
  for (const u of W.updaters) u(t);
  // 東屋の屋根の下に入ったら、屋根を透かす
  for (const f of W.fades) {
    const inside = player.pos.x > f.x0 && player.pos.x < f.x1 && player.pos.z > f.z0 && player.pos.z < f.z1;
    for (const m of f.mats) {
      const want = inside ? 0.18 : 1;
      if (Math.abs(m.opacity - want) > 0.005) { m.opacity = THREE.MathUtils.damp(m.opacity, want, 6, dt); m.depthWrite = m.opacity > 0.9; }
    }
  }
  // 札の位置と、近くの見どころ
  let near = null, nd = 1e9;
  W.spots.forEach((s, i) => {
    const d = s.pos.distanceTo(player.pos);
    if (d < nd) { nd = d; near = s; }
    const p = tmp.copy(s.pos).setY(2.0).project(camera);
    const el = labels[i];
    const vis = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1 && d < 30 && cardSpot !== s.id;
    el.style.opacity = vis ? String(Math.min(1, (30 - d) / 10)) : '0';
    el.style.pointerEvents = vis ? 'auto' : 'none';
    el.style.transform = `translate(-50%,-100%) translate(${(p.x * 0.5 + 0.5) * innerWidth}px,${(-p.y * 0.5 + 0.5) * innerHeight}px)`;
  });
  if (near && nd < 1.9) {
    if (near.view != null && arrived !== near.id && !cam.hold && !cam.focus && player.speed < 0.4 && !stick.on) { cam.goal = THREE.MathUtils.degToRad(near.view); arrived = near.id; }
    if (dismissed !== near.id && !sheet.isOpen()) showCard(near.id);
  }
  else { if (cardSpot) hideCard(); dismissed = null; arrived = null; }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ---------- はじめの画面 ----------
let chosen = store.get('niwa-chara', 'sakuya');
function pickers() {
  $('#pick').innerHTML = CHARAS.map((c) => `<button type="button" data-id="${c.id}" aria-pressed="${c.id === chosen}">
    <img src="./img/${c.id}.jpg" alt="" width="120" height="150"><b>${c.ja}</b><small>${c.en}</small></button>`).join('');
  $('#pick').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { chosen = b.dataset.id; store.set('niwa-chara', chosen); pickers(); }));
}
pickers();
let started = false;
$('#enter').addEventListener('click', async () => {
  $('#enter').disabled = true; $('#bar').hidden = false;
  try {
    await loadChara(chosen);
  } catch (e) {
    $('#enter').disabled = false; $('#bar').hidden = true;
    $('#err').textContent = 'キャラの読み込みに失敗しました。通信を確かめて、もう一度お試しください。'; return;
  }
  $('#start').hidden = true; $('#hud').hidden = false; $('#labels').hidden = false;
  if (!started) { started = true; cam.look.copy(player.pos).setY(0.75); requestAnimationFrame(tick); }
});
$('#who').addEventListener('click', () => { if (sheet.isOpen()) sheet.close(); $('#start').hidden = false; $('#hud').hidden = true; $('#labels').hidden = true; hideCard(); $('#enter').disabled = false; $('#bar').hidden = true; });
// 最初の1枚（はじめの画面の後ろに庭を見せる）
camera.position.set(3.2, 2.5, 6.4); camera.lookAt(-3.2, 1.1, -5.5);
renderer.compile(scene, camera);
renderer.render(scene, camera);
$('#loading').hidden = true;

// 撮影用（動画・確認の写真）: ?c=sakuya&at=x,z&face=度&yaw=度&pitch=0.3&dist=6&night=1&ui=0 で、その場所から始める
const Q = new URLSearchParams(location.search);
if (Q.has('c') || Q.has('at') || Q.has('sheet')) {
  if (Q.get('c')) chosen = Q.get('c');
  if (Q.get('at')) { const [x, z] = Q.get('at').split(',').map(Number); player.pos.set(x, 0, z); }
  if (Q.has('face')) player.yaw = THREE.MathUtils.degToRad(+Q.get('face'));
  if (Q.has('yaw')) { cam.yaw = THREE.MathUtils.degToRad(+Q.get('yaw')); cam.hold = true; }
  if (Q.has('pitch')) cam.pitch = +Q.get('pitch');
  if (Q.has('dist')) cam.dist = +Q.get('dist');
  if (Q.get('ui') === '0') document.body.classList.add('noui');
  if (Q.get('night') === '1') setNight(true);
  $('#enter').click();
  if (Q.get('sheet')) { const [k, id] = Q.get('sheet').split(':'); sheet.open(k, id); }
  // 撮影の道具が待てるように、数コマ描いたら印を立てる
  const wait = () => (started && clock.elapsedTime > 1.2 ? (document.documentElement.dataset.ready = '1') : requestAnimationFrame(wait));
  requestAnimationFrame(wait);
}
