// Hauts simples, ajustés automatiquement au type de corps du projet.

import { G, Z } from '../builder.js';
import { BODY_TYPES, torso } from './bodies.js';

const CX = 31.5;

function base(t, grow = 1) {
  const g = torso(G(), t, 'c', grow);
  return g;
}

function finish(g) {
  g.shade('c', 'C', 1, 0, 2);
  g.outline('x');
  return g;
}

const TOPS = [
  {
    id: 'tshirt', name: 'T-shirt',
    draw: (t) => {
      const g = base(t);
      g.clear((x, y) => ((x + 0.5 - CX) / (t.neck + 1.5)) ** 2 + ((y + 0.5 - (t.top - 1)) / 4) ** 2 <= 1);
      const ax = Math.round(t.rx - 5);
      g.line(Math.round(CX - ax), 56, Math.round(CX - ax), 63, 'C');
      g.line(Math.round(CX + ax), 56, Math.round(CX + ax), 63, 'C');
      return finish(g);
    },
  },
  {
    id: 'hoodie', name: 'Sweat à capuche',
    draw: (t) => {
      const g = base(t);
      g.ell(CX, t.top + 1, t.neck + 5, 4, 'C');
      g.clear((x, y) => ((x + 0.5 - CX) / (t.neck + 1)) ** 2 + ((y + 0.5 - (t.top - 2)) / 3.5) ** 2 <= 1);
      g.line(29, t.top + 4, 29, t.top + 10, 'a');
      g.line(34, t.top + 4, 34, t.top + 10, 'a');
      g.rect(25, 58, 38, 58, 'C');
      g.line(24, 59, 24, 63, 'C');
      g.line(39, 59, 39, 63, 'C');
      return finish(g);
    },
  },
  {
    id: 'shirt', name: 'Chemise',
    draw: (t) => {
      const g = base(t);
      g.poly([[CX - t.neck - 1, t.top - 2], [CX + t.neck + 1, t.top - 2], [CX, t.top + 7]], 's');
      g.poly([[CX - t.neck - 2, t.top - 2], [CX - 1, t.top + 6], [CX - t.neck - 3, t.top + 4]], 'w');
      g.poly([[CX + t.neck + 2, t.top - 2], [CX + 1, t.top + 6], [CX + t.neck + 3, t.top + 4]], 'w');
      for (let y = t.top + 9; y < 63; y += 4) g.px(31, y, 'x');
      g.line(31, t.top + 8, 31, 63, 'C');
      return finish(g);
    },
  },
  {
    id: 'tank', name: 'Débardeur',
    draw: (t) => {
      const g = base(t, 0);
      const inner = Math.round(t.rx - 6);
      g.clear((x, y) => y < t.top + 10 && (x < CX - inner || x > CX + inner));
      g.rect(Math.round(CX - inner), t.top - 1, Math.round(CX - inner) + 2, t.top + 10, 'c');
      g.rect(Math.round(CX + inner) - 2, t.top - 1, Math.round(CX + inner), t.top + 10, 'c');
      g.clear((x, y) => ((x + 0.5 - CX) / (inner - 2)) ** 2 + ((y + 0.5 - t.top) / 6) ** 2 <= 1);
      return finish(g);
    },
  },
  {
    id: 'turtleneck', name: 'Col roulé',
    draw: (t) => {
      const g = base(t);
      g.rect(Math.ceil(CX - t.neck - 1), 36, Math.floor(CX + t.neck + 1), t.top + 2, 'c');
      for (let y = 37; y <= t.top; y += 2) g.line(Math.ceil(CX - t.neck - 1), y, Math.floor(CX + t.neck + 1), y, 'C');
      return finish(g);
    },
  },
  {
    id: 'overalls', name: 'Salopette',
    draw: (t) => {
      const g = base(t);
      g.clear((x, y) => ((x + 0.5 - CX) / (t.neck + 1.5)) ** 2 + ((y + 0.5 - (t.top - 1)) / 4) ** 2 <= 1);
      g.recolor('c', 'w');
      g.rect(24, 54, 39, 63, 'c');
      g.rect(24, t.top + 1, 26, 54, 'c');
      g.rect(37, t.top + 1, 39, 54, 'c');
      g.px(25, 53, 'a').px(38, 53, 'a');
      g.rect(28, 57, 35, 60, 'C');
      g.shade('w', 'S', 1, 0, 1);
      g.recolor('S', 'w', () => true);
      return finish(g);
    },
  },
];

export default TOPS.map((tp) => ({
  id: `top-${tp.id}`,
  name: tp.name,
  category: 'top',
  fitsBody: true,
  build: (ctx = {}) => {
    const t = BODY_TYPES[ctx.bodyType] || BODY_TYPES.moyen;
    return [{ name: `Haut (${tp.name.toLowerCase()})`, z: Z.top, grid: tp.draw(t) }];
  },
}));
