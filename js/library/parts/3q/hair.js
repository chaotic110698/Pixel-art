// Coiffures en vue de 3/4 (droite) : texture en mèches, volume vers l'arrière.
// Calque « arrière » (sous la tête) pour le volume et les longueurs,
// calque « avant » pour le dessus du crâne, la frange et les pattes.

import { G, Z } from '../../builder.js';
import { hash } from './common.js';
import { headSilhouette } from './heads.js';

// ligne d'implantation (y limite selon x) : nuque, derrière l'oreille, patte, front
const HAIRLINE = [[10, 38], [20, 35], [21.5, 24], [27, 22.5], [31, 22], [33, 17], [40, 15], [48, 14]];
function hairline(x, pts = HAIRLINE) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return pts[pts.length - 1][1];
}

/** Calotte : tête gonflée de `grow` px, coupée à la ligne d'implantation. */
function scalp(grow = 1, pts = HAIRLINE) {
  const g = headSilhouette(G(), 'oval', 'h');
  for (let i = 0; i < grow; i++) g.outline('h');
  g.clear((x, y) => y + 0.5 > hairline(x + 0.5, pts));
  return g;
}

/** Patte devant l'oreille. */
const sideburn = (g, y1 = 27) => g.rect(29, 22, 30, y1, 'h');

/** Mèches pointues (triangles) : [x, y, dx, dy, largeur]. */
function locks(g, list) {
  for (const [x, y, dx, dy, w = 2] of list) g.poly([[x - w, y], [x + w, y], [x + dx, y + dy]], 'h');
  return g;
}

/** Ombre, texture en mèches (traits courts), reflets, contour. */
function finish(g, { light = true, seed = 5 } = {}) {
  g.shade('h', 'H', -1, 1, 2);
  // stries : petits traits d'ombre dans le sens des mèches
  g.each((x, y) => {
    if (g.get(x, y) !== 104) return; // 'h'
    const r = hash(x, y, seed);
    if (r < 0.08) { g.set(x, y, 'H'); if (g.get(x + 1, y + 1) === 104) g.set(x + 1, y + 1, 'H'); if (g.get(x + 2, y + 1) === 104) g.set(x + 2, y + 1, 'H'); }
    else if (light && r > 0.95 && y < 18 && x > 26) { g.set(x, y, 'j'); if (g.get(x + 1, y) === 104) g.set(x + 1, y, 'j'); }
  });
  g.outline('q');
  return g;
}

function layers(back, front, name) {
  const out = [];
  if (back && !back.isEmpty()) out.push({ name: `Cheveux arrière (${name}, 3/4)`, z: Z.hairBack, grid: finish(back, { light: false, seed: 9 }) });
  if (front && !front.isEmpty()) out.push({ name: `Cheveux avant (${name}, 3/4)`, z: Z.hairFront, grid: finish(front) });
  return out;
}

const STYLES = [
  {
    id: 'short', name: 'Courte (3/4)',
    back: () => null,
    front: () => sideburn(scalp(1)),
  },
  {
    id: 'messy', name: 'Ébouriffée (3/4)',
    back: () => G().ell(29, 19, 15, 12, 'h'),
    front: () => {
      const g = sideburn(scalp(2));
      // épis sur le dessus et mèches qui retombent vers l'avant
      locks(g, [[20, 13, -4, -4], [25, 9, -2, -5], [31, 8, 1, -5], [37, 9, 4, -4], [42, 11, 5, -2]]);
      locks(g, [[37, 14, 3, 5, 2.5], [41, 14, 4, 4, 2], [45, 14, 2, 4, 1.5]]);
      return g;
    },
  },
  {
    id: 'slick', name: 'Plaquée en arrière (3/4)',
    back: () => G().ell(28, 19, 14, 11, 'h'),
    front: () => {
      const g = sideburn(scalp(1, [[10, 38], [20, 35], [21.5, 24], [27, 22.5], [31, 22], [33, 15], [40, 13], [48, 12]]));
      g.ell(33, 11.5, 12, 4.5, 'h');
      return g;
    },
  },
  {
    id: 'side', name: 'Raie sur le côté (3/4)',
    back: () => G().ell(29, 20, 14.5, 12, 'h'),
    front: () => {
      const g = sideburn(scalp(2));
      // frange balayée vers l'avant
      g.poly([[30, 10], [44, 11], [48, 15], [46, 19], [40, 16], [34, 15]], 'h');
      return g;
    },
  },
  {
    id: 'curly', name: 'Bouclée (3/4)',
    back: () => {
      const g = G();
      g.ell(29, 19, 15, 13, 'h');
      // boucles le long du contour (de la nuque au front)
      for (let a = 0; a <= 10; a++) {
        const t = Math.PI * (0.55 + a * 0.115);
        g.ell(29 + Math.cos(t) * -14, 19 - Math.sin(t) * 12.5, 3.6, 3.6, 'h');
      }
      return g;
    },
    front: () => {
      const g = sideburn(scalp(2), 26);
      for (const [x, y] of [[36, 13], [40, 13.5], [44, 15], [32, 12]]) g.ell(x, y, 2.6, 2.6, 'h');
      return g;
    },
  },
  {
    id: 'long', name: 'Longue (3/4)',
    back: () => {
      const g = G();
      g.ell(29, 21, 15.5, 14, 'h');
      g.poly([[14, 22], [32, 22], [34, 40], [30, 56], [12, 58]], 'h');
      return g;
    },
    front: () => {
      const g = scalp(2);
      g.poly([[31, 10], [45, 12], [47.5, 17], [44, 21], [38, 16], [33, 15]], 'h');
      return g;
    },
  },
  {
    id: 'ponytail', name: 'Queue de cheval (3/4)',
    back: () => {
      const g = G();
      g.ell(28, 20, 14, 12, 'h');
      g.poly([[13, 16], [19, 15], [17, 30], [15, 44], [10, 40], [11, 26]], 'h');
      return g;
    },
    front: () => {
      const g = sideburn(scalp(1, [[10, 38], [20, 35], [21.5, 24], [27, 22.5], [31, 22], [33, 16], [40, 14], [48, 13]]));
      g.rect(16, 15, 19, 18, 'a'); // élastique
      return g;
    },
  },
  {
    id: 'bun', name: 'Chignon (3/4)',
    back: () => G().ell(21, 10, 6, 5.5, 'h').ell(29, 20, 14, 12, 'h'),
    front: () => sideburn(scalp(1, [[10, 38], [20, 35], [21.5, 24], [27, 22.5], [31, 22], [33, 16], [40, 14], [48, 13]])),
  },
  {
    id: 'buzz', name: 'Rasée (3/4)',
    back: () => null,
    front: () => {
      const g = sideburn(scalp(0));
      g.recolor('h', 'H');
      g.recolor('H', 'h', (x, y) => hash(x, y, 4) < 0.25);
      return g;
    },
    raw: true,
  },
];

export default STYLES.map((s) => ({
  id: `hair-3q-${s.id}`,
  name: s.name,
  category: 'hair',
  view: '3q',
  build: () => {
    const name = s.name.replace(' (3/4)', '').toLowerCase();
    if (s.raw) return [{ name: `Cheveux (${name}, 3/4)`, z: Z.hairFront, grid: s.front() }];
    return layers(s.back(), s.front(), name);
  },
}));
