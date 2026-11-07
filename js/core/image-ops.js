// Opérations sur l'image entière : taille du canevas, mise à l'échelle,
// miroir/rotation du document, recadrage. Toutes annulables.

import { scaleNearest, flipH, flipV, rotateCW, rotateCCW, contentBounds } from './raster.js';
import { composePixels } from '../render/compose.js';

function remapAll(doc, fn) {
  for (const l of doc.allLayers()) l.cels = l.cels.map((c) => fn(c || doc.newCel()));
}

/** Change la taille du canevas ; anchor ∈ {tl,t,tr,l,c,r,bl,b,br}. */
export function resizeCanvas(app, nw, nh, anchor = 'c') {
  const doc = app.doc;
  nw = Math.max(1, Math.min(4096, nw | 0));
  nh = Math.max(1, Math.min(4096, nh | 0));
  if (nw === doc.width && nh === doc.height) return;
  app.selection.commitFloating();
  app.selection.reset();
  const W = doc.width, H = doc.height;
  const ax = anchor.includes('l') ? 0 : anchor.includes('r') ? 1 : 0.5;
  const ay = anchor.includes('t') ? 0 : anchor.includes('b') ? 1 : 0.5;
  const dx = Math.round((nw - W) * ax), dy = Math.round((nh - H) * ay);
  app.history.transact('Taille du canevas', () => {
    remapAll(doc, (c) => {
      const out = new Uint32Array(nw * nh);
      for (let y = 0; y < H; y++) {
        const ty = y + dy;
        if (ty < 0 || ty >= nh) continue;
        for (let x = 0; x < W; x++) {
          const tx = x + dx;
          if (tx >= 0 && tx < nw) out[ty * nw + tx] = c[y * W + x];
        }
      }
      return out;
    });
    doc.width = nw;
    doc.height = nh;
    if (doc.charTemplate) doc.charTemplate = { ...doc.charTemplate, ox: doc.charTemplate.ox + dx, oy: doc.charTemplate.oy + dy };
  });
  app.renderer.ensureBuffers();
  app.viewport.fit();
  app.emit('doc', doc);
}

export function scaleImage(app, nw, nh) {
  const doc = app.doc;
  nw = Math.max(1, Math.min(4096, nw | 0));
  nh = Math.max(1, Math.min(4096, nh | 0));
  app.selection.commitFloating();
  app.selection.reset();
  const W = doc.width, H = doc.height;
  app.history.transact('Mettre à l\'échelle', () => {
    remapAll(doc, (c) => scaleNearest(c, W, H, nw, nh));
    doc.width = nw;
    doc.height = nh;
  });
  app.renderer.ensureBuffers();
  app.viewport.fit();
  app.emit('doc', doc);
}

export function flipDoc(app, axis) {
  const doc = app.doc;
  app.selection.commitFloating();
  const W = doc.width, H = doc.height;
  app.history.transact(axis === 'h' ? 'Miroir horizontal' : 'Miroir vertical', () => {
    remapAll(doc, (c) => (axis === 'h' ? flipH(c, W, H) : flipV(c, W, H)));
    // personnage de bibliothèque : le gabarit suit le miroir (et le sens du profil s'inverse)
    const t = doc.charTemplate;
    if (axis === 'h' && t) {
      doc.charTemplate = { ...t, ox: W - t.ox - 64 * (t.scale || 1) };
      if (t.facing) doc.charTemplate.facing = t.facing === 'left' ? 'right' : 'left';
    }
  });
}

export function rotateDoc(app, dir) {
  const doc = app.doc;
  app.selection.commitFloating();
  app.selection.reset();
  const W = doc.width, H = doc.height;
  app.history.transact('Rotation 90°', () => {
    remapAll(doc, (c) => (dir > 0 ? rotateCW(c, W, H) : rotateCCW(c, W, H))[0]);
    doc.width = H;
    doc.height = W;
  });
  app.renderer.ensureBuffers();
  app.viewport.fit();
  app.emit('doc', doc);
}

export function cropTo(app, x0, y0, x1, y1) {
  const doc = app.doc;
  const W = doc.width;
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1;
  if (nw <= 0 || nh <= 0) return;
  app.selection.commitFloating();
  app.selection.reset();
  app.history.transact('Recadrer', () => {
    remapAll(doc, (c) => {
      const out = new Uint32Array(nw * nh);
      for (let y = 0; y < nh; y++) out.set(c.subarray((y0 + y) * W + x0, (y0 + y) * W + x0 + nw), y * nw);
      return out;
    });
    doc.width = nw;
    doc.height = nh;
    if (doc.charTemplate) doc.charTemplate = { ...doc.charTemplate, ox: doc.charTemplate.ox - x0, oy: doc.charTemplate.oy - y0 };
  });
  app.renderer.ensureBuffers();
  app.viewport.fit();
  app.emit('doc', doc);
}

export function cropToSelection(app) {
  app.selection.commitFloating();
  const b = app.selection.bounds;
  if (!b) return app.toast('Aucune sélection');
  cropTo(app, b.x0, b.y0, b.x1, b.y1);
}

export function cropToContent(app) {
  const doc = app.doc;
  const px = composePixels(doc, { includeReference: false });
  const b = contentBounds(px, doc.width, doc.height);
  if (!b) return app.toast('Image vide');
  cropTo(app, b.x0, b.y0, b.x1, b.y1);
}
