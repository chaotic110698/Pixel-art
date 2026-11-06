// Registre de la bibliothèque et insertion des pièces dans un document.
// Pour ajouter une catégorie : créez un fichier dans parts/ et ajoutez-le à CATEGORIES.

import bodies from './parts/bodies.js';
import heads from './parts/heads.js';
import hair from './parts/hair.js';
import eyes from './parts/eyes.js';
import brows from './parts/brows.js';
import noses from './parts/noses.js';
import mouths from './parts/mouths.js';
import accessories from './parts/accessories.js';
import tops from './parts/tops.js';
import { TEMPLATE, roleColors, rasterize, DEFAULT_COLORS } from './builder.js';
import { uid } from '../core/doc.js';

export const CATEGORIES = [
  { id: 'body', name: 'Corps', pieces: bodies, exclusive: true },
  { id: 'head', name: 'Têtes', pieces: heads, exclusive: true },
  { id: 'hair', name: 'Coiffures', pieces: hair, exclusive: true },
  { id: 'eyes', name: 'Yeux', pieces: eyes, exclusive: true },
  { id: 'brows', name: 'Sourcils', pieces: brows, exclusive: true },
  { id: 'nose', name: 'Nez', pieces: noses, exclusive: true },
  { id: 'mouth', name: 'Bouches', pieces: mouths, exclusive: true },
  { id: 'top', name: 'Vêtements', pieces: tops, exclusive: true },
  { id: 'accessory', name: 'Accessoires', pieces: accessories, exclusive: false },
];

export function allPieces() {
  return CATEGORIES.flatMap((c) => c.pieces);
}

export function pieceById(id) {
  return allPieces().find((p) => p.id === id) || null;
}

const cache = new Map();
/** Couches de rôles d'une pièce (avec cache). */
export function buildPiece(piece, ctx = {}) {
  const key = piece.id + '|' + (piece.fitsBody ? ctx.bodyType || '' : '');
  if (!cache.has(key)) cache.set(key, piece.build(ctx));
  return cache.get(key);
}

/** Décalage du gabarit 64×64 dans le canevas : centré, aligné en bas. */
export function templateOffset(doc) {
  return [Math.floor((doc.width - TEMPLATE) / 2), doc.height - TEMPLATE];
}

/** Type de corps présent dans le document (pour ajuster les vêtements). */
export function docBodyType(doc) {
  for (const n of doc.nodes.values()) if (n.part?.category === 'body' && n.part.bodyType) return n.part.bodyType;
  return 'moyen';
}

/** Nœuds (racine) appartenant à une catégorie/sous-catégorie exclusive. */
export function nodesOfKind(doc, piece) {
  const key = piece.exclusiveKey !== undefined ? piece.exclusiveKey : piece.category;
  if (!key) return [];
  const keyOf = (n) => (n.part.exclusiveKey !== undefined ? n.part.exclusiveKey : n.part.category);
  const out = [];
  for (const n of doc.nodes.values()) {
    if (!n.part || keyOf(n) !== key) continue;
    const parent = doc.get(n.parent);
    // on ne garde que le nœud « racine » de la pièce (pas les variantes d'un groupe-pièce)
    if (parent?.part && keyOf(parent) === key) continue;
    out.push(n);
  }
  return out;
}

/** Index d'insertion dans la racine selon l'ordre z des pièces. */
function zIndex(doc, z) {
  const ch = doc.root.children;
  for (let i = 0; i < ch.length; i++) {
    const n = doc.get(ch[i]);
    if (n?.part && n.part.z > z) return i;
  }
  // après la dernière pièce (les calques de l'utilisateur au-dessus restent au-dessus)
  let last = -1;
  for (let i = 0; i < ch.length; i++) if (doc.get(ch[i])?.part) last = i;
  return last + 1;
}

/**
 * Crée les nœuds d'une pièce dans `doc` (sans historique : à appeler dans une transaction).
 * Retourne le premier nœud créé (pour le rendre actif).
 */
export function insertPiece(doc, piece, { colors = doc.charColors || DEFAULT_COLORS, replace = true } = {}) {
  const ctx = { bodyType: docBodyType(doc) };
  const layers = buildPiece(piece, ctx);
  const rc = roleColors(colors);
  const [ox, oy] = templateOffset(doc);
  if (!doc.charColors) doc.charColors = { ...colors };
  if (replace) for (const n of nodesOfKind(doc, piece)) doc.remove(n.id);
  const partMeta = (extra = {}) => ({
    pieceId: piece.id,
    category: piece.category,
    exclusiveKey: piece.exclusiveKey !== undefined ? piece.exclusiveKey : piece.category,
    bodyType: piece.bodyType || null,
    ...extra,
  });
  let first = null;
  for (const L of layers) {
    let node;
    if (L.variants) {
      node = doc.createGroup(L.name, { variant: true, role: L.role || null, part: partMeta({ z: L.z }) });
      for (const v of L.variants) {
        const layer = doc.createLayer(v.name, { part: partMeta({ z: L.z, state: v.state }) });
        layer.cels[0] = rasterize(v.grid, rc, doc.width, doc.height, ox, oy);
        for (let f = 1; f < layer.cels.length; f++) layer.cels[f] = layer.cels[0].slice();
        doc.adopt(node, layer);
      }
      // ordre d'affichage : premier état (ouvert/fermé...) en haut de la liste
      node.children.reverse();
      node.active = node.children[node.children.length - 1];
    } else {
      node = doc.createLayer(L.name, { part: partMeta({ z: L.z }) });
      node.cels[0] = rasterize(L.grid, rc, doc.width, doc.height, ox, oy);
      for (let f = 1; f < node.cels.length; f++) node.cels[f] = node.cels[0].slice();
    }
    doc.insert(node, 'root', zIndex(doc, L.z));
    if (!first) first = node;
  }
  return first;
}

/** Aperçu d'une pièce : Uint32Array 64×64 (avec mannequin optionnel). */
export function previewPixels(piece, { colors = DEFAULT_COLORS, bodyType = 'moyen', state = null } = {}) {
  const rc = roleColors(colors);
  const out = new Uint32Array(TEMPLATE * TEMPLATE);
  for (const L of buildPiece(piece, { bodyType })) {
    const grid = L.variants ? (L.variants.find((v) => v.state === state) || L.variants[0]).grid : L.grid;
    const px = rasterize(grid, rc, TEMPLATE, TEMPLATE);
    for (let i = 0; i < px.length; i++) if (px[i] >>> 24) out[i] = px[i];
  }
  return out;
}

export function userPieceId() {
  return uid('u');
}
