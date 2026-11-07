// Bustes en vue de 3/4 (droite), plusieurs physiques. Le torse est tourné :
// l'épaule proche (gauche) est plus large, la poitrine regarde vers la droite.

import { G, Z } from '../../builder.js';

// cx : centre du torse ; rx : demi-largeur côté épaule proche ; fx : côté poitrine (droite)
// top : haut des épaules ; neck : demi-largeur du cou ; belly : ventre arrondi ; traps : trapèzes marqués
export const BODY3Q = {
  '3q-fin': { name: 'Fin (3/4)', cx: 32, rx: 14, fx: 12, top: 45, neck: 3.5 },
  '3q-moyen': { name: 'Moyen (3/4)', cx: 32, rx: 18, fx: 15, top: 44, neck: 4 },
  '3q-costaud': { name: 'Costaud (3/4)', cx: 31, rx: 23, fx: 19, top: 43, neck: 5.5, traps: true },
  '3q-rond': { name: 'Rond (3/4)', cx: 32, rx: 20, fx: 18, top: 46, neck: 4.5, belly: true },
};

/** Centre du cou (décalé vers l'avant du visage). */
export const NECK_X = 35;

/** Torse tourné de 3/4 (rôle `role`, agrandi de `grow` pour les vêtements). */
export function torso3q(g, t, role, grow = 0) {
  const top = t.top - grow;
  const L = t.cx - t.rx - grow, R = t.cx + t.fx + grow;
  // épaule proche (arrondie) et épaule lointaine (plus basse, en partie cachée)
  g.ell(t.cx - t.rx * 0.45, top + 8, t.rx * 0.6 + grow, 8 + grow, role);
  g.ell(t.cx + t.fx * 0.45, top + 9, t.fx * 0.6 + grow, 8 + grow, role);
  g.poly([[t.cx - t.rx * 0.4, top], [t.cx + t.fx * 0.4, top + 0.5], [R, top + 9], [R + 0.5, 64], [L - 0.5, 64], [L, top + 8]], role);
  if (t.traps) g.poly([[NECK_X - t.neck - 1, top - 4], [NECK_X + t.neck, top - 3], [R - 4, top + 3], [L + 4, top + 3]], role);
  if (t.belly) g.ell(t.cx + 2, 66, t.fx + 2 + grow, 14 + grow, role);
  return g;
}

function bust(t) {
  const g = G();
  // cou (sous la mâchoire)
  g.rect(Math.ceil(NECK_X - t.neck - 1), 34, Math.floor(NECK_X + t.neck), t.top + 2, 's');
  torso3q(g, t, 's');
  // ombre sous la mâchoire et côté arrière du cou
  g.rect(Math.ceil(NECK_X - t.neck - 1), 36, Math.floor(NECK_X + t.neck), 39, 'S');
  g.rect(Math.ceil(NECK_X - t.neck - 1), 36, Math.ceil(NECK_X - t.neck), t.top + 1, 'S');
  // côté arrière (gauche) dans l'ombre, dessous
  g.shade('s', 'S', -1, 0, 3);
  // creux du bras proche, clavicule, pli de la poitrine
  const ax = Math.round(t.cx - t.rx + 6);
  g.line(ax, t.top + 9, ax - 1, 63, 'S');
  g.line(Math.round(NECK_X - 3), t.top + 4, Math.round(NECK_X + 3), t.top + 4, 'S');
  g.line(Math.round(t.cx + t.fx - 4), t.top + 10, Math.round(t.cx + t.fx - 4), 63, 'S');
  g.outline('k');
  return g;
}

export default Object.entries(BODY3Q).map(([key, t]) => ({
  id: `body-${key}`,
  name: t.name,
  category: 'body',
  view: '3q',
  bodyType: key,
  build: () => [{ name: `Corps (${t.name.replace(' (3/4)', '').toLowerCase()}, 3/4)`, z: Z.body, grid: bust(t) }],
}));
