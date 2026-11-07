// Vue de 3/4 tournée vers la droite, style « portrait » : gros pixels.
// Chaque pièce est dessinée sur une grille 32×32 puis doublée (chaque pixel
// d'art = 2×2 pixels du gabarit 64×64), comme une image en basse définition.
//
// Repères (grille 32×32) : crâne x 8–23, y 4–20 ; oreille x 9–11, y 12–17 ;
// visage x 13–23 (profil droit vertical en x 24) ; sourcils y 11 ; yeux y 12–14
// (œil proche x 16–18, œil lointain x 22–23) ; dessous du nez y 17 ;
// bouche x 19–22, y 18–21 ; menton y 22–23 ; cou x 11–19, y 19–26 ; épaules y 24–25.
// Rôles : o contour commun, s/M/K/L peau (base, ombre douce, ombre, reflet),
// h/H/j cheveux, c/C vêtement, e/p yeux.

import { Grid } from '../../builder.js';

export const N = 32;

/** Grille de travail 32×32. */
export const g32 = () => new Grid(N, N);

/** Motif ASCII (lignes) posé en (ox, oy) dans une grille 32×32. */
export function art(rows, ox = 0, oy = 0) {
  const g = g32();
  g.stamp(Grid.from(rows), ox, oy);
  return g;
}

/** Double une grille 32×32 vers le gabarit 64×64 (pixels 2×2). */
export function x2(g) {
  const out = new Grid(64, 64);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const v = g.a[y * g.w + x];
      if (!v) continue;
      for (let k = 0; k < 4; k++) out.a[(y * 2 + (k >> 1)) * 64 + x * 2 + (k & 1)] = v;
    }
  }
  return out;
}

/** Bruit déterministe 0..1 (textures). */
export function hash(x, y, seed = 1) {
  let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Fusionne plusieurs grilles (les suivantes par-dessus). */
export function merge(...gs) {
  const g = g32();
  for (const o of gs) if (o) g.stamp(o, 0, 0);
  return g;
}
