// Sérialisation d'un document : structure JSON + pixels.
// - pour IndexedDB : pixels bruts (Uint32Array, clonage structuré) ;
// - pour fichier .json : pixels compressés (deflate) puis base64, sans perte.

import { Doc, defaultGrid, defaultPngtuber } from '../core/doc.js';
import { bytesToBase64, base64ToBytes } from '../util/dom.js';

export const FORMAT = 'pixel-atelier';
export const VERSION = 1;

function nodeMeta(n) {
  const { cels, ...rest } = n;
  void cels;
  return JSON.parse(JSON.stringify(rest));
}

/** Objet clonable : { ...structure, cels: { 'layerId:frame': Uint32Array } } */
export function docToRecord(doc) {
  const nodes = [];
  const cels = {};
  for (const n of doc.nodes.values()) {
    nodes.push(nodeMeta(n));
    if (n.type === 'layer') n.cels.forEach((c, f) => { if (c) cels[`${n.id}:${f}`] = c.slice(); });
  }
  return {
    format: FORMAT,
    version: VERSION,
    id: doc.id,
    name: doc.name,
    width: doc.width,
    height: doc.height,
    frames: doc.frames,
    frame: doc.frame,
    fps: doc.fps,
    activeId: doc.activeId,
    expressions: doc.expressions,
    grid: doc.grid,
    palette: doc.palette,
    charColors: doc.charColors,
    pngtuber: doc.pngtuber,
    created: doc.created,
    updated: doc.updated,
    nodes,
    cels,
  };
}

export function recordToDoc(r) {
  if (!r || r.format !== FORMAT) throw new Error('Format de projet inconnu');
  const doc = new Doc(r.width, r.height, r.name);
  doc.id = r.id || doc.id;
  doc.frames = (r.frames && r.frames.length ? r.frames : [{ duration: 100 }]).map((f) => ({ duration: f.duration || 100 }));
  doc.frame = Math.min(r.frame || 0, doc.frames.length - 1);
  doc.fps = r.fps || 8;
  doc.nodes = new Map();
  for (const m of r.nodes) {
    const n = { ...m };
    if (n.type === 'layer') {
      n.cels = doc.frames.map((_, f) => {
        const c = r.cels[`${n.id}:${f}`];
        if (c && c.length === r.width * r.height) return c instanceof Uint32Array ? c : new Uint32Array(c);
        return doc.newCel();
      });
    } else n.children = [...(n.children || [])];
    doc.nodes.set(n.id, n);
  }
  doc.root = doc.nodes.get('root');
  if (!doc.root) throw new Error('Projet corrompu (racine absente)');
  // nettoyage : enfants manquants
  for (const n of doc.nodes.values()) if (n.type === 'group') n.children = n.children.filter((id) => doc.nodes.has(id));
  doc.activeId = doc.nodes.has(r.activeId) ? r.activeId : doc.firstLayer()?.id || null;
  doc.expressions = r.expressions || [];
  doc.grid = { ...defaultGrid(), ...(r.grid || {}) };
  doc.palette = r.palette || null;
  doc.charColors = r.charColors || null;
  doc.pngtuber = { ...defaultPngtuber(), ...(r.pngtuber || {}) };
  doc.created = r.created || Date.now();
  doc.updated = r.updated || Date.now();
  return doc;
}

// ---------- Fichier .json ----------
async function deflate(bytes) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const cs = new CompressionStream('deflate-raw');
    const out = new Response(new Blob([bytes]).stream().pipeThrough(cs));
    return new Uint8Array(await out.arrayBuffer());
  } catch (_) {
    return null; // navigateur sans « deflate-raw » : on enregistre sans compression
  }
}

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}

export async function docToFileJSON(doc) {
  const rec = docToRecord(doc);
  const enc = {};
  let compression = 'deflate-raw';
  const entries = Object.entries(rec.cels);
  // tout compressé ou rien : le format n'a qu'un seul indicateur de compression
  const zipped = [];
  for (const [, cel] of entries) {
    const z = await deflate(new Uint8Array(cel.buffer, cel.byteOffset, cel.byteLength));
    if (!z) { compression = 'none'; break; }
    zipped.push(z);
  }
  entries.forEach(([k, cel], i) => {
    enc[k] = bytesToBase64(compression === 'none' ? new Uint8Array(cel.buffer, cel.byteOffset, cel.byteLength) : zipped[i]);
  });
  rec.cels = enc;
  rec.compression = compression;
  rec.app = 'Pixel Atelier';
  return JSON.stringify(rec);
}

export async function fileJSONToDoc(text) {
  const rec = JSON.parse(text);
  if (rec.format !== FORMAT) throw new Error('Ce fichier n\'est pas un projet Pixel Atelier');
  const cels = {};
  for (const [k, b64] of Object.entries(rec.cels || {})) {
    let bytes = base64ToBytes(b64);
    if (rec.compression === 'deflate-raw') bytes = await inflate(bytes);
    cels[k] = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 2).slice();
  }
  rec.cels = cels;
  return recordToDoc(rec);
}
