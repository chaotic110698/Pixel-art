// Têtes / visages (avec oreilles). Gabarit : tête entre x 20..43, y 11..37.

import { G, Z } from '../builder.js';

function ears(g) {
  g.ell(19.5, 26.5, 2.5, 3.5, 's');
  g.ell(44.5, 26.5, 2.5, 3.5, 's');
  g.px(19, 26, 'S').px(19, 27, 'S').px(44, 26, 'S').px(44, 27, 'S');
  return g;
}

function finish(g) {
  g.shade('s', 'S', 1, 1, 1);
  g.outline('k');
  return g;
}

const HEADS = [
  {
    id: 'head-round', name: 'Ronde',
    draw: () => finish(ears(G()).ell(31.5, 24.5, 12.5, 13.5, 's')),
  },
  {
    id: 'head-oval', name: 'Ovale',
    draw: () => finish(ears(G()).ell(31.5, 24.5, 11.5, 14, 's')),
  },
  {
    id: 'head-square', name: 'Carrée',
    draw: () => {
      const g = ears(G());
      g.ell(31.5, 21, 12.5, 10, 's');
      g.rect(20, 21, 43, 32, 's');
      g.ell(31.5, 32, 11.5, 5.5, 's');
      return finish(g);
    },
  },
  {
    id: 'head-pointy', name: 'Menton fin',
    draw: () => {
      const g = ears(G());
      g.ell(31.5, 22, 12.5, 11, 's');
      g.poly([[19.5, 24], [44, 24], [37, 35], [31.5, 38.5], [26.5, 35]], 's');
      return finish(g);
    },
  },
  {
    id: 'head-chubby', name: 'Joufflue',
    draw: () => {
      const g = ears(G());
      g.ell(31.5, 23, 12.5, 12, 's');
      g.ell(31.5, 29, 13.5, 8.5, 's');
      return finish(g);
    },
  },
];

export default HEADS.map((hd) => ({
  id: hd.id,
  name: hd.name,
  category: 'head',
  build: () => [{ name: `Tête (${hd.name.toLowerCase()})`, z: Z.head, grid: hd.draw() }],
}));
