// Nez (petits motifs centrés sur x = 31,5).

import { place, Z } from '../builder.js';

const NOSES = [
  { id: 'dot', name: 'Discret', rows: ['SS'], x: 31, y: 30 },
  { id: 'small', name: 'Petit', rows: ['.S', 'SS'], x: 31, y: 29 },
  { id: 'line', name: 'Arête', rows: ['S.', 'S.', 'SS'], x: 31, y: 28 },
  { id: 'button', name: 'Bouton', rows: ['.SS.', 'S..S', '.kk.'], x: 30, y: 28 },
  { id: 'pointy', name: 'Pointu', rows: ['..S', '..S', '.SS', 'kk.'], x: 30, y: 27 },
  { id: 'nostrils', name: 'Narines', rows: ['k..k'], x: 30, y: 30 },
];

export default NOSES.map((n) => ({
  id: `nose-${n.id}`,
  name: n.name,
  category: 'nose',
  build: () => [{ name: `Nez (${n.name.toLowerCase()})`, z: Z.nose, grid: place(n.rows, n.x, n.y) }],
}));
