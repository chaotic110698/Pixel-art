// Mini-langage pour définir des pièces en pixel art sous forme de données.
// Une pièce est une grille 64×64 (gabarit de personnage) de « rôles » (lettres) :
// la couleur réelle est attribuée à l'insertion selon les couleurs du personnage,
// ce qui permet la recoloration par échange de palette.
//
// Rôles :
//   s S k r   peau, ombre de peau, contour de peau, joues roses
//   h H j q   cheveux, ombre, reflet, contour
//   w e E p l blanc de l'œil, iris, iris sombre, encre (traits/pupille), reflet
//   m t T     intérieur de bouche, langue, dents
//   c C x     vêtement, ombre, contour
//   a A y     accessoire, ombre, contour
//   g         verre (semi-transparent)

import { shadeHex, hexToU32, u32ToHex, toRgba, rgba } from '../util/color.js';

export const TEMPLATE = 64;

// Ordre d'empilement (z) des catégories : plus grand = au-dessus.
export const Z = {
  hairBack: 10, body: 20, top: 30, head: 40, earrings: 45, blush: 48, nose: 50,
  mouth: 52, eyes: 54, brows: 56, hairFront: 60, animalEars: 66, glasses: 70, hat: 80, extra: 90,
};

export class Grid {
  constructor(w = TEMPLATE, h = TEMPLATE) {
    this.w = w;
    this.h = h;
    this.a = new Uint8Array(w * h); // 0 = vide, sinon code ASCII du rôle
  }
  static from(rows, legend = null) {
    const g = new Grid(Math.max(...rows.map((r) => r.length)), rows.length);
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const c = legend && legend[ch] !== undefined ? legend[ch] : ch;
      if (c && c !== '.' && c !== ' ') g.a[y * g.w + x] = c.charCodeAt(0);
    }));
    return g;
  }
  in(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x, y) {
    return this.in(x, y) ? this.a[y * this.w + x] : 0;
  }
  set(x, y, role) {
    if (this.in(x, y)) this.a[y * this.w + x] = role ? role.charCodeAt(0) : 0;
    return this;
  }
  px(x, y, role) {
    return this.set(x, y, role);
  }
  each(fn) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) fn(x, y);
    return this;
  }
  /** Remplit les pixels où test(x, y) est vrai. */
  fill(test, role) {
    return this.each((x, y) => { if (test(x, y)) this.set(x, y, role); });
  }
  ell(cx, cy, rx, ry, role = 'h') {
    return this.fill((x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1, role);
  }
  rect(x0, y0, x1, y1, role = 'h') {
    return this.fill((x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1, role);
  }
  /** Polygone (sommets en coordonnées continues, test sur le centre des pixels). */
  poly(pts, role = 'h') {
    const inside = (px, py) => {
      let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    return this.fill((x, y) => inside(x + 0.5, y + 0.5), role);
  }
  line(x0, y0, x1, y1, role) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, role);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  /** Efface les pixels où test(x, y) est vrai. */
  clear(test) {
    return this.each((x, y) => { if (test(x, y)) this.a[y * this.w + x] = 0; });
  }
  keep(test) {
    return this.clear((x, y) => !test(x, y));
  }
  /** Recopie la moitié gauche en miroir sur la droite (symétrie parfaite). */
  mirror() {
    const w = this.w;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < w / 2; x++) this.a[y * w + (w - 1 - x)] = this.a[y * w + x];
    return this;
  }
  /** Colle une autre grille (pixels non vides) en (ox, oy), optionnellement en miroir. */
  stamp(g, ox, oy, flip = false) {
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const v = g.a[y * g.w + (flip ? g.w - 1 - x : x)];
        if (v && this.in(ox + x, oy + y)) this.a[(oy + y) * this.w + ox + x] = v;
      }
    }
    return this;
  }
  /** Ombre : pixels `base` dont le voisin (dx, dy) est vide deviennent `shade`. */
  shade(base, shadeRole, dx = 1, dy = 1, depth = 1) {
    const b = base.charCodeAt(0);
    const src = this.a.slice();
    const empty = (x, y) => {
      if (!this.in(x, y)) return false; // le bord du canevas n'ombre pas
      return src[y * this.w + x] === 0;
    };
    this.each((x, y) => {
      if (src[y * this.w + x] !== b) return;
      for (let k = 1; k <= depth; k++) {
        if ((dx && empty(x + dx * k, y)) || (dy && empty(x, y + dy * k))) {
          this.set(x, y, shadeRole);
          return;
        }
      }
    });
    return this;
  }
  /** Contour extérieur (4-connexité) autour des pixels non vides. */
  outline(role, { skipBottom = false, only = null } = {}) {
    const src = this.a.slice();
    const filled = (x, y) => this.in(x, y) && src[y * this.w + x] !== 0 && (!only || only.includes(String.fromCharCode(src[y * this.w + x])));
    this.each((x, y) => {
      if (src[y * this.w + x]) return;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || (!skipBottom && filled(x, y + 1))) this.set(x, y, role);
    });
    return this;
  }
  /** Remplace un rôle par un autre là où test(x, y) (optionnel). */
  recolor(from, to, test = null) {
    const f = from.charCodeAt(0);
    this.each((x, y) => {
      if (this.a[y * this.w + x] === f && (!test || test(x, y))) this.set(x, y, to);
    });
    return this;
  }
  /** Pixels non vides de `other` effacent ceux de cette grille. */
  subtract(other) {
    for (let i = 0; i < this.a.length; i++) if (other.a[i]) this.a[i] = 0;
    return this;
  }
  clone() {
    const g = new Grid(this.w, this.h);
    g.a.set(this.a);
    return g;
  }
  isEmpty() {
    return !this.a.some((v) => v);
  }
}

export const G = () => new Grid();

/** Place un petit motif ASCII (lignes) dans une grille 64×64. */
export function place(rows, x, y, { mirrorTo = null } = {}) {
  const small = Grid.from(rows);
  const g = new Grid();
  g.stamp(small, x, y);
  if (mirrorTo !== null) g.stamp(small, mirrorTo, y, true);
  return g;
}

/** Place un motif pour les deux yeux (ou sourcils) symétriques autour de x = 31,5. */
export function pair(rows, x, y, { flip = true } = {}) {
  const small = Grid.from(rows);
  const g = new Grid();
  g.stamp(small, x, y);
  g.stamp(small, TEMPLATE - x - small.w, y, flip);
  return g;
}

// ---------- Couleurs ----------
export const DEFAULT_COLORS = {
  skin: '#f5c6a5',
  hair: '#6b3e26',
  eyes: '#3b7dd8',
  clothes: '#4a7bd0',
  accent: '#f2c94c',
};

function mix(a, b, t) {
  const A = toRgba(hexToU32(a)), B = toRgba(hexToU32(b));
  return u32ToHex(rgba(...[0, 1, 2].map((i) => Math.round(A[i] * (1 - t) + B[i] * t)), 255));
}

/** Couleur de chaque rôle à partir des 5 couleurs du personnage. */
export function roleColors(cc = DEFAULT_COLORS) {
  const c = { ...DEFAULT_COLORS, ...cc };
  return {
    s: c.skin, S: shadeHex(c.skin, -0.1, -6, 0.05), k: shadeHex(c.skin, -0.45, -8, -0.3), r: mix(c.skin, '#ff4f7a', 0.45),
    h: c.hair, H: shadeHex(c.hair, -0.1, -8), j: shadeHex(c.hair, 0.12, 6), q: shadeHex(c.hair, -0.3, -8, -0.1),
    w: '#f6f6fa', e: c.eyes, E: shadeHex(c.eyes, -0.18, 8), p: '#1e1a2a', l: '#ffffff',
    m: '#5a1f33', t: '#e2607d', T: '#fbfbff',
    c: c.clothes, C: shadeHex(c.clothes, -0.12, -8), x: shadeHex(c.clothes, -0.32, -12),
    a: c.accent, A: shadeHex(c.accent, -0.14, -10), y: shadeHex(c.accent, -0.36, -15),
    g: '#bfe6ff80',
  };
}

/** Grille de rôles -> Uint32Array (taille dw×dh) placée en (ox, oy). */
export function rasterize(grid, colors, dw, dh, ox = 0, oy = 0) {
  const out = new Uint32Array(dw * dh);
  const lut = {};
  for (const [role, hex] of Object.entries(colors)) lut[role.charCodeAt(0)] = hexToU32(hex);
  for (let y = 0; y < grid.h; y++) {
    const ty = y + oy;
    if (ty < 0 || ty >= dh) continue;
    for (let x = 0; x < grid.w; x++) {
      const v = grid.a[y * grid.w + x];
      if (!v) continue;
      const tx = x + ox;
      if (tx < 0 || tx >= dw) continue;
      out[ty * dw + tx] = lut[v] ?? 0xff00ffff;
    }
  }
  return out;
}

/** Correspondance ancienne couleur -> nouvelle couleur pour une recoloration. */
export function recolorMap(oldColors, newColors) {
  const a = roleColors(oldColors), b = roleColors(newColors);
  const map = new Map();
  for (const k of Object.keys(a)) {
    const from = hexToU32(a[k]), to = hexToU32(b[k]);
    if (from !== to && !map.has(from)) map.set(from, to);
  }
  return map;
}
