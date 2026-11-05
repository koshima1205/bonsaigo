// 庭そのもの（家と縁側・盆栽棚・東屋・茶屋・市・池・枯山水・石灯籠・道・竹垣・庭木）を組む。
// 座標: y が上、−z が北（家のある側）。単位はメートル。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { T, rng, rakedGravel, textBoard } from './tex.js';
import { makeTree } from './bonsai.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildWorld(scene, { mobile }) {
  const W = { colliders: [], spots: [], night: { lights: [], emissive: [] }, updaters: [], camBoxes: [], noGrass: [], fades: [] };
  // カメラが建物の中に入らないように、建物ごとの箱（ここに当たったらカメラを手前に寄せる）
  const camBox = (x0, y0, z0, x1, y1, z1) => W.camBoxes.push(new THREE.Box3(V(x0, y0, z0), V(x1, y1, z1)));
  const r = rng(2026);
  const shadow = (o, cast = true, recv = true) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = recv; } }); return o; };
  const add = (o) => { scene.add(o); return o; };

  // ---------- 材質 ----------
  const rep = (t, x, y) => { const c = t.clone(); c.repeat.set(x, y); c.needsUpdate = true; return c; };
  const M = {
    ground: new THREE.MeshStandardMaterial({ color: '#ffffff', map: T.moss, roughness: 1 }),
    stone: new THREE.MeshStandardMaterial({ color: '#ffffff', map: T.stone, roughness: 0.92 }),
    darkWood: new THREE.MeshStandardMaterial({ color: '#ffffff', map: T.darkWood, roughness: 0.8 }),
    plaster: new THREE.MeshStandardMaterial({ color: '#ffffff', map: T.plaster, roughness: 0.95 }),
    under: new THREE.MeshStandardMaterial({ color: '#17140f', roughness: 1 }),
    tiles: new THREE.MeshStandardMaterial({ color: '#ffffff', map: T.tiles, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide }),
    ridge: new THREE.MeshStandardMaterial({ color: '#2f3237', roughness: 0.5, metalness: 0.15 }),
    thatch: new THREE.MeshStandardMaterial({ color: '#ffffff', map: T.thatch, roughness: 1, side: THREE.DoubleSide }),
    felt: new THREE.MeshStandardMaterial({ color: '#ffffff', map: T.felt, roughness: 0.9 }),
    bamboo: new THREE.MeshStandardMaterial({ color: '#ffffff', map: T.bamboo, roughness: 0.6 }),
    shrub: new THREE.MeshStandardMaterial({ color: '#4f7038', map: T.foliage, roughness: 0.95 }),
    rock: new THREE.MeshStandardMaterial({ color: '#a8a397', map: T.stone, roughness: 0.96 }),
    shoji: new THREE.MeshStandardMaterial({ map: T.shoji, emissiveMap: T.shojiGlow, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.9 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#b9ad92', emissive: '#ffb45a', emissiveIntensity: 0, roughness: 0.9 }),
  };
  W.night.emissive.push([M.shoji, 0, 1.25], [M.lamp, 0, 3.2]);
  const woodM = (rx, ry) => new THREE.MeshStandardMaterial({ map: rep(T.wood, rx, ry), roughness: 0.62 });

  // ---------- 地面 ----------
  // 苔の地面。大きなむら（色の濃い所・黄みの所）を頂点の色でつけて、同じ模様のくり返しを目立たなくする
  const gg = new THREE.PlaneGeometry(140, 140, 70, 70), gp = gg.attributes.position, gc = [];
  const gcol = new THREE.Color();
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), y = gp.getY(i);
    const n = Math.sin(x * 0.21 + 1.3) * Math.sin(y * 0.17 + 0.4) * 0.5 + Math.sin(x * 0.07 - y * 0.09 + 2.1) * 0.5;
    gcol.setHSL(0.24 + n * 0.025, 0.42 + n * 0.08, 0.82 + n * 0.12); gc.push(gcol.r, gcol.g, gcol.b);
  }
  gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
  M.ground.vertexColors = true;
  const ground = new THREE.Mesh(gg, M.ground);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.name = 'ground';
  add(ground); W.ground = ground;

  // 木を台の上に置く（鉢の底を y にそろえる）
  const placeOn = (t, x, y, z) => { t.position.set(0, 0, 0); t.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(t); t.position.set(x, y - b.min.y, z); return t; };
  const box = (w, h, d, m, x, y, z, rnd = 0) => {
    const g = rnd ? new RoundedBoxGeometry(w, h, d, 2, rnd) : new THREE.BoxGeometry(w, h, d);
    const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return shadow(o);
  };
  // 石: 頂点をつないだ球を、位置で決まるでこぼこで崩す（割れ目ができないように）。底は平らにして地面になじませる
  const rock = (x, y, z, sx, sy, sz, seed) => {
    const rr = rng(seed), f = [rr() * 6, rr() * 6, rr() * 6, rr() * 6];
    let g = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g);
    const p = g.attributes.position, uv = [];
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      let k = 1 + 0.16 * Math.sin(vx * 2.1 + f[0]) * Math.sin(vz * 1.7 + f[1]) + 0.08 * Math.sin(vy * 4.3 + vx * 3.1 + f[2]) + 0.04 * Math.sin(vz * 7 + vy * 6 + f[3]);
      // 角ばった面（はつった面）を少し
      k *= 1 - 0.1 * Math.max(0, Math.sin(vx * 1.3 + vz * 0.9 + f[0]));
      const ny = Math.max(vy * k, -0.35);
      p.setXYZ(i, vx * k, ny, vz * k);
      uv.push(Math.atan2(vz, vx) / (Math.PI * 2) + 0.5, vy * 0.5 + 0.5);
    }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const o = new THREE.Mesh(g, M.rock); o.scale.set(sx, sy, sz); o.position.set(x, y + 0.35 * sy - 0.02, z); o.rotation.y = rr() * 6;
    return shadow(o);
  };

  // ---------- 家と縁側 ----------
  const house = new THREE.Group();
  const X0 = -11, X1 = 5, ZW = -10.5, ZB = -17, FL = 0.58, ZE = -9.15;
  house.add(box(X1 - X0, FL - 0.06, ZW - ZB, M.under, (X0 + X1) / 2, (FL - 0.06) / 2, (ZW + ZB) / 2));
  const deck = box(X1 - X0 + 0.4, 0.08, ZW - ZE, woodM(4, 1), (X0 + X1) / 2, FL - 0.04, (ZW + ZE) / 2);
  house.add(deck);
  house.add(box(X1 - X0 + 0.4, 0.06, 0.08, M.darkWood, (X0 + X1) / 2, FL - 0.07, ZE + 0.04));
  // 柱・桁・障子・小壁
  const ken = (X1 - X0) / 9;
  for (let i = 0; i <= 9; i++) {
    const x = X0 + i * ken;
    house.add(box(0.13, 2.45, 0.13, M.darkWood, x, FL + 1.22, ZW));
    house.add(box(0.12, 2.4, 0.12, M.darkWood, x, FL + 1.2, ZE + 0.1));
    house.add(rock(x, 0.06, ZE + 0.1, 0.16, 0.08, 0.16, 50 + i));
    if (i < 9) for (let k = 0; k < 2; k++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(ken / 2 - 0.02, 1.8), M.shoji);
      p.position.set(x + ken / 4 + k * ken / 2, FL + 0.9, ZW + 0.02); house.add(p);
    }
  }
  house.add(box(X1 - X0, 0.12, 0.14, M.darkWood, (X0 + X1) / 2, FL + 1.86, ZW));
  const kokabe = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, 0.6), M.plaster);
  kokabe.position.set((X0 + X1) / 2, FL + 2.22, ZW + 0.01); house.add(kokabe);
  house.add(box(X1 - X0 + 0.4, 0.16, 0.16, M.darkWood, (X0 + X1) / 2, FL + 2.45, ZE + 0.1));
  for (const x of [X0, X1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(ZW - ZB, 2.5), M.plaster);
    w.position.set(x, FL + 1.25, (ZW + ZB) / 2); w.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2; house.add(w);
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, 2.5), M.plaster);
  back.position.set((X0 + X1) / 2, FL + 1.25, ZB); back.rotation.y = Math.PI; house.add(back);
  // 寄棟の屋根
  const RX0 = X0 - 1.3, RX1 = X1 + 1.3, RZ0 = ZB - 1.3, RZ1 = ZE - 0.75, EY = FL + 2.5, RY = FL + 4.7, IN = 3.6;
  const A = V(RX0, EY, RZ1), B = V(RX1, EY, RZ1), C = V(RX1, EY, RZ0), D = V(RX0, EY, RZ0);
  const zm = (RZ0 + RZ1) / 2, R1 = V(RX0 + IN, RY, zm), R2 = V(RX1 - IN, RY, zm);
  const tri = [[A, B, R2], [A, R2, R1], [C, D, R1], [C, R1, R2], [D, A, R1], [B, C, R2]];
  const pos = [], uv = [];
  tri.forEach((t, i) => t.forEach((p) => {
    pos.push(p.x, p.y, p.z);
    const side = i >= 4;
    const along = side ? p.z : p.x;
    const edge = side ? Math.abs(p.x - (i === 4 ? RX0 : RX1)) : Math.abs(p.z - (i < 2 ? RZ1 : RZ0));
    uv.push(along * 0.45, Math.hypot(p.y - EY, edge) * 0.45);
  }));
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  rg.computeVertexNormals();
  house.add(shadow(new THREE.Mesh(rg, M.tiles)));
  const rlen = R2.x - R1.x;
  house.add(box(rlen + 0.3, 0.32, 0.36, M.ridge, (R1.x + R2.x) / 2, RY + 0.1, zm, 0.06));
  for (const x of [R1.x - 0.2, R2.x + 0.2]) house.add(box(0.3, 0.55, 0.4, M.ridge, x, RY + 0.2, zm, 0.08));
  for (const [p, q] of [[A, B], [D, C], [A, D], [B, C]]) {
    const len = p.distanceTo(q), mid = p.clone().add(q).multiplyScalar(0.5);
    const e = box(p.x === q.x ? 0.12 : len, 0.18, p.x === q.x ? len : 0.12, M.darkWood, mid.x, EY - 0.06, mid.z);
    house.add(e);
  }
  // 沓脱石・座布団・縁側の盆栽
  house.add(box(1.0, 0.24, 0.55, M.stone, -2, 0.12, ZE + 0.5, 0.1));
  const zabuton = box(0.62, 0.07, 0.62, new THREE.MeshStandardMaterial({ color: '#6b2732', roughness: 0.9 }), -2.8, FL + 0.035, -9.85, 0.03);
  house.add(zabuton);
  const tray = box(0.4, 0.03, 0.28, M.darkWood, -2.15, FL + 0.015, -9.95); house.add(tray);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.07, 20), new THREE.MeshStandardMaterial({ color: '#3d5a4d', roughness: 0.3 }));
  cup.position.set(-2.1, FL + 0.065, -9.95); house.add(shadow(cup));
  const engawaTree = makeTree({ kind: 'pine', seed: 41, height: 0.55 });
  placeOn(engawaTree, -0.9, FL, -9.8); house.add(engawaTree);
  add(house);
  W.colliders.push({ type: 'rect', x0: X0 - 0.4, x1: X1 + 0.4, z0: ZB - 1, z1: ZE + 0.2 });
  camBox(X0 - 1.3, 0, ZB - 1.3, X1 + 1.3, 6, ZE + 0.1);
  // 軒下の雨落ち（白い砂利の帯と、縁の石）
  const amo = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 2.4, 0.95), new THREE.MeshStandardMaterial({ map: rep(T.gravelPlain, 9, 0.6), roughness: 1, color: '#e9e5da' }));
  W.noGrass.push([X0 - 1.3, ZE, X1 + 1.3, ZE + 1.0]);
  amo.rotation.x = -Math.PI / 2; amo.position.set((X0 + X1) / 2, 0.015, ZE + 0.42); amo.receiveShadow = true; add(amo);
  add(box(X1 - X0 + 2.4, 0.07, 0.1, M.stone, (X0 + X1) / 2, 0.035, ZE + 0.93, 0.02));
  W.colliders.push({ type: 'rect', x0: -2.55, x1: -1.45, z0: ZE + 0.2, z1: ZE + 0.8 });

  // ---------- 池（鯉つき） ----------
  const PC = V(10.5, 0, -2.5);
  const pr = (a) => 3.6 + 0.7 * Math.sin(2 * a + 1) + 0.35 * Math.sin(3 * a + 2);
  const shape = new THREE.Shape();
  for (let i = 0; i <= 72; i++) {
    const a = i / 72 * Math.PI * 2, rr = pr(a);
    const x = PC.x + Math.cos(a) * rr, z = PC.z + Math.sin(a) * rr;
    i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z);
  }
  const bed = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), new THREE.MeshStandardMaterial({ color: '#1a2a22', roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
  bed.rotation.x = -Math.PI / 2; bed.position.y = 0.012; bed.receiveShadow = true; add(bed);
  const waterN = T.water.clone(); waterN.repeat.set(1.1, 1.1); waterN.needsUpdate = true;
  const water = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), new THREE.MeshStandardMaterial({
    color: '#1b3735', roughness: 0.06, metalness: 0, normalMap: waterN, normalScale: new THREE.Vector2(0.1, 0.1),
    transparent: true, opacity: 0.86, envMapIntensity: 1.0 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.06; water.receiveShadow = true; add(water);
  W.updaters.push((t) => { waterN.offset.set(t * 0.012, t * 0.008); });
  for (let i = 0; i < 34; i++) {
    const a = i / 34 * Math.PI * 2 + r() * 0.08, rr = pr(a) + 0.12;
    add(rock(PC.x + Math.cos(a) * rr, -0.02, PC.z + Math.sin(a) * rr, 0.22 + r() * 0.25, 0.12 + r() * 0.1, 0.2 + r() * 0.2, 300 + i));
  }
  add(rock(PC.x - 1.0, -0.04, PC.z + 0.6, 0.62, 0.42, 0.52, 333));
  const koiCols = [['#f26b1d', '#ffffff'], ['#ffffff', '#d4231c'], ['#f5a623', '#f5a623'], ['#ffffff', '#222222'], ['#e2471b', '#e2471b']];
  koiCols.forEach(([c1, c2], i) => {
    const koi = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshStandardMaterial({ color: c1, roughness: 0.35 }));
    body.scale.set(0.16, 0.035, 0.06); koi.add(body);
    const spot = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), new THREE.MeshStandardMaterial({ color: c2, roughness: 0.35 }));
    spot.scale.set(0.07, 0.037, 0.045); spot.position.x = 0.03; koi.add(spot);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8), body.material);
    tail.rotation.z = Math.PI / 2; tail.scale.z = 0.25; tail.position.x = -0.19; koi.add(tail);
    koi.position.y = 0.035; add(koi);
    const rad = 0.9 + i * 0.42, sp = (0.18 + r() * 0.12) * (i % 2 ? 1 : -1), ph = r() * 6;
    W.updaters.push((t) => {
      const a = ph + t * sp, rr = Math.min(rad, pr(a) - 0.6);
      koi.position.x = PC.x + Math.cos(a) * rr; koi.position.z = PC.z + Math.sin(a) * rr;
      koi.rotation.y = -a + (sp > 0 ? -Math.PI / 2 : Math.PI / 2);
      tail.rotation.y = Math.sin(t * 6 + ph) * 0.4;
    });
  });
  W.colliders.push({ type: 'pond', cx: PC.x, cz: PC.z, rf: (a) => pr(a) + 0.35 });

  // ---------- 枯山水 ----------
  const KX0 = -15.5, KZ0 = -6.2, KW = 9, KD = 7;
  const krocks = [{ x: 2.0, z: 2.2, r: 0.75 }, { x: 5.9, z: 4.5, r: 0.95 }, { x: 7.5, z: 1.6, r: 0.45 }];
  const rk = rakedGravel(KW, KD, krocks, mobile ? 48 : 72);
  const gravel = new THREE.Mesh(new THREE.PlaneGeometry(KW, KD), new THREE.MeshStandardMaterial({ map: rk.map, bumpMap: rk.bump, bumpScale: 2.2, roughness: 0.95 }));
  gravel.rotation.x = -Math.PI / 2; gravel.position.set(KX0 + KW / 2, 0.02, KZ0 + KD / 2); gravel.receiveShadow = true; add(gravel);
  krocks.forEach((k, i) => {
    add(rock(KX0 + k.x, -0.03, KZ0 + k.z, k.r * 0.9, k.r * 0.85, k.r * 0.8, 700 + i));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(k.r * 0.85, 0.12, 8, 32), new THREE.MeshStandardMaterial({ color: '#56722f', map: T.moss, roughness: 1 }));
    ring.rotation.x = Math.PI / 2; ring.scale.z = 0.4; ring.position.set(KX0 + k.x, 0.03, KZ0 + k.z); add(ring);
  });
  for (const [x, z, w, d] of [[KX0 + KW / 2, KZ0 - 0.1, KW + 0.4, 0.2], [KX0 + KW / 2, KZ0 + KD + 0.1, KW + 0.4, 0.2], [KX0 - 0.1, KZ0 + KD / 2, 0.2, KD], [KX0 + KW + 0.1, KZ0 + KD / 2, 0.2, KD]])
    add(box(w, 0.12, d, M.stone, x, 0.06, z, 0.03));
  W.colliders.push({ type: 'rect', x0: KX0 - 0.2, x1: KX0 + KW + 0.2, z0: KZ0 - 0.2, z1: KZ0 + KD + 0.2 });

  // ---------- 盆栽棚（夜はライトアップ） ----------
  const SX0 = -6.2, SX1 = -0.8, SZ = 2.0;
  const shelf = new THREE.Group();
  const boardM = woodM(3, 0.4);
  shelf.add(box(SX1 - SX0, 0.06, 0.55, boardM, (SX0 + SX1) / 2, 0.6, SZ + 0.3));
  shelf.add(box(SX1 - SX0, 0.06, 0.5, boardM, (SX0 + SX1) / 2, 0.95, SZ - 0.25));
  for (let i = 0; i <= 3; i++) {
    const x = SX0 + 0.1 + i * (SX1 - SX0 - 0.2) / 3;
    shelf.add(box(0.09, 0.6, 0.09, M.darkWood, x, 0.3, SZ + 0.52));
    shelf.add(box(0.09, 0.95, 0.09, M.darkWood, x, 0.475, SZ - 0.45));
    shelf.add(box(0.09, 0.95, 0.09, M.darkWood, x, 0.475, SZ + 0.05));
  }
  // 後ろの竹垣（ライトアップの背景）
  const canes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 8), M.bamboo, 80);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 80; i++) { m4.makeTranslation(SX0 - 0.3 + i * (SX1 - SX0 + 0.6) / 79, 1.0, SZ - 0.75); canes.setMatrixAt(i, m4); }
  canes.castShadow = true; canes.receiveShadow = true; shelf.add(canes);
  for (const y of [0.5, 1.2, 1.8]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, SX1 - SX0 + 0.7, 8), M.darkWood);
    rail.rotation.z = Math.PI / 2; rail.position.set((SX0 + SX1) / 2, y, SZ - 0.7); shelf.add(rail);
  }
  const shelfTrees = [
    ['pine', 0.52, -5.5, 0.63, SZ + 0.3], ['maple', 0.48, -4.2, 0.63, SZ + 0.3], ['juniper', 0.46, -2.9, 0.63, SZ + 0.3], ['azalea', 0.36, -1.6, 0.63, SZ + 0.3],
    ['wpine', 0.55, -4.9, 0.98, SZ - 0.25], ['zelkova', 0.6, -3.5, 0.98, SZ - 0.25], ['maple', 0.5, -2.1, 0.98, SZ - 0.25],
  ];
  shelfTrees.forEach(([kind, h, x, y, z], i) => {
    const t = makeTree({ kind, seed: 10 + i * 3, height: h, detail: 1.2 });
    t.rotation.y = (r() - 0.5) * 0.6; placeOn(t, x, y, z);
    shelf.add(t);
  });
  add(shelf);
  W.colliders.push({ type: 'rect', x0: SX0 - 0.4, x1: SX1 + 0.4, z0: SZ - 0.9, z1: SZ + 0.65 });
  camBox(SX0 - 0.35, 0, SZ - 0.8, SX1 + 0.35, 2.05, SZ + 0.6);
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.SpotLight('#fff1d6', 45, 14, 0.36, 0.55, 1.6);
    sp.position.set(-5.4 + i * 1.6, 3.4, SZ + 4.2);
    sp.target.position.set(-5.4 + i * 1.6, 0.8, SZ);
    if (i === 1) { sp.castShadow = true; sp.shadow.mapSize.set(512, 512); sp.shadow.bias = -0.002; }
    sp.visible = false; add(sp); add(sp.target); W.night.lights.push(sp);
  }

  // ---------- 東屋（学びの場） ----------
  const AZ = V(9.5, 0, 9.5);
  const az = new THREE.Group(); az.position.copy(AZ);
  az.add(box(3.8, 0.14, 3.8, M.stone, 0, 0.07, 0, 0.04));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    az.add(box(0.16, 2.35, 0.16, M.darkWood, sx * 1.55, 1.25, sz * 1.55));
    W.colliders.push({ type: 'circle', x: AZ.x + sx * 1.55, z: AZ.z + sz * 1.55, r: 0.2 });
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.5, 4, 1, true), M.thatch.clone());
  roof.rotation.y = Math.PI / 4; roof.position.y = 2.42 + 0.75; az.add(shadow(roof));
  az.add(box(0.5, 0.35, 0.5, M.ridge, 0, 3.95, 0, 0.08));
  for (const [x, z, w, d] of [[0, -1.3, 3.0, 0.45], [-1.3, 0, 0.45, 2.1]]) {
    az.add(box(w, 0.06, d, woodM(1, 0.3), x, 0.48, z));
    az.add(box(0.07, 0.42, 0.07, M.darkWood, x - w / 2 + 0.1, 0.27, z));
    az.add(box(0.07, 0.42, 0.07, M.darkWood, x + w / 2 - 0.1, 0.27, z));
    W.colliders.push({ type: 'rect', x0: AZ.x + x - w / 2, x1: AZ.x + x + w / 2, z0: AZ.z + z - d / 2, z1: AZ.z + z + d / 2 });
  }
  const stand = box(0.7, 0.55, 0.45, M.darkWood, 0.6, 0.42, -0.9); az.add(stand);
  const learnTree = makeTree({ kind: 'wpine', seed: 77, height: 0.65, detail: 1.3 }); placeOn(learnTree, 0.6, 0.695, -0.9); az.add(learnTree);
  const scroll = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.15), new THREE.MeshStandardMaterial({
    map: textBoard(['盆栽を', 'まなぶ'], { w: 256, h: 512, size: 72, vertical: true, bg: '#efe6cf' }), roughness: 0.9 }));
  scroll.position.set(-0.5, 1.6, -1.53); az.add(scroll);
  az.add(box(0.72, 0.04, 0.04, M.darkWood, -0.5, 2.2, -1.52));
  add(az);
  W.noGrass.push([AZ.x - 2, AZ.z - 2, AZ.x + 2, AZ.z + 2]);
  roof.material.transparent = true;
  W.fades.push({ x0: AZ.x - 1.9, z0: AZ.z - 1.9, x1: AZ.x + 1.9, z1: AZ.z + 1.9, mats: [roof.material] });

  // ---------- 茶屋と掲示板 ----------
  const TC = V(-9.8, 0, 9.6);
  const tea = new THREE.Group(); tea.position.copy(TC);
  tea.add(box(1.9, 0.08, 0.85, M.felt, 0.3, 0.48, -0.4));
  tea.add(box(1.9, 0.06, 0.85, woodM(1, 0.4), 0.3, 0.43, -0.4));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tea.add(box(0.07, 0.42, 0.07, M.darkWood, 0.3 + sx * 0.85, 0.21, -0.4 + sz * 0.35));
  W.colliders.push({ type: 'rect', x0: TC.x - 0.7, x1: TC.x + 1.3, z0: TC.z - 0.85, z1: TC.z + 0.05 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.5, 8), M.darkWood); pole.position.set(1.4, 1.25, -0.9); tea.add(shadow(pole));
  const umb = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.55, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#b8232b', roughness: 0.8, side: THREE.DoubleSide }));
  umb.position.set(1.4, 2.3, -0.9); tea.add(shadow(umb));
  W.colliders.push({ type: 'circle', x: TC.x + 1.4, z: TC.z - 0.9, r: 0.15 });
  // 掲示板（札には本物の話題の題名が出る＝W.setBoard）
  const bb = new THREE.Group(); bb.position.set(-1.6, 0, -0.6); bb.rotation.y = 0.35; tea.add(bb);
  for (const sx of [-1, 1]) bb.add(box(0.1, 2.1, 0.1, M.darkWood, sx * 0.85, 1.05, 0));
  bb.add(box(1.8, 0.08, 0.36, M.ridge, 0, 2.15, 0, 0.02));
  const bt = boardTexture();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.9 }));
  board.position.set(0, 1.4, 0.06); bb.add(board);
  W.clickables = [{ obj: bb, kind: 'board' }]; // 3Dの掲示板・市の台を押すと、その画面が開く
  W.setBoard = (items) => withFonts(['茶屋の掲示板', ...(items || []).slice(0, 3).map((t) => t.title)], () => { drawBoard(bt.image, items); bt.needsUpdate = true; });
  bb.add(box(1.66, 1.06, 0.06, M.darkWood, 0, 1.4, 0.0));
  W.colliders.push({ type: 'circle', x: TC.x - 1.6, z: TC.z - 0.6, r: 0.9 });
  add(tea);
  camBox(TC.x + 1.4 - 1.5, 2.0, TC.z - 0.9 - 1.5, TC.x + 1.4 + 1.5, 2.6, TC.z - 0.9 + 1.5);

  // ---------- 市の縁側（欲しい木） ----------
  const MC = V(4.9, 0, 12.1);
  const mk = new THREE.Group(); mk.position.copy(MC);
  mk.add(box(3.4, 0.08, 1.0, woodM(2, 0.4), 0, 0.42, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mk.add(box(0.08, 0.4, 0.08, M.darkWood, sx * 1.6, 0.2, sz * 0.42));
  [['maple', 0.48], ['juniper', 0.42], ['azalea', 0.34], ['pine', 0.46]].forEach(([kind, h], i) => {
    const t = makeTree({ kind, seed: 90 + i * 5, height: h }); t.rotation.y = Math.PI + (r() - 0.5) * 0.5; placeOn(t, -1.2 + i * 0.8, 0.46, 0); mk.add(t);
  });
  for (const sx of [-1, 1]) mk.add(box(0.1, 2.3, 0.1, M.darkWood, sx * 1.8, 1.15, 0.6));
  mk.add(box(3.8, 0.08, 0.08, M.darkWood, 0, 2.25, 0.6));
  const noren = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.7), new THREE.MeshStandardMaterial({
    map: textBoard(['縁側の市'], { w: 512, h: 224, size: 96, bg: '#2b3a5e', fg: '#f4efe2' }), roughness: 0.95, side: THREE.DoubleSide }));
  noren.position.set(0, 1.85, 0.6); noren.rotation.y = Math.PI; mk.add(noren);
  // 欲しい木の下げ札（台の手前＝歩いてくる側に下がる。中身は W.setWishes）
  const tags = [];
  for (let i = 0; i < 4; i++) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 196;
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(0.54, 0.33); geo.translate(0, -0.185, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: '#ffd27a', emissiveIntensity: 0, roughness: 0.92, side: THREE.DoubleSide }));
    m.position.set(1.2 - i * 0.8, 0.375, -0.53); m.rotation.y = Math.PI; m.visible = false; // 歩いてくる側から見て、左から新しい順
    m.add(box(0.008, 0.02, 0.008, M.darkWood, 0, -0.01, 0));
    mk.add(m); tags.push({ m, c, tx, ph: r() * 6, until: 0 });
  }
  let tagT = 0;
  W.updaters.push((t) => {
    tagT = t;
    for (const g of tags) {
      g.m.rotation.z = 0.035 * Math.sin(t * 1.1 + g.ph);
      g.m.material.emissiveIntensity = g.until > t ? 0.3 + 0.3 * Math.sin(t * 5) : 0; // 下げたばかりの札を少し光らせる
    }
  });
  W.setWishes = (list) => withFonts((list || []).slice(0, 4).map((w) => `${w.parsed?.species ?? ''}${w.parsed?.budget ?? ''}`), () => tags.forEach((g, i) => {
    const w = list?.[i]; g.m.visible = !!w;
    if (w) { drawTag(g.c, w); g.tx.needsUpdate = true; }
  }));
  W.clickables.push({ obj: mk, kind: 'market' });
  W.flashTag = (i = 0, sec = 5) => { if (tags[i]) tags[i].until = tagT + sec; };
  // 札の少し手前（台の箱の外）。カメラが札を正面から見るときの見る先
  W.tagPos = (i = 0) => mk.localToWorld(new THREE.Vector3(1.2 - i * 0.8, 0.2, -0.75));
  add(mk);
  W.colliders.push({ type: 'rect', x0: MC.x - 1.8, x1: MC.x + 1.8, z0: MC.z - 0.6, z1: MC.z + 0.7 });
  camBox(MC.x - 1.95, 0, MC.z - 0.6, MC.x + 1.95, 2.4, MC.z + 0.75);

  // ---------- 石灯籠 ----------
  const lanterns = [[-4.6, -7.6, true], [6.3, -6.0, false], [7.2, 1.2, true], [-1.6, 6.2, false], [7.6, 11.0, false], [-7.0, 11.6, true], [-6.8, 0.8, false]];
  lanterns.forEach(([x, z, light], i) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r() * 1.5;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.18, 6), M.rock)).position.y = 0.09;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.75, 8), M.rock)).position.y = 0.55;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.12, 6), M.rock)).position.y = 0.98;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), M.rock)).position.y = 1.21;
    for (let k = 0; k < 4; k++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.2), M.lamp);
      win.position.set(Math.sin(k * Math.PI / 2) * 0.172, 1.21, Math.cos(k * Math.PI / 2) * 0.172); win.rotation.y = k * Math.PI / 2; g.add(win);
    }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.32, 6), M.rock); cap.position.y = 1.54; g.add(cap);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), M.rock)).position.y = 1.75;
    shadow(g); add(g);
    W.colliders.push({ type: 'circle', x, z, r: 0.38 });
    if (light) {
      const pl = new THREE.PointLight('#ffb35c', 6, 9, 1.7); pl.position.set(x, 1.25, z); pl.visible = false; add(pl); W.night.lights.push(pl);
    }
  });

  // ---------- 飛び石の道 ----------
  const paths = [
    [[0, 8.6], [0, 4.2], [-0.8, 0.2], [-1.5, -4], [-2, -7.6]],
    [[0, 4.2], [-1.9, 3.7], [-3.5, 3.6]],
    [[0, 4.2], [3, 5.2], [6, 6.4], [8.8, 7.4]],
    [[0, 4.2], [-3.2, 5.7], [-6.6, 6.9], [-9.6, 7.8]],
    [[0, 8.6], [2.4, 9.7], [4.6, 10.3]],
    [[-0.8, 0.2], [3, -0.8], [6.2, -1.3]],
  ];
  const stoneG = [];
  const seen = [];
  for (const pl of paths) for (let s = 0; s < pl.length - 1; s++) {
    const a = V(pl[s][0], 0, pl[s][1]), b = V(pl[s + 1][0], 0, pl[s + 1][1]);
    const n = Math.max(1, Math.round(a.distanceTo(b) / 0.72));
    const side = V(b.z - a.z, 0, a.x - b.x).normalize();
    for (let i = 0; i < n; i++) {
      const p = a.clone().lerp(b, i / n).add(side.clone().multiplyScalar((r() - 0.5) * 0.25));
      if (seen.some((q) => q.distanceTo(p) < 0.5)) continue;
      seen.push(p);
      const g = new THREE.CylinderGeometry(1, 1.05, 1, 14, 1);
      const pp = g.attributes.position;
      const ph1 = r() * 6, ph2 = r() * 6;
      for (let k = 0; k < pp.count; k++) { const a = Math.atan2(pp.getZ(k), pp.getX(k)), f = 1 + 0.11 * Math.sin(3 * a + ph1) + 0.06 * Math.sin(5 * a + ph2); pp.setX(k, pp.getX(k) * f); pp.setZ(k, pp.getZ(k) * f); }
      const sr = 0.24 + r() * 0.1;
      g.scale(sr * (1 + r() * 0.3), 0.09, sr);
      g.rotateY(r() * 6); g.translate(p.x, 0.03, p.z);
      g.computeVertexNormals();
      stoneG.push(g);
    }
  }
  const stones = new THREE.Mesh(mergeGeometries(stoneG), new THREE.MeshStandardMaterial({ map: T.stone, color: '#d9d4c8', roughness: 0.9 }));
  stones.receiveShadow = true; stones.castShadow = true; add(stones);

  // ---------- 庭木・刈込み ----------
  const big = [['pine', 5.5, 4.6, -7.2, 3], ['maple', 4.6, 14.5, 5.8, 5], ['maple', 4.0, -16.0, 7.0, 7], ['maple', 3.6, 6.8, -9.6, 9], ['zelkova', 6.0, -16.5, -13.0, 11], ['pine', 4.4, -14.5, -9.0, 13], ['wpine', 4.2, 16.0, -9.0, 15]];
  big.forEach(([kind, h, x, z, seed]) => {
    const t = makeTree({ kind, seed, height: h, pot: false, detail: mobile ? 3 : 5, tuftScale: 1.6 });
    t.position.set(x, -0.05, z); t.rotation.y = r() * 6; add(t);
    W.colliders.push({ type: 'circle', x, z, r: 0.45 });
  });
  const shrubs = [[-9.5, -8.2, 1.0], [-7.2, -8.3, 0.8], [2.6, -8.3, 0.9], [4.4, -8.2, 0.7], [13.8, -1.0, 1.1], [14.5, -4.5, 0.9], [7.6, 3.1, 0.8], [-12.6, 2.6, 0.9], [-8.2, 3.6, 0.7], [12.5, 10.5, 1.0], [-13.0, 11.0, 0.9], [8.3, 13.3, 0.8], [-3.6, 12.6, 0.9], [16.5, 1.5, 1.2], [-17, -3, 1.2]];
  shrubs.forEach(([x, z, s], i) => {
    for (let k = 0; k < 3; k++) {
      const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position, rr = rng(900 + i * 5 + k);
      const ph = rr() * 6;
      for (let j = 0; j < p.count; j++) { const n = 1 + 0.07 * Math.sin(p.getX(j) * 6 + ph) * Math.sin(p.getZ(j) * 5 + ph); p.setXYZ(j, p.getX(j) * n, p.getY(j) * n, p.getZ(j) * n); }
      g.computeVertexNormals();
      const o = new THREE.Mesh(g, M.shrub);
      const sc = s * (k ? 0.65 : 1);
      o.scale.set(sc, sc * 0.62, sc * 0.9); o.position.set(x + (k ? (k - 1.5) * s * 0.9 : 0), sc * 0.45, z + (k ? 0.2 : 0));
      add(shadow(o));
    }
    W.colliders.push({ type: 'circle', x, z, r: s * 1.1 });
  });
  // 竹林（北東のすみ）
  const bambooN = 46, bam = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.055, 0.065, 8, 8), M.bamboo, bambooN);
  const leafG = new THREE.IcosahedronGeometry(0.9, 1);
  const bamLeaf = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ color: '#5f7d3a', map: T.foliage, roughness: 0.9 }), bambooN * 3);
  for (let i = 0; i < bambooN; i++) {
    const x = 13.5 + r() * 5, z = -19 + r() * 6.5, tilt = (r() - 0.5) * 0.08;
    m4.compose(V(x, 4, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0, (r() - 0.5) * 0.08)), V(1, 1, 1)); bam.setMatrixAt(i, m4);
    for (let k = 0; k < 3; k++) {
      m4.compose(V(x + (r() - 0.5) * 1.2, 6.2 + k * 0.8 + r() * 0.5, z + (r() - 0.5) * 1.2), new THREE.Quaternion(), V(1.2, 0.5, 1.2)); bamLeaf.setMatrixAt(i * 3 + k, m4);
    }
  }
  bam.castShadow = bamLeaf.castShadow = true; add(bam); add(bamLeaf);
  W.colliders.push({ type: 'rect', x0: 13.3, x1: 18.7, z0: -19.5, z1: -12.3 });

  // ---------- 竹垣（まわり）と、垣の外の森 ----------
  const FX0 = -19, FX1 = 19, FZ0 = -20, FZ1 = 15, FH = 1.55;
  const per = [[FX0, FZ0, FX1, FZ0], [FX1, FZ0, FX1, FZ1], [FX1, FZ1, FX0, FZ1], [FX0, FZ1, FX0, FZ0]];
  let slatCount = 0; per.forEach(([a, b, c, d]) => { slatCount += Math.ceil(Math.hypot(c - a, d - b) / 0.09); });
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.085, FH, 0.03), new THREE.MeshStandardMaterial({ color: '#9b8452', map: T.bamboo, roughness: 0.7 }), slatCount);
  const col = new THREE.Color(); let si = 0;
  per.forEach(([a, b, c, d]) => {
    const len = Math.hypot(c - a, d - b), n = Math.ceil(len / 0.09), ang = Math.atan2(d - b, c - a);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      m4.compose(V(a + (c - a) * t, FH / 2, b + (d - b) * t), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -ang), V(1, 1 + (r() - 0.5) * 0.02, 1));
      slats.setMatrixAt(si, m4); col.setHSL(0.11, 0.35, 0.42 + (r() - 0.5) * 0.08); slats.setColorAt(si, col); si++;
    }
    for (const y of [0.35, 0.85, 1.35]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 8), M.darkWood);
      rail.position.set((a + c) / 2, y, (b + d) / 2 + (a === c ? 0 : 0.03)); rail.rotation.set(0, -ang, Math.PI / 2);
      add(rail);
    }
  });
  slats.castShadow = true; slats.receiveShadow = true; add(slats);
  // 垣の外: 丸い樹冠（広葉樹）と、背の高い杉。遠いものほど空の色に寄せる
  const crownParts = [];
  for (const [x, y, z, s] of [[0, 0, 0, 1], [0.7, -0.15, 0.2, 0.72], [-0.65, -0.1, -0.15, 0.76], [0.1, 0.45, -0.3, 0.68], [-0.2, -0.3, 0.6, 0.6]]) {
    let g = new THREE.IcosahedronGeometry(s, 2); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
    const gp2 = g.attributes.position;
    for (let i = 0; i < gp2.count; i++) { const k = 1 + 0.08 * Math.sin(gp2.getX(i) * 7 + x * 3) * Math.sin(gp2.getY(i) * 6 + z * 2); gp2.setXYZ(i, gp2.getX(i) * k, gp2.getY(i) * k, gp2.getZ(i) * k); }
    const uvs = []; for (let i = 0; i < gp2.count; i++) uvs.push(gp2.getX(i) * 0.5 + 0.5, gp2.getY(i) * 0.5 + 0.5);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.translate(x, y, z); crownParts.push(g);
  }
  const crownG = mergeGeometries(crownParts); crownG.computeVertexNormals();
  { const cp = crownG.attributes.position, cn = crownG.attributes.normal, cc = [];
    for (let i = 0; i < cp.count; i++) { const v = 0.55 + 0.45 * (cn.getY(i) * 0.5 + 0.5) + 0.08 * Math.sin(cp.getX(i) * 9) * Math.sin(cp.getZ(i) * 8 + cp.getY(i) * 5); cc.push(v, v, v); }
    crownG.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); }
  const forestN = 64;
  const forest = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 1 }), forestN);
  for (let i = 0; i < forestN; i++) {
    const a = i / forestN * Math.PI * 2 + r() * 0.05, d = 25 + r() * 9, s = 2.6 + r() * 2.6;
    const x = Math.cos(a) * d * 1.05, z = -2.5 + Math.sin(a) * d;
    m4.compose(V(x, s * 0.8 + 1.4, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), r() * 6), V(s, s * (0.85 + r() * 0.3), s)); forest.setMatrixAt(i, m4);
    col.setHSL(0.26 + (r() - 0.5) * 0.07, 0.28 + r() * 0.1, 0.27 + r() * 0.08 + (d - 25) * 0.007, THREE.SRGBColorSpace); forest.setColorAt(i, col);
  }
  forest.receiveShadow = false; add(forest);
  const cedarN = 46;
  const cedarG = mergeGeometries([0, 1, 2, 3].map((k) => { const g = new THREE.ConeGeometry(1 - k * 0.2, 0.42, 10, 1); g.translate(0, 0.21 + k * 0.2, 0); return g; }));
  { const cp = cedarG.attributes.position, cc = []; for (let i = 0; i < cp.count; i++) { const v = 0.7 + 0.3 * cp.getY(i); cc.push(v, v, v); } cedarG.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); }
  const cedar = new THREE.InstancedMesh(cedarG, new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 1 }), cedarN);
  for (let i = 0; i < cedarN; i++) {
    const a = r() * Math.PI * 2, d = 31 + r() * 10, h = 10 + r() * 8;
    const x = Math.cos(a) * d * 1.05, z = -2.5 + Math.sin(a) * d;
    m4.compose(V(x, 2.0, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), r() * 6), V(h * 0.2, h, h * 0.2)); cedar.setMatrixAt(i, m4);
    col.setHSL(0.38 + (r() - 0.5) * 0.04, 0.24, 0.21 + r() * 0.06 + (d - 31) * 0.008, THREE.SRGBColorSpace); cedar.setColorAt(i, col);
  }
  add(cedar);

  // 足もとの草（近くで見たときの密度）。道・建物・池・枯山水を避けて置く
  const bladeTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    for (let k = 0; k < 9; k++) {
      const x0 = 8 + k * 6 + (k % 2) * 2, lean = (k - 4) * 2.2;
      g.fillStyle = `hsl(${88 + k * 3}, 45%, ${44 + (k % 3) * 8}%)`;
      g.beginPath(); g.moveTo(x0 - 2.2, 64); g.quadraticCurveTo(x0 + lean * 0.4, 34, x0 + lean, 6 + (k % 3) * 9); g.quadraticCurveTo(x0 + lean * 0.4 + 1, 34, x0 + 2.2, 64); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const bladeG = mergeGeometries([0, Math.PI / 3, -Math.PI / 3].map((ang) => { const g = new THREE.PlaneGeometry(0.34, 0.2); g.translate(0, 0.1, 0); g.rotateY(ang); return g; }));
  const nearPath = (x, z) => seen.some((q) => Math.hypot(q.x - x, q.z - z) < 0.55);
  const blocked = (x, z) => W.colliders.some((c) => (c.type === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + 0.15
    : c.type === 'rect' ? x > c.x0 - 0.1 && x < c.x1 + 0.1 && z > c.z0 - 0.1 && z < c.z1 + 0.1
      : Math.hypot(x - c.cx, z - c.cz) < c.rf(Math.atan2(z - c.cz, x - c.cx)) + 0.1));
  const tuftN = mobile ? 2200 : 4800;
  const tufts = new THREE.InstancedMesh(bladeG, new THREE.MeshStandardMaterial({ map: bladeTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95 }), tuftN);
  let ti = 0;
  for (let tries = 0; ti < tuftN && tries < tuftN * 6; tries++) {
    const x = FX0 + 0.6 + r() * (FX1 - FX0 - 1.2), z = FZ0 + 0.6 + r() * (FZ1 - FZ0 - 1.2);
    if (nearPath(x, z) || blocked(x, z) || W.noGrass.some(([a, b, c, d]) => x > a && x < c && z > b && z < d)) continue;
    const sc = 0.32 + r() * 0.5;
    m4.compose(V(x, 0, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), r() * 6), V(sc, sc * (0.7 + r() * 0.6), sc)); tufts.setMatrixAt(ti, m4);
    col.setHSL(0.25 + (r() - 0.5) * 0.05, 0.4, 0.42 + (r() - 0.5) * 0.12, THREE.SRGBColorSpace); tufts.setColorAt(ti, col); ti++;
  }
  tufts.count = ti; tufts.receiveShadow = true; add(tufts);
  W.bounds = { x0: FX0 + 0.5, x1: FX1 - 0.5, z0: FZ0 + 0.5, z1: FZ1 - 0.5 };

  // ---------- 見どころ（5か所） ----------
  W.spots = [
    { id: 'engawa', pos: V(-2, 0, -7.9) },
    { id: 'learn', pos: V(9.0, 0, 7.6) },
    { id: 'night', pos: V(-3.5, 0, 3.7) },
    { id: 'board', pos: V(-9.7, 0, 7.9) },
    { id: 'market', pos: V(4.8, 0, 10.5), view: 195 }, // 着いたらカメラを北西に回して、台の手前（札）が見えるように
  ];
  const ringM = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.55, depthWrite: false });
  W.spots.forEach((s) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 48), ringM);
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.pos.x, 0.07, s.pos.z); add(ring); s.ring = ring;
  });
  W.updaters.push((t) => { ringM.opacity = 0.35 + 0.25 * Math.sin(t * 2.2); });

  // 夜の紅葉のライトアップ（下から）
  const up = new THREE.SpotLight('#ffcf9e', 70, 16, 0.55, 0.6, 1.5);
  up.position.set(13.2, 0.3, 3.4); up.target.position.set(14.5, 3.2, 5.8); up.visible = false;
  add(up); add(up.target); W.night.lights.push(up);
  return W;
}

const EN = !/^ja/i.test(navigator.language || 'ja'); // 日本語以外の読み手には、札に英語の要約も出す
const MIN = '"Shippori Mincho","Hiragino Mincho ProN","Yu Mincho","YuMincho",serif';
// 札の字を、ページで読んでいる明朝（Shippori Mincho）で描く。字の分だけ読みこんでから描き直す（読めなければ手元の明朝のまま）
function withFonts(texts, draw) {
  draw();
  const s = texts.join('');
  if (!document.fonts?.load || !s) return;
  Promise.all(['500 22px "Shippori Mincho"', '700 34px "Shippori Mincho"'].map((f) => document.fonts.load(f, s))).then(draw, () => {});
}
const SANS = '"Hiragino Sans","Yu Gothic UI","Noto Sans JP",sans-serif';

// 幅に合わせて行に分ける（日本語・中国語は1字ずつ、ほかの言葉は単語ごと）。入りきらない分は「…」
function wrapLines(g, text, maxW, max) {
  const toks = String(text ?? '').match(/[⺀-鿿豈-﫿＀-￯][、。，．！？」』）]?|[^\s⺀-鿿豈-﫿＀-￯]+|\s+/g) || [];
  const lines = []; let cur = '';
  for (let tk of toks) {
    if (/^\s+$/.test(tk)) { if (cur) cur += ' '; continue; }
    if (g.measureText(cur + tk).width <= maxW) { cur += tk; continue; }
    if (cur.trim()) { lines.push(cur.trim()); cur = ''; }
    while (tk.length > 1 && g.measureText(tk).width > maxW) { // 1語だけで幅を超えるときは字で切る
      let k = tk.length - 1; while (k > 1 && g.measureText(tk.slice(0, k)).width > maxW) k--;
      lines.push(tk.slice(0, k)); tk = tk.slice(k);
    }
    cur = tk;
  }
  if (cur.trim()) lines.push(cur.trim());
  if (lines.length <= max) return lines;
  let last = lines[max - 1]; while (last && g.measureText(last + '…').width > maxW) last = last.slice(0, -1);
  return [...lines.slice(0, max - 1), last + '…'];
}

function boardTexture() {
  const c = document.createElement('canvas'); c.width = 640; c.height = 400;
  drawBoard(c, null);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
// 掲示板の札（新しい話題から3つ）
function drawBoard(c, items) {
  const g = c.getContext('2d');
  g.fillStyle = '#8a6a48'; g.fillRect(0, 0, 640, 400);
  g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < 400; y += 40) g.fillRect(0, y, 640, 2);
  g.textAlign = 'center'; g.font = `700 34px ${MIN}`; g.fillStyle = '#f4efe2'; g.fillText(EN ? 'Tea-house board' : '茶屋の掲示板', 320, 46); g.textAlign = 'left';
  (items || []).slice(0, 3).forEach((t, i) => {
    const x = 30 + i * 205, y = 90 + (i % 2) * 22;
    g.save(); g.translate(x + 87, y + 120); g.rotate((i - 1) * 0.04); g.translate(-(x + 87), -(y + 120));
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 4, y + 5, 175, 240);
    g.fillStyle = '#f6f1e3'; g.fillRect(x, y, 175, 240);
    g.fillStyle = '#c0392b'; g.beginPath(); g.arc(x + 87, y + 14, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2b2420'; g.font = `600 22px ${MIN}`;
    wrapLines(g, t.title, 150, 5).forEach((l, k) => g.fillText(l, x + 13, y + 58 + k * 30));
    g.fillStyle = '#8a7d6b'; g.font = `15px ${SANS}`;
    const lang = (t.posts?.[0]?.lang || '').toUpperCase(), n = t.count ?? t.posts?.length ?? 1;
    g.fillText(EN ? `${lang} · ${n} posts` : `${lang} · ${n}件`, x + 13, y + 224);
    if (t.seed) { g.textAlign = 'right'; g.fillText(EN ? 'Sample' : '見本', x + 162, y + 224); g.textAlign = 'left'; }
    g.restore();
  });
}
// 市の下げ札（樹種・予算・国）。手を挙げた職人がいれば朱の丸に人数
function drawTag(c, w) {
  const g = c.getContext('2d'), cw = c.width, ch = c.height, p = w.parsed || {};
  g.clearRect(0, 0, cw, ch);
  g.fillStyle = '#efe4c8'; g.fillRect(0, 0, cw, ch);
  g.strokeStyle = 'rgba(92,70,44,0.45)'; g.lineWidth = 5; g.strokeRect(6, 6, cw - 12, ch - 12);
  g.fillStyle = '#5a4630'; g.beginPath(); g.arc(cw / 2, 20, 7, 0, Math.PI * 2); g.fill();
  g.textAlign = 'center'; g.fillStyle = '#23211c';
  const sp = String(p.species || (p.summary_ja || '').slice(0, 8) || '欲しい木').replace(/（.*?）|\(.*?\)/g, '');
  let size = 48; do { g.font = `700 ${size}px ${MIN}`; size -= 2; } while (size > 26 && g.measureText(sp).width > cw - 40);
  g.fillText(wrapLines(g, sp, cw - 40, 1)[0] || '', cw / 2, 82);
  if (EN && p.summary_en) {
    g.fillStyle = '#6b3a24'; g.font = `600 19px ${SANS}`;
    wrapLines(g, p.summary_en, cw - 36, 2).forEach((l, k) => g.fillText(l, cw / 2, 114 + k * 24));
    g.fillStyle = '#5b564b'; g.font = `18px ${SANS}`;
    g.fillText(wrapLines(g, w.country || '', cw - 40, 1)[0] || '', cw / 2, 172);
  } else {
    g.fillStyle = '#9a3a26'; g.font = `600 27px ${MIN}`;
    g.fillText(wrapLines(g, p.budget || '', cw - 40, 1)[0] || '', cw / 2, 124);
    g.fillStyle = '#5b564b'; g.font = `21px ${SANS}`;
    g.fillText(wrapLines(g, [w.country, p.size].filter(Boolean).join(' · '), cw - 40, 1)[0] || '', cw / 2, 164);
  }
  const n = w.raised?.length || 0;
  if (n) {
    g.fillStyle = '#b5432f'; g.beginPath(); g.arc(cw - 34, 34, 20, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = `700 22px ${SANS}`; g.fillText(String(n), cw - 34, 42);
  }
  g.textAlign = 'left';
}
