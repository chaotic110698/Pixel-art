// Composition des calques : version canvas (rapide, affichage) et version
// pixels exacte (export, pipette) — sans lissage ni perte de précision alpha.

import { celCanvas, createCanvas } from './celcache.js';
import { blendOver } from '../util/color.js';

/** Compose sur un contexte 2D existant (taille document). */
export function composeOnCtx(ctx, doc, opts = {}) {
  const { frame = doc.frame, rect = null } = opts;
  const list = doc.renderList(opts);
  const W = doc.width, H = doc.height;
  const [x0, y0, x1, y1] = rect || [0, 0, W, H];
  const rw = x1 - x0, rh = y1 - y0;
  if (rw <= 0 || rh <= 0) return;
  ctx.imageSmoothingEnabled = false;
  for (const { layer, opacity } of list) {
    const cel = layer.cels[frame];
    if (!cel) continue;
    if (opacity <= 0) continue;
    ctx.globalAlpha = opacity;
    ctx.drawImage(celCanvas(cel, W, H), x0, y0, rw, rh, x0, y0, rw, rh);
    if (opts.after && opts.after.layerId === layer.id) opts.after.draw(ctx, opacity);
  }
  ctx.globalAlpha = 1;
}

export function composeToCanvas(doc, opts = {}) {
  const c = createCanvas(doc.width, doc.height);
  composeOnCtx(c.getContext('2d'), doc, opts);
  return c;
}

/** Composition exacte en Uint32Array (0xAABBGGRR). */
export function composePixels(doc, opts = {}) {
  const { frame = doc.frame } = opts;
  const n = doc.width * doc.height;
  const out = new Uint32Array(n);
  const list = doc.renderList(opts);
  for (const { layer, opacity } of list) {
    const cel = layer.cels[frame];
    if (!cel || opacity <= 0) continue;
    if (opacity >= 1) {
      for (let i = 0; i < n; i++) {
        const s = cel[i];
        if (s === 0) continue;
        const sa = s >>> 24;
        if (sa === 255) out[i] = s;
        else if (sa) out[i] = blendOver(out[i], s, 1);
      }
    } else {
      for (let i = 0; i < n; i++) {
        const s = cel[i];
        if (s >>> 24) out[i] = blendOver(out[i], s, opacity);
      }
    }
  }
  return out;
}

/** Couleur composée en (x, y). */
export function pixelAt(doc, x, y, opts = {}) {
  const { frame = doc.frame } = opts;
  if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return 0;
  const i = y * doc.width + x;
  let c = 0;
  for (const { layer, opacity } of doc.renderList({ includeReference: false, ...opts })) {
    const cel = layer.cels[frame];
    if (cel && cel[i] >>> 24) c = blendOver(c, cel[i], opacity);
  }
  return c;
}

/** Tampon Uint32 -> canvas (taille w×h). */
export function pixelsToCanvas(data, w, h) {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = new ImageData(new Uint8ClampedArray(data.buffer.slice(data.byteOffset, data.byteOffset + w * h * 4)), w, h);
  ctx.putImageData(img, 0, 0);
  return c;
}
