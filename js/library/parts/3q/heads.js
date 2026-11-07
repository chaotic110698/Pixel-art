// Têtes en vue de 3/4 (droite) : crâne arrondi à gauche, profil du visage à droite
// (front, arcade, lèvres, menton), oreille dessinée à l'intérieur de la silhouette.

import { G, Z } from '../../builder.js';
import { Q, shade3q } from './common.js';

/** Profils (sommets) : front -> arcade -> lèvres -> menton -> mâchoire -> nuque. */
export const PROFILES = {
  oval: [[37, 10.5], [42.5, 12.5], [45.5, 16.5], [46.5, 21], [46.5, 24], [45.8, 27], [46, 31], [46.5, 33], [45.8, 35.5], [46, 38], [44.5, 40.5], [41, 41.5], [35, 40], [29, 36.5], [23, 31]],
  square: [[37, 10.5], [42.5, 12.5], [45.5, 16.5], [46.5, 21], [46.5, 24], [45.8, 27], [46, 31], [46.5, 33], [46, 35.5], [46.5, 39], [45.5, 41.8], [39, 42.5], [32, 40.5], [26, 35.5], [22, 30]],
  long: [[37, 10.5], [42.5, 12.5], [45.5, 16.5], [46.5, 21], [46.5, 24], [45.8, 27], [46, 31], [46.5, 34], [45.8, 37], [46, 40], [44.5, 42.5], [41, 43.5], [35, 42], [29, 37.5], [23, 31]],
  round: [[37, 10.5], [42.5, 12.5], [45.5, 16.5], [46.5, 21], [46.5, 24], [46.5, 27], [47, 31], [47, 34], [46, 37.5], [43.5, 40.5], [39, 41.5], [33, 40.5], [27, 37], [22, 31]],
};

/** Silhouette d'une tête (rôle `role`). */
export function headSilhouette(g, kind = 'oval', role = 's') {
  g.ell(Q.cx - 1, 22.5, 12.3, 12.5, role);
  g.poly([[31, 10], ...PROFILES[kind], [21, 26]], role);
  if (kind === 'round') g.ell(38, 33, 7, 6.5, role);
  return g;
}

/** Oreille vue de 3/4 : contour avant, creux ombré. */
function ear(g) {
  const { earX: ex, earY: ey } = Q;
  const inOuter = (x, y) => ((x + 0.5 - ex) / 3) ** 2 + ((y + 0.5 - ey) / 4.4) ** 2 <= 1;
  const inInner = (x, y) => ((x + 0.5 - ex + 0.4) / 2) ** 2 + ((y + 0.5 - ey) / 3.4) ** 2 <= 1;
  g.fill((x, y) => inOuter(x, y) && !inInner(x, y) && (x + 0.5 >= ex || y + 0.5 > ey + 1.5), 'k');
  g.fill((x, y) => inInner(x, y), 's');
  g.px(Math.floor(ex) - 1, Math.floor(ey) - 1, 'S').px(Math.floor(ex) - 1, Math.floor(ey), 'S').px(Math.floor(ex), Math.floor(ey) + 1, 'S');
  return g;
}

function draw(kind) {
  const g = headSilhouette(G(), kind);
  shade3q(g, 's', 'S', 2);
  // le visage (côté éclairé) n'est pas ombré, sauf sous le menton
  g.recolor('S', 's', (x, y) => x > 36 && y < 38);
  g.outline('k');
  ear(g);
  return g;
}

const HEADS = [
  { id: 'oval', name: 'Ovale (3/4)' },
  { id: 'square', name: 'Mâchoire carrée (3/4)' },
  { id: 'long', name: 'Allongée (3/4)' },
  { id: 'round', name: 'Ronde (3/4)' },
];

export default HEADS.map((hd) => ({
  id: `head-3q-${hd.id}`,
  name: hd.name,
  category: 'head',
  view: '3q',
  build: () => [{ name: `Tête (${hd.name.replace(' (3/4)', '').toLowerCase()}, 3/4)`, z: Z.head, grid: draw(hd.id) }],
}));
