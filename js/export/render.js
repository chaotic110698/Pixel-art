// Génération des images d'export (pixels exacts) : composition, calques,
// variantes, expressions, combinaisons, images d'animation.

import { composePixels } from '../render/compose.js';
import { contentBounds } from '../core/raster.js';
import { slugify } from '../util/dom.js';

/** Nom de fichier unique dans un ensemble. */
export function uniqueFile(used, base, ext = '.png') {
  let name = base + ext;
  for (let i = 2; used.has(name); i++) name = `${base}_${i}${ext}`;
  used.add(name);
  return name;
}

export function groupPath(doc, node) {
  return doc.ancestors(node).reverse().map((a) => a.name);
}

/** Liste des calques exportables (hors références), ordre bas -> haut. */
export function exportLayers(doc) {
  return doc.allLayers().filter((l) => !l.reference);
}

export function layerImage(doc, layer, frame = doc.frame) {
  return composePixels(doc, { root: layer, ignoreVisibility: true, includeReference: false, frame });
}

export function nodeImage(doc, node, frame = doc.frame) {
  return composePixels(doc, { root: node, ignoreVisibility: true, includeReference: false, frame });
}

export function compositeImage(doc, { overrides = null, frame = doc.frame } = {}) {
  return composePixels(doc, { overrides, includeReference: false, frame });
}

/** Produit cartésien des groupes de variantes. */
export function combinations(doc) {
  const groups = doc.variantGroups().filter((g) => g.children.length);
  let combos = [{}];
  for (const g of groups) {
    const next = [];
    for (const c of combos) for (const cid of g.children) next.push({ ...c, [g.id]: cid });
    combos = next;
    if (combos.length > 100000) break;
  }
  return { groups, combos: groups.length ? combos : [] };
}

export function countCombinations(doc) {
  return doc.variantGroups().reduce((n, g) => n * Math.max(1, g.children.length), 1);
}

/** Recadrage : calcule la boîte commune ou individuelle. */
export function boundsOf(images, w, h) {
  let u = null;
  for (const img of images) {
    const b = contentBounds(img, w, h);
    if (!b) continue;
    if (!u) u = { ...b };
    else {
      u.x0 = Math.min(u.x0, b.x0); u.y0 = Math.min(u.y0, b.y0);
      u.x1 = Math.max(u.x1, b.x1); u.y1 = Math.max(u.y1, b.y1);
    }
  }
  return u;
}

export const slug = slugify;
