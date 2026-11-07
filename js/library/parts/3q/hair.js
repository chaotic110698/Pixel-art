// Coiffures de 3/4 (droite), style portrait : cheveux courts et denses, ligne
// du front nette (sans contour sur la peau), reflets en haut à droite, mèches
// sombres à l'arrière. Grille 32×32 doublée.
// Calque « avant » (au-dessus du visage) ; calque « arrière » pour les longueurs.

import { Z } from '../../builder.js';
import { g32, art, x2, hash } from './common.js';
import { headMask } from './heads.js';

// Coiffure de l'image de référence : courte, en bataille.
const MESSY = [
  '........ooo..oooooooo...........',
  '.......ohjhoohhhhhhjjoo.........',
  '.......ohhohhhhhhhhhjjho........',
  '.......ooohhhhhhhhhhhjjho.......',
  '........oohhhhhhhhhhhhjho.......',
  '........ohhhhh..................',
  '.......oohhhhh..................',
  '.......oohhhhh..................',
  '.......oohhhh...................',
  '.......oohhhh...................',
  '.......oo.......................',
  '........o.......................',
  '........o.......................',
  '........o.......................',
];

/**
 * Calotte : tête gonflée de `grow`, gardée au-dessus de la ligne d'implantation
 * (front y ≤ front, tempe y ≤ temple, nuque y ≤ nape).
 */
function cap({ grow = 1, front = 7, temple = 12, nape = 16, slope = 0 } = {}) {
  const g = headMask('long', 'h');
  for (let i = 0; i < grow; i++) g.outline('h');
  const line = (x) => (x >= 13 ? front + (x - 13) * slope : x >= 9 ? temple : nape);
  g.clear((x, y) => y > line(x));
  return g;
}

/** Texture : reflets le long du bord haut/droit, quelques mèches sombres en diagonale. */
function texture(g, { seed = 1, light = 0.7, dark = 0.05 } = {}) {
  const src = g.clone();
  const empty = (x, y) => !src.get(x, y);
  g.each((x, y) => {
    if (src.get(x, y) !== 104) return; // 'h'
    const r = hash(x, y, seed);
    if ((empty(x, y - 1) || empty(x + 1, y)) && x >= 14 && r < light) {
      g.set(x, y, 'j');
      if (src.get(x - 1, y + 1) === 104 && r < light / 2) g.set(x - 1, y + 1, 'j');
    } else if (r < dark && x <= 20) {
      g.set(x, y, 'H');
      if (src.get(x + 1, y + 1) === 104) g.set(x + 1, y + 1, 'H');
    }
  });
  return g;
}

/** Contour sauf sous la ligne du front et des tempes (la peau n'est pas cernée). */
function edge(g, { front = 7, temple = 12, slope = 0 } = {}) {
  g.outline('o');
  const line = (x) => (x >= 13 ? front + (x - 13) * slope : temple);
  g.clear((x, y) => g.get(x, y) === 111 && x >= 9 && x <= 23 && y > line(x) && y <= line(x) + 1.99);
  return g;
}

function front(opts = {}) {
  return edge(texture(cap(opts), opts), opts);
}

const STYLES = [
  { id: 'messy', name: 'Courte en bataille (3/4)', front: () => art(MESSY, 0, 3) },
  { id: 'short', name: 'Courte (3/4)', front: () => front({ seed: 2 }) },
  {
    id: 'side', name: 'Mèche sur le côté (3/4)',
    front: () => {
      const g = cap({ slope: 0.25 });
      g.poly([[13, 6], [20, 5], [24.6, 7], [24.6, 9.5], [21, 8.2]], 'h');
      return edge(texture(g, { seed: 4 }), { slope: 0.25 });
    },
  },
  {
    id: 'slick', name: 'Plaquée en arrière (3/4)',
    front: () => {
      const g = cap({ front: 6 });
      texture(g, { seed: 6, light: 0.35, dark: 0.1 });
      // stries vers l'arrière
      for (const [y, x0, x1] of [[4, 11, 15], [6, 9, 13], [5, 16, 19]]) g.line(x0, y, x1, y, 'H');
      return edge(g, { front: 6 });
    },
  },
  {
    id: 'curly', name: 'Bouclée (3/4)',
    front: () => {
      const g = cap({ grow: 2, front: 7 });
      for (const [x, y] of [[9, 4], [13, 2.5], [18, 2.5], [22, 4], [7, 8], [6.5, 12]]) g.ell(x, y, 2.3, 2.3, 'h');
      texture(g, { seed: 8, light: 0.5, dark: 0.04 });
      // boucles : petits creux sombres sous chaque bosse
      for (const [x, y] of [[9, 6], [13, 5], [18, 5], [7, 10], [11, 9], [16, 7]]) if (g.get(x, y) === 104) g.set(x, y, 'H');
      return edge(g);
    },
  },
  {
    id: 'receding', name: 'Dégarnie (3/4)',
    front: () => {
      const g = cap({ front: 7 });
      g.clear((x, y) => x >= 13 && y <= 7 && y + 0.6 * (x - 12) > 7);
      return edge(texture(g, { seed: 3 }), { front: 7 });
    },
  },
  {
    id: 'buzz', name: 'Rasée (3/4)', raw: true,
    front: () => {
      const g = cap({ grow: 0 });
      g.recolor('h', 'H');
      // ligne du front adoucie
      g.clear((x, y) => x >= 13 && y === 7 && x % 2 === 0);
      return g;
    },
  },
  {
    id: 'long', name: 'Longue (3/4)',
    back: () => {
      const g = g32();
      g.poly([[6, 6], [14, 6], [14, 26], [10, 30], [3, 29], [4, 16]], 'h');
      return edge(texture(g, { seed: 7, light: 0.3, dark: 0.03 }));
    },
    front: () => {
      const g = cap({ temple: 18, nape: 18 });
      g.poly([[13, 5], [24.6, 6], [24.6, 8.5], [16, 8], [13, 10]], 'h');
      return edge(texture(g, { seed: 9 }), { temple: 18 });
    },
  },
  {
    id: 'ponytail', name: 'Queue de cheval (3/4)',
    back: () => {
      const g = g32();
      g.poly([[4, 8], [9, 7], [8, 14], [6, 23], [3, 22], [3, 14]], 'h');
      return edge(texture(g, { seed: 11, light: 0.3, dark: 0.03 }));
    },
    front: () => {
      const g = cap({ front: 6 });
      texture(g, { seed: 12, light: 0.35 });
      g.rect(6, 8, 7, 9, 'a');
      return edge(g, { front: 6 });
    },
  },
  {
    id: 'bun', name: 'Chignon (3/4)',
    back: () => edge(texture(g32().ell(9, 4.5, 3.6, 3.2, 'h'), { seed: 13, light: 0.4 })),
    front: () => front({ front: 6, seed: 14 }),
  },
];

export default STYLES.map((s) => ({
  id: `hair-3q-${s.id}`,
  name: s.name,
  category: 'hair',
  view: '3q',
  build: () => {
    const name = s.name.replace(' (3/4)', '').toLowerCase();
    if (s.raw) return [{ name: `Cheveux (${name}, 3/4)`, z: Z.hairFront, grid: x2(s.front()) }];
    const out = [];
    if (s.back) out.push({ name: `Cheveux arrière (${name}, 3/4)`, z: Z.hairBack, grid: x2(s.back()) });
    out.push({ name: `Cheveux avant (${name}, 3/4)`, z: Z.hairFront, grid: x2(s.front()) });
    return out;
  },
}));
