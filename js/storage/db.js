// Accès IndexedDB minimal (promesses).

const DB_NAME = 'pixel-atelier';
const DB_VERSION = 2; // v2 : magasin « cels » (pixels enregistrés calque par calque)
let dbp = null;

export function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponible'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('library')) db.createObjectStore('library', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('cels')) db.createObjectStore('cels');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    const r = fn(s);
    if (r && 'onsuccess' in r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

/** Clés commençant par `prefix` (les clés sont des chaînes). */
export function prefixRange(prefix) {
  return IDBKeyRange.bound(prefix, prefix + '\uffff');
}

export const db = {
  /** [{ key, value }] pour une plage de clés. */
  entries: (store, range) => openDB().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(store, 'readonly');
    const s = t.objectStore(store);
    const out = [];
    const req = s.openCursor(range);
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      out.push({ key: c.key, value: c.value });
      c.continue();
    };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
  })),
  /** Écritures et suppressions groupées dans une seule transaction. */
  batch: (store, puts = [], deletes = []) => tx(store, 'readwrite', (s) => {
    for (const { key, value } of puts) s.put(value, key);
    for (const k of deletes) s.delete(k);
  }),
  get: (store, key) => tx(store, 'readonly', (s) => s.get(key)),
  getAll: (store) => tx(store, 'readonly', (s) => s.getAll()),
  put: (store, value, key) => tx(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key))),
  delete: (store, key) => tx(store, 'readwrite', (s) => s.delete(key)),
  deleteRange: (store, range) => tx(store, 'readwrite', (s) => s.delete(range)),
};
