// Bas et chaussures des corps entiers (gabarit 64×96, vue de face). Les pantalons et jupes
// s'excluent entre eux (exclusiveKey 'bottom'), les chaussures aussi ('shoes') : on peut
// porter les deux. Couleurs : accent (a, A, y) pour les bas, vêtements foncés (x) pour les
// chaussures. Ajustés au corps (fitsBody) : fin ou moyen.

import { Z, Grid } from '../builder.js';
import { BODY_TYPES } from './bodies.js';

const CX = 31.5;
const ZB = Z.body + 4, ZS = Z.body + 5; // au-dessus du corps, sous le haut

/** Corps entier ciblé (les bustes utilisent le corps entier moyen). */
const typeOf = (ctx) => (BODY_TYPES[ctx.bodyType]?.tall ? BODY_TYPES[ctx.bodyType] : BODY_TYPES['entier-moyen']);

const finish = (g, main = 'a', shade = 'A') => {
  g.shade(main, shade, 1, 0, 1);
  g.outline('k');
  return g;
};

/** Bassin et ceinture, communs aux pantalons et shorts. */
function hips(g, t, to) {
  g.rect(Math.ceil(CX - t.rx + 1), t.waist, Math.floor(CX + t.rx - 1), to, 'a');
  g.rect(Math.ceil(CX - t.rx + 1), t.waist, Math.floor(CX + t.rx - 1), t.waist + 1, 'y');
  return g;
}

const BOTTOMS = [
  {
    id: 'pants', name: 'Pantalon',
    draw: (t) => {
      const g = new Grid(64, 96);
      hips(g, t, t.waist + 7);
      g.rect(Math.ceil(CX - t.rx + 2), t.waist + 8, 30, 88, 'a');
      g.rect(33, t.waist + 8, Math.floor(CX + t.rx - 2), 88, 'a');
      g.line(31, t.waist + 4, 31, t.waist + 7, 'A');
      g.line(32, t.waist + 4, 32, t.waist + 7, 'A');
      return finish(g);
    },
  },
  {
    id: 'jeans', name: 'Jean à revers',
    draw: (t) => {
      const g = BOTTOMS[0].draw(t);
      // revers clairs en bas, coutures
      g.rect(Math.ceil(CX - t.rx + 2), 86, 30, 88, 'y');
      g.rect(33, 86, Math.floor(CX + t.rx - 2), 88, 'y');
      g.line(Math.ceil(CX - t.rx + 4), t.waist + 9, Math.ceil(CX - t.rx + 4), 84, 'A');
      g.line(Math.floor(CX + t.rx - 4), t.waist + 9, Math.floor(CX + t.rx - 4), 84, 'A');
      g.outline('k');
      return g;
    },
  },
  {
    id: 'shorts', name: 'Bermuda',
    draw: (t) => {
      const g = new Grid(64, 96);
      hips(g, t, t.waist + 7);
      g.rect(Math.ceil(CX - t.rx + 1), t.waist + 8, 30, t.waist + 15, 'a');
      g.rect(33, t.waist + 8, Math.floor(CX + t.rx - 1), t.waist + 15, 'a');
      return finish(g);
    },
  },
  {
    id: 'skirt', name: 'Jupe', z: Z.body + 6, // par-dessus les bottes
    draw: (t) => {
      const g = new Grid(64, 96);
      for (let y = t.waist; y <= t.waist + 13; y++) {
        const hw = t.rx - 1 + (y - t.waist) * 0.32;
        g.rect(Math.ceil(CX - hw), y, Math.floor(CX + hw), y, 'a');
      }
      g.rect(Math.ceil(CX - t.rx + 1), t.waist, Math.floor(CX + t.rx - 1), t.waist + 1, 'y');
      // plis
      for (const dx of [-6, -2, 2, 6]) g.line(Math.round(CX + dx), t.waist + 5, Math.round(CX + dx * 1.3), t.waist + 13, 'A');
      g.outline('k');
      return g;
    },
  },
  {
    id: 'long-skirt', name: 'Jupe longue', z: Z.body + 6,
    draw: (t) => {
      const g = new Grid(64, 96);
      for (let y = t.waist; y <= 86; y++) {
        const hw = t.rx - 1 + (y - t.waist) * 0.16;
        g.rect(Math.ceil(CX - hw), y, Math.floor(CX + hw), y, 'a');
      }
      g.rect(Math.ceil(CX - t.rx + 1), t.waist, Math.floor(CX + t.rx - 1), t.waist + 1, 'y');
      for (const dx of [-5, 0, 5]) g.line(Math.round(CX + dx), t.waist + 8, Math.round(CX + dx * 1.35), 85, 'A');
      g.outline('k');
      return g;
    },
  },
  {
    id: 'overalls-legs', name: 'Salopette (bas)', z: Z.top + 1, // la bavette passe sur le haut
    draw: (t) => {
      const g = BOTTOMS[0].draw(t);
      // bavette et bretelles sur le torse
      g.rect(Math.ceil(CX - t.rx + 4), t.top + 10, Math.floor(CX + t.rx - 4), t.waist + 1, 'a');
      g.line(Math.ceil(CX - t.rx + 4), t.top + 4, Math.ceil(CX - t.rx + 4), t.top + 10, 'a');
      g.line(Math.floor(CX + t.rx - 4), t.top + 4, Math.floor(CX + t.rx - 4), t.top + 10, 'a');
      g.rect(29, t.top + 13, 34, t.top + 16, 'A');
      g.px(Math.ceil(CX - t.rx + 4), t.top + 10, 'y').px(Math.floor(CX + t.rx - 4), t.top + 10, 'y');
      g.outline('k');
      return g;
    },
  },
];

const SHOES = [
  {
    id: 'sneakers', name: 'Baskets',
    draw: (t) => {
      const g = new Grid(64, 96);
      for (const [x0, x1] of [[Math.ceil(CX - t.rx + 1), 30], [33, Math.floor(CX + t.rx - 1)]]) {
        g.rect(x0, 88, x1, 93, 'x');
        g.rect(x0, 94, x1, 94, 'w');
        g.line(x0 + 1, 90, x1 - 1, 90, 'w');
      }
      g.outline('k');
      return g;
    },
  },
  {
    id: 'boots', name: 'Bottes',
    draw: (t) => {
      const g = new Grid(64, 96);
      for (const [x0, x1] of [[Math.ceil(CX - t.rx + 1), 30], [33, Math.floor(CX + t.rx - 1)]]) {
        g.rect(x0 + 1, 78, x1, 93, 'x');
        g.rect(x0, 89, x1, 94, 'x');
        g.line(x0 + 1, 78, x1, 78, 'y');
      }
      g.outline('k');
      return g;
    },
  },
  {
    id: 'sandals', name: 'Sandales',
    draw: (t) => {
      const g = new Grid(64, 96);
      for (const [x0, x1] of [[Math.ceil(CX - t.rx + 1), 30], [33, Math.floor(CX + t.rx - 1)]]) {
        g.rect(x0, 89, x1, 93, 's');
        g.rect(x0, 94, x1, 94, 'x');
        g.line(x0, 90, x1, 90, 'x');
      }
      g.shade('s', 'S', 1, 0, 1);
      g.outline('k');
      return g;
    },
  },
];

const piece = (it, key, z, label) => ({
  id: `${key}-${it.id}`,
  name: it.name,
  category: 'bottom',
  exclusiveKey: key,
  tall: true,
  needsTall: true,
  fitsBody: true,
  build: (ctx = {}) => [{ name: `${label} (${it.name.toLowerCase()})`, z: it.z || z, grid: it.draw(typeOf(ctx)) }],
});

export default [...BOTTOMS.map((b) => piece(b, 'bottom', ZB, 'Bas')), ...SHOES.map((s) => piece(s, 'shoes', ZS, 'Chaussures'))];
