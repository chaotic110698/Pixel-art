// Bustes de 3/4 (droite), style portrait : cou épais éclairé par la gauche,
// épaules larges et tombantes. Plusieurs physiques. Grille 32×32 doublée.

import { Z } from '../../builder.js';
import { g32, x2 } from './common.js';

// k : largeur des épaules (1 = moyen) ; dy : hauteur des épaules ;
// neck : élargissement du cou ; belly : ventre arrondi ; traps : trapèzes marqués
export const BODY3Q = {
  '3q-fin': { name: 'Fin (3/4)', k: 0.82, dy: 1, neck: -0.6 },
  '3q-moyen': { name: 'Moyen (3/4)', k: 1, dy: 0, neck: 0 },
  '3q-costaud': { name: 'Costaud (3/4)', k: 1.14, dy: -1, neck: 0.9, traps: true },
  '3q-rond': { name: 'Rond (3/4)', k: 1.08, dy: 0.5, neck: 0.4, belly: true },
};

const CX = 15.5;

/** Cou (rôle `role`). Bord gauche en diagonale, caché en haut par la mâchoire. */
export function neck(g, t, role = 's') {
  const n = t.neck;
  g.poly([[11.4 - n, 16.5], [19.6 + n, 16.5], [19.6 + n, 27], [13 - n, 27], [11 - n, 24.6], [11 - n, 20]], role);
  return g;
}

/** Torse (épaules + poitrine) jusqu'en bas du gabarit. */
export function torso(g, t, role = 's', grow = 0) {
  const sx = (x) => CX + (x - CX) * t.k;
  const d = t.dy;
  const pts = [
    [11 - t.neck, 24.4 + d], [8, 24.6 + d], [5, 25.6 + d], [3.4, 27 + d], [2.5, 28.6 + d], [2.3, 32.5],
    [29, 32.5], [28.9, 28.6 + d], [28, 27.5 + d], [26.2, 26.3 + d], [24, 25.3 + d], [20 + t.neck, 25 + d],
  ].map(([x, y], i) => [i === 0 || i === 11 ? x : sx(x) + (x < CX ? -grow : grow), y - grow]);
  g.poly(pts, role);
  if (t.traps) g.poly([[10, 23.4], [21, 23.6], [25, 25.5], [6, 25.5]], role);
  if (t.belly) g.ell(CX + 1, 34, 14.5 * t.k + grow, 6.5, role);
  return g;
}

/** Ombrage du cou : éclairé à gauche, ombre portée du menton à droite. */
export function shadeNeck(g, t) {
  g.recolor('s', 'M', (x, y) => y >= 17 && y <= 26 && x >= 11 && x <= 20 && x - y > -12 + t.neck);
  g.recolor('M', 'K', (x, y) => y >= 17 && y <= 25 && x >= 11 && x <= 20 && x - y > -10 + t.neck);
  return g;
}

function bust(t) {
  const g = g32();
  torso(g, t, 's');
  neck(g, t, 's');
  shadeNeck(g, t);
  // clavicule, plis des bras, poitrine, côté gauche dans l'ombre
  g.line(13, 27 + Math.round(t.dy), 19, 27 + Math.round(t.dy), 'M');
  g.line(8, 29, 8, 31, 'M');
  g.line(Math.round(CX + 10.5 * t.k), 29, Math.round(CX + 10.5 * t.k), 31, 'M');
  g.shade('s', 'M', -1, 0, 1);
  g.outline('o');
  return g;
}

export default Object.entries(BODY3Q).map(([key, t]) => ({
  id: `body-${key}`,
  name: t.name,
  category: 'body',
  view: '3q',
  bodyType: key,
  build: () => [{ name: `Corps (${t.name.replace(' (3/4)', '').toLowerCase()}, 3/4)`, z: Z.body, grid: x2(bust(t)) }],
}));
