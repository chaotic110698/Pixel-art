// Visage de 3/4 (droite), style portrait : yeux à paupière sans blanc, nez
// suggéré par la lumière et l'ombre, bouche sous la moustache, barbes le long
// de la mâchoire. Grille 32×32 doublée. Les états reprennent ceux de la vue de
// face (reconnus par le PNGtuber et les expressions par défaut).

import { Z } from '../../builder.js';
import { EYE_STATES } from '../eyes.js';
import { BROW_STATES } from '../brows.js';
import { MOUTH_STATES } from '../mouths.js';
import { art, x2, hash } from './common.js';

/** Deux motifs (proche, lointain) dans une grille 32×32. */
function duo(near, far, [nx, ny], [fx, fy]) {
  const g = art(near, nx, ny);
  g.stamp(art(far, fx, fy), 0, 0);
  return g;
}

// ---------- Yeux (œil proche x 16–18, lointain x 22–23, y 12–14) ----------
const EYES = [
  {
    id: 'natural', name: 'Naturels (3/4)', near: [16, 12], far: [22, 12],
    states: {
      open: [['KKK', 'epe', '.e.'], ['KK', 'pe', 'e.']],
      closed: [['MMM', 'KKK', '...'], ['MM', 'KK', '..']],
      happy: [['MKK', 'Kpe', 'MMM'], ['KK', 'pe', 'MM']],
      surprised: [['.K.', 'epe', 'eee'], ['K.', 'pe', 'ee']],
    },
  },
  {
    id: 'tired', name: 'Fatigués (3/4)', near: [16, 12], far: [22, 12],
    states: {
      open: [['KKK', 'epe', 'MKM'], ['KK', 'pe', 'KM']],
      closed: [['MMM', 'KKK', 'MKM'], ['MM', 'KK', 'KM']],
      happy: [['MMM', 'KKK', 'MKM'], ['MM', 'KK', 'KM']],
      surprised: [['.K.', 'epe', 'eKe'], ['K.', 'pe', 'eK']],
    },
  },
  {
    id: 'bright', name: 'Vifs (3/4)', near: [16, 12], far: [22, 12],
    states: {
      open: [['ooo', 'epL', '.e.'], ['oo', 'pe', 'e.']],
      closed: [['MMM', 'ooo', '...'], ['MM', 'oo', '..']],
      happy: [['MMM', 'ooo', 'M.M'], ['MM', 'oo', '.M']],
      surprised: [['.o.', 'epL', 'eee'], ['o.', 'pe', 'ee']],
    },
  },
  {
    id: 'narrow', name: 'Plissés (3/4)', near: [16, 12], far: [22, 12],
    states: {
      open: [['MMM', 'KKK', 'epe'], ['MM', 'KK', 'pe']],
      closed: [['MMM', 'MMM', 'KKK'], ['MM', 'MM', 'KK']],
      happy: [['MMM', 'KKK', 'M.M'], ['MM', 'KK', '.M']],
      surprised: [['KKK', 'epe', '.e.'], ['KK', 'pe', 'e.']],
    },
  },
];

export const eyes = EYES.map((s) => ({
  id: `eyes-3q-${s.id}`,
  name: s.name,
  category: 'eyes',
  view: '3q',
  build: () => [{
    name: 'Yeux',
    z: Z.eyes,
    role: 'eyes',
    variants: EYE_STATES.map(([state, label]) => ({ name: label, state, grid: x2(duo(...s.states[state], s.near, s.far)) })),
  }],
}));

// ---------- Sourcils (y 10–11) ----------
const BROWS = [
  {
    id: 'straight', name: 'Droits (3/4)',
    states: {
      normal: [['...', 'hhh'], ['..', 'hh']],
      high: [['hhh', '...'], ['hh', '..']],
      angry: [['hh.', '..h'], ['.h', 'h.']],
      sad: [['..h', 'hh.'], ['h.', '.h']],
    },
  },
  {
    id: 'thick', name: 'Épais (3/4)',
    states: {
      normal: [['.hhh', 'hhhh'], ['hh', 'hh']],
      high: [['hhhh', '.hh.'], ['hh', 'h.']],
      angry: [['hhh.', '.hhh'], ['.h', 'hh']],
      sad: [['..hh', 'hhh.'], ['hh', '.h']],
    },
  },
  {
    id: 'short', name: 'Courts (3/4)',
    states: {
      normal: [['...', '.hh'], ['..', 'h.']],
      high: [['.hh', '...'], ['h.', '..']],
      angry: [['.h.', '..h'], ['.h', 'h.']],
      sad: [['..h', '.h.'], ['h.', '.h']],
    },
  },
];

export const brows = BROWS.map((s) => ({
  id: `brows-3q-${s.id}`,
  name: s.name,
  category: 'brows',
  view: '3q',
  build: () => [{
    name: 'Sourcils',
    z: Z.brows,
    role: 'brows',
    variants: BROW_STATES.map(([state, label]) => {
      const [near, far] = s.states[state];
      const nx = 19 - near[0].length;
      return { name: label, state, grid: x2(duo(near, far, [nx, 10], [22, 10])) };
    }),
  }],
}));

// ---------- Nez : lumière sur l'arête, ombre dessous (x 19–25, y 12–17) ----------
const NOSES = [
  { id: 'soft', name: 'Discret (3/4)', rows: ['.......', '.L.....', '..M....', '..MM...', '....L..', '.KKK...'] },
  { id: 'strong', name: 'Fort (3/4)', rows: ['.......', '.L.....', '..M..so', '..MM.so', '....Lso', '.KKKKo.'] },
  { id: 'hooked', name: 'Aquilin (3/4)', rows: ['.......', '.L...so', '..M..so', '..MMKo.', '.KKK...', '.......'] },
  { id: 'small', name: 'Retroussé (3/4)', rows: ['.......', '.......', '.L.....', '..M....', '....L..', '..KK...'] },
];

export const noses = NOSES.map((n) => ({
  id: `nose-3q-${n.id}`,
  name: n.name,
  category: 'nose',
  view: '3q',
  build: () => [{ name: `Nez (${n.name.replace(' (3/4)', '').toLowerCase()}, 3/4)`, z: Z.nose, grid: x2(art(n.rows, 19, 12)) }],
}));

// ---------- Bouches (x 18–23, y 19–21 ; la moustache recouvre y 18–19) ----------
const MOUTHS = [
  {
    id: 'natural', name: 'Naturelle (3/4)',
    states: {
      closed: ['......', '..MMM.', '..KK..'],
      half: ['......', '..ooo.', '..KK..'],
      open: ['..MMM.', '..omo.', '..KK..'],
      smile: ['.K...K', '..KKK.', '......'],
      sad: ['......', '..KKK.', '.K...K'],
      surprised: ['...o..', '..omo.', '...o..'],
    },
  },
  {
    id: 'line', name: 'Trait (3/4)',
    states: {
      closed: ['......', '.KKKK.', '......'],
      half: ['......', '.KooK.', '......'],
      open: ['.KKKK.', '.ommo.', '..KK..'],
      smile: ['.K...K', '..KKK.', '......'],
      sad: ['......', '..KKK.', '.K...K'],
      surprised: ['..KK..', '.ommo.', '..KK..'],
    },
  },
  {
    id: 'full', name: 'Lèvres pleines (3/4)',
    states: {
      closed: ['..MMM.', '..ooo.', '..KKK.'],
      half: ['..MMM.', '..omo.', '..KKK.'],
      open: ['..MMM.', '.ommmo', '..KKK.'],
      smile: ['.o.MMo', '..ooo.', '..KK..'],
      sad: ['..MMM.', '..ooo.', '.o.KKo'],
      surprised: ['..MM..', '..om..', '..KK..'],
    },
  },
];

export const mouths = MOUTHS.map((s) => ({
  id: `mouth-3q-${s.id}`,
  name: s.name,
  category: 'mouth',
  view: '3q',
  build: () => [{
    name: 'Bouche',
    z: Z.mouth,
    role: 'mouth',
    variants: MOUTH_STATES.map(([state, label]) => ({ name: label, state, grid: x2(art(s.states[state], 18, 19)) })),
  }],
}));

// ---------- Barbes (posées en x 11, y 12) ----------
const FULL = [
  '.h............',
  '.h............',
  '.h............',
  '.h............',
  '.hh...........',
  '.hh...........',
  'ohh....hhhhhj.',
  'oohh..hhhhhhh.',
  '..ohh.h.......',
  '...ohhh.......',
  '....ohhhhhhh..',
  '.....oohhhho..',
  '.......oooo...',
];

/** Reflets dans la barbe (texture). */
function tex(g, seed = 3, d = 0.14) {
  g.each((x, y) => { if (g.get(x, y) === 104 && hash(x, y, seed) < d) g.set(x, y, 'j'); });
  return g;
}

const BEARDS = [
  { id: 'full', name: 'Barbe (3/4)', draw: () => tex(art(FULL, 11, 12)) },
  {
    id: 'thick', name: 'Barbe fournie (3/4)',
    draw: () => tex(art([
      '.h............',
      '.h............',
      '.hh...........',
      '.hh...........',
      '.hhh..........',
      'ohhh..........',
      'ohhhh..hhhhhj.',
      'ohhhhhhhhhhhh.',
      '.ohhhhh.....h.',
      '..ohhhh.....h.',
      '...ohhhhhhhhh.',
      '....ohhhhhhho.',
      '.....ohhhhho..',
      '......ooooo...',
    ], 11, 12), 5, 0.18),
  },
  {
    id: 'stubble', name: 'Barbe de trois jours (3/4)',
    draw: () => {
      const g = art(FULL, 11, 12);
      g.recolor('o', 'h');
      g.recolor('j', 'h');
      g.recolor('h', 'H', (x, y) => hash(x, y, 4) < 0.3);
      g.clear((x, y) => hash(x, y, 9) < 0.45 || y > 23);
      return g;
    },
  },
  {
    id: 'mustache', name: 'Moustache (3/4)',
    draw: () => tex(art(['hhhhhj', 'ohhhhho'], 17, 18)),
  },
  {
    id: 'goatee', name: 'Bouc (3/4)',
    draw: () => tex(art(['.hhhhhj', '.hhhhhh', '.h....h', '.h....h', '.hhhhhh', '..hhhho', '...ooo.'], 17, 18)),
  },
];

export const beards = BEARDS.map((b) => ({
  id: `beard-3q-${b.id}`,
  name: b.name,
  category: 'accessory',
  sub: 'beard',
  exclusiveKey: 'beard',
  view: '3q',
  build: () => [{ name: b.name.replace(' (3/4)', ''), z: Z.beard, grid: x2(b.draw()) }],
}));
