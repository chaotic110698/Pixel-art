// Conversion d'une image (photo, dessin) en pixel art : réduction, réglages, palette,
// tramage et nettoyage. Fonctions pures sur des tableaux RGBA (Uint8ClampedArray).

import { extractPalette } from './palettes.js';
import { hexToU32 } from '../util/color.js';

/**
 * Réduit src (w×h RGBA) à tw×th. mode 'average' : moyenne de chaque bloc (doux) ;
 * 'dominant' : couleur la plus présente du bloc (net, garde les contours).
 */
export function downscale(src, w, h, tw, th, mode = 'average') {
  const out = new Uint8ClampedArray(tw * th * 4);
  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.floor((ty * h) / th), y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * h) / th));
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.floor((tx * w) / tw), x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * w) / tw));
      const o = (ty * tw + tx) * 4;
      if (mode === 'dominant') {
        // couleurs regroupées par 5 bits, puis moyenne du groupe le plus fréquent
        const groups = new Map();
        let opaque = 0, n = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          n++;
          if (src[i + 3] < 128) continue;
          opaque++;
          const k = ((src[i] >> 3) << 10) | ((src[i + 1] >> 3) << 5) | (src[i + 2] >> 3);
          let g = groups.get(k);
          if (!g) groups.set(k, (g = [0, 0, 0, 0]));
          g[0] += src[i]; g[1] += src[i + 1]; g[2] += src[i + 2]; g[3]++;
        }
        if (opaque * 2 < n) continue; // bloc surtout transparent
        let best = null;
        for (const g of groups.values()) if (!best || g[3] > best[3]) best = g;
        out[o] = best[0] / best[3]; out[o + 1] = best[1] / best[3]; out[o + 2] = best[2] / best[3]; out[o + 3] = 255;
      } else {
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          const al = src[i + 3];
          r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; n++;
        }
        if (a) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
        out[o + 3] = a / n;
      }
    }
  }
  return out;
}

/** Saturation et contraste (1 = inchangé), sur place. */
export function adjust(d, { saturation = 1, contrast = 1 } = {}) {
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    r = y + (r - y) * saturation; g = y + (g - y) * saturation; b = y + (b - y) * saturation;
    d[i] = (r - 128) * contrast + 128; d[i + 1] = (g - 128) * contrast + 128; d[i + 2] = (b - 128) * contrast + 128;
  }
  return d;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Couleur de palette la plus proche (distance pondérée selon la perception). */
function nearest(pal, r, g, b) {
  let best = 0, bd = Infinity;
  for (let k = 0; k < pal.length; k++) {
    const p = pal[k];
    const rm = (p[0] + r) / 2;
    const dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

/**
 * Ramène l'image aux couleurs de palette (liste de [r, g, b]). dither : 'none' | 'ordered'
 * | 'diffusion' (Floyd-Steinberg, adouci). Les pixels à moins de 50 % d'opacité deviennent
 * transparents. Renvoie un Uint32Array (0xAABBGGRR).
 */
export function quantize(d, w, h, pal, dither = 'none', strength = 1) {
  const out = new Uint32Array(w * h);
  const buf = Float32Array.from(d);
  const packed = pal.map(([r, g, b]) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (buf[i + 3] < 128) continue;
    let r = buf[i], g = buf[i + 1], b = buf[i + 2];
    if (dither === 'ordered') {
      const t = (BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 48 * strength;
      r += t; g += t; b += t;
    }
    const k = nearest(pal, r, g, b);
    out[y * w + x] = packed[k];
    if (dither === 'diffusion') {
      const er = (r - pal[k][0]) * 0.75 * strength, eg = (g - pal[k][1]) * 0.75 * strength, eb = (b - pal[k][2]) * 0.75 * strength;
      const push = (dx, dy, f) => {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= w || yy >= h) return;
        const j = (yy * w + xx) * 4;
        buf[j] += er * f; buf[j + 1] += eg * f; buf[j + 2] += eb * f;
      };
      push(1, 0, 7 / 16); push(-1, 1, 3 / 16); push(0, 1, 5 / 16); push(1, 1, 1 / 16);
    }
  }
  return out;
}

/** Supprime les pixels isolés (entourés de 3 ou 4 voisins identiques), sur place. */
export function cleanup(px, w, h) {
  const src = px.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, c = src[i];
    const nb = [];
    if (x > 0) nb.push(src[i - 1]);
    if (x < w - 1) nb.push(src[i + 1]);
    if (y > 0) nb.push(src[i - w]);
    if (y < h - 1) nb.push(src[i + w]);
    if (nb.includes(c)) continue;
    const count = new Map();
    for (const v of nb) count.set(v, (count.get(v) || 0) + 1);
    let best = null, bn = 0;
    for (const [v, n] of count) if (n > bn) { bn = n; best = v; }
    if (bn >= 3) px[i] = best;
  }
  return px;
}

/**
 * Conversion complète. img : { data (RGBA), width, height }. o : { width, height, mode,
 * saturation, contrast, palette: 'extract' | 'project' | 'none', colors, projectPalette
 * (hex[]), dither, strength, clean }. Renvoie { w, h, pixels (Uint32Array), palette (hex[]) }.
 */
export function pixelize(img, o) {
  const w = o.width, h = o.height;
  const small = downscale(img.data, img.width, img.height, w, h, o.mode);
  adjust(small, o);
  let palHex = null;
  if (o.palette === 'project' && o.projectPalette && o.projectPalette.length) palHex = o.projectPalette;
  else if (o.palette !== 'none') palHex = extractPalette({ data: small }, o.colors || 16);
  let pixels;
  if (palHex && palHex.length) {
    const pal = palHex.map((hx) => { const u = hexToU32(hx); return [u & 255, (u >>> 8) & 255, (u >>> 16) & 255]; });
    pixels = quantize(small, w, h, pal, o.dither || 'none', o.strength ?? 1);
  } else {
    pixels = new Uint32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const a = small[i * 4 + 3];
      if (a >= 128) pixels[i] = ((255 << 24) | (small[i * 4 + 2] << 16) | (small[i * 4 + 1] << 8) | small[i * 4]) >>> 0;
    }
  }
  if (o.clean) cleanup(pixels, w, h);
  return { w, h, pixels, palette: palHex || [] };
}
