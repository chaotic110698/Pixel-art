// Cache canvas par cel (tableau de pixels). Le canvas est mis à jour
// paresseusement et seulement sur le rectangle modifié (putImageData partiel).

const cache = new WeakMap();

// Safari 16.0–16.3 expose OffscreenCanvas sans contexte 2D : on teste réellement.
const OFFSCREEN_OK = (() => {
  try {
    return typeof OffscreenCanvas !== 'undefined' && !!new OffscreenCanvas(1, 1).getContext('2d');
  } catch (_) {
    return false;
  }
})();

function makeCanvas(w, h) {
  if (OFFSCREEN_OK) {
    try {
      return new OffscreenCanvas(w, h);
    } catch (_) { /* repli */ }
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function createCanvas(w, h) {
  return makeCanvas(w, h);
}

// Notifié à chaque modification de pixels (sauvegarde incrémentale).
let dirtyHook = null;
export function setDirtyHook(fn) {
  dirtyHook = fn;
}

export function markDirty(cel, x0 = 0, y0 = 0, x1 = Infinity, y1 = Infinity) {
  dirtyHook?.(cel);
  const e = cache.get(cel);
  if (!e) return;
  if (!e.dirty) e.dirty = [x0, y0, x1, y1];
  else {
    const d = e.dirty;
    d[0] = Math.min(d[0], x0);
    d[1] = Math.min(d[1], y0);
    d[2] = Math.max(d[2], x1);
    d[3] = Math.max(d[3], y1);
  }
}

export function markAllDirty(cel) {
  markDirty(cel, 0, 0, Infinity, Infinity);
}

/** Canvas (w×h) reflétant le contenu de `cel`. */
export function celCanvas(cel, w, h) {
  let e = cache.get(cel);
  if (!e || e.w !== w || e.h !== h) {
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d');
    const img = new ImageData(new Uint8ClampedArray(cel.buffer, cel.byteOffset, w * h * 4), w, h);
    e = { canvas, ctx, img, w, h, dirty: [0, 0, w, h] };
    cache.set(cel, e);
  }
  if (e.dirty) {
    const x0 = Math.max(0, Math.floor(e.dirty[0]));
    const y0 = Math.max(0, Math.floor(e.dirty[1]));
    const x1 = Math.min(w, Math.ceil(e.dirty[2]));
    const y1 = Math.min(h, Math.ceil(e.dirty[3]));
    if (x1 > x0 && y1 > y0) e.ctx.putImageData(e.img, 0, 0, x0, y0, x1 - x0, y1 - y0);
    e.dirty = null;
  }
  return e.canvas;
}
