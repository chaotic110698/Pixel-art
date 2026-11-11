// Composition des calques : version canvas (rapide, affichage) et version
// pixels exacte (export, pipette) — sans lissage ni perte de précision alpha.

import { celCanvas, createCanvas } from './celcache.js';
import { blendOver } from '../util/color.js';
import { canvasOp, composeEntries } from '../core/blend.js';

let tmpA = null, tmpB = null;
/** Canvas de travail (groupes d'écrêtage). */
function scratch(which, w, h) {
  let c = which ? tmpB : tmpA;
  if (!c || c.width !== w || c.height !== h) { c = createCanvas(w, h); if (which) tmpB = c; else tmpA = c; }
  const g = c.getContext('2d');
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, w, h);
  return [c, g];
}

/** Compose sur un contexte 2D existant (taille document). */
export function composeOnCtx(ctx, doc, opts = {}) {
  const { frame = doc.frame, rect = null } = opts;
  const list = doc.renderList(opts);
  const W = doc.width, H = doc.height;
  const [x0, y0, x1, y1] = rect || [0, 0, W, H];
  const rw = x1 - x0, rh = y1 - y0;
  if (rw <= 0 || rh <= 0) return;
  ctx.imageSmoothingEnabled = false;
  const inList = new Set(list);
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const { layer, opacity } = e;
    if (e.clip && inList.has(e.clip)) continue; // dessiné avec sa base
    const clipped = [];
    for (let j = i + 1; j < list.length && list[j].clip === e; j++) clipped.push(list[j]);
    const cel = layer.cels[frame];
    if (!cel) continue;
    if (opacity <= 0) continue;
    ctx.globalCompositeOperation = canvasOp(e.blend);
    if (!clipped.length) {
      ctx.globalAlpha = opacity;
      ctx.drawImage(celCanvas(cel, W, H), x0, y0, rw, rh, x0, y0, rw, rh);
      if (opts.after && opts.after.layerId === layer.id) { ctx.globalCompositeOperation = 'source-over'; opts.after.draw(ctx, opacity); }
      continue;
    }
    // groupe d'écrêtage : base, puis calques écrêtés limités aux pixels de la base
    const [ga, g] = scratch(0, W, H);
    g.drawImage(celCanvas(cel, W, H), 0, 0);
    if (opts.after && opts.after.layerId === layer.id) opts.after.draw(g, 1);
    for (const c of clipped) {
      const cc = c.layer.cels[frame];
      if (!cc) continue;
      const [gb, g2] = scratch(1, W, H);
      g2.globalAlpha = c.layer.opacity ?? 1;
      g2.drawImage(celCanvas(cc, W, H), 0, 0);
      if (opts.after && opts.after.layerId === c.layer.id) opts.after.draw(g2, c.layer.opacity ?? 1);
      g2.globalAlpha = 1;
      g2.globalCompositeOperation = 'destination-in';
      g2.drawImage(celCanvas(cel, W, H), 0, 0);
      g.globalCompositeOperation = canvasOp(c.blend);
      g.drawImage(gb, 0, 0);
      g.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = opacity;
    ctx.drawImage(ga, x0, y0, rw, rh, x0, y0, rw, rh);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
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
  return composeEntries(doc.renderList(opts), n, frame, out, opts.opacityDiv || 1);
}

/** Couleur composée en (x, y). */
export function pixelAt(doc, x, y, opts = {}) {
  const { frame = doc.frame } = opts;
  if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return 0;
  const i = y * doc.width + x;
  const list = doc.renderList({ includeReference: false, ...opts });
  // modes de fusion ou écrêtage : composition exacte (plus lente, mais juste)
  if (list.some((e) => e.clip || (e.blend && e.blend !== 'normal'))) return composePixels(doc, { includeReference: false, ...opts })[i];
  let c = 0;
  for (const { layer, opacity } of list) {
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
