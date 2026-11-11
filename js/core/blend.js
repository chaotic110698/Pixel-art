// Modes de fusion des calques et masques d'écrêtage : composition exacte en pixels
// (export, pipette, fusion de calques). L'affichage utilise les modes équivalents du
// canvas (globalCompositeOperation), voir render/compose.js.

import { blendOver, rgba } from '../util/color.js';

/** Modes proposés : [id, nom, opération canvas]. */
export const BLEND_MODES = [
  ['normal', 'Normal', 'source-over'],
  ['multiply', 'Produit', 'multiply'],
  ['screen', 'Écran', 'screen'],
  ['overlay', 'Incrustation', 'overlay'],
  ['soft-light', 'Lumière tamisée', 'soft-light'],
  ['hard-light', 'Lumière crue', 'hard-light'],
  ['darken', 'Obscurcir', 'darken'],
  ['lighten', 'Éclaircir', 'lighten'],
  ['color-dodge', 'Densité couleur −', 'color-dodge'],
  ['color-burn', 'Densité couleur +', 'color-burn'],
  ['add', 'Addition', 'lighter'],
  ['difference', 'Différence', 'difference'],
];
const OP = Object.fromEntries(BLEND_MODES.map(([id, , op]) => [id, op]));
export const canvasOp = (mode) => OP[mode] || 'source-over';

const multiply = (b, s) => b * s;
const screen = (b, s) => b + s - b * s;
const hard = (b, s) => (s <= 0.5 ? multiply(b, 2 * s) : screen(b, 2 * s - 1));
/** Fonctions de mélange séparables (b : fond, s : calque), valeurs 0..1 (norme W3C). */
const F = {
  multiply,
  screen,
  overlay: (b, s) => hard(s, b),
  'hard-light': hard,
  'soft-light': (b, s) => {
    if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
    const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
    return b + (2 * s - 1) * (d - b);
  },
  darken: Math.min,
  lighten: Math.max,
  'color-dodge': (b, s) => (b === 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s))),
  'color-burn': (b, s) => (b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s)),
  difference: (b, s) => Math.abs(b - s),
};

/** Pose src sur dst (0xAABBGGRR) avec une opacité et un mode de fusion. */
export function blendPixel(dst, src, opacity = 1, mode = 'normal') {
  if (!mode || mode === 'normal' || !(dst >>> 24)) return blendOver(dst, src, opacity);
  const sa = ((src >>> 24) / 255) * opacity;
  if (sa <= 0) return dst;
  const da = (dst >>> 24) / 255;
  if (mode === 'add') {
    const oa = Math.min(1, sa + da);
    const ch = (sh) => Math.round(Math.min(255, ((src >>> sh) & 255) * sa + ((dst >>> sh) & 255) * da) / oa);
    return rgba(Math.min(255, ch(0)), Math.min(255, ch(8)), Math.min(255, ch(16)), Math.round(oa * 255));
  }
  const f = F[mode];
  if (!f) return blendOver(dst, src, opacity);
  const oa = sa + da * (1 - sa);
  const ch = (sh) => {
    const s = ((src >>> sh) & 255) / 255, b = ((dst >>> sh) & 255) / 255;
    const mixed = (1 - da) * s + da * f(b, s);
    return Math.round(((mixed * sa + b * da * (1 - sa)) / oa) * 255);
  };
  return rgba(ch(0), ch(8), ch(16), Math.round(oa * 255));
}

/**
 * Composition exacte d'une liste de calques (doc.renderList) dans out (Uint32Array).
 * Un calque « écrêté » (clip) n'apparaît que sur les pixels de son calque de base ;
 * l'ensemble prend l'opacité et le mode de la base. opacityDiv : divise les opacités
 * (aplatir un groupe sans compter deux fois son opacité).
 */
export function composeEntries(list, n, frame, out = new Uint32Array(n), opacityDiv = 1) {
  const inList = new Set(list);
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const cel = e.layer.cels[frame];
    if (e.clip && inList.has(e.clip)) continue; // dessiné avec sa base
    const clipped = [];
    for (let j = i + 1; j < list.length && list[j].clip === e; j++) clipped.push(list[j]);
    const op = e.opacity / opacityDiv;
    if (!cel || op <= 0) continue;
    let src = cel;
    if (clipped.length) {
      src = cel.slice();
      for (const c of clipped) {
        const cc = c.layer.cels[frame];
        const cop = c.layer.opacity ?? 1; // opacité propre (le groupe parent compte déjà pour la base)
        if (!cc || cop <= 0) continue;
        for (let k = 0; k < n; k++) {
          const ba = src[k] >>> 24;
          if (!ba || !(cc[k] >>> 24)) continue;
          // pixel du calque écrêté limité à l'opacité de la base
          const masked = ((cc[k] & 0x00ffffff) | (Math.round(((cc[k] >>> 24) * ba) / 255) << 24)) >>> 0;
          const r = blendPixel(src[k], masked, cop, c.blend);
          src[k] = ((r & 0x00ffffff) | (ba << 24)) >>> 0;
        }
      }
    }
    const mode = e.blend || 'normal';
    for (let k = 0; k < n; k++) {
      const s = src[k];
      if (!(s >>> 24)) continue;
      out[k] = mode === 'normal' && op >= 1 && s >>> 24 === 255 ? s : blendPixel(out[k], s, op, mode);
    }
  }
  return out;
}
