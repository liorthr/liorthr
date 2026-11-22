// Modèle 3D – immeuble de bureaux/commerces, rue Gad Manela, Netanya (zone Poleg)
// Géométrie en plan issue du plan de RDC 1:125 (voir tools/geometry.py).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import G from './geometry.json';

const GF_H = G.meta.gf_h;      // hauteur RDC commercial
const FH = G.meta.fh;          // hauteur d'étage courant (plancher à plancher)
const NF = G.meta.floors;      // nombre d'étages au-dessus du RDC
const CX = 63, CY = 38;        // centre de la scène (m, repère plan)
const P = (x, y, z = 0) => new THREE.Vector3(x - CX, z, -(y - CY));
const levelZ = (k) => (k === 0 ? 0 : GF_H + (k - 1) * FH); // cote du plancher du niveau k

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 4000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 5;
controls.maxDistance = 900;

// ------------------------------------------------------------------ ciel / soleil
const sky = new Sky();
sky.scale.setScalar(3000);
const su = sky.material.uniforms;
su.turbidity.value = 3.5; su.rayleigh.value = 1.4; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.8;
scene.add(sky);
const sunDir = new THREE.Vector3();
const sun = new THREE.DirectionalLight(0xfff3e0, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera; sc.left = -130; sc.right = 130; sc.top = 130; sc.bottom = -130; sc.near = 10; sc.far = 700;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0xb9ab95, 0.9);
scene.add(hemi);
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
const skyScene = new THREE.Scene();
const skyForEnv = new Sky(); skyForEnv.scale.setScalar(1000); skyScene.add(skyForEnv);
// sol neutre dans l'environnement pour que les vitrages reflètent un horizon réaliste
const envGround = new THREE.Mesh(new THREE.CircleGeometry(900, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x8a8174 }));
envGround.position.y = -5; skyScene.add(envGround);

// Netanya : lat 32.3°N. Façade principale (rue Gad Manela) orientée ~sud (flèche nord du plan).
function setSun(hour) {
  const lat = THREE.MathUtils.degToRad(32.3);
  const decl = THREE.MathUtils.degToRad(-20); // fin novembre
  const H = THREE.MathUtils.degToRad((hour - 12) * 15);
  const alt = Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(H));
  let az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)); // depuis le sud, + vers l'ouest
  const elev = Math.max(alt, THREE.MathUtils.degToRad(2));
  // repère scène : -Z = nord, +X = est
  sunDir.set(-Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev));
  su.sunPosition.value.copy(sunDir);
  skyForEnv.material.uniforms.sunPosition.value.copy(sunDir);
  for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG'])
    skyForEnv.material.uniforms[k].value = su[k].value;
  sun.position.copy(sunDir).multiplyScalar(400);
  const warm = THREE.MathUtils.clamp(alt / 0.6, 0, 1);
  sun.color.setHSL(0.09, 0.6 - 0.45 * warm, 0.75 + 0.2 * warm);
  sun.intensity = 0.6 + 2.8 * Math.sin(Math.max(alt, 0.03));
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(skyScene, 0.02);
  scene.environment = envRT.texture;
}

// ------------------------------------------------------------------ textures procédurales
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Mur-rideau : 8 trames de 1.35 m × 1 étage (3.90 m). Profils noirs fins, imposte en partie haute,
// allège vitrée sombre au droit du plancher, ouvrants (châssis à projection) aléatoires – cf. photos.
const CW_W = 1.35, CW_N = 8;
function curtainWallTextures() {
  const W = 1024, H = 512, pw = W / CW_N;
  const layout = [];
  for (let i = 0; i < CW_N; i++) layout.push({ tone: rnd(), vent: rnd() < 0.22, dark: i === 5 });
  const transom = H * (1 - 3.0 / 3.9); // imposte à 3.0 m du plancher (v=0 en bas, canvas inversé)
  const slab = H * (0.4 / 3.9);
  const paint = (mode) => (ctx) => {
    for (let i = 0; i < CW_N; i++) {
      const L = layout[i], x = i * pw;
      if (mode === 'color') {
        const b = 0.92 + L.tone * 0.12;
        const c = L.dark ? [52, 68, 96] : [Math.round(92 * b), Math.round(126 * b), Math.round(170 * b)];
        ctx.fillStyle = `rgb(${c})`; ctx.fillRect(x, 0, pw, H);
        ctx.fillStyle = 'rgb(46,58,80)'; ctx.fillRect(x, H - slab, pw, slab); // allège / nez de dalle
      } else if (mode === 'metal') { ctx.fillStyle = '#fff'; ctx.fillRect(x, 0, pw, H); ctx.fillStyle = '#999'; ctx.fillRect(x, H - slab, pw, slab); }
      else { ctx.fillStyle = '#0b0b0b'; ctx.fillRect(x, 0, pw, H); }
      const frame = mode === 'color' ? '#16181c' : mode === 'metal' ? '#000' : '#a0a0a0';
      ctx.fillStyle = frame;
      ctx.fillRect(x, 0, 5, H);                 // montant
      ctx.fillRect(x, transom - 3, pw, 6);      // traverse d'imposte
      ctx.fillRect(x, H - slab - 3, pw, 6);     // traverse basse
      ctx.fillRect(x, 0, pw, 4);                // traverse de plancher
      if (L.vent) { // ouvrant en partie basse de la vision, cadre plus large
        ctx.lineWidth = 7; ctx.strokeStyle = frame;
        ctx.strokeRect(x + 10, transom + 16, pw - 20, (H - slab - transom) * 0.42);
      }
    }
  };
  return {
    map: canvasTex(W, H, paint('color')),
    metal: canvasTex(W, H, paint('metal'), false),
    rough: canvasTex(W, H, paint('rough'), false),
  };
}
const cwTex = curtainWallTextures();
const matCW = new THREE.MeshPhysicalMaterial({
  map: cwTex.map, metalnessMap: cwTex.metal, roughnessMap: cwTex.rough,
  metalness: 0.62, roughness: 1.0, envMapIntensity: 1.35, clearcoat: 0.5, clearcoatRoughness: 0.03,
});

// Vitrines RDC : grands vitrages toute hauteur (≈2.5 m) + bandeau aluminium gris anthracite
function storefrontTex() {
  return canvasTex(512, 512, (ctx, W, H) => {
    const fascia = H * (1.3 / GF_H);
    ctx.fillStyle = '#8fa3b3'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, fascia, 0, H);
    g.addColorStop(0, '#9fb3c3'); g.addColorStop(0.7, '#7d909f'); g.addColorStop(1, '#5f6e79');
    ctx.fillStyle = g; ctx.fillRect(0, fascia, W, H - fascia);
    ctx.fillStyle = '#3a3d42'; ctx.fillRect(0, 0, W, fascia);
    ctx.fillStyle = '#1b1d20';
    for (let i = 0; i < 2; i++) ctx.fillRect(i * W / 2, fascia, 6, H - fascia);
    ctx.fillRect(0, fascia + (H - fascia) * 0.18, W, 5);
    ctx.fillRect(0, fascia - 4, W, 8); ctx.fillRect(0, H - 8, W, 8);
    // fixations de verre type "spider" (photos de l'angle vitré)
    ctx.fillStyle = '#c9ced3';
    for (let i = 0; i < 2; i++) for (const v of [0.35, 0.75]) {
      ctx.beginPath(); ctx.arc(i * W / 2 + 3, fascia + (H - fascia) * v, 6, 0, 7); ctx.fill();
    }
  });
}
const matStore = new THREE.MeshPhysicalMaterial({ map: storefrontTex(), metalness: 0.25, roughness: 0.1, envMapIntensity: 0.8 });
const matSlab = new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.6, metalness: 0.3 });
const matSoffit = new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.9 });
const matRoof = new THREE.MeshStandardMaterial({ color: 0x9c9a95, roughness: 0.95 });
const matDark = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.7, metalness: 0.2 });
const matCore = new THREE.MeshStandardMaterial({ color: 0x2f3236, roughness: 0.85 });
const matWhite = new THREE.MeshStandardMaterial({ color: 0xf3f2ee, roughness: 0.45, metalness: 0.1 });
const matGrey = new THREE.MeshStandardMaterial({ color: 0x5f646b, roughness: 0.8 });
const matRail = new THREE.MeshPhysicalMaterial({ color: 0xbcd6e6, metalness: 0, roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.45, envMapIntensity: 1.2 });

// Dallage (pierre claire, calepinage diagonal comme au plan)
const paveTex = canvasTex(512, 512, (ctx, W, H) => {
  ctx.fillStyle = '#cdc6b6'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2500; i++) { ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '90,80,70'},0.05)`; ctx.fillRect(rnd() * W, rnd() * H, 3, 3); }
  ctx.strokeStyle = 'rgba(110,100,88,0.45)'; ctx.lineWidth = 2;
  for (let i = -W; i < 2 * W; i += W / 8) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i, H); ctx.lineTo(i + H, 0); ctx.stroke(); }
});
paveTex.repeat.set(1 / 6, 1 / 6);
const matPave = new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.9 });
const asphaltTex = canvasTex(256, 256, (ctx, W, H) => {
  ctx.fillStyle = '#3b3c3e'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 4000; i++) { const v = 40 + rnd() * 50; ctx.fillStyle = `rgb(${v},${v},${v + 2})`; ctx.fillRect(rnd() * W, rnd() * H, 1.5, 1.5); }
});
asphaltTex.repeat.set(1 / 8, 1 / 8);
const matAsphalt = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.95 });
const matGrass = new THREE.MeshStandardMaterial({ color: 0x6f9a3e, roughness: 1 });
const matSand = new THREE.MeshStandardMaterial({ color: 0xb9a582, roughness: 1 });
const matCurb = new THREE.MeshStandardMaterial({ color: 0xd8d6d0, roughness: 0.8 });
const matStripe = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 });

// ------------------------------------------------------------------ helpers géométrie
const signedArea = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const ccw = (r) => (signedArea(r) > 0 ? r : [...r].reverse());
const cw = (r) => (signedArea(r) < 0 ? r : [...r].reverse());

function shapeFrom(poly) {
  const s = new THREE.Shape(ccw(poly.outer).map(([x, y]) => new THREE.Vector2(x - CX, y - CY)));
  for (const h of poly.holes) s.holes.push(new THREE.Path(cw(h).map(([x, y]) => new THREE.Vector2(x - CX, y - CY))));
  return s;
}
// dalle horizontale (face supérieure ou inférieure)
function slabGeo(polys, z, down = false) {
  const geos = polys.map((p) => {
    const g = new THREE.ShapeGeometry(shapeFrom(p), 4);
    g.rotateX(-Math.PI / 2);
    if (down) g.rotateX(Math.PI), g.scale(1, 1, -1); // retourne la normale vers le bas
    g.translate(0, z, 0);
    return g;
  });
  return mergeGeometries(geos);
}
// murs extrudés d'un anneau, UV en mètres (u/uW, v/vH)
function wallGeo(ring, z0, z1, uW, vH, outward = true, offset = 0, uOff = 0) {
  const r = outward ? ccw(ring) : cw(ring);
  const pos = [], uv = [], idx = [];
  let acc = uOff;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 1e-3) continue;
    const nx = dy / L * offset, ny = -dx / L * offset;
    const A = P(a[0] + nx, a[1] + ny), B = P(b[0] + nx, b[1] + ny);
    const n = pos.length / 3;
    pos.push(A.x, z0, A.z, B.x, z0, B.z, B.x, z1, B.z, A.x, z1, A.z);
    const u0 = acc / uW, u1 = (acc + L) / uW;
    uv.push(u0, z0 / vH, u1, z0 / vH, u1, z1 / vH, u0, z1 / vH);
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    acc += L;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function addMesh(geo, mat, cast = true, recv = true, parent = scene) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m;
}

// ------------------------------------------------------------------ sol / contexte urbain
const site = new THREE.Group(); scene.add(site);
const context = new THREE.Group(); scene.add(context);
function flatPoly(pts, y, mat, parent = site, recv = true) {
  const s = new THREE.Shape(pts.map(([x, yy]) => new THREE.Vector2(x - CX, yy - CY)));
  const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  // UV en mètres pour les textures répétées
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[2 * i] = p.getX(i); uv[2 * i + 1] = p.getZ(i); }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return addMesh(g, mat, false, recv, parent);
}
const big = new THREE.Mesh(new THREE.CircleGeometry(1400, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xa9a08e, roughness: 1 }));
big.position.y = -0.25; big.receiveShadow = true; scene.add(big);
// Parcelle et trottoirs (cote +0.00 = +22.80)
flatPoly([[-12, -4.5], [131, -4.5], [136, 2], [136, 84], [126, 84], [-12, 54.7 - 0.209 * 12]], -0.02, matPave);
// Rue Gad Manela (sud) : chaussée + terre-plein central
flatPoly([[-60, -4.6], [200, -4.6], [200, -31], [-60, -31]], -0.12, matAsphalt);
flatPoly([[3, -12.2], [137, -12.2], [137, -14.0], [3, -14.0]], 0.0, matCurb);
flatPoly([[-60, -31], [200, -31], [200, -36], [-60, -36]], -0.04, matPave);
// Rue est (perpendiculaire)
flatPoly([[136.2, -31], [152, -31], [152, 140], [136.2, 140]], -0.11, matAsphalt);
flatPoly([[152, -36], [158, -36], [158, 140], [152, 140]], -0.04, matPave);
// Rue ouest (accès pompiers / parking)
flatPoly([[-30, -4.6], [-12, -4.6], [-12, 60], [-30, 60]], -0.11, matAsphalt);
// Espace vert public au nord (ש.צ.פ)
flatPoly([[-30, 54.7 - 0.209 * 30 + 0.5], [126, 54.7 + 0.209 * 126 + 0.3], [126, 140], [-30, 140]], -0.06, matGrass);
// bande engazonnée le long de la rue (plan : "דשא")
flatPoly([[6, -2.6], [117, -2.6], [117, -1.5], [6, -1.5]], 0.01, matGrass);
// passages piétons : ouest (sur Gad Manela), est
const crossings = [[-11, -5.2, 0], [9, -6, 0], [132.5, -6, 0]];
for (const [x, y] of crossings) for (let i = 0; i < 8; i++)
  flatPoly([[x + i * 1.0, y], [x + i * 1.0 + 0.5, y], [x + i * 1.0 + 0.5, y - 24.5], [x + i * 1.0, y - 24.5]], -0.06, matStripe);
for (let i = 0; i < 6; i++) flatPoly([[136.5, 2 + i], [152, 2 + i], [152, 2.5 + i], [136.5, 2.5 + i]], -0.06, matStripe);
// marquage axial
for (let x = -50; x < 195; x += 6) flatPoly([[x, -21.2], [x + 3, -21.2], [x + 3, -21.05], [x, -21.05]], -0.065, matStripe);

// ------------------------------------------------------------------ BÂTIMENT
const bldg = new THREE.Group(); scene.add(bldg);
// Rez-de-chaussée commercial : vitrines toute hauteur, ±0.00 = +22.80
for (const p of G.gf) {
  addMesh(wallGeo(p.outer, 0, GF_H, 5.0, GF_H, true), matStore, true, true, bldg);
  for (const h of p.holes) addMesh(wallGeo(h, 0, GF_H, 5.0, GF_H, false), matStore, true, true, bldg);
}
addMesh(slabGeo(G.gf, GF_H - 0.05), matRoof, false, true, bldg);
// Rampe d'accès au parking (pente ~14 %)
for (const p of G.ramp) {
  const g = slabGeo([p], -0.05); addMesh(g, matDark, false, true, bldg);
  addMesh(wallGeo(p.outer, -0.05, GF_H, 4, GF_H, true), matGrey, true, true, bldg);
}

// Étages de bureaux en mur-rideau
const floorsGroup = new THREE.Group(); bldg.add(floorsGroup);
G.floors.forEach((polys, i) => {
  const k = i + 1, z0 = levelZ(k), z1 = z0 + FH;
  const grp = new THREE.Group(); grp.name = 'niveau ' + k; floorsGroup.add(grp);
  for (const p of polys) {
    const uo = ((k * 5) % CW_N) * CW_W; // décalage du motif d'un étage à l'autre
    addMesh(wallGeo(p.outer, z0, z1, CW_W * CW_N, FH, true, 0, uo), matCW, true, true, grp);
    for (const h of p.holes) addMesh(wallGeo(h, z0, z1, CW_W * CW_N, FH, false, 0, uo), matCW, true, true, grp);
    // nez de dalle (fin profil sombre, débord 8 cm)
    addMesh(wallGeo(p.outer, z0 - 0.02, z0 + 0.12, 10, 1, true, 0.05), matSlab, false, false, grp);
    for (const h of p.holes) addMesh(wallGeo(h, z0 - 0.02, z0 + 0.12, 10, 1, false, 0.05), matSlab, false, false, grp);
  }
  addMesh(slabGeo(polys, z1 - 0.02), matRoof, false, true, grp);       // dessus (terrasse / toiture)
  addMesh(slabGeo(polys, z0 + 0.01, true), matSoffit, false, true, grp); // sous-face (porte-à-faux)
});

// Garde-corps vitrés des terrasses en gradins et de la toiture
function railGeo(line, z, h = 1.1, t = 0.03) {
  const geos = [];
  for (let i = 0; i < line.length - 1; i++) {
    const a = P(line[i][0], line[i][1], z), b = P(line[i + 1][0], line[i + 1][1], z);
    const L = a.distanceTo(b); if (L < 0.05) continue;
    const g = new THREE.BoxGeometry(L, h, t);
    g.rotateY(-Math.atan2(b.z - a.z, b.x - a.x));
    g.translate((a.x + b.x) / 2, z + h / 2, (a.z + b.z) / 2);
    geos.push(g);
  }
  return geos.length ? mergeGeometries(geos) : null;
}
G.rails.forEach((lines, i) => {
  const z = levelZ(i + 2) - 0.02; // dessus du niveau i+1
  for (const l of lines) {
    const g = railGeo(l, z); if (g) addMesh(g, matRail, false, false, bldg);
    const t = railGeo(l, z + 1.1, 0.05, 0.08); if (t) addMesh(t, matDark, false, false, bldg);
  }
});

// Poteaux (sous la passerelle SE du niveau 1) – gris anthracite, 0.8 × 0.8 m, cf. photos
for (const [x, y] of G.columns) {
  const g = new THREE.BoxGeometry(0.8, GF_H, 0.8); const p = P(x, y, GF_H / 2); g.translate(p.x, GF_H / 2, p.z);
  addMesh(g, matDark, true, true, bldg);
}

// Émergences en toiture : noyaux d'escaliers / ascenseurs (blocs sombres visibles sur les photos)
for (const c of G.cores) {
  const zTop = levelZ(c.floor + 1);
  const h = 4.6;
  const g = new THREE.BoxGeometry(c.s[0], h, c.s[1]);
  if (c.rot) g.rotateY(THREE.MathUtils.degToRad(c.rot));
  const p = P(c.c[0], c.c[1]); g.translate(p.x, zTop + h / 2, p.z);
  addMesh(g, matCore, true, true, bldg);
}

// ------------------------------------------------------------------ résille en losanges (diagrid)
// Façade ouest + angle arrondi SO + retour sur la façade sud, niveaux 1 à 6 (photos 4-5)
function diagrid(path, z0, z1, pitch, rodW, rodD, parent) {
  // abscisse curviligne
  const s = [0]; for (let i = 1; i < path.length; i++) s.push(s[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const S = s[s.length - 1];
  const at = (u) => { // point du parcours à l'abscisse u
    u = THREE.MathUtils.clamp(u, 0, S);
    let i = 1; while (i < s.length - 1 && s[i] < u) i++;
    const t = (u - s[i - 1]) / (s[i] - s[i - 1] || 1);
    return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t];
  };
  const H = z1 - z0;
  const dummy = new THREE.Object3D();
  const segs = [];
  for (const dir of [1, -1]) {
    for (let c = -H; c < S + H; c += pitch) {
      // ligne : u = c + dir*(z-z0) ; découpée en petits tronçons pour suivre la courbe
      const N = Math.ceil(H / 0.9);
      let prev = null;
      for (let j = 0; j <= N; j++) {
        const z = z0 + H * j / N, u = c + dir * (z - z0);
        const inside = u >= 0 && u <= S;
        const pt = inside ? at(u) : null;
        if (prev && pt) segs.push([prev, [pt[0], pt[1], z]]);
        prev = pt ? [pt[0], pt[1], z] : null;
      }
    }
  }
  // cadre haut/bas et montants d'extrémité
  for (let j = 0; j < path.length - 1; j++) for (const z of [z0, z1]) segs.push([[...path[j], z], [...path[j + 1], z]]);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const inst = new THREE.InstancedMesh(geo, matWhite, segs.length);
  segs.forEach(([a, b], i) => {
    const A = P(a[0], a[1], a[2]), B = P(b[0], b[1], b[2]);
    A.y = a[2]; B.y = b[2];
    const L = A.distanceTo(B);
    dummy.position.copy(A).add(B).multiplyScalar(0.5);
    dummy.lookAt(B);
    dummy.scale.set(rodW, rodD, L + rodW * 0.6);
    dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
  });
  inst.castShadow = true; inst.receiveShadow = true;
  parent.add(inst);
  return inst;
}
const diagGroup = new THREE.Group(); bldg.add(diagGroup);
// mur plein gris derrière la résille (photos 4-5) : on habille les niveaux 1-6 de l'aile ouest
{
  const path = G.diag_path;
  // fines fenêtres carrées sur fond gris – texture
  const wallTex = canvasTex(256, 256, (ctx, W, H) => {
    ctx.fillStyle = '#6b6f73'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2e3a48'; ctx.fillRect(W * 0.32, H * 0.3, W * 0.36, H * 0.42);
    ctx.strokeStyle = '#d9dadb'; ctx.lineWidth = 6; ctx.strokeRect(W * 0.32, H * 0.3, W * 0.36, H * 0.42);
  });
  const mWall = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 });
  // surface suivant le parcours de la résille
  const pos = [], uv = [], idx = []; let acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const A = P(a[0], a[1]), B = P(b[0], b[1]); const n = pos.length / 3;
    const z0 = levelZ(1), z1 = levelZ(7);
    pos.push(A.x, z0, A.z, B.x, z0, B.z, B.x, z1, B.z, A.x, z1, A.z);
    uv.push(acc / 4.2, 0, (acc + L) / 4.2, 0, (acc + L) / 4.2, (z1 - z0) / FH, acc / 4.2, (z1 - z0) / FH);
    idx.push(n, n + 2, n + 1, n, n + 3, n + 2); acc += L;
  }
  const gw = new THREE.BufferGeometry(); gw.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  gw.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gw.setIndex(idx); gw.computeVertexNormals();
  const wm = addMesh(gw, mWall, true, true, diagGroup); wm.material.side = THREE.DoubleSide;
  // la résille elle-même, décollée de 0.55 m
  diagrid(path, levelZ(1) - 0.3, levelZ(7), 2.2, 0.14, 0.24, diagGroup);
}
// Local technique en toiture avec résille (photo 1)
{
  const x0 = 60.5, x1 = 68.5, y0 = 6.5, y1 = 14.5;
  const zb = levelZ(G.cores[1].floor + 1);
  const ring = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
  diagrid(ring, zb, zb + 4.6, 1.6, 0.12, 0.16, diagGroup);
}

// ------------------------------------------------------------------ cour intérieure : arbres, kiosques, pavillon
const life = new THREE.Group(); scene.add(life);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4a3a, roughness: 1 });
const leafMats = [0x5f8a3a, 0x4e7a33, 0x6f9840].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true }));
const flowerMat = new THREE.MeshStandardMaterial({ color: 0xe8cf2c, roughness: 0.9, flatShading: true });
const pinkMat = new THREE.MeshStandardMaterial({ color: 0xd9a6c8, roughness: 0.9, flatShading: true });
function tree(x, y, h = 7, r = 2.6, z = 0, mat = null) {
  const g = new THREE.Group();
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, h * 0.55, 7), trunkMat);
  tr.position.y = h * 0.275; tr.castShadow = true; g.add(tr);
  const n = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r * (0.55 + rnd() * 0.35), 1), mat || leafMats[i % 3]);
    m.position.set((rnd() - 0.5) * r * 1.1, h * 0.62 + rnd() * h * 0.3, (rnd() - 0.5) * r * 1.1);
    m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  const p = P(x, y); g.position.set(p.x, z, p.z); life.add(g);
  // fosse d'arbre
  const pit = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.75, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 }));
  pit.position.set(p.x, z + 0.0, p.z); pit.receiveShadow = true; life.add(pit);
  return g;
}
for (const [x, y] of G.trees_street) tree(x, y, 7.5, 2.4);
for (const [x, y] of G.trees_court) tree(x, y, 9, 3.4);
for (const [x, y] of G.trees_plaza) tree(x, y, 6, 2.5, 0, pinkMat);
// arbres à fleurs jaunes sur la terrasse du niveau 1 (photos 2-3)
for (const [x, y] of [[100, 30], [94, 33.5], [106.5, 25.5], [111.5, 20.5], [70, 16]]) {
  tree(x, y, 4.2, 1.6, levelZ(2), flowerMat);
}
// Kiosques en "C" (plan : "דוכן") – comptoirs beige
const kioskMat = new THREE.MeshStandardMaterial({ color: 0xe6d6b0, roughness: 0.7 });
for (const [x, y, a] of G.kiosks) {
  const g = new THREE.Group();
  const parts = [[3.2, 0.4, 0, -1.3], [3.2, 0.4, 0, 1.3], [0.4, 3.0, -1.4, 0]];
  for (const [w, d, ox, oz] of parts) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), kioskMat); b.position.set(ox, 0.55, oz); b.castShadow = true; b.receiveShadow = true; g.add(b);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 3.2), matWhite); roof.position.y = 2.7; roof.castShadow = true; g.add(roof);
  for (const [ox, oz] of [[-1.5, -1.3], [-1.5, 1.3], [1.5, -1.3], [1.5, 1.3]]) {
    const pst = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.7, 0.08), matDark); pst.position.set(ox, 1.35, oz); g.add(pst);
  }
  const p = P(x, y); g.position.set(p.x, 0, p.z); g.rotation.y = THREE.MathUtils.degToRad(a); life.add(g);
}
// Pavillon vitré (accès parking / ascenseurs) au centre de la cour
{
  const { c, s } = G.pavilion; const p = P(c[0], c[1]);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(s[0], 3.4, s[1]), matStore);
  glass.position.set(p.x, 1.7, p.z); glass.rotation.y = THREE.MathUtils.degToRad(-12); glass.castShadow = true; life.add(glass);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(s[0] + 0.6, 0.35, s[1] + 0.6), matDark);
  cap.position.set(p.x, 3.55, p.z); cap.rotation.y = glass.rotation.y; cap.castShadow = true; life.add(cap);
}

// ------------------------------------------------------------------ contexte (voisins schématiques)
const ctxMat = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.9 });
const ctxGlass = new THREE.MeshStandardMaterial({ color: 0xb8c4d0, metalness: 0.2, roughness: 0.5 });
function block(x0, y0, x1, y1, h, mat = ctxMat) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), h, Math.abs(y1 - y0));
  const p = P((x0 + x1) / 2, (y0 + y1) / 2); g.translate(p.x, h / 2, p.z);
  addMesh(g, mat, true, true, context);
}
block(-13.5, 50.5, -2.5, 56.0, 3.5, ctxMat); // construction existante au NO (bloc noir du plan)
block(170, -10, 230, 50, 24, ctxMat);
block(170, 70, 215, 120, 18, ctxMat);
block(-40, -70, 40, -45, 15, ctxMat);
block(60, -80, 130, -48, 32, ctxGlass);
block(150, -90, 175, -55, 72, ctxGlass); // tour de bureaux voisine
// grue à tour (photos 4-5)
{
  const cr = new THREE.Group(); const y = new THREE.MeshStandardMaterial({ color: 0xe8b021, roughness: 0.6 });
  const mast = new THREE.Mesh(new THREE.BoxGeometry(1.6, 58, 1.6), y); mast.position.y = 29; cr.add(mast);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(48, 1.2, 1.2), y); jib.position.set(14, 58, 0); cr.add(jib);
  const cj = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3), matGrey); cj.position.set(-8, 57, 0); cr.add(cj);
  const p = P(-22, 8); cr.position.set(p.x, 0, p.z); cr.rotation.y = 0.5; cr.traverse((o) => (o.castShadow = true)); context.add(cr);
}

// ------------------------------------------------------------------ axes de la trame (repères du plan)
const gridGroup = new THREE.Group(); gridGroup.visible = false; scene.add(gridGroup);
function label(text, pos, color = '#c00') {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(64, 64, 56, 0, 7); ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = color; ctx.stroke();
  ctx.fillStyle = color; ctx.font = 'bold 60px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 64, 68);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  sp.scale.set(3, 3, 1); sp.position.copy(pos); sp.renderOrder = 10; gridGroup.add(sp);
}
{
  const lm = new THREE.LineDashedMaterial({ color: 0xcc0000, dashSize: 1.2, gapSize: 0.6, depthTest: false });
  for (const [k, x] of Object.entries(G.grid_x)) {
    const g = new THREE.BufferGeometry().setFromPoints([P(x, -6, 0.3), P(x, 80, 0.3)]);
    const l = new THREE.Line(g, lm); l.computeLineDistances(); l.renderOrder = 9; gridGroup.add(l);
    label(k, P(x, -8, 1.5));
  }
  for (const [k, y] of Object.entries(G.grid_y)) {
    const g = new THREE.BufferGeometry().setFromPoints([P(-6, y, 0.3), P(133, y, 0.3)]);
    const l = new THREE.Line(g, lm); l.computeLineDistances(); l.renderOrder = 9; gridGroup.add(l);
    label(k, P(-8, y, 1.5));
  }
}

// ------------------------------------------------------------------ vues & UI
const views = {
  'Rue Gad Manela (sud)': { pos: [38, 1.7, -34], look: [56, 18, 10] },
  'Angle SE (cour ouverte)': { pos: [148, 1.8, -16], look: [100, 15, 28] },
  'Angle SO (résille)': { pos: [-26, 1.7, -14], look: [6, 14, 12] },
  'Cour intérieure': { pos: [33, 1.7, 28], look: [90, 14, 33] },
  'Vue aérienne': { pos: [175, 140, -95], look: [63, 10, 38] },
  'Plan (dessus)': { pos: [63, 260, 37.9], look: [63, 0, 38] },
};
function goView(name) {
  const v = views[name]; const p = P(v.pos[0], v.pos[2], v.pos[1]); p.y = v.pos[1];
  const t = P(v.look[0], v.look[2]); t.y = v.look[1];
  camera.position.copy(p); controls.target.copy(t); controls.update();
}
const ui = document.getElementById('views');
for (const n of Object.keys(views)) { const b = document.createElement('button'); b.textContent = n; b.onclick = () => goView(n); ui.appendChild(b); }
document.getElementById('grid').onchange = (e) => (gridGroup.visible = e.target.checked);
document.getElementById('ctx').onchange = (e) => (context.visible = e.target.checked);
document.getElementById('cut').oninput = (e) => {
  const n = +e.target.value; document.getElementById('cutv').textContent = n === NF ? 'tous' : 'jusqu\'au ' + n;
  floorsGroup.children.forEach((g, i) => (g.visible = i < n));
  diagGroup.visible = n >= 6;
};
const hourEl = document.getElementById('hour');
hourEl.oninput = () => { setSun(+hourEl.value); document.getElementById('hourv').textContent = fmtH(+hourEl.value); };
const fmtH = (h) => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const topZ = levelZ(NF + 1);
document.getElementById('stats').innerHTML = `
  Emprise : ≈ ${Math.round(127)} × ${Math.round(76)} m (axes 1→17 / A→J)<br>
  Trame structurelle : 8,10 m<br>
  RDC commercial : ${GF_H.toFixed(2)} m · étages : ${FH.toFixed(2)} m<br>
  R+${NF} · acrotère ≈ ${topZ.toFixed(1)} m (+${(22.8 + topZ).toFixed(1)} NGI)<br>
  Cour intérieure ≈ 1 600 m²`;

setSun(+hourEl.value);
goView('Vue aérienne');
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
window.__ready = true;
window.__goView = goView;
