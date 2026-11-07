// Accessoires en vue de 3/4 (droite) : lunettes, chapeaux, boucles d'oreilles, joues.

import { G, Z, place } from '../../builder.js';
import { Q } from './common.js';
import { headSilhouette } from './heads.js';

/** Monture : verre proche (large) et lointain (étroit), branche vers l'oreille. */
function frames(lens) {
  const g = G();
  g.rect(31, 22, 37, 27, 'y');
  g.rect(40, 22, 44, 27, 'y');
  g.rect(32, 23, 36, 26, lens);
  g.rect(41, 23, 43, 26, lens);
  g.line(38, 23, 39, 23, 'y');
  g.line(Math.round(Q.earX) + 2, 24, 30, 23, 'y');
  return g;
}

/** Calotte d'un chapeau : tête gonflée, coupée sous `y1`. */
function crown(y1, grow = 2) {
  const g = headSilhouette(G(), 'oval', 'a');
  for (let i = 0; i < grow; i++) g.outline('a');
  g.clear((x, y) => y > y1);
  return g;
}

const ITEMS = [
  {
    id: 'glasses', name: 'Lunettes (3/4)', sub: 'glasses', z: Z.glasses,
    draw: () => frames('g'),
  },
  {
    id: 'sunglasses', name: 'Lunettes de soleil (3/4)', sub: 'glasses', z: Z.glasses,
    draw: () => { const g = frames('p'); g.px(33, 23, 'l').px(41, 23, 'l'); return g; },
  },
  {
    id: 'beanie', name: 'Bonnet (3/4)', sub: 'hat', z: Z.hat,
    draw: () => {
      const g = crown(17);
      g.ell(31, 12, 13.5, 8.5, 'a');
      g.clear((x, y) => y > 17);
      // revers et côtes
      g.recolor('a', 'A', (x, y) => y >= 14 || x % 3 === 2);
      g.recolor('A', 'a', (x, y) => y >= 14 && y <= 15);
      g.shade('a', 'A', -1, 0, 1);
      g.outline('y');
      return g;
    },
  },
  {
    id: 'cap', name: 'Casquette (3/4)', sub: 'hat', z: Z.hat,
    draw: () => {
      const g = crown(15, 1);
      // visière vers l'avant (à droite)
      g.poly([[36, 13], [51, 14], [53, 16.5], [38, 17]], 'A');
      g.line(39, 13, 50, 14, 'a');
      g.px(29, 9, 'A');
      g.shade('a', 'A', -1, 0, 2);
      g.outline('y');
      return g;
    },
  },
  {
    id: 'earring', name: 'Anneau d\'oreille (3/4)', sub: 'earrings', z: Z.earrings,
    draw: () => place(['.y.', 'yay', '.y.'], Math.round(Q.earX) - 1, 32),
  },
  {
    id: 'stud', name: 'Clou d\'oreille (3/4)', sub: 'earrings', z: Z.earrings,
    draw: () => place(['a'], Math.round(Q.earX), 32),
  },
  {
    id: 'blush', name: 'Joues roses (3/4)', sub: 'blush', z: Z.blush,
    draw: () => G().ell(35, 29.5, 2.5, 1.2, 'r').ell(44, 29.5, 1, 1, 'r'),
  },
  {
    id: 'freckles', name: 'Taches de rousseur (3/4)', sub: 'blush', z: Z.blush,
    draw: () => place(['S.S.S', '.S.S.'], 33, 28).px(43, 28, 'S').px(44, 29, 'S'),
  },
  {
    id: 'scar', name: 'Cicatrice (3/4)', sub: 'blush', z: Z.blush,
    draw: () => place(['k..', '.k.', 'k.k', '..k'], 37, 27),
  },
];

export default ITEMS.map((it) => ({
  id: `acc-3q-${it.id}`,
  name: it.name,
  category: 'accessory',
  sub: it.sub,
  view: '3q',
  exclusiveKey: it.sub === 'blush' || it.sub === 'makeup' ? null : it.sub,
  build: () => [{ name: it.name.replace(' (3/4)', ''), z: it.z, grid: it.draw() }],
}));
