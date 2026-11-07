// Hauts de 3/4 (droite), style portrait, ajustés au physique du buste 3/4.
// Grille 32×32 doublée.

import { Z } from '../../builder.js';
import { g32, x2 } from './common.js';
import { BODY3Q, torso, neck } from './bodies.js';

/** Encolure : on retire le cou (au-dessus de y), bords cernés, col tracé. */
function collar(g, t, { y = 26, role = 'o' } = {}) {
  const n = neck(g32(), t, 's');
  const hole = (x, yy) => n.get(x, yy) && yy <= y;
  g.clear(hole);
  g.each((x, yy) => { if (g.get(x, yy) && yy <= y && (hole(x - 1, yy) || hole(x + 1, yy))) g.set(x, yy, 'o'); });
  g.line(Math.round(13 - t.neck), y + 1, Math.round(19 + t.neck), y + 1, role);
  return g;
}

/** Ombres (bord gauche, plis des bras). Le contour est tracé avant l'encolure (outlined). */
function finish(g, t, { folds = true } = {}) {
  g.shade('c', 'C', -1, 0, 1);
  g.shade('c', 'C', 0, -1, 1);
  if (folds) {
    g.recolor('c', 'C', (x, y) => (x === 8 && y >= 30) || (x === 9 && y >= 31) || (x === Math.round(15.5 + 10.5 * t.k) && y >= 29));
  }
  return g;
}

const base = (t, grow = 0) => torso(g32(), t, 'c', grow).outline('o');

const TOPS = [
  {
    id: 'tshirt', name: 'T-shirt (3/4)',
    draw: (t) => finish(collar(base(t), t), t),
  },
  {
    id: 'sweater', name: 'Pull (3/4)',
    draw: (t) => {
      const g = base(t);
      collar(g, t, { y: 25 });
      g.line(Math.round(13 - t.neck), 26, Math.round(19 + t.neck), 26, 'C');
      g.line(3, 31, 28, 31, 'C');
      return finish(g, t);
    },
  },
  {
    id: 'hoodie', name: 'Sweat à capuche (3/4)',
    draw: (t) => {
      const g = base(t);
      // capuche repliée derrière la nuque
      g.ell(8.5, 24.5, 4.5, 2.6, 'c');
      collar(g, t, { y: 26 });
      g.line(15, 28, 15, 31, 'a').line(18, 28, 18, 30, 'a');
      g.line(9, 24, 12, 26, 'C');
      return finish(g, t);
    },
  },
  {
    id: 'shirt', name: 'Chemise ouverte (3/4)',
    draw: (t) => {
      const g = base(t);
      collar(g, t, { y: 26, role: 'c' });
      // col en V et pans du col
      g.clear((x, y) => y >= 27 && y <= 29 && Math.abs(x - 16.5) <= 29 - y);
      g.poly([[11, 25], [14.5, 27.6], [13, 29.5], [10.5, 27]], 'w');
      g.poly([[20.5, 25], [17.5, 27.6], [19, 29.5], [21.5, 27]], 'w');
      g.line(16, 30, 16, 31, 'C');
      return finish(g, t);
    },
  },
  {
    id: 'jacket', name: 'Veste (3/4)',
    draw: (t) => {
      const g = base(t, 0);
      collar(g, t, { y: 26 });
      // t-shirt dessous, revers
      g.poly([[13, 27], [20, 27], [21, 32.5], [14, 32.5]], 'w');
      g.line(13, 27, 19, 27, 'o');
      g.poly([[10, 25], [13.6, 27.5], [13.6, 31], [11, 28]], 'C');
      g.poly([[21.5, 25.5], [19.6, 27.5], [20.6, 31], [23, 28]], 'C');
      g.line(13, 29, 13, 31, 'o').line(21, 28, 21, 31, 'o');
      return finish(g, t, { folds: true });
    },
  },
  {
    id: 'tank', name: 'Débardeur (3/4)',
    draw: (t) => {
      const g = base(t);
      collar(g, t, { y: 27 });
      // emmanchures : épaules nues
      g.clear((x, y) => y <= 29 && (x < 9 || x > Math.round(15.5 + 8.8 * t.k)));
      return finish(g, t, { folds: false });
    },
  },
];

export default TOPS.map((tp) => ({
  id: `top-3q-${tp.id}`,
  name: tp.name,
  category: 'top',
  view: '3q',
  fitsBody: true,
  build: (ctx = {}) => {
    const t = BODY3Q[ctx.bodyType] || BODY3Q['3q-moyen'];
    return [{ name: `Haut (${tp.name.replace(' (3/4)', '').toLowerCase()}, 3/4)`, z: Z.top, grid: x2(tp.draw(t)) }];
  },
}));
