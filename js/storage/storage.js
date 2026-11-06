// Sauvegarde automatique locale (IndexedDB) et gestion de la liste des projets.

import { db } from './db.js';
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

export async function initStorage(app) {
  let saving = false;
  let dirty = false;
  let lastSaved = 0;

  async function save(doc = app.doc) {
    doc.updated = Date.now();
    const rec = docToRecord(doc);
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
    const rec = await db.get('projects', id);
    if (!rec) throw new Error('Projet introuvable');
    return recordToDoc(rec);
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

  async function remove(id) {
    await db.delete('projects', id);
    await db.delete('meta', id);
  }

  return { save, saveNow, load, restoreLast, list, remove, get lastSaved() { return lastSaved; } };
}
