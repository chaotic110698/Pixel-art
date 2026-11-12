// Icônes Stream Deck (144 × 144, pixel art net) pour chaque effet et chaque décor,
// et pack ZIP téléchargeable. Les mêmes icônes sont rangées dans le dossier
// stream-deck/ du dépôt (générées par scripts/make-streamdeck.js).

import { renderText } from '../core/fonts.js';
import { EFFECTS, SCENE_NAMES, createEffects } from './effects.js';
import { encodePNG } from '../export/png.js';
import { makeZip } from '../export/zip.js';
import { slugify } from '../util/dom.js';
import { buildCharacter, DEFAULT_CHARACTER } from '../library/character.js';
import { composeToCanvas } from '../render/compose.js';

const slug = (s) => slugify(String(s).replace(/œ/g, 'oe').replace(/Œ/g, 'Oe').replace(/æ/g, 'ae'));

export const ICON_SIZE = 144;
const N = 24; // grille des icônes d'effets (×6 = 144)

const PAL = {
  r: '#ff3b6b', R: '#e8262e', d: '#a8173a', w: '#ffffff', W: '#d8dcf0', y: '#ffd84a', Y: '#fff3b0', o: '#ff9a2e', O: '#e8402a',
  b: '#59c2ff', B: '#2a7fd4', c: '#bff4ff', k: '#140c10', n: '#ffe9a8', p: '#ff9ccf', P: '#ffc4e1', g: '#b6ff6a', G: '#e9ff8a',
  v: '#b48cff', s: '#f5a26e', S: '#d17255', m: '#743931', h: '#542a2c',
};
// fond de touche par famille d'effets
const BG = { oneshot: ['#2a1d46', '#3d2a66'], ambient: ['#132a3a', '#1d4258'], voice: ['#3a1638', '#5a2357'], transform: ['#2a1420', '#4a2238'] };

function grid() {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const px = (x, y, col) => { g.fillStyle = PAL[col] || col; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const rect = (x, y, w, h, col) => { g.fillStyle = PAL[col] || col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const art = (rows, x, y, k = 1) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') rect(x + i * k, y + j * k, k, k, ch); }));
  const line = (x0, y0, x1, y1, col) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, col);
  };
  const disc = (cx, cy, r, col) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) px(cx + x, cy + y, col); };
  const ring = (cx, cy, r, col) => { for (let a = 0; a < Math.PI * 2; a += 0.04) px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, col); };
  return { c, g, px, rect, art, line, disc, ring };
}

// motifs de base
const HEART = ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
const STAR = ['...w...', '...w...', '..www..', 'wwwwwww', '..www..', '...w...', '...w...'];
const DROP = ['..b..', '.bbb.', 'bbbbb', 'bbcbb', 'bbbbb', '.bbb.'];

const DRAW = {
  confetti(t) {
    const cols = ['r', 'y', 'b', 'g', 'v', 'w', 'o'];
    for (let i = 0; i < 34; i++) { const a = i * 2.39996, r = 3 + (i * 7) % 9; const x = 12 + Math.cos(a) * r, y = 13 + Math.sin(a) * r * 0.9; t.rect(x, y, i % 3 ? 2 : 1, i % 3 ? 1 : 2, cols[i % cols.length]); }
  },
  hearts(t) { t.art(HEART, 3, 5, 2); t.art(['p.p', 'ppp', '.p.'], 18, 3); t.art(['p.p', 'ppp', '.p.'], 1, 17); },
  sparkles(t) { t.art(STAR, 5, 5, 2); t.art(['.y.', 'yyy', '.y.'], 18, 3); t.art(['.y.', 'yyy', '.y.'], 17, 17); t.px(3, 19, 'w'); },
  fireworks(t) {
    const cols = ['r', 'y', 'b', 'p'];
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; for (let r = 3; r <= 9; r += 2) t.px(12 + Math.cos(a) * r, 11 + Math.sin(a) * r, r > 7 ? cols[k % 4] : 'Y'); }
    t.rect(11, 10, 2, 2, 'w'); t.line(12, 22, 12, 19, 'o');
  },
  stars(t) { t.line(3, 20, 15, 8, 'W'); t.line(4, 21, 16, 9, 'c'); t.line(1, 14, 8, 7, 'c'); t.art(STAR, 14, 3, 1); t.px(6, 4, 'w'); t.px(19, 18, 'w'); },
  impact(t) {
    const pts = []; for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, r = k % 2 ? 5 : 11; pts.push([12 + Math.cos(a) * r, 12 + Math.sin(a) * r]); }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) c = !c; } if (c) t.px(x, y, Math.hypot(x - 12, y - 12) < 5 ? 'Y' : 'y'); }
    t.disc(12, 12, 2, 'w');
  },
  bang(t) { t.art(['.kkk.', 'kRRRk', 'kRRRk', 'kRRRk', 'kRRRk', '.kRk.', '..k..', '.kkk.', 'kRRRk', '.kkk.'], 7, 2, 2); },
  quest(t) { t.art(['.www.', 'w...w', '...w.', '..w..', '.....', '..w..'], 5, 3, 3); },
  sweat(t) { t.art(DROP, 7, 4, 2); t.px(10, 9, 'w'); t.px(10, 10, 'w'); },
  vein(t) { t.art(['..R.R..', '..R.R..', 'RRR.RRR', '.......', 'RRR.RRR', '..R.R..', '..R.R..'], 2, 2, 3); },
  tears(t) { t.art(['.b.', 'bcb', 'bbb', '.b.'], 4, 5, 2); t.art(['.b.', 'bcb', 'bbb', '.b.'], 14, 9, 2); t.art(['.b.', 'bbb', '.b.'], 9, 16, 1); },
  lines(t) { for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2 + 0.2; t.line(12 + Math.cos(a) * 15, 12 + Math.sin(a) * 15, 12 + Math.cos(a) * (k % 2 ? 6 : 8), 12 + Math.sin(a) * (k % 2 ? 6 : 8), k % 3 ? 'w' : 'W'); } },
  zzz(t) { const Z = ['www', '..w', '.w.', 'w..', 'www']; t.art(Z, 3, 16, 1); t.art(Z, 8, 9, 2); t.art(['wwww', '...w', '..w.', '.w..', 'wwww'], 15, 1, 2); },
  snow(t) {
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; t.line(12, 12, 12 + Math.cos(a) * 9, 12 + Math.sin(a) * 9, 'w'); t.px(12 + Math.cos(a) * 6 + Math.cos(a + 1) * 2, 12 + Math.sin(a) * 6 + Math.sin(a + 1) * 2, 'c'); t.px(12 + Math.cos(a) * 6 + Math.cos(a - 1) * 2, 12 + Math.sin(a) * 6 + Math.sin(a - 1) * 2, 'c'); }
    t.rect(11, 11, 2, 2, 'c');
  },
  rain(t) { t.rect(4, 4, 16, 4, 'W'); t.rect(6, 2, 8, 2, 'W'); t.rect(5, 8, 14, 1, 'B'); for (const [x, y] of [[6, 11], [11, 13], [16, 11], [8, 17], [14, 18], [18, 16]]) t.line(x, y, x - 1, y + 3, 'b'); },
  petals(t) { for (const [x, y, f] of [[5, 5, 0], [14, 4, 1], [9, 12, 1], [17, 13, 0], [4, 17, 1], [13, 19, 0]]) { t.rect(x, y, f ? 3 : 2, f ? 2 : 3, 'p'); t.px(x, y, 'P'); } },
  fireflies(t) { for (const [x, y] of [[6, 6], [16, 5], [11, 12], [19, 15], [5, 17], [13, 20]]) { t.px(x, y, 'G'); t.g.globalAlpha = 0.5; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) t.px(x + dx, y + dy, 'g'); t.g.globalAlpha = 1; } },
  bubbles(t) { t.ring(9, 13, 6, 'c'); t.px(7, 10, 'w'); t.ring(18, 6, 3, 'c'); t.ring(17, 18, 2, 'c'); },
  flames(t) {
    const layers = [['O', 10, 3], ['o', 8, 6], ['y', 6, 9], ['Y', 3, 12]];
    for (const [c, w, top] of layers) for (let y = top; y < 22; y++) { const k = (y - top) / (22 - top); const hw = Math.round(w * Math.sqrt(k)); t.rect(12 - hw, y, hw * 2, 1, c); }
    t.px(7, 6, 'o'); t.px(17, 8, 'O'); t.px(15, 3, 'o');
  },
  aura(t) {
    t.g.globalAlpha = 0.9; t.disc(12, 9, 6, 'p'); t.rect(4, 15, 16, 9, 'p'); t.g.globalAlpha = 1;
    t.disc(12, 9, 5, 's'); t.rect(5, 16, 14, 8, 'm'); t.rect(10, 13, 4, 3, 's'); t.rect(7, 4, 10, 3, 'h'); t.rect(7, 4, 2, 5, 'h');
    t.px(11, 9, 'k'); t.px(15, 9, 'k'); t.rect(12, 12, 3, 1, 'S');
    for (const [x, y] of [[2, 6], [21, 6], [1, 12], [22, 12]]) t.px(x, y, 'P');
  },
  rainbow(t) { const cols = ['#ff3b3b', '#ff9a2e', '#ffd84a', '#5fd35f', '#59c2ff', '#8a6bff']; cols.forEach((c, i) => { const r = 11 - i; for (let a = Math.PI; a <= Math.PI * 2; a += 0.02) t.px(12 + Math.cos(a) * r, 18 + Math.sin(a) * r, c); }); t.rect(2, 19, 6, 2, 'w'); t.rect(16, 19, 6, 2, 'w'); },
  notes(t) { t.art(['..nnnn', '..n..n', '..n..n', 'nnn.nn', 'nnn.nn'].map((r) => r), 4, 6, 2); t.art(['.n', '.n', 'nn'], 18, 4, 1); },
  squash(t) { t.disc(12, 15, 0, 'w'); t.rect(4, 13, 16, 8, 's'); t.rect(5, 12, 14, 1, 's'); t.rect(3, 21, 18, 1, 'S'); t.rect(8, 15, 2, 2, 'k'); t.rect(14, 15, 2, 2, 'k'); for (const y of [4, 7]) { t.line(5, y, 8, y + 3, 'w'); t.line(19, y, 16, y + 3, 'w'); } },
};

function finish(art, family, scale) {
  // fond arrondi + motif agrandi au plus proche voisin
  const S = ICON_SIZE;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const [a, b] = BG[family] || BG.oneshot;
  const gr = g.createLinearGradient(0, 0, 0, S);
  gr.addColorStop(0, b);
  gr.addColorStop(1, a);
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  g.imageSmoothingEnabled = false;
  const w = art.width * scale, h = art.height * scale;
  g.drawImage(art, Math.round((S - w) / 2), Math.round((S - h) / 2), w, h);
  return c;
}

let sample = null;
/** Personnage d'exemple (64×64) pour les icônes des transformations et tenues. */
function sampleAvatar() {
  if (sample) return sample;
  const doc = buildCharacter({ colors: { skin: '#f5c6a5', hair: '#6b3e26', eyes: '#3b7dd8', clothes: '#4a7bd0', accent: '#f2c94c' }, sel: DEFAULT_CHARACTER });
  sample = document.createElement('canvas');
  sample.width = doc.width; sample.height = doc.height;
  sample.getContext('2d').drawImage(composeToCanvas(doc, {}), 0, 0);
  return sample;
}

/** Icône 144×144 d'un effet (transformation : le personnage d'exemple transformé). */
export function effectIcon(id) {
  const e = EFFECTS.find((x) => x.id === id);
  if (e?.kind === 'transform') {
    const img = sampleAvatar();
    const fx = createEffects({ stage: document.body, back: document.createElement('canvas'), front: document.createElement('canvas'), width: img.width, height: img.height, cfg: () => ({}) });
    const art = fx.transformImage(img, id);
    const stage = fx.transformStage(id);
    if (stage && stage.scene) return stageIcon(fx, img, art, stage);
    return finish(art, 'transform', Math.floor(ICON_SIZE / Math.max(img.width, img.height)));
  }
  const t = grid();
  (DRAW[id] || (() => {}))(t);
  return finish(t.c, e?.kind || 'oneshot', ICON_SIZE / N);
}

/** Icône d'une transformation qui change toute la scène (Plan subtil) : fond, clones, texte. */
function stageIcon(fx, img, art, stage) {
  const S = ICON_SIZE;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(fx.sceneThumb(stage.scene, 48, 48, 2), 0, 0, S, S);
  const sc = 2, w = img.width * sc, h = img.height * sc;
  if (stage.echo) {
    for (const [dx, a, s2] of [[-52, 0.3, 1.5], [52, 0.3, 1.5], [-30, 0.5, 1.75], [30, 0.5, 1.75]]) {
      g.globalAlpha = a;
      g.drawImage(art, Math.round((S - img.width * s2) / 2 + dx), Math.round(S - img.height * s2), img.width * s2, img.height * s2);
    }
    g.globalAlpha = 1;
  }
  g.drawImage(art, Math.round((S - w) / 2), S - h, w, h);
  if (stage.banner) {
    const t = renderText(stage.banner, 'small', { scale: 2 });
    const x0 = Math.round((S - t.w) / 2), y0 = 8;
    g.globalAlpha = 0.75;
    g.fillStyle = '#ffffff';
    for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) if (t.mask[y * t.w + x]) g.fillRect(x0 + x, y0 + y, 1, 1);
    g.globalAlpha = 1;
  }
  return c;
}

/** Icône 144×144 d'un décor (vignette animée figée). */
export function sceneIcon(id) {
  const back = document.createElement('canvas');
  const front = document.createElement('canvas');
  const fx = createEffects({ stage: document.body, back, front, width: 48, height: 48, cfg: () => ({}) });
  const thumb = fx.sceneThumb(id, 48, 48, 3);
  const c = document.createElement('canvas');
  c.width = c.height = ICON_SIZE;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(thumb, 0, 0, ICON_SIZE, ICON_SIZE);
  return c;
}

async function png(canvas) {
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  return encodePNG(new Uint32Array(d.data.buffer), canvas.width, canvas.height);
}

/** Fichiers du pack : [{ name, data }] (+ LISEZMOI avec les touches du projet si fourni). */
export async function streamDeckFiles(doc = null) {
  const files = [];
  const lines = [];
  const keyOf = (k) => (k ? ` — touche : ${String(k).replace(/Maj\+/g, 'Maj+')}` : '');
  for (const [i, e] of EFFECTS.entries()) {
    const name = `effets/${String(i + 1).padStart(2, '0')}_${slug(e.name)}.png`;
    files.push({ name, data: await png(effectIcon(e.id)) });
    lines.push(`${name}  ${e.name}${keyOf(doc?.pngtuber.effects?.keys?.[e.id])}`);
  }
  for (const [id, n] of Object.entries(SCENE_NAMES)) {
    const name = `fonds/${slug(n)}.png`;
    files.push({ name, data: await png(sceneIcon(id)) });
    lines.push(`${name}  ${n}${keyOf(doc?.pngtuber.bgKeys?.[id])}`);
  }
  const readme = [
    'Icônes Stream Deck — Pixel Atelier',
    '',
    'Format : PNG 144 × 144 (Stream Deck, Stream Deck XL et +).',
    'Utilisation : dans le logiciel Stream Deck, ajoutez une action « Raccourci clavier » (Hotkey),',
    'tapez la touche ou la combinaison choisie dans Pixel Atelier (mode PNGtuber > Effets ou Fond),',
    'puis « Définir depuis un fichier » sur l\'icône et choisissez l\'image ci-dessous.',
    'La fenêtre du mode PNGtuber ou de capture doit avoir le focus.',
    '',
    ...lines,
    '',
  ].join('\r\n');
  files.push({ name: 'LISEZMOI.txt', data: readme });
  return files;
}

/** Pack ZIP téléchargeable. */
export async function streamDeckZip(doc = null) {
  return makeZip(await streamDeckFiles(doc));
}
