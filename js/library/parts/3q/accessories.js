// Accessoires de 3/4 (droite), style portrait : lunettes, chapeaux, boucles
// d'oreilles, détails du visage. Grille 32×32 doublée.

import { Z } from '../../builder.js';
import { g32, art, x2 } from './common.js';
import { headMask } from './heads.js';

/** Monture : verre proche (large), verre lointain coupé par le profil, branche vers l'oreille. */
function frames(lens) {
  const g = g32();
  g.rect(15, 11, 19, 14, 'o').rect(16, 12, 18, 13, lens);
  g.rect(21, 11, 24, 14, 'o').rect(22, 12, 23, 13, lens);
  g.px(20, 12, 'o');
  g.line(11, 12, 14, 12, 'o');
  return g;
}

/** Calotte de chapeau : tête gonflée, coupée sous `y1`. */
function crown(y1, grow = 1) {
  const g = headMask('long', 'a');
  for (let i = 0; i < grow; i++) g.outline('a');
  g.clear((x, y) => y > y1);
  return g;
}

const ITEMS = [
  { id: 'glasses', name: 'Lunettes (3/4)', sub: 'glasses', z: Z.glasses, draw: () => frames('g') },
  {
    id: 'sunglasses', name: 'Lunettes de soleil (3/4)', sub: 'glasses', z: Z.glasses,
    draw: () => frames('p').px(16, 12, 'l'),
  },
  {
    id: 'beanie', name: 'Bonnet (3/4)', sub: 'hat', z: Z.hat,
    draw: () => {
      const g = crown(8, 1);
      g.ell(15.5, 4, 8.6, 4, 'a');
      g.clear((x, y) => y > 8);
      // côtes et revers
      g.recolor('a', 'A', (x, y) => (y <= 5 && x % 2 === 0) || y >= 7);
      g.recolor('A', 'a', (x, y) => y === 7 && x % 3 === 0);
      g.outline('o');
      return g;
    },
  },
  {
    id: 'cap', name: 'Casquette (3/4)', sub: 'hat', z: Z.hat,
    draw: () => {
      const g = crown(6, 1);
      // visière vers l'avant (à droite)
      g.poly([[18, 6], [28, 6.4], [28.5, 8], [19, 8]], 'A');
      g.px(14, 2, 'A');
      g.shade('a', 'A', -1, 0, 1);
      g.outline('o');
      return g;
    },
  },
  {
    id: 'earring', name: 'Anneau d\'oreille (3/4)', sub: 'earrings', z: Z.earrings,
    draw: () => art(['a.', '.a', 'a.'], 9, 17),
  },
  {
    id: 'stud', name: 'Clou d\'oreille (3/4)', sub: 'earrings', z: Z.earrings,
    draw: () => art(['a'], 10, 16),
  },
  {
    id: 'flushed', name: 'Joues rougies (3/4)', sub: 'blush', z: Z.blush,
    draw: () => art(['rr...r'], 16, 15),
  },
  {
    id: 'freckles', name: 'Taches de rousseur (3/4)', sub: 'blush', z: Z.blush,
    draw: () => art(['M.M..M', '.M..M.'], 16, 14),
  },
  {
    id: 'scar', name: 'Cicatrice (3/4)', sub: 'blush', z: Z.blush,
    draw: () => art(['K..', '.L.', '..K'], 20, 8),
  },
  {
    id: 'wrinkles', name: 'Rides (3/4)', sub: 'blush', z: Z.blush,
    draw: () => art(['...MMMM', '.......', '.......', '.......', '.......', '.......', '.M.....', '..M....', '.......', '.......'], 15, 8),
  },
];

export default ITEMS.map((it) => ({
  id: `acc-3q-${it.id}`,
  name: it.name,
  category: 'accessory',
  sub: it.sub,
  view: '3q',
  exclusiveKey: it.sub === 'blush' || it.sub === 'makeup' ? null : it.sub,
  build: () => [{ name: it.name.replace(' (3/4)', ''), z: it.z, grid: x2(it.draw()) }],
}));
