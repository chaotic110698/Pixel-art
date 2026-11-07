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
import hands from './parts/hands.js';
import bodies3q from './parts/3q/bodies.js';
import heads3q from './parts/3q/heads.js';
import hair3q from './parts/3q/hair.js';
import { eyes as eyes3q, brows as brows3q, noses as noses3q, mouths as mouths3q, beards as beards3q } from './parts/3q/face.js';
import tops3q from './parts/3q/tops.js';
import acc3q from './parts/3q/accessories.js';
import { headsQD, hairQD, beardsQD, eyesQD, browsQD, mouthsQD, bodiesQD, topsQD } from './parts/3qd.js';
import { TEMPLATE, roleColors, rasterize, DEFAULT_COLORS } from './builder.js';
import { uid } from '../core/doc.js';
import { tr } from '../ui/i18n.js';

export const CATEGORIES = [
  { id: 'body', name: 'Corps', pieces: [...bodies, ...bodies3q, ...bodiesQD], exclusive: true },
  { id: 'head', name: 'Têtes', pieces: [...heads, ...heads3q, ...headsQD], exclusive: true },
  { id: 'hair', name: 'Coiffures', pieces: [...hair, ...hair3q, ...hairQD], exclusive: true },
  { id: 'eyes', name: 'Yeux', pieces: [...eyes, ...eyes3q, ...eyesQD], exclusive: true },
  { id: 'brows', name: 'Sourcils', pieces: [...brows, ...brows3q, ...browsQD], exclusive: true },
  { id: 'nose', name: 'Nez', pieces: [...noses, ...noses3q], exclusive: true },
  { id: 'mouth', name: 'Bouches', pieces: [...mouths, ...mouths3q, ...mouthsQD], exclusive: true },
  { id: 'top', name: 'Vêtements', pieces: [...tops, ...tops3q, ...topsQD], exclusive: true },
  { id: 'accessory', name: 'Accessoires', pieces: [...accessories, ...beards3q, ...acc3q, ...beardsQD], exclusive: false },
  { id: 'hands', name: 'Mains', pieces: hands, exclusive: true },
];

/**
 * Vues disponibles : de face, de 3/4 (style portrait) et « portrait détaillé » (3/4 à grande
 * tête, d'après la 2e image de référence). Les pièces de profil portent `facing` (sens dessiné) ;
 * le personnage d'un projet a son propre sens (doc.charTemplate.facing) : une pièce dessinée
 * dans l'autre sens est retournée en miroir à l'insertion.
 */
export const VIEWS = [
  { id: 'front', name: 'De face' },
  { id: '3q', name: '3/4' },
  { id: '3qd', name: 'Portrait détaillé' },
];
export const viewOf = (piece) => piece?.view || 'front';
/** Sens dessiné d'une pièce de profil ('left' | 'right'), null pour la vue de face. */
export const facingOf = (piece) => piece?.facing || (viewOf(piece) === '3q' ? 'right' : null);
/** La pièce doit-elle être retournée pour regarder dans le sens `facing` ? */
export const needsFlip = (piece, facing) => !!(facing && facingOf(piece) && facingOf(piece) !== facing);
/** Sens par défaut d'une vue. */
export const viewFacing = (view) => (view === '3qd' ? 'left' : view === '3q' ? 'right' : null);

/** Pièces de base (mannequin) d'une vue. */
export const VIEW_BASE = {
  front: { body: 'body-moyen', head: 'head-round', face: ['eyes-dots', 'mouth-simple'] },
  '3q': { body: 'body-3q-moyen', head: 'head-3q-long', face: ['eyes-3q-natural', 'brows-3q-straight', 'nose-3q-soft', 'mouth-3q-natural'] },
  '3qd': { body: 'body-qd-moyen', head: 'head-qd', face: ['eyes-qd', 'brows-qd', 'mouth-qd'] },
};

/** Vue dominante du document (d'après les pièces de bibliothèque présentes). */
export function docView(doc) {
  for (const n of doc.nodes.values()) {
    const p = n.part && ['body', 'head'].includes(n.part.category) && pieceById(n.part.pieceId);
    if (p) return viewOf(p);
  }
  return null;
}

/** Type de corps cohérent avec la vue (les hauts de profil attendent un physique de la même vue). */
export function bodyTypeForView(bodyType, view) {
  const b = String(bodyType || '');
  const own = view === '3q' ? '3q-' : view === '3qd' ? 'qd-' : null;
  if (own) return b.startsWith(own) ? b : own + 'moyen';
  return b.startsWith('3q-') || b.startsWith('qd-') ? 'moyen' : bodyType || 'moyen';
}

/** Sens du personnage du projet (null tant qu'aucune pièce de profil n'a été posée). */
export function docFacing(doc) {
  if (doc.charTemplate?.facing) return doc.charTemplate.facing;
  for (const n of doc.nodes.values()) {
    const p = n.part && pieceById(n.part.pieceId);
    if (p && facingOf(p)) return facingOf(p);
  }
  return null;
}

/** Miroir horizontal d'une grille de rôles. */
export function flipGrid(grid) {
  const w = grid.w, a = new Uint8Array(grid.a.length);
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < w; x++) a[y * w + x] = grid.a[y * w + w - 1 - x];
  return { a, w, h: grid.h };
}

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
/**
 * Origine du gabarit 64×64 (coin haut-gauche de la tête « standard ») dans le canevas,
 * mémorisée par projet dans doc.charTemplate = { ox, oy, scale } dès la première pièce.
 * Les corps entiers utilisent un gabarit 64×96 dont les 64 premières lignes coïncident.
 */
export function templateOrigin(doc, { tall = false, scale = null } = {}) {
  const t = doc.charTemplate;
  if (t && Number.isFinite(t.ox) && Number.isFinite(t.oy)) return { ox: t.ox, oy: t.oy, scale: t.scale || 1 };
  const s = scale || 1;
  const h = (tall ? 96 : TEMPLATE) * s;
  return { ox: Math.floor((doc.width - TEMPLATE * s) / 2), oy: doc.height - h, scale: s };
}

export function templateOffset(doc) {
  const o = templateOrigin(doc);
  return [o.ox, o.oy];
}

/** Agrandissement « Scale2x » d'une grille de rôles (lisse les diagonales). */
export function scaleGrid(grid, s) {
  if (s <= 1) return grid;
  let a = grid.a, w = grid.w, h = grid.h;
  for (let k = 1; k < s; k *= 2) {
    const W = w * 2;
    const out = new Uint8Array(W * h * 2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const E = a[y * w + x];
        const B = y > 0 ? a[(y - 1) * w + x] : E, H = y < h - 1 ? a[(y + 1) * w + x] : E;
        const D = x > 0 ? a[y * w + x - 1] : E, F = x < w - 1 ? a[y * w + x + 1] : E;
        let e0 = E, e1 = E, e2 = E, e3 = E;
        if (B !== H && D !== F) {
          if (D === B) e0 = D;
          if (B === F) e1 = F;
          if (D === H) e2 = D;
          if (H === F) e3 = F;
        }
        const o = y * 2 * W + x * 2;
        out[o] = e0; out[o + 1] = e1; out[o + W] = e2; out[o + W + 1] = e3;
      }
    }
    a = out; w = W; h *= 2;
  }
  return { a, w, h };
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

/** Nom de calque « Catégorie (pièce) » traduit morceau par morceau (interface anglaise). */
const LAYER_HEADS = { 'Corps entier': 'Full body', 'Cheveux arrière': 'Hair back', 'Cheveux avant': 'Hair front', Cheveux: 'Hair', Corps: 'Body', 'Tête': 'Head', Haut: 'Top', Nez: 'Nose', Main: 'Hand' };
function trName(name) {
  if (tr('Calque') === 'Calque') return name; // interface en français
  const m = name.match(/^(.+?) \((.+?)(, 3\/4|, portrait)?\)$/);
  if (!m) return tr(name);
  const cap = m[2].charAt(0).toUpperCase() + m[2].slice(1);
  return `${LAYER_HEADS[m[1]] || tr(m[1])} (${tr(cap).toLowerCase()}${m[3] || ''})`;
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
export function insertPiece(doc, piece, { colors = doc.charColors || DEFAULT_COLORS, replace = true, facing: wanted = null } = {}) {
  const ctx = { bodyType: docBodyType(doc) };
  const layers = buildPiece(piece, ctx);
  const rc = roleColors(colors);
  const origin = templateOrigin(doc, { tall: !!piece.tall });
  const { ox, oy, scale } = origin;
  if (!doc.charTemplate) doc.charTemplate = { ox, oy, scale };
  // sens du personnage : fixé par la première pièce de profil, puis les autres s'y alignent
  const facing = (facingOf(piece) && (wanted || docFacing(doc))) || docFacing(doc) || facingOf(piece);
  if (facing && doc.charTemplate.facing !== facing) doc.charTemplate = { ...doc.charTemplate, facing };
  const flip = needsFlip(piece, facing);
  const raster = (grid) => rasterize(scaleGrid(flip ? flipGrid(grid) : grid, scale), rc, doc.width, doc.height, ox, oy);
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
      node = doc.createGroup(tr(L.name), { variant: true, role: L.role || null, part: partMeta({ z: L.z }) });
      for (const v of L.variants) {
        const layer = doc.createLayer(tr(v.name), { part: partMeta({ z: L.z, state: v.state }) });
        layer.cels[0] = raster(v.grid);
        for (let f = 1; f < layer.cels.length; f++) layer.cels[f] = layer.cels[0].slice();
        doc.adopt(node, layer);
      }
      // ordre d'affichage : premier état (ouvert/fermé...) en haut de la liste
      node.children.reverse();
      node.active = node.children[node.children.length - 1];
    } else {
      node = doc.createLayer(trName(L.name), { part: partMeta({ z: L.z }) });
      node.cels[0] = raster(L.grid);
      for (let f = 1; f < node.cels.length; f++) node.cels[f] = node.cels[0].slice();
    }
    doc.insert(node, 'root', zIndex(doc, L.z));
    if (!first) first = node;
  }
  // changement de corps : le vêtement (ajusté au corps) est recréé à la bonne forme
  if (piece.category === 'body') {
    const top = [...doc.nodes.values()].find((n) => n.part?.category === 'top' && doc.get(n.parent)?.id === 'root');
    const topPiece = top && pieceById(top.part.pieceId);
    if (topPiece?.fitsBody) insertPiece(doc, topPiece, { colors, replace: true });
  }
  return first;
}

/** Aperçu d'une pièce : Uint32Array 64×64 (avec mannequin optionnel). */
export function previewPixels(piece, { colors = DEFAULT_COLORS, bodyType = 'moyen', state = null, height = TEMPLATE, flip = false } = {}) {
  const rc = roleColors(colors);
  const out = new Uint32Array(TEMPLATE * height);
  for (const L of buildPiece(piece, { bodyType })) {
    let grid = L.variants ? (L.variants.find((v) => v.state === state) || L.variants[0]).grid : L.grid;
    if (flip) grid = flipGrid(grid);
    const px = rasterize(grid, rc, TEMPLATE, height);
    for (let i = 0; i < px.length; i++) if (px[i] >>> 24) out[i] = px[i];
  }
  return out;
}

export function userPieceId() {
  return uid('u');
}
