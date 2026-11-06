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
  // ----- têtes non humaines -----
  {
    id: 'head-cat', name: 'Chat',
    draw: () => {
      const g = G();
      g.ell(31.5, 25, 13.5, 12.5, 's');
      g.poly([[18.5, 20], [19, 7], [28, 14]], 's');
      g.poly([[45, 20], [44.5, 7], [35.5, 14]], 's');
      g.poly([[20.5, 16], [21, 10], [25.5, 14]], 'r');
      g.poly([[43, 16], [42.5, 10], [38, 14]], 'r');
      g.ell(31.5, 32, 6, 4, 'w');
      g.shade('s', 'S', 1, 1, 1);
      g.outline('k');
      // moustaches
      g.line(13, 30, 19, 31, 'k').line(13, 33, 19, 32, 'k');
      g.line(44, 31, 50, 30, 'k').line(44, 32, 50, 33, 'k');
      return g;
    },
  },
  {
    id: 'head-robot', name: 'Robot',
    draw: () => {
      const g = G();
      g.rect(19, 13, 44, 37, 'a');
      g.rect(21, 21, 42, 30, 'p');
      g.rect(31, 6, 32, 12, 'A');
      g.ell(31.5, 5.5, 2.5, 2.5, 'e');
      g.rect(15, 21, 18, 29, 'A').rect(45, 21, 48, 29, 'A');
      for (const [x, y] of [[21, 15], [42, 15], [21, 35], [42, 35]]) g.px(x, y, 'y');
      g.shade('a', 'A', 1, 1, 1);
      g.outline('y');
      return g;
    },
  },
  {
    id: 'head-slime', name: 'Slime',
    draw: () => {
      const g = G();
      g.ell(31.5, 28, 15, 11, 's');
      g.ell(31.5, 20, 9, 9, 's');
      g.ell(31.5, 11, 2.5, 3, 's');
      g.px(25, 16, 'w').px(26, 15, 'w').px(24, 18, 'w');
      g.shade('s', 'S', 1, 1, 2);
      g.outline('k');
      return g;
    },
  },
  {
    id: 'head-ghost', name: 'Fantôme',
    draw: () => {
      const g = G();
      g.ell(31.5, 24, 13, 14, 's');
      g.shade('s', 'S', 1, 1, 1);
      g.outline('k');
      return g;
    },
  },
  {
    id: 'head-dog', name: 'Chien',
    draw: () => {
      const g = G();
      g.ell(31.5, 24.5, 12.5, 13, 's');
      g.ell(31.5, 32, 7, 5, 'w');
      g.ell(31.5, 29, 2.5, 1.8, 'p');
      // oreilles tombantes (couleur des cheveux)
      g.ell(17.5, 22, 4, 9, 'h').ell(45.5, 22, 4, 9, 'h');
      g.shade('s', 'S', 1, 1, 1);
      g.shade('h', 'H', 1, 1, 1);
      g.outline('k', { only: ['s', 'S', 'w', 'p'] });
      g.outline('q');
      return g;
    },
  },
];

export default HEADS.map((hd) => ({
  id: hd.id,
  name: hd.name,
  category: 'head',
  build: () => [{ name: `Tête (${hd.name.toLowerCase()})`, z: Z.head, grid: hd.draw() }],
}));
