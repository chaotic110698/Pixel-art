// Hauts en vue de 3/4 (droite), ajustés au physique du buste 3/4 du projet.

import { G, Z } from '../../builder.js';
import { BODY3Q, NECK_X, torso3q } from './bodies.js';

const base = (t, grow = 1) => torso3q(G(), t, 'c', grow);
const neckHole = (g, t, extra = 0) => g.clear((x, y) => ((x + 0.5 - NECK_X + 0.5) / (t.neck + 1.5 + extra)) ** 2 + ((y + 0.5 - (t.top - 1)) / (3.5 + extra)) ** 2 <= 1);
/** Couture du bras proche. */
const sleeve = (g, t, role = 'C') => g.line(Math.round(t.cx - t.rx + 6), t.top + 8, Math.round(t.cx - t.rx + 5), 63, role);

function finish(g) {
  g.shade('c', 'C', -1, 0, 2);
  g.shade('c', 'C', 0, -1, 0);
  g.outline('x');
  return g;
}

const TOPS = [
  {
    id: 'tshirt', name: 'T-shirt (3/4)',
    draw: (t) => {
      const g = base(t);
      neckHole(g, t);
      sleeve(g, t);
      return finish(g);
    },
  },
  {
    id: 'hoodie', name: 'Sweat à capuche (3/4)',
    draw: (t) => {
      const g = base(t);
      // capuche repliée derrière la nuque
      g.ell(NECK_X - t.neck - 4, t.top - 1, 7, 4.5, 'C');
      neckHole(g, t);
      g.line(NECK_X + 1, t.top + 2, NECK_X + 1, t.top + 9, 'a');
      g.line(NECK_X + 4, t.top + 2, NECK_X + 4, t.top + 8, 'a');
      g.line(NECK_X - 6, 58, NECK_X + 9, 58, 'C');
      sleeve(g, t);
      return finish(g);
    },
  },
  {
    id: 'shirt', name: 'Chemise (3/4)',
    draw: (t) => {
      const g = base(t);
      neckHole(g, t);
      // col ouvert en V, pans du col, boutons
      g.clear((x, y) => g.get(x, y) && y < t.top + 8 && Math.abs(x + 0.5 - NECK_X - 1) < (t.top + 8 - y) * 0.55);
      g.poly([[NECK_X - t.neck - 2, t.top - 3], [NECK_X + 1, t.top + 6], [NECK_X - t.neck - 3, t.top + 3]], 'w');
      g.poly([[NECK_X + t.neck + 1, t.top - 3], [NECK_X + 3, t.top + 6], [NECK_X + t.neck + 3, t.top + 2]], 'w');
      g.line(NECK_X + 2, t.top + 7, NECK_X + 1, 63, 'C');
      for (let y = t.top + 10; y < 63; y += 4) g.px(NECK_X + 2, y, 'x');
      sleeve(g, t);
      return finish(g);
    },
  },
  {
    id: 'jacket', name: 'Veste ouverte (3/4)',
    draw: (t) => {
      const g = base(t, 2);
      // t-shirt dessous (côté poitrine) et revers
      g.poly([[NECK_X - 3, t.top - 1], [NECK_X + 6, t.top - 1], [NECK_X + 7, 64], [NECK_X - 2, 64]], 'w');
      neckHole(g, t);
      g.poly([[NECK_X - t.neck - 3, t.top - 2], [NECK_X - 2, t.top + 10], [NECK_X - t.neck - 3, t.top + 9]], 'C');
      g.poly([[NECK_X + t.neck + 2, t.top - 2], [NECK_X + 6, t.top + 9], [NECK_X + t.neck + 4, t.top + 7]], 'C');
      g.line(NECK_X - 3, t.top + 8, NECK_X - 3, 63, 'x').line(NECK_X + 7, t.top + 6, NECK_X + 8, 63, 'x');
      sleeve(g, t, 'x');
      return finish(g);
    },
  },
  {
    id: 'turtleneck', name: 'Col roulé (3/4)',
    draw: (t) => {
      const g = base(t);
      g.rect(Math.ceil(NECK_X - t.neck - 2), 37, Math.floor(NECK_X + t.neck + 1), t.top + 1, 'c');
      for (let y = 38; y <= t.top; y += 2) g.line(Math.ceil(NECK_X - t.neck - 2), y, Math.floor(NECK_X + t.neck + 1), y, 'C');
      sleeve(g, t);
      return finish(g);
    },
  },
  {
    id: 'tank', name: 'Débardeur (3/4)',
    draw: (t) => {
      const g = base(t, 0);
      // emmanchures : épaules dégagées
      g.clear((x, y) => y < t.top + 12 && (x < t.cx - t.rx + 8 || x > t.cx + t.fx - 5));
      g.rect(Math.round(t.cx - t.rx + 8), t.top, Math.round(t.cx - t.rx + 10), t.top + 11, 'c');
      neckHole(g, t, 2);
      return finish(g);
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
    return [{ name: `Haut (${tp.name.replace(' (3/4)', '').toLowerCase()}, 3/4)`, z: Z.top, grid: tp.draw(t) }];
  },
}));
