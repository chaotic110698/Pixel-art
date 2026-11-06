// Coiffures. Chaque coiffure produit deux calques :
//  - « arrière » (sous la tête : volume, longueur) ;
//  - « avant » (par-dessus le front : frange, mèches).
// La tête cache naturellement le centre du calque arrière.

import { G, Z } from '../builder.js';

const CX = 31.5;

/** Calotte : volume de base autour du haut de la tête. */
function cap(g, { ry = 12.5, rx = 14, cy = 21 } = {}) {
  return g.ell(CX, cy, rx, ry, 'h');
}

/** Partie avant de base : calotte coupée à la ligne du front. */
function crown(g, fringeY = 16) {
  cap(g);
  g.clear((x, y) => y > fringeY);
  return g;
}

/** Mèches pointues vers le bas le long de la frange. */
function bangs(g, xs, y0, len, w = 2.5) {
  for (const x of xs) g.poly([[x - w, y0], [x + w, y0], [x, y0 + len]], 'h');
  return g;
}

/** Mèches latérales (gauche + miroir). */
function sideLocks(g, y0, y1, x0 = 17, x1 = 21) {
  g.rect(x0, y0, x1, y1, 'h');
  g.rect(63 - x1, y0, 63 - x0, y1, 'h');
  g.poly([[x0, y1], [x1 + 1, y1], [x0 + 1, y1 + 3]], 'h');
  g.poly([[63 - x0 + 1, y1], [63 - x1, y1], [63 - x0, y1 + 3]], 'h');
  return g;
}

function finish(g, { highlightTop = 15 } = {}) {
  g.shade('h', 'H', 1, 1, 1);
  g.shade('h', 'j', -1, -1, 1);
  g.recolor('j', 'h', (x, y) => y > highlightTop || x > 38);
  g.outline('q');
  return g;
}

function layers(back, front, name) {
  const out = [];
  if (back && !back.isEmpty()) out.push({ name: `Cheveux arrière (${name})`, z: Z.hairBack, grid: finish(back, { highlightTop: 12 }) });
  if (front && !front.isEmpty()) out.push({ name: `Cheveux avant (${name})`, z: Z.hairFront, grid: finish(front) });
  return out;
}

const STYLES = [
  {
    id: 'short', name: 'Courte',
    back: () => cap(G()).clear((x, y) => y > 30),
    front: () => {
      const g = crown(G(), 16);
      bangs(g, [22.5, 27, 31.5, 36, 40.5], 16, 4);
      sideLocks(g, 16, 23);
      return g;
    },
  },
  {
    id: 'long', name: 'Longue',
    back: () => {
      const g = cap(G());
      g.rect(17, 21, 46, 52, 'h');
      g.ell(CX, 52, 14.5, 4, 'h');
      return g;
    },
    front: () => {
      const g = crown(G(), 15);
      g.poly([[18, 15], [CX, 12], [CX, 18], [22, 19]], 'h');
      g.poly([[45, 15], [CX + 1, 12], [CX + 1, 18], [41, 19]], 'h');
      sideLocks(g, 15, 46, 16, 20);
      g.line(31, 9, 31, 13, 'H');
      return g;
    },
  },
  {
    id: 'ponytail', name: 'Queue de cheval',
    back: () => {
      const g = cap(G()).clear((x, y) => y > 30);
      g.ell(48, 31, 4.5, 13, 'h');
      g.ell(45, 17, 4, 5, 'h');
      g.rect(45, 14, 48, 20, 'a');
      return g;
    },
    front: () => {
      const g = crown(G(), 16);
      g.poly([[17, 13], [42, 9], [46, 16], [24, 20], [19, 22]], 'h');
      sideLocks(g, 16, 24, 17, 20);
      return g;
    },
  },
  {
    id: 'braids', name: 'Tresses',
    back: () => cap(G()).clear((x, y) => y > 31),
    front: () => {
      const g = crown(G(), 15);
      g.poly([[18, 15], [CX, 12], [CX, 17], [21, 18]], 'h');
      g.poly([[45, 15], [CX + 1, 12], [CX + 1, 17], [42, 18]], 'h');
      sideLocks(g, 15, 26, 17, 20);
      for (let y = 27; y <= 49; y += 4) {
        g.ell(18.5, y + 1.5, 2.6, 2.4, 'h');
        g.ell(45.5, y + 1.5, 2.6, 2.4, 'h');
      }
      g.rect(17, 52, 20, 53, 'a');
      g.rect(43, 52, 46, 53, 'a');
      for (let y = 29; y <= 49; y += 4) { g.px(18, y, 'H'); g.px(45, y, 'H'); }
      return g;
    },
  },
  {
    id: 'bun', name: 'Chignon',
    back: () => {
      const g = cap(G()).clear((x, y) => y > 28);
      g.ell(CX, 6, 6, 5, 'h');
      return g;
    },
    front: () => {
      const g = crown(G(), 15);
      g.line(26, 10, 29, 15, 'H');
      g.line(37, 10, 34, 15, 'H');
      sideLocks(g, 15, 21, 18, 20);
      return g;
    },
  },
  {
    id: 'spiky', name: 'Hérissée',
    back: () => {
      const g = cap(G()).clear((x, y) => y > 29);
      for (const [x, h] of [[20, 7], [25, 3], [31.5, 1], [38, 3], [43, 7]]) g.poly([[x - 4, 14], [x + 4, 14], [x, h]], 'h');
      g.poly([[14, 22], [19, 14], [20, 24]], 'h');
      g.poly([[49, 22], [44, 14], [43, 24]], 'h');
      return g;
    },
    front: () => {
      const g = crown(G(), 15);
      bangs(g, [21, 26, 31.5, 37, 42], 15, 5, 3);
      for (const [x, h] of [[24, 6], [31.5, 4], [39, 6]]) g.poly([[x - 3.5, 14], [x + 3.5, 14], [x, h]], 'h');
      return g;
    },
  },
  {
    id: 'bangs', name: 'Frange droite',
    back: () => {
      const g = cap(G());
      g.rect(17, 21, 46, 37, 'h');
      g.ell(CX, 37, 14.5, 2.5, 'h');
      return g;
    },
    front: () => {
      const g = crown(G(), 19);
      g.rect(20, 15, 43, 19, 'h');
      sideLocks(g, 16, 36, 17, 21);
      for (const x of [24, 28, 35, 39]) g.px(x, 19, 'H');
      return g;
    },
  },
  {
    id: 'bob', name: 'Carré',
    back: () => {
      const g = cap(G(), { rx: 15 });
      g.rect(16, 21, 47, 34, 'h');
      return g;
    },
    front: () => {
      const g = crown(G(), 15);
      g.poly([[17, 12], [36, 10], [26, 20], [20, 22]], 'h');
      g.poly([[46, 14], [36, 10], [40, 18]], 'h');
      sideLocks(g, 14, 33, 16, 21);
      return g;
    },
  },
  {
    id: 'swept', name: 'Mèche sur le côté',
    back: () => cap(G()).clear((x, y) => y > 31),
    front: () => {
      const g = crown(G(), 14);
      g.poly([[16, 13], [46, 11], [46, 15], [27, 20], [21, 25], [19, 18]], 'h');
      sideLocks(g, 14, 22, 17, 20);
      return g;
    },
  },
  {
    id: 'afro', name: 'Afro',
    back: () => {
      const g = G().ell(CX, 18, 19, 15.5, 'h');
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) g.ell(CX + Math.cos(a) * 17, 18 + Math.sin(a) * 13.5, 3.5, 3.5, 'h');
      return g.clear((x, y) => y > 36);
    },
    front: () => {
      const g = G().ell(CX, 18, 19, 15.5, 'h');
      for (let a = Math.PI; a < Math.PI * 2; a += Math.PI / 7) g.ell(CX + Math.cos(a) * 17, 18 + Math.sin(a) * 13.5, 3.5, 3.5, 'h');
      g.clear((x, y) => y > 15 && x > 20 && x < 43);
      g.clear((x, y) => y > 27);
      bangs(g, [24, 29, 34, 39], 15, 3, 2.5);
      return g;
    },
  },
  {
    id: 'pigtails', name: 'Couettes',
    back: () => {
      const g = cap(G()).clear((x, y) => y > 29);
      g.ell(13, 29, 4.5, 10, 'h');
      g.ell(50, 29, 4.5, 10, 'h');
      g.rect(14, 19, 17, 21, 'a');
      g.rect(46, 19, 49, 21, 'a');
      return g;
    },
    front: () => {
      const g = crown(G(), 16);
      bangs(g, [23, 28, 35, 40], 16, 4);
      g.poly([[27, 16], [36, 16], [31.5, 21]], 'h');
      sideLocks(g, 16, 24, 18, 20);
      return g;
    },
  },
  {
    id: 'mohawk', name: 'Crête',
    back: () => G(),
    front: () => {
      const g = G();
      g.ell(CX, 12, 4.5, 11, 'h');
      for (const y of [2, 6, 10]) g.poly([[CX - 4, y + 3], [CX + 4, y + 3], [CX + 7, y]], 'h');
      g.clear((x, y) => y > 15);
      // côtés rasés (tramage)
      const side = G();
      cap(side).clear((x, y) => y > 16 || (x > 26 && x < 37));
      side.clear((x, y) => (x + y) % 2 === 0);
      side.recolor('h', 'H');
      g.stamp(side, 0, 0);
      return g;
    },
  },
  {
    id: 'shaved', name: 'Rasée',
    back: () => G(),
    front: () => {
      const g = G();
      cap(g).clear((x, y) => y > 17);
      g.clear((x, y) => (x + y) % 2 === 0 && y > 11);
      g.recolor('h', 'H');
      return g;
    },
    noOutline: true,
  },
  {
    id: 'wavy', name: 'Longue ondulée',
    back: () => {
      const g = cap(G());
      g.rect(17, 21, 46, 50, 'h');
      // bords ondulés
      for (let y = 24; y <= 50; y += 6) { g.ell(16, y, 2.5, 3, 'h'); g.ell(47, y + 3, 2.5, 3, 'h'); }
      for (let x = 19; x <= 45; x += 5) g.ell(x, 51, 2.5, 2.5, 'h');
      return g;
    },
    front: () => {
      const g = crown(G(), 15);
      g.poly([[17, 14], [36, 10], [30, 18], [21, 21]], 'h');
      g.poly([[46, 15], [36, 10], [42, 19]], 'h');
      sideLocks(g, 15, 44, 16, 20);
      for (let y = 22; y <= 42; y += 6) { g.px(17, y, 'H'); g.px(46, y + 3, 'H'); }
      return g;
    },
  },
  {
    id: 'undercut', name: 'Undercut',
    back: () => G(),
    front: () => {
      const g = G();
      g.ell(31.5, 14, 13, 8, 'h').clear((x, y) => y > 15);
      g.poly([[18, 12], [45, 8], [44, 15], [27, 18], [20, 17]], 'h');
      // côtés rasés (tramage)
      const side = G();
      cap(side).clear((x, y) => y < 15 || y > 24 || (x > 21 && x < 42));
      side.clear((x, y) => (x + y) % 2 === 0);
      side.recolor('h', 'H');
      g.stamp(side, 0, 0);
      return g;
    },
  },
  {
    id: 'spacebuns', name: 'Double chignon',
    back: () => {
      const g = cap(G()).clear((x, y) => y > 30);
      g.ell(19, 9, 5.5, 5, 'h');
      g.ell(44, 9, 5.5, 5, 'h');
      return g;
    },
    front: () => {
      const g = crown(G(), 16);
      bangs(g, [22.5, 27, 31.5, 36, 40.5], 16, 4);
      sideLocks(g, 16, 25, 17, 20);
      g.ell(19, 9, 3, 2, 'j');
      return g;
    },
  },
  {
    id: 'curly', name: 'Bouclée courte',
    back: () => {
      const g = cap(G(), { rx: 15, ry: 13.5 }).clear((x, y) => y > 32);
      for (let a = Math.PI; a <= Math.PI * 2; a += Math.PI / 6) g.ell(31.5 + Math.cos(a) * 14, 21 + Math.sin(a) * 12, 3.2, 3.2, 'h');
      return g;
    },
    front: () => {
      const g = crown(G(), 15);
      for (let a = Math.PI; a <= Math.PI * 2; a += Math.PI / 6) g.ell(31.5 + Math.cos(a) * 14, 21 + Math.sin(a) * 12, 3.2, 3.2, 'h');
      for (const x of [22, 27, 32, 37, 42]) g.ell(x, 16, 2.6, 2.6, 'h');
      g.clear((x, y) => y > 18);
      for (const [x, y] of [[24, 12], [30, 10], [36, 12], [41, 14]]) g.px(x, y, 'H');
      return g;
    },
  },
  {
    id: 'bald', name: 'Chauve (aucune)',
    back: () => G(),
    front: () => G(),
  },
];

export default STYLES.map((s) => ({
  id: `hair-${s.id}`,
  name: s.name,
  category: 'hair',
  build: () => {
    if (s.noOutline) {
      const f = s.front();
      return f.isEmpty() ? [] : [{ name: `Cheveux (${s.name.toLowerCase()})`, z: Z.hairFront, grid: f }];
    }
    return layers(s.back(), s.front(), s.name.toLowerCase());
  },
}));
