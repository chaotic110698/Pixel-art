// Visage en vue de 3/4 (droite) : yeux, sourcils, nez, bouches et barbes.
// L'œil proche (gauche) est plus large que l'œil lointain, près du profil.
// Les états reprennent ceux de la vue de face (reconnus par le PNGtuber).

import { Grid, G, Z, place } from '../../builder.js';
import { EYE_STATES } from '../eyes.js';
import { BROW_STATES } from '../brows.js';
import { MOUTH_STATES } from '../mouths.js';
import { texture, hash } from './common.js';
import { headSilhouette } from './heads.js';

/** Deux motifs (œil/sourcil proche et lointain) dans une grille 64×64. */
function duo(near, far, nx, ny, fx, fy) {
  const g = G();
  g.stamp(Grid.from(near), nx, ny);
  g.stamp(Grid.from(far), fx, fy);
  return g;
}

// ---------- Yeux ----------
const EYES = [
  {
    id: 'small', name: 'Petits (3/4)', near: [33, 23], far: [41, 23],
    states: {
      open: [['pppp', 'wwEp'], ['ppp', 'wEp']],
      closed: [['....', 'pppp'], ['...', 'ppp']],
      happy: [['.pp.', 'p..p'], ['.p.', 'p.p']],
      surprised: [['.pp.', 'pwEp', '.pp.'], ['pp', 'Ep', 'pp']],
    },
  },
  {
    id: 'heavy', name: 'Paupières lourdes (3/4)', near: [32, 23], far: [41, 23],
    states: {
      open: [['.pppp', 'pwwEp', '..SS.'], ['ppp', 'wEp', '.S.']],
      closed: [['.....', 'ppppp', '..SS.'], ['...', 'ppp', '.S.']],
      happy: [['..pp.', '.p..p', '.....'], ['.p.', 'p.p', '...']],
      surprised: [['.ppp.', 'pwwEp', '.ppp.'], ['.pp', 'wEp', '.pp']],
    },
  },
  {
    id: 'big', name: 'Grands (3/4)', near: [32, 22], far: [41, 22],
    states: {
      open: [['.ppp.', 'pwEEp', 'pwElp', 'pwEEp', '.ppp.'], ['.pp', 'pEp', 'pEl', 'pEp', '.pp']],
      closed: [['.....', '.....', '.....', 'p...p', '.ppp.'], ['...', '...', '...', 'p.p', '.p.']],
      happy: [['.....', '.ppp.', 'p...p', '.....', '.....'], ['...', '.p.', 'p.p', '...', '...']],
      surprised: [['.ppp.', 'pwwwp', 'pwEwp', 'pwwwp', '.ppp.'], ['.pp', 'pwp', 'pEp', 'pwp', '.pp']],
    },
  },
  {
    id: 'almond', name: 'Amande (3/4)', near: [32, 23], far: [41, 23],
    states: {
      open: [['.pppp', 'pwEEp', '.ppp.'], ['ppp', 'wEp', '.p.']],
      closed: [['.....', 'ppppp', '.....'], ['...', 'ppp', '...']],
      happy: [['.ppp.', 'p...p', '.....'], ['.p.', 'p.p', '...']],
      surprised: [['.ppp.', 'pwEwp', '.ppp.'], ['.p.', 'pEp', '.p.']],
    },
  },
  {
    id: 'dots', name: 'Points (3/4)', near: [34, 23], far: [42, 23],
    states: {
      open: [['pp', 'pp', '..'], ['p', 'p', '.']],
      closed: [['..', 'pp', '..'], ['.', 'p', '.']],
      happy: [['pp', '..', '..'], ['p', '.', '.']],
      surprised: [['pp', 'pp', 'pp'], ['p', 'p', 'p']],
    },
  },
];

const eyes = EYES.map((s) => ({
  id: `eyes-3q-${s.id}`,
  name: s.name,
  category: 'eyes',
  view: '3q',
  build: () => [{
    name: 'Yeux',
    z: Z.eyes,
    role: 'eyes',
    variants: EYE_STATES.map(([state, label]) => ({ name: label, state, grid: duo(...s.states[state], ...s.near, ...s.far) })),
  }],
}));

// ---------- Sourcils ----------
const BROWS = [
  {
    id: 'thick', name: 'Épais (3/4)', near: [31, 19], far: [41, 19],
    states: {
      normal: [['...', '.qqqq', 'qqqqq'], ['...', 'qqq.', 'qqqq']],
      high: [['.qqqq', 'qqqqq', '.....'], ['qqq.', 'qqqq', '....']],
      angry: [['qq...', 'qqqq.', '..qqq'], ['..qq', '.qqq', 'qq..']],
      sad: [['...qq', '.qqqq', 'qqq..'], ['qq..', 'qqq.', '..qq']],
    },
  },
  {
    id: 'thin', name: 'Fins (3/4)', near: [32, 19], far: [41, 19],
    states: {
      normal: [['....', '....', 'qqqq'], ['...', '...', 'qqq']],
      high: [['qqqq', '....', '....'], ['qqq', '...', '...']],
      angry: [['....', 'qq..', '..qq'], ['...', '.qq', 'q..']],
      sad: [['....', '..qq', 'qq..'], ['...', 'qq.', '..q']],
    },
  },
  {
    id: 'bushy', name: 'Broussailleux (3/4)', near: [31, 18], far: [41, 18],
    states: {
      normal: [['......', '.q.q.q', 'qqqqqq', 'qqqqq.'], ['....', 'q.q.', 'qqqq', 'qqq.']],
      high: [['.q.q.q', 'qqqqqq', 'qqqqq.', '......'], ['q.q.', 'qqqq', 'qqq.', '....']],
      angry: [['q.....', 'qqq.q.', 'qqqqqq', '...qqq'], ['...q', '.qqq', 'qqqq', 'qq..']],
      sad: [['.....q', '..qqqq', 'qqqqq.', 'qqq...'], ['q...', 'qqq.', 'qqqq', '..qq']],
    },
  },
];

const brows = BROWS.map((s) => ({
  id: `brows-3q-${s.id}`,
  name: s.name,
  category: 'brows',
  view: '3q',
  build: () => [{
    name: 'Sourcils',
    z: Z.brows,
    role: 'brows',
    variants: BROW_STATES.map(([state, label]) => ({ name: label, state, grid: duo(...s.states[state], ...s.near, ...s.far) })),
  }],
}));

// ---------- Nez (dépasse du profil, côté droit) ----------
const NOSES = [
  { id: 'straight', name: 'Droit (3/4)', x: 43, y: 24, rows: ['....s.', '....sk', '....sk', '....ssk', '...Sssk', '..SSkk.', '...kk..'] },
  { id: 'strong', name: 'Fort (3/4)', x: 43, y: 23, rows: ['....s..', '....sk.', '....ssk', '....ssk', '....sssk', '..Sssssk', '..SSSSkk', '...kkkk.'] },
  { id: 'small', name: 'Retroussé (3/4)', x: 43, y: 25, rows: ['....s.', '....sk', '....ssk', '..SSssk', '...kkk.'] },
  { id: 'pointy', name: 'Pointu (3/4)', x: 43, y: 24, rows: ['....s..', '....sk.', '....ssk', '....sssk', '...Sssssk', '..SSkkkk.', '...k.....'] },
];

const noses = NOSES.map((n) => ({
  id: `nose-3q-${n.id}`,
  name: n.name,
  category: 'nose',
  view: '3q',
  build: () => [{ name: `Nez (${n.name.replace(' (3/4)', '').toLowerCase()}, 3/4)`, z: Z.nose, grid: place(n.rows, n.x, n.y) }],
}));

// ---------- Bouches (décalées vers le profil) ----------
const MOUTHS = [
  {
    id: 'simple', name: 'Simple (3/4)', x: 37, y: 33,
    states: {
      closed: ['........', '...ppppp', '........', '........'],
      half: ['...pppp.', '..pmmmmp', '...pppp.', '........'],
      open: ['...ppppp', '..pmmmmp', '..pmttp.', '...ppp..'],
      smile: ['..p....p', '...pppp.', '........', '........'],
      sad: ['...pppp.', '..p....p', '........', '........'],
      surprised: ['....pp..', '...pmmp.', '...pmmp.', '....pp..'],
    },
  },
  {
    id: 'line', name: 'Trait (3/4)', x: 37, y: 33,
    states: {
      closed: ['........', '....pppp', '........', '........'],
      half: ['........', '....pppp', '....mmmp', '........'],
      open: ['....pppp', '...pmmmp', '...pTTp.', '....pp..'],
      smile: ['...p....', '....pppp', '........', '........'],
      sad: ['........', '....pppp', '...p....', '........'],
      surprised: ['.....pp.', '....pmmp', '....pmmp', '.....pp.'],
    },
  },
  {
    id: 'wide', name: 'Large (3/4)', x: 36, y: 33,
    states: {
      closed: ['.........', '..ppppppp', '.........', '.........'],
      half: ['..ppppppp', '.pmmmmmmp', '..ppppppp', '.........'],
      open: ['..ppppppp', '.pTTTTTTp', '.pmmmttmp', '..pppppp.'],
      smile: ['.pppppppp', '..pTTTTTp', '...ppppp.', '.........'],
      sad: ['...ppppp.', '..p.....p', '.p.......', '.........'],
      surprised: ['....ppp..', '...pmmmp.', '...pmmmp.', '....ppp..'],
    },
  },
  {
    id: 'lips', name: 'Lèvres (3/4)', x: 37, y: 33,
    states: {
      closed: ['...rrrr.', '..rppppr', '...rrrr.', '........'],
      half: ['...rrrr.', '..rpmmpr', '...rrrr.', '........'],
      open: ['..rrrrr.', '.rpmmmpr', '.rpmttpr', '..rrrrr.'],
      smile: ['.r....r.', '..rppppr', '...rrrr.', '........'],
      sad: ['...rrrr.', '..rppppr', '.r.....r', '........'],
      surprised: ['...rrr..', '..rpmpr.', '..rpmpr.', '...rrr..'],
    },
  },
];

const mouths = MOUTHS.map((s) => ({
  id: `mouth-3q-${s.id}`,
  name: s.name,
  category: 'mouth',
  view: '3q',
  build: () => [{
    name: 'Bouche',
    z: Z.mouth,
    role: 'mouth',
    variants: MOUTH_STATES.map(([state, label]) => ({ name: label, state, grid: place(s.states[state], s.x, s.y) })),
  }],
}));

// ---------- Barbes (le long de la mâchoire, comme sur un portrait de 3/4) ----------
function jaw(full = false) {
  const head = headSilhouette(new Grid(), 'oval');
  const g = G();
  // favori devant l'oreille, joue basse, menton
  g.fill((x, y) => head.get(x, y) && x >= 29 && y >= 30 + (x - 29) * 0.18, 'h');
  g.rect(29, 23, 31, 31, 'h');
  if (full) {
    g.ell(40, 40.5, 7.5, 5, 'h');
    g.ell(33, 38.5, 5, 4, 'h');
    g.clear((x, y) => x > 47);
  } else {
    g.fill((x, y) => head.get(x, y - 1) && !head.get(x, y) && x >= 30 && x <= 46 && y > 30, 'h');
  }
  return g;
}

function beardFinish(g, { dense = 0.22 } = {}) {
  // bouche dégagée (la bouche est au-dessus mais on évite un bord trop épais)
  g.clear((x, y) => ((x + 0.5 - 41) / 4) ** 2 + ((y + 0.5 - 34.5) / 1.4) ** 2 <= 1);
  g.shade('h', 'H', -1, 1, 1);
  texture(g, 'h', 'H', 'j', { density: dense, seed: 7 });
  g.outline('q');
  return g;
}

const BEARDS = [
  { id: 'stubble', name: 'Barbe de trois jours (3/4)', draw: () => { const g = jaw(); g.recolor('h', 'H'); g.clear((x, y) => hash(x, y, 11) < 0.45); return g; } },
  { id: 'short', name: 'Barbe courte (3/4)', draw: () => beardFinish(jaw()) },
  { id: 'full', name: 'Barbe fournie (3/4)', draw: () => beardFinish(jaw(true), { dense: 0.26 }) },
  {
    id: 'mustache', name: 'Moustache (3/4)',
    draw: () => {
      const g = G();
      g.poly([[37.5, 33.5], [40, 31.5], [46.5, 31.5], [46.5, 33.5], [44, 33]], 'h');
      return beardFinish(g);
    },
  },
  {
    id: 'goatee', name: 'Bouc (3/4)',
    draw: () => {
      const g = G();
      g.poly([[38, 33.5], [40, 31.5], [46.5, 31.5], [46.5, 33.5]], 'h');
      g.poly([[39, 36], [46, 36], [45.5, 41.5], [41, 42.5], [38.5, 39]], 'h');
      return beardFinish(g);
    },
  },
];

const beards = BEARDS.map((b) => ({
  id: `beard-3q-${b.id}`,
  name: b.name,
  category: 'accessory',
  sub: 'beard',
  exclusiveKey: 'beard',
  view: '3q',
  build: () => [{ name: b.name.replace(' (3/4)', ''), z: Z.beard, grid: b.draw() }],
}));

export { eyes, brows, noses, mouths, beards };
