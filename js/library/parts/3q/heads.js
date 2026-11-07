// Têtes de 3/4 (droite), style portrait : visage long, profil droit vertical,
// mâchoire marquée, oreille à gauche. Dessinées en 32×32 puis doublées.

import { Z } from '../../builder.js';
import { g32, art, x2 } from './common.js';

// Contour du visage (sommets, grille 32×32) : front -> profil -> menton -> mâchoire.
const FACES = {
  long: [[13, 8], [21, 5.5], [23.6, 6.6], [24, 8], [24, 20], [23, 21.6], [22, 22.6], [16.5, 22.6], [11.5, 17.5]],
  square: [[13, 8], [21, 5.5], [23.6, 6.6], [24, 8], [24, 21], [23.6, 22.6], [15.5, 22.6], [11.5, 17.5]],
  oval: [[13, 8], [21, 5.5], [23.6, 6.6], [24, 8], [24, 18.5], [22.6, 20.8], [20.6, 21.8], [16.6, 21.5], [11.5, 17]],
  full: [[13, 8], [21, 5.5], [23.6, 6.6], [24, 8], [24.6, 16.5], [24.4, 20.5], [22.5, 22.6], [16, 22.4], [11, 17]],
};

/** Silhouette (sans contour) d'une tête : sert de masque aux cheveux et barbes. */
export function headMask(kind = 'long', role = 's') {
  const g = g32();
  g.ell(15.5, 12, 7.6, 8, role);
  g.poly(FACES[kind], role);
  return g;
}

// oreille (posée en x 8, y 12)
const EAR = [
  '.ooo.',
  'osMKo',
  'osKM.',
  'oMKM.',
  'oMMM.',
  '.ooo.',
];

function draw(kind) {
  const g = headMask(kind);
  // ombres : arrière du crâne, joue côté oreille, dessous de la mâchoire
  g.recolor('s', 'M', (x, y) => (x <= 9 && y >= 9) || (x <= 14 && y >= 8 && x >= 12) || (y >= 18 && x <= 16));
  g.shade('s', 'M', 0, 1, 1);
  g.shade('M', 'K', 0, 1, 1);
  g.stamp(art(EAR, 8, 12), 0, 0);
  g.outline('o');
  return g;
}

const HEADS = [
  { id: 'long', name: 'Visage long (3/4)' },
  { id: 'square', name: 'Mâchoire carrée (3/4)' },
  { id: 'oval', name: 'Ovale (3/4)' },
  { id: 'full', name: 'Visage plein (3/4)' },
];

export default HEADS.map((hd) => ({
  id: `head-3q-${hd.id}`,
  name: hd.name,
  category: 'head',
  view: '3q',
  build: () => [{ name: `Tête (${hd.name.replace(' (3/4)', '').toLowerCase()}, 3/4)`, z: Z.head, grid: x2(draw(hd.id)) }],
}));
