// Sauvegarde automatique locale (IndexedDB) et gestion de la liste des projets.

import { db, prefixRange } from './db.js';
import { setDirtyHook } from '../render/celcache.js';
import { docToRecord, recordToDoc } from './serialize.js';
import { composeToCanvas } from '../render/compose.js';
import { debounce } from '../util/dom.js';

export async function makeThumb(doc, size = 128) {
  const src = composeToCanvas(doc, { includeReference: false, frame: 0 });
  const k = Math.max(1, Math.floor(size / Math.max(doc.width, doc.height)));
  const c = document.createElement('canvas');
  const s = Math.min(1, size / Math.max(doc.width, doc.height));
  c.width = Math.max(1, Math.round(doc.width * (k > 1 ? k : s)));
  c.height = Math.max(1, Math.round(doc.height * (k > 1 ? k : s)));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b), 'image/png'));
}

/** Lit un projet enregistré (utilisable sans l'éditeur, ex. fenêtre de capture). */
export async function readProject(id) {
  const rec = await db.get('projects', id);
  if (!rec) throw new Error('Projet introuvable');
  if (!rec.celKeys) return { doc: recordToDoc(rec), rec, entries: null }; // ancien format : pixels dans l'enregistrement
  const entries = await db.entries('cels', prefixRange(`${id}|`));
  rec.cels = {};
  for (const { key, value } of entries) {
    const [, layerId, f] = key.split('|');
    rec.cels[`${layerId}:${f}`] = value;
  }
  return { doc: recordToDoc(rec), rec, entries };
}

/** Canal entre onglets (éditeur -> fenêtre de capture PNGtuber). */
export const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('pixel-atelier') : null;

export async function initStorage(app) {
  let saving = false;
  let dirty = false;
  let lastSaved = 0;

  // Sauvegarde incrémentale : chaque cel (calque × image) est un enregistrement
  // séparé, réécrit seulement s'il a changé depuis la dernière sauvegarde.
  const savedKey = new WeakMap(); // cel -> clé sous laquelle elle est enregistrée
  const dirtyCels = new WeakSet();
  const knownKeys = new Map(); // id projet -> Set des clés enregistrées
  setDirtyHook((cel) => dirtyCels.add(cel));

  const celKey = (docId, layerId, f) => `${docId}|${layerId}|${f}`;

  /** Copie d'une cel avec le contenu flottant (sélection en cours de déplacement) posé dessus. */
  function withFloating(doc, cel) {
    const f = app.selection.floating;
    const out = cel.slice();
    const { width: w, height: h } = doc;
    for (let y = 0; y < f.h; y++) {
      const ty = f.y + y;
      if (ty < 0 || ty >= h) continue;
      for (let x = 0; x < f.w; x++) {
        const tx = f.x + x;
        const c = f.data[y * f.w + x];
        if (tx >= 0 && tx < w && f.mask[y * f.w + x] && c >>> 24) out[ty * w + tx] = c;
      }
    }
    return out;
  }

  async function save(doc = app.doc) {
    doc.updated = Date.now();
    const rec = docToRecord(doc, { withCels: false });
    const floating = doc === app.doc ? app.selection.floating : null;
    const puts = [];
    const written = [];
    const keys = new Set();
    const links = rec.celLinks || {};
    for (const layer of doc.allLayers()) {
      layer.cels.forEach((cel, f) => {
        if (!cel || links[`${layer.id}:${f}`]) return; // image liée : la cel source suffit
        const key = celKey(doc.id, layer.id, f);
        keys.add(key);
        const isFloat = floating && floating.layerId === layer.id && layer.cels[doc.frame] === cel;
        if (isFloat) {
          puts.push({ key, value: withFloating(doc, cel) });
          return; // reste « sale » : sera réécrite après validation du déplacement
        }
        if (dirtyCels.has(cel) || savedKey.get(cel) !== key) {
          puts.push({ key, value: cel.slice() });
          written.push([cel, key]);
          dirtyCels.delete(cel);
          savedKey.set(cel, key);
        }
      });
    }
    rec.celKeys = [...keys];
    const prev = knownKeys.get(doc.id);
    const stale = prev ? [...prev].filter((k) => !keys.has(k)) : [];
    try {
      await db.batch('cels', puts, stale);
    } catch (err) {
      for (const [cel] of written) {
        dirtyCels.add(cel);
        savedKey.delete(cel);
      }
      throw err;
    }
    knownKeys.set(doc.id, keys);
    await db.put('projects', rec);
    let thumb = null;
    try {
      thumb = await makeThumb(doc);
    } catch (_) { /* aperçu facultatif */ }
    await db.put('meta', { id: doc.id, name: doc.name, width: doc.width, height: doc.height, updated: doc.updated, created: doc.created, layers: doc.allLayers().length, frames: doc.frames.length, thumb });
    await db.put('kv', doc.id, 'lastProject');
  }

  async function saveNow(showToast = false) {
    if (saving) {
      dirty = true;
      return;
    }
    saving = true;
    try {
      await save();
      dirty = false;
      lastSaved = Date.now();
      app.emit('saved', lastSaved);
      channel?.postMessage({ type: 'saved', projectId: app.doc.id });
      if (showToast) app.toast('Projet enregistré sur cet appareil');
    } catch (err) {
      console.error('[save]', err);
      if (showToast) app.toast('Échec de l\'enregistrement : ' + (err.message || err));
    } finally {
      saving = false;
      if (dirty) autosave();
    }
  }

  const autosave = debounce(() => saveNow(false), 1500);
  app.on('changed', autosave);
  app.on('pixels', autosave);
  app.on('doc', autosave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') autosave.flush();
  });
  window.addEventListener('pagehide', () => autosave.flush());

  async function load(id) {
    const { doc, rec, entries } = await readProject(id);
    if (!entries) return doc; // ancien format
    // les cels chargées sont déjà à jour en base
    const keys = new Set();
    for (const layer of doc.allLayers()) {
      layer.cels.forEach((cel, f) => {
        const key = celKey(doc.id, layer.id, f);
        keys.add(key);
        if (rec.cels[`${layer.id}:${f}`] === cel) savedKey.set(cel, key);
      });
    }
    knownKeys.set(doc.id, new Set(entries.map((e) => e.key)));
    return doc;
  }

  async function restoreLast() {
    try {
      const id = await db.get('kv', 'lastProject');
      if (!id) return false;
      const doc = await load(id);
      app.setDoc(doc);
      return true;
    } catch (err) {
      console.warn('[restore]', err);
      return false;
    }
  }

  async function list() {
    const metas = await db.getAll('meta');
    return metas.sort((a, b) => b.updated - a.updated);
  }

  /** Renomme un projet enregistré sans le charger. */
  async function rename(id, name) {
    const rec = await db.get('projects', id);
    const meta = await db.get('meta', id);
    if (!rec) return;
    rec.name = name;
    await db.put('projects', rec);
    if (meta) await db.put('meta', { ...meta, name });
  }

  async function remove(id) {
    await db.delete('projects', id);
    await db.delete('meta', id);
    await db.deleteRange('cels', prefixRange(`${id}|`));
    knownKeys.delete(id);
  }

  return { save, saveNow, load, restoreLast, list, remove, rename, get lastSaved() { return lastSaved; } };
}
