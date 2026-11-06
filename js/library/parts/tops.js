// Hauts simples, ajustés automatiquement au type de corps du projet.

import { G, Z, Grid } from '../builder.js';
import { BODY_TYPES, torso } from './bodies.js';

const CX = 31.5;

function base(t, grow = 1) {
  // corps entier : grille 64×96 (le haut s'arrête à la taille)
  const g = torso(t.tall ? new Grid(64, 96) : G(), t, 'c', grow);
  return g;
}

const neckHole = (g, t) => g.clear((x, y) => ((x + 0.5 - CX) / (t.neck + 1.5)) ** 2 + ((y + 0.5 - (t.top - 1)) / 4) ** 2 <= 1);
const bottomY = (t) => (t.tall ? t.waist : 63);

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
    id: 'jacket', name: 'Veste ouverte',
    draw: (t) => {
      const g = base(t);
      neckHole(g, t);
      // t-shirt blanc visible au milieu, revers
      g.rect(27, t.top - 1, 36, bottomY(t), 'w');
      neckHole(g, t);
      g.poly([[CX - t.neck - 3, t.top - 1], [CX - 4, t.top + 10], [CX - t.neck - 4, t.top + 8]], 'C');
      g.poly([[CX + t.neck + 3, t.top - 1], [CX + 4, t.top + 10], [CX + t.neck + 4, t.top + 8]], 'C');
      g.line(26, t.top + 6, 26, bottomY(t), 'x').line(37, t.top + 6, 37, bottomY(t), 'x');
      g.px(24, t.top + 14, 'a');
      return finish(g);
    },
  },
  {
    id: 'dress', name: 'Robe',
    draw: (t) => {
      const g = base(t, 0);
      const inner = Math.round(t.rx - 6);
      g.clear((x, y) => y < t.top + 8 && (x < CX - inner || x > CX + inner));
      g.clear((x, y) => ((x + 0.5 - CX) / (inner - 1)) ** 2 + ((y + 0.5 - t.top) / 5) ** 2 <= 1);
      g.line(Math.round(CX - inner) + 1, t.top - 2, Math.round(CX - inner) + 1, t.top + 7, 'c');
      g.line(Math.round(CX + inner) - 1, t.top - 2, Math.round(CX + inner) - 1, t.top + 7, 'c');
      // volants à la taille
      const wy = t.tall ? t.waist - 4 : 58;
      g.line(Math.ceil(CX - t.rx + 1), wy, Math.floor(CX + t.rx - 1), wy, 'a');
      for (let x = Math.ceil(CX - t.rx + 2); x < CX + t.rx - 1; x += 3) g.px(x, wy + 1, 'A');
      return finish(g);
    },
  },
  {
    id: 'kimono', name: 'Kimono',
    draw: (t) => {
      const g = base(t, 2);
      // col croisé en V
      g.poly([[CX - t.neck - 1, t.top - 3], [CX + t.neck + 1, t.top - 3], [CX + 2, t.top + 9]], 's');
      g.line(Math.round(CX - t.neck - 1), t.top - 2, 34, t.top + 10, 'w');
      g.line(Math.round(CX - t.neck), t.top - 2, 35, t.top + 10, 'w');
      g.line(Math.round(CX + t.neck + 1), t.top - 2, 31, t.top + 6, 'C');
      // ceinture
      const by = t.tall ? t.waist - 6 : 57;
      g.rect(Math.ceil(CX - t.rx - 1), by, Math.floor(CX + t.rx + 1), by + 3, 'a');
      g.line(Math.ceil(CX - t.rx - 1), by + 1, Math.floor(CX + t.rx + 1), by + 1, 'A');
      return finish(g);
    },
  },
  {
    id: 'armor', name: 'Armure',
    draw: (t) => {
      const g = base(t, 1);
      neckHole(g, t);
      g.recolor('c', 'a');
      // épaulières et plastron
      g.ell(CX - t.rx + 3, t.top + 3, 5, 4, 'A');
      g.ell(CX + t.rx - 3, t.top + 3, 5, 4, 'A');
      g.rect(25, t.top + 5, 38, bottomY(t), 'A');
      g.rect(26, t.top + 6, 37, bottomY(t) - 1, 'a');
      g.line(31, t.top + 6, 31, bottomY(t) - 1, 'y');
      for (const [x, y] of [[27, t.top + 8], [36, t.top + 8], [27, t.top + 15], [36, t.top + 15]]) g.px(x, y, 'l');
      g.shade('a', 'A', 1, 0, 1);
      g.outline('y');
      return g;
    },
  },
  {
    id: 'stripes', name: 'Pull rayé',
    draw: (t) => {
      const g = base(t);
      neckHole(g, t);
      g.recolor('c', 'w', (x, y) => Math.floor((y - t.top) / 2) % 2 === 1);
      g.rect(Math.ceil(CX - t.neck - 2), t.top - 2, Math.floor(CX + t.neck + 2), t.top - 1, 'c');
      neckHole(g, t);
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
