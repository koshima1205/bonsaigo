// 盆栽と庭木を、その場で組み立てる（幹・枝・葉の雲・葉の粒・鉢）。
// 形の決め方は blender/species.py（8樹種の盆栽）と同じ考え方。単位は「木の高さ約2.2」で作り、最後に縮める。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng, T } from './tex.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// 樹種ごとの形（species.py の座標を、y を上にして写したもの）
export const SPECIES = {
  pine: { bark: '#5a4a3d', trunk: [[0, 0, 0], [0.28, 0.45, 0.05], [-0.18, 0.95, -0.04], [0.22, 1.4, 0.06], [0.02, 1.85, -0.03], [-0.12, 2.2, 0.02]], r0: 0.27,
    branches: [[0.42, -1, 1.15, 0.2], [0.55, 1, 1.0, -0.3], [0.68, -1, 0.85, 0.9], [0.78, 1, 0.75, 0.5], [0.88, -1, 0.55, -0.6]], pad: 0.62, padY: 0.5, top: 0.5,
    tuft: 'needle', col: ['#1e3a1c', '#3f6a2c'], dens: 900, pot: 'rect', potcol: '#5a3a2c' },
  wpine: { bark: '#62584e', trunk: [[0, 0, 0], [0.15, 0.5, 0], [-0.08, 1.0, 0.03], [0.1, 1.5, -0.02], [0, 2.05, 0]], r0: 0.22,
    branches: [[0.35, 1, 1.0, 0.1], [0.48, -1, 0.95, -0.2], [0.6, 1, 0.8, 0.8], [0.7, -1, 0.75, 0.6], [0.8, 1, 0.6, -0.7], [0.9, -1, 0.5, 0.3]], pad: 0.5, padY: 0.55, top: 0.45,
    tuft: 'needle', col: ['#2d4f47', '#5d8a78'], dens: 1000, pot: 'rect', potcol: '#6d655e' },
  juniper: { bark: '#7a4a32', trunk: [[0, 0, 0], [0.35, 0.35, 0.1], [0.05, 0.75, -0.2], [-0.35, 1.05, 0.05], [-0.1, 1.45, 0.2], [0.25, 1.75, 0], [0.05, 2.0, -0.05]], r0: 0.26,
    branches: [[0.45, 1, 1.0, 0.4], [0.62, -1, 0.9, -0.3], [0.78, 1, 0.65, -0.8], [0.9, -1, 0.5, 0.5]], pad: 0.55, padY: 0.6, top: 0.45, shari: true,
    tuft: 'scale', col: ['#2a4f1e', '#5c8a32'], dens: 900, pot: 'rect', potcol: '#6b4a38' },
  maple: { bark: '#6c6a63', trunk: [[0, 0, 0], [0.1, 0.6, 0], [-0.05, 1.2, 0.05], [0.05, 1.75, 0], [0, 2.1, 0]], r0: 0.24,
    branches: [[0.38, -1, 0.95, 0.2], [0.5, 1, 0.95, -0.3], [0.6, -1, 0.85, 0.9], [0.7, 1, 0.8, 0.6], [0.8, -1, 0.65, -0.5], [0.88, 1, 0.55, 0.2]], pad: 0.62, padY: 0.62, top: 0.6,
    tuft: 'leaf', col: ['#9e1a10', '#e8551c'], dens: 700, pot: 'oval', potcol: '#3d5d78' },
  zelkova: { bark: '#6a6152', trunk: [[0, 0, 0], [0, 0.5, 0], [0, 0.9, 0]], r0: 0.24, branches: [], pad: 0, padY: 0.5, top: 0, broom: true,
    tuft: 'oval', col: ['#b07a1a', '#e3b13a'], dens: 600, pot: 'oval', potcol: '#5a3b28' },
  azalea: { bark: '#6e5543', trunk: [[0, 0, 0], [0.18, 0.35, 0.05], [-0.05, 0.75, 0], [0.05, 1.05, 0]], r0: 0.25,
    branches: [[0.55, -1, 0.75, 0.2], [0.65, 1, 0.7, -0.3], [0.8, -1, 0.55, 0.9], [0.9, 1, 0.5, 0.4]], pad: 0.75, padY: 0.65, top: 0.75,
    tuft: 'oval', col: ['#2f5222', '#507a30'], dens: 700, pot: 'round', potcol: '#d8d0bc' },
};

// 先へ行くほど細くなる管
export function taperTube(points, r0, r1, radial = 8, seg = 24, jitter = 0, seed = 1) {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(seg, false);
  const pos = [], uv = [], idx = [];
  const r = rng(seed);
  const len = curve.getLength();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, p = curve.getPointAt(t);
    const rad = r0 + (r1 - r0) * Math.pow(t, 0.8);
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2;
      const n = frames.normals[i].clone().multiplyScalar(Math.cos(a)).add(frames.binormals[i].clone().multiplyScalar(Math.sin(a)));
      const k = 1 + (j % radial === 0 ? 0 : (r() - 0.5) * jitter);
      pos.push(p.x + n.x * rad * k, p.y + n.y * rad * k, p.z + n.z * rad * k);
      uv.push(j / radial, t * len * 1.5);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function lerpPath(pts, t) {
  t = Math.max(0, Math.min(0.999, t)) * (pts.length - 1);
  const i = Math.floor(t);
  return pts[i].clone().lerp(pts[i + 1], t - i);
}

// 葉の1粒（樹種ごと）
const TUFT = {};
function tuftGeo(kind) {
  if (TUFT[kind]) return TUFT[kind];
  let g;
  if (kind === 'needle') {
    const parts = [];
    for (let k = 0; k < 4; k++) {
      const c = new THREE.ConeGeometry(0.012, 0.2, 3, 1); c.translate(0, 0.1, 0);
      c.rotateX(-0.5 + (k % 2) * 0.4); c.rotateY(k * 1.57 + 0.3); parts.push(c);
    }
    g = mergeGeometries(parts);
  } else if (kind === 'scale') {
    const parts = [];
    for (let k = 0; k < 3; k++) { const s = new THREE.IcosahedronGeometry(0.035, 0); s.translate((k - 1) * 0.035, k * 0.02, (k % 2) * 0.03); parts.push(s); }
    g = mergeGeometries(parts);
  } else if (kind === 'leaf') {
    const sh = new THREE.Shape();
    for (let i = 0; i <= 10; i++) {
      const a = i / 10 * Math.PI * 2, rr = i % 2 === 0 ? 0.075 : 0.03;
      const x = Math.sin(a) * rr, y = Math.cos(a) * rr;
      i === 0 ? sh.moveTo(x, y) : sh.lineTo(x, y);
    }
    g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2 + 0.3);
  } else {
    const sh = new THREE.Shape(); sh.absellipse(0, 0, 0.028, 0.055, 0, Math.PI * 2);
    g = new THREE.ShapeGeometry(sh, 6); g.rotateX(-Math.PI / 2 + 0.4);
  }
  return (TUFT[kind] = g);
}

// 葉の雲の芯（でこぼこの玉をつぶしたもの）
function padGeo(r, seed, flat) {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position, rr = rng(seed);
  const ph = [rr() * 6, rr() * 6, rr() * 6];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + 0.12 * Math.sin(x * 5 + ph[0]) * Math.sin(y * 4 + ph[1]) + 0.08 * Math.sin(z * 7 + ph[2]);
    p.setXYZ(i, x * r * n, y * r * n * flat, z * r * n * 0.85);
  }
  g.computeVertexNormals();
  return g;
}

const MAT = {};
function barkMat(hex) {
  const k = 'bark' + hex;
  if (!MAT[k]) { MAT[k] = new THREE.MeshStandardMaterial({ color: hex, map: T.bark, roughness: 0.95 }); }
  return MAT[k];
}

/**
 * 木を1本組む。
 * opts: { kind, seed, height(m), pot(true/false), detail(葉の粒の多さ), tuftScale }
 */
export function makeTree(opts) {
  const S = SPECIES[opts.kind];
  const r = rng(opts.seed || 1);
  const grp = new THREE.Group();
  const wood = [], cores = [], tips = [];
  const trunk = S.trunk.map((p) => V(p[0], p[1], p[2]));
  wood.push(taperTube(trunk, S.r0, 0.05, 10, 28, 0.25, opts.seed));
  // 根張り
  for (let a = 0; a < 6; a++) {
    const ang = a / 6 * Math.PI * 2 + (r() - 0.5) * 0.4, d = V(Math.cos(ang), 0, Math.sin(ang));
    wood.push(taperTube([V(0, 0.12, 0), d.clone().multiplyScalar(S.r0 * 1.2).add(V(0, 0.02, 0)), d.clone().multiplyScalar(S.r0 * 2.1).add(V(0, -0.04, 0))], S.r0 * 0.5, 0.02, 6, 6));
  }
  const pads = [];
  S.branches.forEach(([t, side, length, ang], k) => {
    const base = lerpPath(trunk, t);
    const d = V(side * Math.cos(ang), 0, Math.sin(ang)).normalize();
    const p1 = base.clone().add(d.clone().multiplyScalar(length * 0.4)).add(V(0, 0.06, 0));
    const p2 = base.clone().add(d.clone().multiplyScalar(length * 0.75)).add(V(0, -0.08, 0));
    const p3 = base.clone().add(d.clone().multiplyScalar(length)).add(V(0, -0.02, 0));
    wood.push(taperTube([base, p1, p2, p3], 0.085, 0.02, 6, 12));
    for (let j = 0; j < 3; j++) {
      const a0 = p2.clone().lerp(p3, j / 2);
      const q = a0.clone().add(V((r() - 0.5) * 0.5, r() * 0.08, (r() - 0.5) * 0.5));
      wood.push(taperTube([a0, a0.clone().lerp(q, 0.5).add(V(0, 0.03, 0)), q], 0.025, 0.008, 4, 4));
    }
    pads.push([p3.clone().add(V(0, 0.13, 0)), length * S.pad]);
  });
  if (S.top) pads.push([trunk[trunk.length - 1].clone().add(V(0, 0.18, 0)), S.top]);
  if (S.broom) {
    const top = trunk[trunk.length - 1];
    for (let k = 0; k < 9; k++) {
      const ang = k / 9 * Math.PI * 2, d = V(Math.cos(ang), 0, Math.sin(ang));
      const p1 = top.clone().add(d.clone().multiplyScalar(0.18)).add(V(0, 0.35, 0));
      const p2 = top.clone().add(d.clone().multiplyScalar(0.55)).add(V(0, 0.85, 0));
      const p3 = top.clone().add(d.clone().multiplyScalar(0.85)).add(V(0, 1.25 + (r() - 0.5) * 0.2, 0));
      wood.push(taperTube([top, p1, p2, p3], 0.07, 0.015, 5, 10));
    }
    pads.push([top.clone().add(V(0, 1.1, 0)), 1.0]);
  }
  if (S.shari) {
    wood.push(taperTube(trunk.slice(0, -1).map((p) => p.clone().add(V(0.09, 0, -0.12))), S.r0 * 0.45, 0.03, 6, 20));
  }
  // 葉の雲と、表面にのせる葉の粒
  const tuft = tuftGeo(S.tuft);
  const mats = [];
  const c0 = new THREE.Color(S.col[0]), c1 = new THREE.Color(S.col[1]);
  const detail = opts.detail || 1, ts = opts.tuftScale || 1;
  pads.forEach(([c, s], i) => {
    const n = S.broom ? 7 : 5;
    for (let k = 0; k < n; k++) {
      const off = V((r() - 0.5) * 1.2 * s, (r() - 0.3) * 0.15 * (S.broom ? 4 : 1), (r() - 0.5) * 1.0 * s);
      const rad = s * (0.3 + r() * 0.25);
      const g = padGeo(rad, (opts.seed || 1) * 31 + i * 7 + k, S.padY * 0.8);
      g.translate(c.x + off.x, c.y + off.y, c.z + off.z);
      cores.push(g);
    }
  });
  // 葉の粒を雲の表面に散らす
  const coreGeo = mergeGeometries(cores);
  const cp = coreGeo.attributes.position, cn = coreGeo.attributes.normal;
  const count = Math.round(S.dens * detail * Math.min(2.5, pads.length / 5 + 0.4));
  const inst = new THREE.InstancedMesh(tuft, null, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V(0, 1, 0), col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const vi = (r() * cp.count) | 0;
    const p = V(cp.getX(vi), cp.getY(vi), cp.getZ(vi));
    const n = V(cn.getX(vi), cn.getY(vi), cn.getZ(vi));
    if (n.y < -0.3 && r() < 0.7) { i--; continue; }
    q.setFromUnitVectors(up, n.clone().lerp(up, 0.35).normalize());
    q.multiply(new THREE.Quaternion().setFromAxisAngle(up, r() * Math.PI * 2));
    const sc = (0.8 + r() * 0.7) * ts;
    m4.compose(p.add(n.multiplyScalar(0.01)), q, V(sc, sc, sc));
    inst.setMatrixAt(i, m4);
    col.copy(c0).lerp(c1, r()); col.offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.06);
    inst.setColorAt(i, col);
  }
  inst.material = new THREE.MeshStandardMaterial({ roughness: 0.75, side: THREE.DoubleSide });
  inst.castShadow = true; inst.receiveShadow = true;
  const coreMat = new THREE.MeshStandardMaterial({ color: c0.clone().multiplyScalar(0.3), map: T.foliage, roughness: 0.95 });
  const core = new THREE.Mesh(coreGeo, coreMat); core.castShadow = true; core.receiveShadow = true;
  if (S.broom) core.visible = false;
  const woodMesh = new THREE.Mesh(mergeGeometries(wood), barkMat(S.bark));
  woodMesh.castShadow = true; woodMesh.receiveShadow = true;
  if (S.shari) {
    // 舎利（白く枯れた筋）は最後の管
    const sh = wood.pop(); woodMesh.geometry.dispose();
    woodMesh.geometry = mergeGeometries(wood);
    const shm = new THREE.Mesh(sh, new THREE.MeshStandardMaterial({ color: '#d9d4c9', map: T.bark, roughness: 0.8 }));
    shm.castShadow = true; grp.add(shm);
  }
  grp.add(woodMesh, core, inst);

  // 鉢・土・苔
  if (opts.pot !== false) {
    const pm = new THREE.MeshStandardMaterial({ color: S.potcol, roughness: S.pot === 'rect' ? 0.7 : 0.25, metalness: 0 });
    let pot, soilR;
    if (S.pot === 'rect') {
      pot = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.34, 1.25, 3, 0.05), pm); pot.position.y = -0.17;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.14), pm); f.position.set(sx * 0.78, -0.37, sz * 0.48); grp.add(f);
      }
      soilR = [0.9, 0.58];
    } else {
      const depth = S.pot === 'round' ? 0.42 : 0.26;
      pot = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.88, depth, 48), pm);
      pot.position.y = -depth / 2 + 0.02;
      pot.scale.set(S.pot === 'round' ? 0.85 : 1.2, 1, S.pot === 'round' ? 0.85 : 0.8);
      soilR = S.pot === 'round' ? [0.8, 0.8] : [1.13, 0.75];
    }
    pot.castShadow = true; pot.receiveShadow = true; grp.add(pot);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: '#3a2c20', roughness: 1 }));
    soil.rotation.x = -Math.PI / 2; soil.position.y = 0.02; soil.scale.set(soilR[0], soilR[1], 1); grp.add(soil);
    const mossM = new THREE.MeshStandardMaterial({ color: '#4d6b2a', map: T.moss, roughness: 1 });
    for (let n = 0; n < 12; n++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.06 + r() * 0.06, 8, 5), mossM);
      m.scale.y = 0.3; m.position.set((r() - 0.5) * soilR[0] * 1.4, 0.03, (r() - 0.5) * soilR[1] * 1.3); grp.add(m);
    }
  }
  const s = (opts.height || 0.5) / 2.6;
  grp.scale.setScalar(s);
  grp.userData.kind = opts.kind;
  return grp;
}
