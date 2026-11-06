// Bustes / corps neutres. Pour ajouter un corps : ajoutez une entrée à BODY_TYPES.

import { G, Z } from '../builder.js';

// cx = centre ; rx = demi-largeur des épaules ; top = haut des épaules
export const BODY_TYPES = {
  fin: { name: 'Fin', rx: 14, top: 45, neck: 4 },
  moyen: { name: 'Moyen', rx: 18, top: 44, neck: 5 },
  large: { name: 'Large', rx: 22, top: 43, neck: 6 },
  rond: { name: 'Rond', rx: 20, top: 46, neck: 5, round: true },
};

export function torso(g, t, role, grow = 0) {
  const cx = 31.5;
  const rx = t.rx + grow;
  const ry = t.round ? 13 : 9;
  g.ell(cx, t.top + ry - grow, rx, ry + grow, role);
  g.rect(Math.ceil(cx - rx), t.top + ry - grow, Math.floor(cx + rx), 63, role);
  if (t.round) g.ell(cx, 63, rx + 1, 10, role);
  return g;
}

function body(t) {
  const g = G();
  const cx = 31.5;
  // cou
  g.rect(Math.ceil(cx - t.neck), 32, Math.floor(cx + t.neck), t.top + 2, 's');
  torso(g, t, 's');
  // ombre sous le menton et sur le côté droit
  g.rect(Math.ceil(cx - t.neck), 36, Math.floor(cx + t.neck), 38, 'S');
  g.shade('s', 'S', 1, 0, 2);
  // aisselles
  const ax = Math.round(t.rx - 5);
  g.line(Math.round(cx - ax), 57, Math.round(cx - ax), 63, 'S');
  g.line(Math.round(cx + ax), 57, Math.round(cx + ax), 63, 'S');
  g.outline('k');
  return g;
}

export default Object.entries(BODY_TYPES).map(([key, t]) => ({
  id: `body-${key}`,
  name: t.name,
  category: 'body',
  bodyType: key,
  build: () => [{ name: `Corps (${t.name.toLowerCase()})`, z: Z.body, grid: body(t) }],
}));
