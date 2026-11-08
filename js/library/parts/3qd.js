// Collection « Portrait détaillé » (3/4, tournée vers la GAUCHE), d'après la deuxième
// image de référence de l'utilisateur : grande tête, chignon, barbe le long de la mâchoire,
// cou ombré, t-shirt brique. Dessinée au pixel près (1 pixel = 1 pixel du gabarit 64×64).
//
// La carte REF reprend l'image (grille de 50, colonnes x 8–43, lignes y 11–49) ; les pièces
// en sont découpées par zones, puis déclinées (états des yeux, de la bouche, des sourcils,
// coiffures, barbes, physiques, vêtements). Placement dans le gabarit : x + OX, y + OY.
//
// Rôles : o contour ; s/M/K/k/l peau (base, ombre douce, ombre, cil, reflet) ;
// h/H/j cheveux ; e/E iris ; m intérieur de bouche ; c/C vêtement ; a/A accessoires ; w blanc.

import { G, Z } from '../builder.js';

export const REF_QD = [
  '.............ooooooo................',
  '..........ooohhhhhhhooo...ooo.......',
  '........oohjhhhhhHHHHHHo.ohjho......',
  '.......ohhjhhhhHHHHhhhhHoojhhho.....',
  '......ohjhjhhHHHhhhhhHHhhohhHHo.....',
  '......ohjhhhHHhhhhhhHhhhhHoHhho.....',
  '.....hoHHHhHoHHoooHHhhhhHHoHHHo.....',
  '.....hoMMMMMMMMMMMohhhhHHHHooo......',
  '....h.ossssssssssMMhhHHHHhHo........',
  '....h.osssssssssssMHHHhhhhHHo.......',
  '...h..jHHsssjHHHHsMhhhhhhHHHo.......',
  '...h..oKKKssMKKKKHMMHHHHHHHHo.......',
  '....h.okEEssskEEeMsshHoooHHHo.......',
  '......oMEeMssMEelssshHossoHHo.......',
  '......ossKMsssssssssjHsKKjHo........',
  '......osMMMsssssssssjHMKMjHo........',
  '......osMsssssssssssjHsKsjo.........',
  '......oMsKKKMssssssMjHssjHo.........',
  '......osjjjjjjjsssMjjHooHo..........',
  '.......oHHHHHHHHssMjhHKoo...........',
  '.......ojMKKKKMHsMjjhHKo............',
  '.......ohssssssjsjjhoKKo............',
  '........osjHHsshhhhoKKMo............',
  '........ohjjjjhhhooKKMMo............',
  '.........ojHjHHooKKKMMMo............',
  '..........oooooKKKMMMMso............',
  '.......oooccoKKKKMMMMssoo...........',
  '.....oocccccoKKKMMMMssssooo.........',
  '....occcccccoMMMMMMssssocCCoo.......',
  '...occccccccoMMMMMssssocccCCCoo.....',
  '...occcccccccoooooooooccccccCCCo....',
  '...occccccccccccccccccccccccccCo....',
  '...occccccccccccccccccccccccccCCo...',
  '...occcccccccccccccccccccccccccCo...',
  '..occcCcccccccccccccccccCCcccccCoo..',
  '..occCCcccccccccccccccccCCcccccCCo..',
  '..occCCcccccccccccccccccCCcccccCCo..',
  '..occCCcccccccccccccccCCCCcccccCCo..',
  '..occCCcccccccccccccccCCCCcccccCCo..',
];
const REF = REF_QD;
export const X0 = 8, Y0 = 11, X1 = 43, Y1 = 49;
export const QD_OFFSET = [7, 14];
const OX = 7, OY = 14;
const at = (x, y) => (y < Y0 || y > Y1 || x < X0 || x > X1 ? '.' : REF[y - Y0][x - X0]);
const SKIN = 'sMKl', HAIR = 'hHj';

/** Grille 64×64 remplie par fn(x, y, ch) en coordonnées de la référence. */
function draw(fn, g = G()) {
  for (let y = 0; y < 64 - OY; y++) for (let x = 0; x < 64 - OX; x++) {
    const r = fn(x, y, at(x, y));
    if (r) g.set(x + OX, y + OY, r);
  }
  return g;
}
const put = (g, x, y, role) => g.set(x + OX, y + OY, role);
const get = (g, x, y) => g.get(x + OX, y + OY);
/** Motif ASCII posé en (x, y) (coordonnées de la référence). */
function stamp(g, rows, x, y) {
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') put(g, x + i, y + j, ch); }));
  return g;
}

// ---------- zones ----------
// oreille : forme exacte de la référence (contour en haut, 3 pixels de large, lobe de 2)
const EAR_ROWS = { 23: [30, 32], 24: [30, 33], 25: [30, 32], 26: [30, 32], 27: [30, 32], 28: [30, 31], 29: [30, 31] };
const EAR = (x, y) => !!EAR_ROWS[y] && x >= EAR_ROWS[y][0] && x <= EAR_ROWS[y][1];
const BUN = (x, y) => (y <= 18 && x >= 35) || (y <= 13 && x >= 32);
const inHair = (x, y) => y <= 18 || (y <= 30 && x >= 26) || (x <= 13 && y <= 24);
// barbe : le long de la mâchoire jusqu'à l'oreille (favoris en x 28–29 sur la ligne 31)
const inBeard = (x, y) => y >= 29 && y <= 36 && (x <= 27 || (y <= 31 && x <= 29));
const isNeck = (x, y) => (y >= 30 && x >= 28) || (y >= 34 && x >= 24) || (y >= 35 && x >= 21);
// zone des yeux et sourcils : peau unie (les variantes y dessinent), sauf les ombres douces
const EYE_ZONE = (x, y) => y >= 21 && y <= 24 && x >= 14 && x <= 25;

// ---------- tête ----------
/** Crâne + visage + mâchoire, limités à la silhouette de la référence (sans cou ni oreille). */
function headMask() {
  const g = G();
  for (let y = 11; y <= 36; y++) for (let x = 13; x <= 35; x++) {
    const ch = at(x, y);
    const inSkull = ((x + 0.5 - 24.5) / 10.2) ** 2 + ((y + 0.5 - 21) / 9.6) ** 2 <= 1;
    // les contours intérieurs des cheveux ('o' dans la masse du crâne) restent du crâne
    const innerO = ch === 'o' && inSkull && (y <= 18 || x >= 26);
    if (ch === '.' || (ch === 'o' && !innerO) || x <= 12 || BUN(x, y) || EAR(x, y) || isNeck(x, y)) continue;
    const face = x >= 15 && y >= 18 && y <= 29 && x <= (y >= 29 ? 29 : 33);
    const jaw = y >= 29 && y <= 35 && x >= 16 && x <= 27 && x - 16 >= (y - 33) * 1.2;
    if (inSkull || face || jaw) put(g, x, y, 's');
  }
  return g;
}
function head() {
  const g = headMask();
  // couleurs de la peau d'origine là où elle est visible ; ombre de l'arrière du crâne
  g.each((X, Y) => {
    const x = X - OX, y = Y - OY;
    if (g.get(X, Y) !== 115) return; // 's'
    const ch = at(x, y);
    if (EYE_ZONE(x, y)) { if (ch === 'M') g.set(X, Y, 'M'); return; }
    if (SKIN.includes(ch) && ch !== 'l') g.set(X, Y, ch);
    else if (x >= 27 && y >= 19) g.set(X, Y, 'M');
  });
  g.outline('o');
  // le contour ne déborde ni hors de la silhouette ni sur le cou (ombré, dessiné par le corps)
  g.each((X, Y) => {
    const x = X - OX, y = Y - OY;
    if (g.get(X, Y) === 111 && (at(x, y) === '.' || (isNeck(x, y) && SKIN.includes(at(x, y))))) g.set(X, Y, null);
  });
  // oreille (côté arrière, à droite)
  draw((x, y, ch) => (EAR(x, y) && (SKIN.includes(ch) || ch === 'o') ? ch : null), g);
  return g;
}

// ---------- cheveux ----------
function hairBase({ bun = true } = {}) {
  const g = draw((x, y, ch) => {
    if (!inHair(x, y) || EAR(x, y)) return null;
    if (!bun && BUN(x, y)) return null;
    if (HAIR.includes(ch) || ch === 'o') return ch;
    return null;
  });
  if (!bun) {
    // referme le contour là où le chignon a été retiré
    for (let y = 11; y <= 19; y++) for (let x = 30; x <= 40; x++) {
      if (get(g, x, y)) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const v = get(g, x + dx, y + dy); return v && v !== 111; });
      if (near) put(g, x, y, 'o');
    }
  }
  return g;
}
function hairLongBack() {
  const g = G();
  const poly = [[26, 14], [36, 13], [39.5, 24], [40, 40], [33, 42], [29, 33], [26, 24]];
  g.poly(poly.map(([x, y]) => [x + OX, y + OY]), 'h');
  g.shade('h', 'H', 1, 0, 2);
  g.each((x, y) => { if (g.get(x, y) === 104 && (x * 7 + y * 3) % 11 === 0) g.set(x, y, 'j'); });
  g.outline('o');
  return g;
}
const HAIRS = [
  { id: 'bun', name: 'Chignon (portrait)', build: () => [{ name: 'Cheveux (chignon, portrait)', z: Z.hairFront, grid: hairBase({ bun: true }) }] },
  { id: 'short', name: 'Courte (portrait)', build: () => [{ name: 'Cheveux (courte, portrait)', z: Z.hairFront, grid: hairBase({ bun: false }) }] },
  {
    id: 'long', name: 'Longue (portrait)',
    build: () => [
      { name: 'Cheveux arrière (longue, portrait)', z: Z.hairBack, grid: hairLongBack() },
      { name: 'Cheveux avant (longue, portrait)', z: Z.hairFront, grid: hairBase({ bun: false }) },
    ],
  },
  {
    id: 'buzz', name: 'Rasée (portrait)',
    build: () => {
      const g = hairBase({ bun: false });
      // seulement le dessus et l'arrière du crâne, très court
      g.each((X, Y) => {
        const x = X - OX, y = Y - OY, v = g.get(X, Y);
        if (!v) return;
        if (x <= 13 && y >= 17) return g.set(X, Y, null);
        if (v !== 111) g.set(X, Y, (x * 5 + y * 3) % 4 ? 'H' : 'h');
      });
      return [{ name: 'Cheveux (rasée, portrait)', z: Z.hairFront, grid: g }];
    },
  },
];

// ---------- barbes ----------
function beardFull() {
  return draw((x, y, ch) => (inBeard(x, y) && (HAIR.includes(ch) || (ch === 'o' && y >= 33 && x >= 16)) ? ch : null));
}
const BEARDS = [
  { id: 'full', name: 'Barbe (portrait)', draw: beardFull },
  { id: 'mustache', name: 'Moustache (portrait)', draw: () => draw((x, y, ch) => (y >= 29 && y <= 30 && x >= 16 && x <= 23 && HAIR.includes(ch) ? ch : null)) },
  {
    id: 'stubble', name: 'Barbe de trois jours (portrait)',
    draw: () => {
      const g = beardFull();
      g.each((x, y) => { const v = g.get(x, y); if (!v) return; if (v === 111 || (x * 3 + y * 5) % 3 === 0) g.set(x, y, null); else g.set(x, y, 'H'); });
      return g;
    },
  },
];

// ---------- yeux (x 15–25, y 22–24 : œil lointain à gauche, proche à droite) ----------
const EYE_STATES = {
  open: ['KKK...KKKKH', 'kEE...kEEe.', 'MEe...MEel.'],
  closed: ['MMM...MMMM.', 'kkk...kkkkk', '...........'],
  happy: ['...........', '.k....kkk..', 'k.k..k...k.'],
  surprised: ['kkk...kkkkk', 'EEe...EEEe.', 'MEM...MEelM'],
};
const EYE_LABELS = [['open', 'ouverts'], ['closed', 'fermés'], ['happy', 'contents'], ['surprised', 'surpris']];

// ---------- sourcils (y 20–22 ; lointain x 14–16, proche x 20–24) ----------
const BROW_STATES = {
  normal: { far: [[14, 21, 'jHH']], near: [[20, 21, 'jHHHH']] },
  high: { far: [[14, 20, 'jHH']], near: [[20, 20, 'jHHHH']] },
  angry: { far: [[14, 21, 'jH'], [16, 22, 'H']], near: [[20, 22, 'jH'], [22, 21, 'HHH']] },
  sad: { far: [[14, 21, 'jH'], [16, 20, 'H']], near: [[20, 20, 'jH'], [22, 21, 'HHH']] },
};
const BROW_LABELS = [['normal', 'normaux'], ['high', 'hauts'], ['angry', 'froncés'], ['sad', 'tristes']];

// ---------- bouche (x 16–23, y 31–33) ----------
const MOUTH_STATES = {
  closed: ['.MKKKKM.', '........', '........'],
  half: ['.MkkkkM.', '..MKKM..', '........'],
  open: ['.kkkkkk.', '.kmmmmk.', '..KKKK..'],
  smile: ['k......k', '.KKKKKK.', '........'],
  sad: ['.KKKKKK.', 'k......k', '........'],
  surprised: ['..kkk...', '.kmmmk..', '..kkk...'],
};
const MOUTH_LABELS = [['closed', 'fermée'], ['half', 'entrouverte'], ['open', 'ouverte'], ['smile', 'sourire'], ['sad', 'triste'], ['surprised', 'surprise']];

// ---------- corps et vêtements ----------
// Le t-shirt est repris tel quel de la référence (contour, encolure, plis, ombre du dos),
// puis élargi ou rétréci par physique en dupliquant / retirant des colonnes intérieures.
export const BODYQD = {
  'qd-fin': { name: 'Fin (portrait)', dl: 2, dr: -2 },
  'qd-moyen': { name: 'Moyen (portrait)', dl: 0, dr: 0 },
  'qd-costaud': { name: 'Costaud (portrait)', dl: -2, dr: 2 },
};
const SHIRT_TOP = 37;
const isShirt = (x, y) => {
  const ch = at(x, y);
  if (y < SHIRT_TOP) return null;
  if ('cC'.includes(ch)) return ch;
  // contour du t-shirt et des épaules
  if (ch === 'o') return 'o';
  return null;
};
/** Ligne y du t-shirt (x0..x1 de la référence) ajustée au physique. */
function shirtRow(t, y) {
  let row = [];
  for (let x = X0; x <= X1; x++) row.push(isShirt(x, y));
  const xs = row.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  if (!xs.length) return { row, from: X0 };
  const l = xs[0], r = xs[xs.length - 1];
  const k = Math.min(1, (y - SHIRT_TOP) / 4); // les épaules s'élargissent vers le bas
  const nl = Math.round(-t.dl * k), nr = Math.round(t.dr * k); // > 0 : élargir
  // côté droit d'abord (les indices du côté gauche restent valables)
  const cr = r - 3;
  if (nr > 0) row.splice(cr, 0, ...Array(nr).fill(row[cr]));
  else if (nr < 0) row.splice(cr + nr + 1, -nr);
  const cl = l + 3;
  let from = X0;
  if (nl > 0) { row.splice(cl, 0, ...Array(nl).fill(row[cl])); from -= nl; }
  else if (nl < 0) { row.splice(cl, -nl); from -= nl; }
  return { row, from };
}
function shirtShape(t) {
  const g = G();
  for (let y = SHIRT_TOP; y <= Y1; y++) {
    const { row, from } = shirtRow(t, y);
    row.forEach((v, i) => { if (v) put(g, from + i, y, v); });
  }
  return g;
}
function neck(g) {
  draw((x, y, ch) => (isNeck(x, y) && y <= 41 && SKIN.includes(ch) && !get(g, x, y) ? ch : null), g);
  // partie cachée sous la mâchoire
  for (let y = 27; y <= 34; y++) for (let x = 22; x <= 30; x++) if (!get(g, x, y)) put(g, x, y, 'K');
  return g;
}
function bust(t) {
  const g = shirtShape(t);
  // torse nu : le tissu devient de la peau (ombre côté dos), sans encolure
  g.each((X, Y) => {
    const x = X - OX, y = Y - OY, v = g.get(X, Y);
    if (v === 99) g.set(X, Y, x >= 33 ? 'M' : 's');
    else if (v === 67) g.set(X, Y, 'M');
    else if (v === 111 && y >= SHIRT_TOP && x >= 20 && x <= 30 && y <= 41) g.set(X, Y, null);
  });
  neck(g);
  g.each((X, Y) => { if (g.get(X, Y) === 111) g.set(X, Y, null); });
  g.outline('o');
  return g;
}
/** Haut ajusté au physique : t-shirt de la référence + détails propres au vêtement. */
function shirt(t, opts = {}) {
  const g = shirtShape(t);
  if (opts.after) opts.after(g);
  // les ajouts dessinés en 'x' reçoivent leur propre contour
  g.outline('o', { only: ['x'] });
  g.recolor('x', 'C');
  return g;
}
const TOPS = [
  { id: 'tshirt', name: 'T-shirt (portrait)', draw: (t) => shirt(t) },
  {
    id: 'hoodie', name: 'Sweat à capuche (portrait)',
    draw: (t) => shirt(t, {
      after: (g) => {
        // capuche repliée derrière la nuque (côté dos), cordons
        for (let y = 34; y <= 40; y++) for (let x = 31; x <= 38; x++) if (((x + 0.5 - 34.5) / 4) ** 2 + ((y + 0.5 - 38.5) / 4) ** 2 <= 1 && !SKIN.includes(at(x, y)) && !(at(x, y) === 'o' && x <= 32)) put(g, x, y, 'x');
        for (let y = 42; y <= 47; y++) { put(g, 22, y, 'a'); put(g, 26, y, 'a'); }
        for (let x = 8; x <= 34; x++) if (get(g, x, 46) === 99) put(g, x, 46, 'C');
      },
    }),
  },
  {
    id: 'sweater', name: 'Pull (portrait)',
    draw: (t) => shirt(t, {
      after: (g) => {
        // col côtelé autour du cou et bas côtelé
        draw((x, y) => (y >= 39 && y <= 41 && x >= 17 && x <= 30 && get(g, x, y) ? ((x % 2) ? 'C' : 'c') : null), g);
        for (let x = 0; x <= 43; x++) if (get(g, x, 49)) put(g, x, 49, x % 2 ? 'C' : 'c');
      },
    }),
  },
  {
    id: 'jacket', name: 'Veste ouverte (portrait)',
    draw: (t) => shirt(t, {
      after: (g) => {
        // t-shirt clair au milieu, revers, bords de la veste
        for (let y = 41; y <= 49; y++) for (let x = 18; x <= 25; x++) if (get(g, x, y)) put(g, x, y, 'w');
        for (let y = 41; y <= 45; y++) { put(g, 17, y, 'C'); put(g, 26, y, 'C'); }
        for (let y = 41; y <= 49; y++) { put(g, 17 - (y > 45 ? 0 : 0), y, 'o'); put(g, 26, y, 'o'); }
      },
    }),
  },
];

// ---------- pièces ----------
const FACING = 'left';
const piece = (p) => ({ view: '3qd', facing: FACING, ...p });

export const headsQD = [piece({
  id: 'head-qd', name: 'Visage (portrait)', category: 'head',
  build: () => [{ name: 'Tête (portrait)', z: Z.head, grid: head() }],
})];

export const hairQD = HAIRS.map((s) => piece({ id: `hair-qd-${s.id}`, name: s.name, category: 'hair', build: s.build }));

export const beardsQD = BEARDS.map((b) => piece({
  id: `beard-qd-${b.id}`, name: b.name, category: 'accessory', sub: 'beard', exclusiveKey: 'beard',
  build: () => [{ name: b.name.replace(' (portrait)', ''), z: Z.beard, grid: b.draw() }],
}));

export const eyesQD = [piece({
  id: 'eyes-qd', name: 'Yeux (portrait)', category: 'eyes',
  build: () => [{
    name: 'Yeux', z: Z.eyes, role: 'eyes',
    variants: EYE_LABELS.map(([state, label]) => ({ name: label, state, grid: stamp(G(), EYE_STATES[state], 15, 22) })),
  }],
})];

export const browsQD = [piece({
  id: 'brows-qd', name: 'Sourcils (portrait)', category: 'brows',
  build: () => [{
    name: 'Sourcils', z: Z.brows, role: 'brows',
    variants: BROW_LABELS.map(([state, label]) => {
      const g = G();
      for (const [x, y, s] of [...BROW_STATES[state].far, ...BROW_STATES[state].near]) stamp(g, [s], x, y);
      return { name: label, state, grid: g };
    }),
  }],
})];

export const mouthsQD = [piece({
  id: 'mouth-qd', name: 'Bouche (portrait)', category: 'mouth',
  build: () => [{
    name: 'Bouche', z: Z.mouth, role: 'mouth',
    variants: MOUTH_LABELS.map(([state, label]) => ({ name: label, state, grid: stamp(G(), MOUTH_STATES[state], 16, 31) })),
  }],
})];

export const bodiesQD = Object.entries(BODYQD).map(([key, t]) => piece({
  id: `body-${key}`, name: t.name, category: 'body', bodyType: key,
  build: () => [{ name: `Corps (${t.name.replace(' (portrait)', '').toLowerCase()}, portrait)`, z: Z.body, grid: bust(t) }],
}));

export const topsQD = TOPS.map((tp) => piece({
  id: `top-qd-${tp.id}`, name: tp.name, category: 'top', fitsBody: true,
  build: (ctx = {}) => {
    const t = BODYQD[ctx.bodyType] || BODYQD['qd-moyen'];
    return [{ name: `Haut (${tp.name.replace(' (portrait)', '').toLowerCase()}, portrait)`, z: Z.top, grid: tp.draw(t) }];
  },
}));

/** Outils et repères partagés avec les pièces complémentaires (3qd-more.js). */
export const QD = {
  OX, OY, at, draw, put, get, stamp, piece, headMask, hairBase, shirt, shirtShape,
  EAR, BUN, inHair, isNeck, SKIN, HAIR, EYE_STATES, EYE_LABELS, BROW_LABELS, MOUTH_LABELS, BODYQD,
};
