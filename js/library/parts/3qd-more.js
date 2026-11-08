// Pièces complémentaires du « Portrait détaillé » (3/4 tourné vers la gauche) :
// accessoires, coiffures, yeux, sourcils, bouche, hauts. Mêmes repères que 3qd.js
// (coordonnées de la référence) : yeux y 22–24 (lointain x 15–17, proche x 21–24),
// sourcils y 21, bouche x 16–23 y 31–33, oreille x 30–32 y 23–29, encolure y 41.

import { G, Z } from '../builder.js';
import { QD } from './3qd.js';

const { at, draw, put, get, stamp, piece, headMask, hairBase, shirt, shirtShape, EAR, isNeck, SKIN, HAIR, EYE_STATES, EYE_LABELS, BROW_LABELS, MOUTH_LABELS, BODYQD, OX, OY } = QD;

/** Applique fn(x, y, v) à chaque pixel non vide (coordonnées de la référence). */
function eachRef(g, fn) {
  g.each((X, Y) => { const v = g.get(X, Y); if (v) fn(X - OX, Y - OY, String.fromCharCode(v), X, Y); });
  return g;
}
/** Remplit une forme (test en coordonnées de la référence). */
function fillRef(g, test, role) {
  for (let y = -OY; y < 64 - OY; y++) for (let x = -OX; x < 64 - OX; x++) if (test(x, y)) put(g, x, y, role);
  return g;
}
const inEll = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
function inPoly(pts) {
  return (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
}
/** Silhouette de la tête (pour ne pas couvrir le visage). */
const SKULL = headMask();
const onHead = (x, y) => !!get(SKULL, x, y);
const FACE = (x, y) => x >= 14 && x <= 27 && y >= 18 && y <= 36;

/** Texture de mèches comme sur la référence : lignes diagonales légèrement courbes,
 * base claire devant, ombrée vers l'arrière et en bas ; boucles en petits anneaux. */
const CURL = ['hjjh', 'jhhH', 'jhhH', 'hHHh'];
function hairTexture(g, { curls = false } = {}) {
  return eachRef(g, (x, y, v) => {
    if (v !== 'h') return;
    if (curls) { put(g, x, y, CURL[((y % 4) + 4) % 4][((x % 4) + 4) % 4]); return; }
    const s = Math.floor(x * 0.9 + y * 0.45 + (x * x) / 60);
    const back = x >= 29 || y >= 26;
    if (back) put(g, x, y, s % 3 === 0 ? 'h' : 'H');
    else put(g, x, y, s % 6 === 0 && y < 17 ? 'j' : s % 3 === 0 ? 'H' : 'h');
  });
}
/** Contour 'o' autour des pixels de cheveux ajoutés (sans déborder sur le visage). */
function outlineHair(g) {
  g.outline('o');
  return eachRef(g, (x, y, v) => { if (v === 'o' && FACE(x, y) && y >= 20 && !HAIR.includes(at(x, y)) && at(x, y) !== 'o') put(g, x, y, null); });
}

// ===================================================================
// Accessoires
// ===================================================================
function glasses({ round = false, dark = false } = {}) {
  const g = G();
  const lens = (x0, x1) => {
    for (let x = x0; x <= x1; x++) { put(g, x, 21, 'p'); put(g, x, 25, 'p'); }
    for (let y = 21; y <= 25; y++) { put(g, x0, y, 'p'); put(g, x1, y, 'p'); }
    if (round) { put(g, x0, 21, null); put(g, x1, 21, null); put(g, x0, 25, null); put(g, x1, 25, null); }
    for (let y = 22; y <= 24; y++) for (let x = x0 + 1; x < x1; x++) put(g, x, y, dark ? 'p' : 'g');
  };
  lens(14, 17); // verre lointain (raccourci par la perspective)
  lens(20, 25); // verre proche
  put(g, 18, 22, 'p'); put(g, 19, 22, 'p'); // pont
  for (let x = 26; x <= 30; x++) put(g, x, 22, 'p'); // branche jusqu'à l'oreille
  if (dark) { put(g, 21, 22, 'l'); put(g, 15, 22, 'l'); }
  return g;
}
function cap() {
  const g = G();
  // calotte sur le haut du crâne, visière vers l'avant (à gauche)
  fillRef(g, (x, y) => y <= 18 && y >= 7 && inEll(x, y, 24.5, 18.5, 12.5, 10.5), 'a');
  fillRef(g, (x, y) => (y === 17 || y === 18) && x >= 6 && x <= 14, 'a');
  eachRef(g, (x, y, v) => {
    if (y === 18 && x <= 14) put(g, x, y, 'y'); // dessous de la visière
    else if (x >= 30 || (x >= 27 && y >= 15)) put(g, x, y, 'A');
    else if (y === 17 && x >= 12) put(g, x, y, 'A'); // bande
  });
  put(g, 24, 7, 'A'); put(g, 25, 7, 'A'); // bouton
  put(g, 18, 11, 'A'); put(g, 21, 9, 'A'); // coutures
  g.outline('o');
  return g;
}
function beanie() {
  const g = G();
  fillRef(g, (x, y) => y <= 19 && y >= 6 && inEll(x, y, 24.5, 19, 13, 12.5), 'a');
  eachRef(g, (x, y) => {
    if (y >= 17) put(g, x, y, x % 2 ? 'A' : 'a'); // bord côtelé
    else if (x >= 31) put(g, x, y, 'A');
    else if ((x + y) % 4 === 0 && y < 15) put(g, x, y, 'A');
  });
  g.outline('o');
  return g;
}
function headset() {
  const g = G();
  // arceau posé sur le haut des cheveux, puis qui descend vers l'oreille proche
  for (let x = 16; x <= 29; x++) {
    let top = 0;
    while (top < 30 && at(x, top) === '.') top++;
    put(g, x, top, 'p'); put(g, x, top + 1, 'p');
  }
  for (let k = 0; k <= 10; k++) { const x = 30 + Math.round(k * 0.15), y = 12 + k; put(g, x, y, 'p'); put(g, x + 1, y, 'p'); }
  // écouteur sur l'oreille
  fillRef(g, (x, y) => inEll(x, y, 31.5, 26, 3.2, 4.2), 'p');
  fillRef(g, (x, y) => inEll(x, y, 31.5, 26, 1.8, 2.6), 'a');
  put(g, 31, 25, 'A'); put(g, 31, 26, 'A');
  // micro vers le coin de la bouche
  for (let x = 23; x <= 29; x++) put(g, x, 29 + Math.round((29 - x) * 0.55), 'p');
  put(g, 21, 33, 'a'); put(g, 22, 33, 'a'); put(g, 21, 34, 'A'); put(g, 22, 34, 'A');
  g.outline('o', { only: ['a', 'A'] });
  return g;
}
const px = (list) => () => { const g = G(); for (const [x, y, r] of list) put(g, x, y, r); return g; };

const ACC = [
  { id: 'glasses', name: 'Lunettes (portrait)', sub: 'glasses', z: Z.glasses, draw: () => glasses() },
  { id: 'glasses-round', name: 'Lunettes rondes (portrait)', sub: 'glasses', z: Z.glasses, draw: () => glasses({ round: true }) },
  { id: 'sunglasses', name: 'Lunettes de soleil (portrait)', sub: 'glasses', z: Z.glasses, draw: () => glasses({ dark: true }) },
  { id: 'cap', name: 'Casquette (portrait)', sub: 'hat', z: Z.hat, draw: cap },
  { id: 'beanie', name: 'Bonnet (portrait)', sub: 'hat', z: Z.hat, draw: beanie },
  { id: 'headset', name: 'Casque micro (portrait)', sub: 'headset', z: Z.hat + 2, draw: headset },
  { id: 'stud', name: 'Clou d\'oreille (portrait)', sub: 'earrings', z: Z.hairFront + 1, draw: px([[31, 28, 'a'], [30, 28, 'l']]) },
  { id: 'hoop', name: 'Anneau d\'oreille (portrait)', sub: 'earrings', z: Z.hairFront + 1, draw: px([[31, 30, 'a'], [30, 31, 'a'], [32, 31, 'A'], [31, 32, 'A']]) },
  {
    id: 'necklace', name: 'Collier (portrait)', sub: 'neck', z: Z.top + 2,
    draw: px([[21, 38, 'a'], [22, 39, 'A'], [23, 39, 'a'], [24, 40, 'A'], [25, 40, 'a'], [26, 40, 'A'], [27, 39, 'a'], [28, 39, 'A'], [29, 38, 'a'], [25, 41, 'a'], [25, 42, 'A']]),
  },
  { id: 'blush', name: 'Joues rosées (portrait)', sub: 'blush', z: Z.blush, draw: px([[21, 26, 'r'], [22, 26, 'r'], [23, 26, 'r'], [22, 27, 'r'], [15, 26, 'r']]) },
  { id: 'freckles', name: 'Taches de rousseur (portrait)', sub: 'blush', z: Z.blush, draw: px([[20, 25, 'K'], [22, 26, 'K'], [24, 25, 'K'], [21, 27, 'K'], [16, 26, 'K'], [19, 27, 'K']]) },
  { id: 'scar', name: 'Cicatrice (portrait)', sub: 'blush', z: Z.blush, draw: px([[25, 24, 'r'], [24, 25, 'K'], [24, 26, 'r'], [23, 27, 'K']]) },
  { id: 'mole', name: 'Grain de beauté (portrait)', sub: 'blush', z: Z.blush, draw: px([[24, 29, 'k']]) },
];
export const accQD = ACC.map((it) => piece({
  id: `acc-qd-${it.id}`, name: it.name, category: 'accessory', sub: it.sub,
  exclusiveKey: it.sub === 'blush' ? null : it.sub === 'headset' ? 'hat' : it.sub,
  build: () => [{ name: it.name.replace(' (portrait)', ''), z: it.z, grid: it.draw() }],
}));

// ===================================================================
// Coiffures
// ===================================================================
/** Frange sur le front (au-dessus des sourcils). */
function fringe(g, { side = false } = {}) {
  fillRef(g, (x, y) => {
    if (!onHead(x, y) || x > 27 || y < 15) return false;
    const bottom = side ? 18 + Math.round((27 - x) / 6) : 19 + ((x * 5) % 3 === 0 ? 1 : 0);
    return y <= Math.min(20, bottom);
  }, 'h');
  return g;
}
const shortBase = () => hairBase({ bun: false });

const MORE_HAIRS = [
  {
    id: 'ponytail', name: 'Queue de cheval (portrait)',
    build: () => {
      const back = G();
      fillRef(back, inPoly([[33.5, 15], [37.5, 14], [39.5, 20], [39, 28], [37, 35], [34.5, 37.5], [35, 30], [34, 22]]), 'h');
      hairTexture(back); back.outline('o');
      const front = shortBase();
      put(front, 34, 15, 'a'); put(front, 35, 15, 'a'); put(front, 34, 16, 'A'); put(front, 35, 16, 'A');
      return [
        { name: 'Cheveux arrière (queue de cheval, portrait)', z: Z.hairBack, grid: back },
        { name: 'Cheveux avant (queue de cheval, portrait)', z: Z.hairFront, grid: front },
      ];
    },
  },
  {
    id: 'long-fringe', name: 'Longue à frange (portrait)',
    build: () => {
      const back = G();
      fillRef(back, inPoly([[23, 11], [35, 11.5], [39.5, 18], [40.5, 30], [41.5, 43], [36, 46], [30.5, 44], [29, 36], [26, 30]]), 'h');
      hairTexture(back); back.outline('o');
      const front = shortBase();
      fringe(front, { side: true });
      // mèches qui retombent devant l'oreille
      fillRef(front, (x, y) => x >= 27 && x <= 33 && y >= 19 && y <= 31 && !isNeck(x, y), 'h');
      hairTexture(front); outlineHair(front);
      return [
        { name: 'Cheveux arrière (longue à frange, portrait)', z: Z.hairBack, grid: back },
        { name: 'Cheveux avant (longue à frange, portrait)', z: Z.hairFront, grid: front },
      ];
    },
  },
  {
    id: 'bob', name: 'Carré (portrait)',
    build: () => {
      const g = shortBase();
      fringe(g);
      fillRef(g, (x, y) => inPoly([[25, 16], [36, 13], [38.5, 22], [37.5, 31], [33.5, 34.5], [27.5, 33.5], [26, 27]])(x, y) && !(isNeck(x, y) && y >= 34), 'h');
      hairTexture(g); outlineHair(g);
      return [{ name: 'Cheveux (carré, portrait)', z: Z.hairFront, grid: g }];
    },
  },
  {
    id: 'curly', name: 'Bouclée (portrait)',
    build: () => {
      const g = shortBase();
      fillRef(g, (x, y) => (inEll(x, y, 25, 15.5, 12.5, 7.5) && y <= 19 && !(FACE(x, y) && y >= 18)) || inEll(x, y, 32.5, 21.5, 5, 7.5), 'h');
      eachRef(g, (x, y) => { if (EAR(x, y)) put(g, x, y, null); });
      hairTexture(g, { curls: true });
      outlineHair(g);
      // contour festonné (boucles)
      eachRef(g, (x, y, v) => { if (v === 'o' && (x + y) % 4 === 0 && y <= 12) put(g, x, y, null); });
      return [{ name: 'Cheveux (bouclée, portrait)', z: Z.hairFront, grid: g }];
    },
  },
  {
    id: 'fringe', name: 'Courte à frange (portrait)',
    build: () => {
      const g = fringe(shortBase());
      hairTexture(g); outlineHair(g);
      return [{ name: 'Cheveux (frange, portrait)', z: Z.hairFront, grid: g }];
    },
  },
];
export const hairQDMore = MORE_HAIRS.map((s) => piece({ id: `hair-qd-${s.id}`, name: s.name, category: 'hair', build: s.build }));

// ===================================================================
// Yeux, sourcils, bouche
// ===================================================================
/** Yeux avec cils (paupière plus marquée, cils au coin extérieur). */
function lashes(state) {
  const g = stamp(G(), EYE_STATES[state], 15, 22);
  eachRef(g, (x, y, v) => { if (y === 22 && v === 'K') put(g, x, y, 'k'); });
  if (state === 'open' || state === 'surprised') { put(g, 25, 21, 'k'); put(g, 25, 22, 'k'); put(g, 14, 22, 'k'); }
  if (state === 'closed') { put(g, 16, 24, 'k'); put(g, 22, 24, 'k'); put(g, 24, 24, 'k'); put(g, 25, 23, 'k'); }
  if (state === 'happy') { put(g, 25, 23, 'k'); }
  return g;
}
const BROWS = {
  thick: {
    normal: [[14, 20, '.jH'], [14, 21, 'jHH'], [20, 20, '.jHHH'], [20, 21, 'jHHHH']],
    high: [[14, 19, '.jH'], [14, 20, 'jHH'], [20, 19, '.jHHH'], [20, 20, 'jHHHH']],
    angry: [[14, 20, 'jH.'], [14, 21, 'jHH'], [16, 22, 'H'], [20, 21, 'jHH'], [20, 22, 'jH'], [22, 20, 'HHH'], [23, 21, 'HH']],
    sad: [[14, 21, 'jH'], [15, 20, 'HH'], [20, 20, 'jHH'], [20, 21, 'jHHHH'], [24, 22, 'H']],
  },
  thin: {
    normal: [[15, 21, 'HH'], [21, 21, 'HHH']],
    high: [[15, 20, 'HH'], [21, 20, 'HHH']],
    angry: [[15, 21, 'H'], [16, 22, 'H'], [21, 22, 'H'], [22, 21, 'HH']],
    sad: [[15, 21, 'H'], [16, 20, 'H'], [21, 20, 'H'], [22, 21, 'HH']],
  },
};
const LIPS = {
  closed: ['.MKKKKM.', '..tttt..', '........'],
  half: ['.MkkkkM.', '..tmmt..', '...tt...'],
  open: ['.kkkkkk.', '.kmmmmk.', '..tttt..'],
  smile: ['k......k', '.KKKKKK.', '..tttt..'],
  sad: ['.KKKKKK.', 'k.tttt.k', '........'],
  surprised: ['..kkk...', '.kmmmk..', '..ttt...'],
};

export const eyesQDMore = [piece({
  id: 'eyes-qd-lashes', name: 'Yeux à cils (portrait)', category: 'eyes',
  build: () => [{ name: 'Yeux', z: Z.eyes, role: 'eyes', variants: EYE_LABELS.map(([state, label]) => ({ name: label, state, grid: lashes(state) })) }],
})];
export const browsQDMore = Object.entries(BROWS).map(([id, states]) => piece({
  id: `brows-qd-${id}`, name: id === 'thick' ? 'Sourcils épais (portrait)' : 'Sourcils fins (portrait)', category: 'brows',
  build: () => [{
    name: 'Sourcils', z: Z.brows, role: 'brows',
    variants: BROW_LABELS.map(([state, label]) => {
      const g = G();
      for (const [x, y, s] of states[state]) stamp(g, [s], x, y);
      return { name: label, state, grid: g };
    }),
  }],
}));
export const mouthsQDMore = [piece({
  id: 'mouth-qd-lips', name: 'Bouche à lèvres (portrait)', category: 'mouth',
  build: () => [{ name: 'Bouche', z: Z.mouth, role: 'mouth', variants: MOUTH_LABELS.map(([state, label]) => ({ name: label, state, grid: stamp(G(), LIPS[state], 16, 31) })) }],
})];

// ===================================================================
// Hauts
// ===================================================================
/** Chemise : col ouvert en V, pointes de col et boutonnière. */
function collared(t) {
  return shirt(t, {
    after: (g) => {
      // V de l'encolure : on laisse voir la peau du torse
      for (let y = 41; y <= 45; y++) for (let x = 20; x <= 30; x++) if (Math.abs(x + 0.5 - 25.5) <= (45.5 - y) * 1.1 && get(g, x, y)) put(g, x, y, null);
      // bords du V
      for (let y = 41; y <= 46; y++) {
        let l = 99, r = -1;
        for (let x = 19; x <= 31; x++) if (!get(g, x, y) && x > 19 && x < 31) { l = Math.min(l, x); r = Math.max(r, x); }
        if (r >= 0 && y <= 45) { put(g, l - 1, y, 'o'); put(g, r + 1, y, 'o'); } else if (y === 46) put(g, 25, y, 'o');
      }
      // pointes de col
      for (const [x, y] of [[20, 40], [21, 41], [22, 42], [21, 42], [22, 43], [29, 40], [28, 41], [27, 42], [28, 42], [27, 43]]) put(g, x, y, 'x');
      // boutonnière
      for (let y = 46; y <= 49; y++) put(g, 25, y, 'C');
      put(g, 26, 47, 'w'); put(g, 26, 49, 'w');
    },
  });
}
/** Débardeur : épaules nues, large encolure. */
function tank(t) {
  const base = shirtShape(t);
  const g = G();
  eachRef(base, (x, y, v) => {
    if (v === 'o') return;
    const arm = x <= 14 + (y >= 44 ? 0 : 1) || x >= 33;
    const scoop = y <= 43 && x >= 19 && x <= 31;
    if (!arm && !scoop) put(g, x, y, v);
  });
  g.outline('o');
  return g;
}
/** Col roulé : tube côtelé autour du bas du cou. */
function turtleneck(t) {
  return shirt(t, {
    after: (g) => {
      for (let y = 36; y <= 41; y++) for (let x = 20; x <= 31; x++) {
        const neckSkin = isNeck(x, y) && SKIN.includes(at(x, y));
        if (neckSkin || (y === 41 && x <= 30) || (y >= 37 && x === 20)) put(g, x, y, x >= 28 ? 'C' : (x % 3 === 0 ? 'C' : 'c'));
      }
      // contour du haut du col et du côté avant
      for (let x = 20; x <= 31; x++) if (get(g, x, 36) && !get(g, x, 35)) put(g, x, 35, 'o');
      for (let y = 36; y <= 40; y++) if (get(g, 20, y)) put(g, 19, y, 'o');
    },
  });
}
const MORE_TOPS = [
  { id: 'collared', name: 'Chemise (portrait)', draw: collared },
  { id: 'tank', name: 'Débardeur (portrait)', draw: tank },
  { id: 'turtleneck', name: 'Col roulé (portrait)', draw: turtleneck },
];
export const topsQDMore = MORE_TOPS.map((tp) => piece({
  id: `top-qd-${tp.id}`, name: tp.name, category: 'top', fitsBody: true,
  build: (ctx = {}) => {
    const t = BODYQD[ctx.bodyType] || BODYQD['qd-moyen'];
    return [{ name: `Haut (${tp.name.replace(' (portrait)', '').toLowerCase()}, portrait)`, z: Z.top, grid: tp.draw(t) }];
  },
}));

void draw;
