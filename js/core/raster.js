// Primitives raster pures (aucune dépendance DOM).

/** Tracé de Bresenham : appelle cb(x, y) pour chaque pixel du segment. */
export function bresenham(x0, y0, x1, y1, cb) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    cb(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Contraint un segment à 0/45/90° (touche Maj). */
export function constrainLine(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (adx > ady * 2) return [x1, y0];
  if (ady > adx * 2) return [x0, y1];
  const d = Math.max(adx, ady);
  return [x0 + Math.sign(dx) * d, y0 + Math.sign(dy) * d];
}

export function normRect(x0, y0, x1, y1) {
  return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
}

/** Rectangle (bornes incluses). */
export function rectPixels(x0, y0, x1, y1, filled, cb) {
  [x0, y0, x1, y1] = normRect(x0, y0, x1, y1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (filled || y === y0 || y === y1 || x === x0 || x === x1) cb(x, y);
    }
  }
}

/**
 * Ellipse inscrite dans la boîte (bornes incluses). Contour = pixels intérieurs
 * ayant au moins un voisin (4-connexité) extérieur : rendu propre « pixel art ».
 */
export function ellipsePixels(x0, y0, x1, y1, filled, cb) {
  [x0, y0, x1, y1] = normRect(x0, y0, x1, y1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;
  const rx = w / 2, ry = h / 2;
  const inside = (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    return nx * nx + ny * ny <= 1.0001 + 0.15 / Math.max(1, Math.min(rx, ry));
  };
  if (w <= 2 || h <= 2) {
    rectPixels(x0, y0, x1, y1, true, cb);
    return;
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inside(x, y)) continue;
      if (filled || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) cb(x, y);
    }
  }
}

/**
 * Remplissage par diffusion (4-connexité) sur un tableau Uint32.
 * Retourne un Uint8Array masque des pixels touchés.
 * limit : masque optionnel (Uint8Array) restreignant la zone.
 */
export function floodMask(data, w, h, sx, sy, { contiguous = true, limit = null, tolerance = 0 } = {}) {
  const mask = new Uint8Array(w * h);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return mask;
  const target = data[sy * w + sx];
  const match = tolerance <= 0
    ? (c) => c === target || ((c >>> 24) === 0 && (target >>> 24) === 0)
    : (c) => colorDist(c, target) <= tolerance;
  if (!contiguous) {
    for (let i = 0; i < w * h; i++) if ((!limit || limit[i]) && match(data[i])) mask[i] = 1;
    return mask;
  }
  if (limit && !limit[sy * w + sx]) return mask;
  const stack = [sx, sy];
  while (stack.length) {
    const y = stack.pop();
    let x = stack.pop();
    let i = y * w + x;
    while (x >= 0 && !mask[i] && match(data[i]) && (!limit || limit[i])) { x--; i--; }
    x++; i++;
    let up = false, down = false;
    while (x < w && !mask[i] && match(data[i]) && (!limit || limit[i])) {
      mask[i] = 1;
      if (y > 0) {
        const j = i - w;
        const ok = !mask[j] && match(data[j]) && (!limit || limit[j]);
        if (ok && !up) { stack.push(x, y - 1); up = true; } else if (!ok) up = false;
      }
      if (y < h - 1) {
        const j = i + w;
        const ok = !mask[j] && match(data[j]) && (!limit || limit[j]);
        if (ok && !down) { stack.push(x, y + 1); down = true; } else if (!ok) down = false;
      }
      x++; i++;
    }
  }
  return mask;
}

export function colorDist(a, b) {
  const dr = (a & 255) - (b & 255);
  const dg = ((a >>> 8) & 255) - ((b >>> 8) & 255);
  const db = ((a >>> 16) & 255) - ((b >>> 16) & 255);
  const da = (a >>> 24) - (b >>> 24);
  return Math.sqrt(dr * dr + dg * dg + db * db + da * da) / 510; // 0..1
}

/** Remplit un polygone (coordonnées en pixels) dans un masque, contour inclus. */
export function polygonMask(points, w, h) {
  const mask = new Uint8Array(w * h);
  if (points.length < 2) return mask;
  const n = points.length;
  // intérieur par règle pair-impair sur les centres des pixels
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of points) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(h - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++) {
    const cy = y + 0.5;
    const xs = [];
    for (let i = 0; i < n; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[(i + 1) % n];
      const pay = ay + 0.5, pby = by + 0.5;
      if ((pay <= cy && pby > cy) || (pby <= cy && pay > cy)) {
        xs.push(ax + 0.5 + ((cy - pay) / (pby - pay)) * (bx - ax));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5));
      const xb = Math.min(w - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = xa; x <= xb; x++) mask[y * w + x] = 1;
    }
  }
  // contour
  for (let i = 0; i < n; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % n];
    bresenham(ax, ay, bx, by, (x, y) => {
      if (x >= 0 && y >= 0 && x < w && y < h) mask[y * w + x] = 1;
    });
  }
  return mask;
}

/**
 * Variante pour un polygone dont les sommets sont des coins de pixels (grille
 * aimantée) : un pixel est inclus si son centre est dans le polygone.
 */
export function polygonMaskCorners(points, w, h) {
  const mask = new Uint8Array(w * h);
  const n = points.length;
  if (n < 3) return mask;
  for (let y = 0; y < h; y++) {
    const cy = y + 0.5;
    const xs = [];
    for (let i = 0; i < n; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[(i + 1) % n];
      if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5));
      const xb = Math.min(w - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = xa; x <= xb; x++) mask[y * w + x] = 1;
    }
  }
  return mask;
}

export function maskBounds(mask, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Boîte englobante du contenu non transparent. */
export function contentBounds(data, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (data[row + x] >>> 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

// ---------- Motifs de tramage (dithering) ----------
// Chaque motif renvoie true si le pixel (x, y) prend la couleur A, false pour B.
// Coordonnées absolues du document : les motifs restent alignés d'un tracé à l'autre.
export const DITHER_PATTERNS = [
  { id: 'checker', name: 'Damier 50 %', fn: (x, y) => ((x + y) & 1) === 0 },
  { id: 'p25', name: '25 %', fn: (x, y) => (x & 1) === 0 && (y & 1) === 0 },
  { id: 'p75', name: '75 %', fn: (x, y) => !((x & 1) === 1 && (y & 1) === 1) },
  { id: 'p12', name: '12,5 %', fn: (x, y) => ((x & 3) === 0 && (y & 3) === 0) || ((x & 3) === 2 && (y & 3) === 2) },
  { id: 'big', name: 'Gros damier', fn: (x, y) => (((x >> 1) + (y >> 1)) & 1) === 0 },
  { id: 'hlines', name: 'Lignes horiz.', fn: (x, y) => (y & 1) === 0 },
  { id: 'vlines', name: 'Lignes vert.', fn: (x) => (x & 1) === 0 },
  { id: 'diag', name: 'Diagonales', fn: (x, y) => ((x + y) & 3) === 0 },
  { id: 'dots', name: 'Points', fn: (x, y) => (x & 3) === 0 && (y & 3) === 0 },
  { id: 'cross', name: 'Croisillons', fn: (x, y) => (x & 3) === 0 || (y & 3) === 0 },
];

export function ditherFn(id) {
  return (DITHER_PATTERNS.find((p) => p.id === id) || DITHER_PATTERNS[0]).fn;
}

// ---------- Transformations de tampons ----------
export function flipH(data, w, h) {
  const out = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + (w - 1 - x)] = data[y * w + x];
  return out;
}

export function flipV(data, w, h) {
  const out = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) out.set(data.subarray(y * w, y * w + w), (h - 1 - y) * w);
  return out;
}

/** Rotation 90° horaire : renvoie [données, nouvelleLargeur, nouvelleHauteur]. */
export function rotateCW(data, w, h) {
  const out = new (data.constructor)(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[x * h + (h - 1 - y)] = data[y * w + x];
  return [out, h, w];
}

export function rotateCCW(data, w, h) {
  const out = new (data.constructor)(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[(w - 1 - x) * h + y] = data[y * w + x];
  return [out, h, w];
}

export function flipHGeneric(data, w, h) {
  const out = new (data.constructor)(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + (w - 1 - x)] = data[y * w + x];
  return out;
}

export function flipVGeneric(data, w, h) {
  const out = new (data.constructor)(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[(h - 1 - y) * w + x] = data[y * w + x];
  return out;
}

/** Redimensionnement au plus proche voisin. */
export function scaleNearest(data, w, h, nw, nh) {
  const out = new Uint32Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(h - 1, Math.floor((y * h) / nh));
    for (let x = 0; x < nw; x++) {
      out[y * nw + x] = data[sy * w + Math.min(w - 1, Math.floor((x * w) / nw))];
    }
  }
  return out;
}

/** Copie un tampon (sw×sh) dans un autre (dw×dh) à la position (dx, dy). */
export function blit(src, sw, sh, dst, dw, dh, dx, dy, { overwrite = true } = {}) {
  for (let y = 0; y < sh; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= dh) continue;
    for (let x = 0; x < sw; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= dw) continue;
      const c = src[y * sw + x];
      if (overwrite || c >>> 24) dst[ty * dw + tx] = c;
    }
  }
}
