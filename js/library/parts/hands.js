// Mains et bras (gestes) pour les bustes : ajoutés par-dessus le reste.

import { G, Z } from '../builder.js';

function finish(g) {
  g.shade('s', 'S', 1, 1, 1);
  g.shade('c', 'C', 1, 0, 1);
  g.outline('k', { only: ['s', 'S'] });
  g.outline('x');
  return g;
}

const HANDS = [
  {
    id: 'wave', name: 'Coucou',
    draw: () => {
      const g = G();
      // avant-bras qui monte depuis le bas à droite, manche aux couleurs du vêtement
      g.poly([[46, 63], [53, 63], [55, 40], [50, 39]], 's');
      g.poly([[45, 63], [54, 63], [54.5, 52], [47, 52]], 'c');
      // paume et doigts écartés
      g.ell(52.5, 35, 4.5, 5, 's');
      for (const [x, y] of [[48.5, 28], [51, 27], [53.5, 27], [56, 28.5]]) g.rect(Math.round(x), Math.round(y), Math.round(x) + 1, 32, 's');
      g.rect(57, 33, 58, 35, 's');
      return finish(g);
    },
  },
  {
    id: 'thumbs', name: 'Pouce levé',
    draw: () => {
      const g = G();
      g.ell(17, 56, 5, 4.5, 's');
      g.rect(15, 47, 17, 53, 's'); // pouce
      for (let y = 53; y <= 59; y += 2) g.line(19, y, 21, y, 'S');
      g.rect(12, 59, 22, 63, 'c');
      return finish(g);
    },
  },
  {
    id: 'peace', name: 'Signe V',
    draw: () => {
      const g = G();
      g.poly([[44, 63], [51, 63], [51, 46], [46, 45]], 's');
      g.poly([[43, 63], [52, 63], [52, 55], [44, 55]], 'c');
      g.ell(48.5, 42, 4, 4.5, 's');
      g.poly([[45, 39], [47, 39], [46, 30], [44.5, 30.5]], 's');
      g.poly([[48.5, 39], [50.5, 39], [52.5, 31], [51, 30.5]], 's');
      return finish(g);
    },
  },
  {
    id: 'chin', name: 'Main au menton',
    draw: () => {
      const g = G();
      g.poly([[18, 63], [25, 63], [29, 42], [24, 41]], 's');
      g.poly([[17, 63], [26, 63], [27, 54], [20, 54]], 'c');
      g.ell(29.5, 39.5, 5, 3, 's');
      g.line(26, 39, 33, 39, 'S');
      return finish(g);
    },
  },
];

export default HANDS.map((hd) => ({
  id: `hands-${hd.id}`,
  name: hd.name,
  category: 'hands',
  build: () => [{ name: `Main (${hd.name.toLowerCase()})`, z: Z.hands, grid: hd.draw() }],
}));
