// Corps. Bustes (gabarit 64×64) et corps entiers (gabarit 64×96 : les 64 premières
// lignes coïncident avec le buste, la tête reste au même endroit).
// Pour ajouter un corps : ajoutez une entrée à BODY_TYPES (+ éventuellement un dessin).

import { G, Z, Grid } from '../builder.js';

// cx = centre ; rx = demi-largeur des épaules ; top = haut des épaules
// tall : corps entier (taille, jambes) ; waist : ligne de taille (corps entiers)
export const BODY_TYPES = {
  fin: { name: 'Fin', rx: 14, top: 45, neck: 4 },
  moyen: { name: 'Moyen', rx: 18, top: 44, neck: 5 },
  large: { name: 'Large', rx: 22, top: 43, neck: 6 },
  rond: { name: 'Rond', rx: 20, top: 46, neck: 5, round: true },
  'entier-fin': { name: 'Corps entier (fin)', rx: 11, top: 42, neck: 4, tall: true, waist: 64 },
  'entier-moyen': { name: 'Corps entier (moyen)', rx: 13, top: 41, neck: 5, tall: true, waist: 64 },
};

const CX = 31.5;

/** Torse (épaules + buste) ; pour les corps entiers : jusqu'à la taille. */
export function torso(g, t, role, grow = 0) {
  const rx = t.rx + grow;
  if (t.tall) {
    g.ell(CX, t.top + 4 - grow, rx, 5 + grow, role);
    g.rect(Math.ceil(CX - rx + 1), t.top + 4, Math.floor(CX + rx - 1), t.waist + grow, role);
    return g;
  }
  const ry = t.round ? 13 : 9;
  g.ell(CX, t.top + ry - grow, rx, ry + grow, role);
  g.rect(Math.ceil(CX - rx), t.top + ry - grow, Math.floor(CX + rx), 63, role);
  if (t.round) g.ell(CX, 63, rx + 1, 10, role);
  return g;
}

function bust(t) {
  const g = G();
  g.rect(Math.ceil(CX - t.neck), 32, Math.floor(CX + t.neck), t.top + 2, 's');
  torso(g, t, 's');
  g.rect(Math.ceil(CX - t.neck), 36, Math.floor(CX + t.neck), 38, 'S');
  g.shade('s', 'S', 1, 0, 2);
  const ax = Math.round(t.rx - 5);
  g.line(Math.round(CX - ax), 57, Math.round(CX - ax), 63, 'S');
  g.line(Math.round(CX + ax), 57, Math.round(CX + ax), 63, 'S');
  g.outline('k');
  return g;
}

/** Corps entier « chibi » : cou, torse, bras le long du corps, short et chaussures. */
function fullBody(t) {
  const g = new Grid(64, 96);
  g.rect(Math.ceil(CX - t.neck), 32, Math.floor(CX + t.neck), t.top + 2, 's');
  torso(g, t, 's');
  // bras
  const ax = Math.round(CX - t.rx - 1);
  g.rect(ax - 2, t.top + 3, ax + 1, t.waist + 6, 's');
  g.rect(Math.round(CX + t.rx) - 1, t.top + 3, Math.round(CX + t.rx) + 2, t.waist + 6, 's');
  g.ell(ax - 0.5, t.waist + 7.5, 2.6, 2.4, 's');
  g.ell(Math.round(CX + t.rx) + 0.5, t.waist + 7.5, 2.6, 2.4, 's');
  // short (couleur d'accessoire) et jambes
  g.rect(Math.ceil(CX - t.rx + 1), t.waist, Math.floor(CX + t.rx - 1), t.waist + 9, 'a');
  g.line(31, t.waist + 3, 31, t.waist + 9, 'A');
  g.line(32, t.waist + 3, 32, t.waist + 9, 'A');
  g.rect(Math.ceil(CX - t.rx + 3), t.waist + 10, 29, 88, 's');
  g.rect(34, t.waist + 10, Math.floor(CX + t.rx - 3), 88, 's');
  // chaussures
  g.rect(Math.ceil(CX - t.rx + 1), 89, 30, 94, 'x');
  g.rect(33, 89, Math.floor(CX + t.rx - 1), 94, 'x');
  g.rect(Math.ceil(CX - t.neck), 36, Math.floor(CX + t.neck), 38, 'S');
  g.shade('s', 'S', 1, 0, 1);
  g.shade('a', 'A', 1, 0, 1);
  g.outline('k');
  return g;
}

/** Buste de robot (couleur d'accessoire = métal). */
function robotBody() {
  const g = G();
  g.rect(28, 34, 35, 46, 'A');
  for (let y = 36; y <= 45; y += 3) g.line(28, y, 35, y, 'y');
  g.ell(CX, 52, 19, 8, 'a');
  g.rect(13, 52, 50, 63, 'a');
  g.rect(24, 52, 39, 60, 'A');
  g.ell(CX, 56, 3, 3, 'e');
  g.px(31, 55, 'l');
  for (const x of [17, 46]) for (const y of [54, 60]) g.px(x, y, 'y');
  g.shade('a', 'A', 1, 0, 1);
  g.outline('y');
  return g;
}

/** Buste de fantôme : forme ondulée, sans cou. */
function ghostBody() {
  const g = G();
  g.ell(CX, 50, 17, 16, 's');
  g.rect(15, 50, 48, 61, 's');
  for (let x = 15; x <= 48; x += 6) g.ell(x + 3, 61, 3, 3, 's');
  g.clear((x, y) => y > 63);
  g.shade('s', 'S', 1, 1, 1);
  g.outline('k');
  return g;
}

const entries = Object.entries(BODY_TYPES).map(([key, t]) => ({
  id: `body-${key}`,
  name: t.name,
  category: 'body',
  bodyType: key,
  tall: !!t.tall,
  build: () => [{ name: t.tall ? `Corps entier (${t.name.match(/\((.+)\)/)[1]})` : `Corps (${t.name.toLowerCase()})`, z: Z.body, grid: t.tall ? fullBody(t) : bust(t) }],
}));

entries.push(
  { id: 'body-robot', name: 'Robot', category: 'body', bodyType: 'moyen', build: () => [{ name: 'Corps (robot)', z: Z.body, grid: robotBody() }] },
  { id: 'body-ghost', name: 'Fantôme', category: 'body', bodyType: 'moyen', build: () => [{ name: 'Corps (fantôme)', z: Z.body, grid: ghostBody() }] },
);

export default entries;
