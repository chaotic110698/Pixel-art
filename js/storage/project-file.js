// Téléchargement / ouverture de fichiers projet (.pxa.json).

import { docToFileJSON, fileJSONToDoc } from './serialize.js';
import { downloadBlob, pickFile, slugify } from '../util/dom.js';
import { uid } from '../core/doc.js';
import { readZip } from '../export/zip.js';
import { db } from './db.js';

// ---------- Fichier sur l'ordinateur (File System Access : Chrome/Edge ordinateur) ----------
export const fsSupported = typeof window !== 'undefined' && 'showSaveFilePicker' in window;
const handles = new Map(); // id projet -> FileSystemFileHandle

async function storedHandle(docId) {
  if (handles.has(docId)) return handles.get(docId);
  try {
    const h = await db.get('kv', 'handle:' + docId);
    if (h) handles.set(docId, h);
    return h || null;
  } catch (_) {
    return null;
  }
}

async function writeHandle(handle, json) {
  if (handle.queryPermission && (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
    if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Permission refusée');
  }
  const w = await handle.createWritable();
  await w.write(json);
  await w.close();
}

/**
 * Enregistre le projet dans un fichier de l'ordinateur. saveAs : demander l'emplacement.
 * Sans l'API (Firefox, Safari, mobile) : téléchargement.
 */
export async function saveToFile(app, { saveAs = false } = {}) {
  if (!fsSupported) return downloadProject(app);
  app.selection.commitFloating();
  const doc = app.doc;
  let handle = saveAs ? null : await storedHandle(doc.id);
  try {
    if (!handle) {
      handle = await window.showSaveFilePicker({
        suggestedName: `${slugify(doc.name)}.pxa.json`,
        types: [{ description: 'Projet Pixel Atelier', accept: { 'application/json': ['.json'] } }],
      });
    }
    await writeHandle(handle, await docToFileJSON(doc));
    handles.set(doc.id, handle);
    db.put('kv', handle, 'handle:' + doc.id).catch(() => {});
    app.fileName = handle.name;
    app.emit('filehandle', handle.name);
    app.toast(`Enregistré dans « ${handle.name} »`);
    return true;
  } catch (err) {
    if (err?.name === 'AbortError') return false;
    app.toast('Enregistrement du fichier impossible : ' + (err.message || err), 3500);
    return false;
  }
}

/** Ctrl+S : si le projet est lié à un fichier, on l'écrit aussi (sans boîte de dialogue). */
export async function saveLinkedFile(app) {
  if (!fsSupported) return false;
  const handle = await storedHandle(app.doc.id);
  if (!handle) return false;
  try {
    await writeHandle(handle, await docToFileJSON(app.doc));
    app.toast(`Enregistré (navigateur + « ${handle.name} »)`);
    return true;
  } catch (_) {
    return false;
  }
}

export async function downloadProject(app) {
  app.selection.commitFloating();
  const json = await docToFileJSON(app.doc);
  downloadBlob(new Blob([json], { type: 'application/json' }), `${slugify(app.doc.name)}.pxa.json`);
  app.toast('Fichier projet téléchargé');
}

export async function openProjectFile(app, file = null) {
  let handle = null;
  if (!file && 'showOpenFilePicker' in window) {
    try {
      [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Projets et fichiers Aseprite', accept: { 'application/json': ['.json', '.pxa'], 'application/zip': ['.zip'], 'application/octet-stream': ['.ase', '.aseprite'] } }],
      });
      file = await handle.getFile();
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  file = file || (await pickFile('.json,.pxa,.zip,.ase,.aseprite,application/json,application/zip'));
  if (!file) return;
  if (/\.(ase|aseprite)$/i.test(file.name)) {
    const { importAseprite } = await import('./aseprite.js');
    try {
      const doc = await importAseprite(new Uint8Array(await file.arrayBuffer()), file.name.replace(/\.[^.]+$/, ''));
      await app.storage?.saveNow();
      app.setDoc(doc);
      app.toast(`Fichier Aseprite importé : ${doc.allLayers().length} calque(s), ${doc.frames.length} image(s)`);
    } catch (err) {
      console.error(err);
      app.toast('Import Aseprite impossible : ' + (err.message || err), 4000);
    }
    return;
  }
  try {
    let text;
    if (file.name.toLowerCase().endsWith('.zip')) {
      const entries = await readZip(new Uint8Array(await file.arrayBuffer()));
      const e = entries.find((x) => x.name.endsWith('.pxa.json')) || entries.find((x) => x.name === 'project.json');
      if (!e) throw new Error('Aucun projet dans ce ZIP');
      text = new TextDecoder().decode(e.data);
    } else text = await file.text();
    const doc = await fileJSONToDoc(text);
    await app.storage?.saveNow();
    // si un projet avec ce même identifiant existe déjà, on ouvre une copie
    const existing = await app.storage?.list().then((l) => l.some((m) => m.id === doc.id)).catch(() => false);
    if (existing) {
      doc.id = uid('p');
      doc.name += ' (importé)';
    }
    app.setDoc(doc);
    if (handle && /\.json$/i.test(file.name)) {
      // ce fichier devient le fichier lié du projet (Ctrl+S l'écrit)
      handles.set(doc.id, handle);
      db.put('kv', handle, 'handle:' + doc.id).catch(() => {});
    }
    app.toast(`Projet « ${doc.name} » ouvert`);
  } catch (err) {
    console.error(err);
    app.toast('Impossible d\'ouvrir ce fichier : ' + (err.message || err), 3000);
  }
}
