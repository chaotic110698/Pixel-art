// Sauvegardes hors du navigateur :
//  - dossier de l'ordinateur (File System Access : Chrome, Edge, Opera sur ordinateur) ;
//    on peut choisir un dossier synchronisé (Google Drive pour ordinateur, OneDrive, Dropbox…) ;
//  - Google Drive en direct (OAuth 2.0 « jeton » dans une fenêtre surgissante, API Drive v3,
//    accès limité aux fichiers créés par l'application : drive.file) ;
//  - archive ZIP de tous les projets (tous les navigateurs) et restauration.
// La sauvegarde automatique suit l'enregistrement local (évènement « saved »), au plus une
// fois par minute et par destination, et à la fermeture de l'onglet.

import { db } from './db.js';
import { docToFileJSON, fileJSONToDoc } from './serialize.js';
import { makeZip, readZip } from '../export/zip.js';
import { downloadBlob, pickFile, slugify } from '../util/dom.js';
import { uid } from '../core/doc.js';

export const folderSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
const MIN_GAP = 60_000;
const HISTORY_DAYS = 14;

/** Nom de fichier stable d'un projet (l'identifiant permet de le retrouver s'il est renommé). */
export const backupName = (doc) => `${slugify(doc.name) || 'projet'}__${doc.id}.pxa.json`;
const idOfName = (name) => (name.match(/__([^_]+?)(?:__\d{4}-\d\d-\d\d)?\.pxa\.json$/) || [])[1] || null;
const today = () => new Date().toISOString().slice(0, 10);

export const status = { folder: null, drive: null, zip: null, error: {} };
async function loadStatus() {
  const s = await db.get('kv', 'backup:last').catch(() => null);
  Object.assign(status, s || {});
}
function setStatus(app, key, ok, err = null) {
  if (ok) { status[key] = Date.now(); delete status.error[key]; } else status.error[key] = err;
  db.put('kv', { folder: status.folder, drive: status.drive, zip: status.zip, error: status.error }, 'backup:last').catch(() => {});
  app.emit('backup', { key, ok, err });
}

// =========================================================================
// Dossier de l'ordinateur
// =========================================================================
let dirCache; // undefined : pas encore lu ; null : aucun dossier
async function storedDir() {
  if (dirCache === undefined) dirCache = await db.get('kv', 'backup:dir').catch(() => null);
  return dirCache;
}
/** Dossier choisi, avec la permission d'écrire (ask : la redemander, après un clic). */
export async function folderHandle({ ask = false } = {}) {
  const dir = await storedDir();
  if (!dir) return null;
  try {
    let p = await dir.queryPermission?.({ mode: 'readwrite' }) ?? 'granted';
    if (p !== 'granted' && ask) p = await dir.requestPermission({ mode: 'readwrite' });
    return p === 'granted' ? dir : null;
  } catch (_) {
    return null;
  }
}
export async function folderName() {
  return (await storedDir())?.name || null;
}

export async function chooseFolder(app) {
  let dir;
  try {
    dir = await window.showDirectoryPicker({ id: 'pixel-atelier-backup', mode: 'readwrite' });
  } catch (err) {
    if (err?.name !== 'AbortError') app.toast('Dossier inaccessible : ' + (err.message || err), 3500);
    return false;
  }
  dirCache = dir;
  await db.put('kv', dir, 'backup:dir');
  app.setState({ backupFolder: true });
  const n = await backupAll(app, { folder: true });
  app.toast(`Sauvegarde dans « ${dir.name} » activée (${n} projet${n > 1 ? 's' : ''})`, 3000);
  return true;
}
export async function forgetFolder(app) {
  dirCache = null;
  await db.delete('kv', 'backup:dir').catch(() => {});
  app.setState({ backupFolder: false });
  app.emit('backup', {});
}

async function writeFile(dir, name, text) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
}

async function writeToFolder(app, dir, doc, json) {
  const name = backupName(doc);
  // projet renommé : on retire l'ancien fichier du même projet
  for await (const [n, entry] of dir.entries()) {
    if (entry.kind === 'file' && n !== name && idOfName(n) === doc.id && !/__\d{4}-\d\d-\d\d\.pxa\.json$/.test(n)) await dir.removeEntry(n).catch(() => {});
  }
  await writeFile(dir, name, json);
  if (app.state.backupHistory !== false) {
    // une copie par jour dans « historique », gardée 14 jours
    const hist = await dir.getDirectoryHandle('historique', { create: true });
    await writeFile(hist, name.replace(/\.pxa\.json$/, `__${today()}.pxa.json`), json);
    const old = [];
    for await (const [n] of hist.entries()) {
      const m = n.match(/__(\d{4}-\d\d-\d\d)\.pxa\.json$/);
      if (m && idOfName(n) === doc.id && Date.now() - Date.parse(m[1]) > HISTORY_DAYS * 86400e3) old.push(n);
    }
    for (const n of old) await hist.removeEntry(n).catch(() => {});
  }
}

/** Fichiers de sauvegarde présents dans le dossier (pour restaurer). */
export async function listFolder() {
  const dir = await folderHandle({ ask: true });
  if (!dir) return [];
  const out = [];
  const scan = async (d, sub) => {
    for await (const [n, entry] of d.entries()) {
      if (entry.kind === 'file' && n.endsWith('.pxa.json')) {
        const f = await entry.getFile();
        out.push({ name: n, sub, modified: f.lastModified, size: f.size, read: () => f.text() });
      } else if (entry.kind === 'directory' && n === 'historique' && !sub) await scan(entry, n);
    }
  };
  await scan(dir, '');
  return out.sort((a, b) => b.modified - a.modified);
}

// =========================================================================
// Google Drive (API REST, sans bibliothèque externe)
// =========================================================================
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
let token = null;
try {
  const t = JSON.parse(sessionStorage.getItem('pixelAtelier.driveToken') || 'null');
  if (t && t.exp > Date.now() + 60_000) token = t;
} catch (_) { /* stockage de session indisponible */ }

export const driveConnected = () => !!token && token.exp > Date.now() + 30_000;
/** Adresse de retour à déclarer dans la console Google (page oauth.html du site). */
export const redirectUri = () => new URL('oauth.html', location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '')).href;

/** Connexion : fenêtre Google, puis jeton d'accès (valable environ une heure). */
export function driveConnect(app) {
  const clientId = (app.state.driveClientId || '').trim();
  if (!clientId) {
    app.toast('Indiquez d\'abord votre identifiant client Google (voir l\'aide ci-dessous)', 3500);
    return Promise.resolve(false);
  }
  const nonce = uid('o');
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri(), response_type: 'token', scope: SCOPE,
    include_granted_scopes: 'true', state: nonce, prompt: app.state.driveConsented ? '' : 'consent',
  });
  const w = window.open(url, 'pixel-atelier-google', 'width=480,height=640');
  if (!w) {
    app.toast('Fenêtre bloquée : autorisez les fenêtres pop-up pour ce site', 3500);
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const done = (ok) => { window.removeEventListener('message', onMsg); clearInterval(timer); resolve(ok); };
    const onMsg = (e) => {
      if (e.origin !== location.origin || e.data?.type !== 'pixel-atelier-oauth') return;
      const p = new URLSearchParams(e.data.hash.replace(/^#/, ''));
      if (p.get('state') !== nonce) return;
      if (p.get('error') || !p.get('access_token')) {
        app.toast('Connexion Google refusée : ' + (p.get('error') || 'pas de jeton'), 3500);
        return done(false);
      }
      token = { value: p.get('access_token'), exp: Date.now() + (+p.get('expires_in') || 3600) * 1000 };
      try { sessionStorage.setItem('pixelAtelier.driveToken', JSON.stringify(token)); } catch (_) { /* facultatif */ }
      app.setState({ backupDrive: true, driveConsented: true });
      app.emit('backup', {});
      done(true);
    };
    window.addEventListener('message', onMsg);
    const timer = setInterval(() => { if (w.closed) setTimeout(() => done(driveConnected()), 300); }, 500);
  });
}
export function driveDisconnect(app) {
  token = null;
  try { sessionStorage.removeItem('pixelAtelier.driveToken'); } catch (_) { /* facultatif */ }
  app.setState({ backupDrive: false });
  app.emit('backup', {});
}

async function driveFetch(url, opts = {}) {
  if (!driveConnected()) throw new Error('reconnexion à Google nécessaire');
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token.value}`, ...(opts.headers || {}) } });
  if (r.status === 401) { token = null; throw new Error('reconnexion à Google nécessaire'); }
  if (!r.ok) throw new Error(`Google Drive : ${r.status} ${(await r.text()).slice(0, 120)}`);
  return r;
}
async function driveMeta() {
  return (await db.get('kv', 'backup:drive').catch(() => null)) || { folderId: null, files: {} };
}
async function driveFolder() {
  const meta = await driveMeta();
  if (meta.folderId) {
    try {
      const f = await (await driveFetch(`${API}/files/${meta.folderId}?fields=id,trashed`)).json();
      if (!f.trashed) return meta;
    } catch (err) {
      if (/reconnexion/.test(err.message)) throw err;
    }
  }
  const f = await (await driveFetch(`${API}/files?fields=id`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Pixel Atelier', mimeType: 'application/vnd.google-apps.folder' }),
  })).json();
  const next = { folderId: f.id, files: {} };
  await db.put('kv', next, 'backup:drive');
  return next;
}
function multipart(metadata, text) {
  const b = 'pxa' + Math.random().toString(36).slice(2);
  return {
    type: `multipart/related; boundary=${b}`,
    body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${b}--`,
  };
}
async function writeToDrive(doc, json) {
  const meta = await driveFolder();
  const name = backupName(doc);
  const id = meta.files[doc.id];
  if (id) {
    const m = multipart({ name }, json);
    try {
      await driveFetch(`${UPLOAD}/files/${id}?uploadType=multipart&fields=id`, { method: 'PATCH', headers: { 'Content-Type': m.type }, body: m.body });
      return;
    } catch (err) {
      if (!/ 404 /.test(err.message)) throw err; // fichier supprimé du Drive : on le recrée
    }
  }
  const m = multipart({ name, parents: [meta.folderId], mimeType: 'application/json', appProperties: { pixelAtelierId: doc.id } }, json);
  const f = await (await driveFetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': m.type }, body: m.body })).json();
  meta.files[doc.id] = f.id;
  await db.put('kv', meta, 'backup:drive');
}
export async function listDrive() {
  const meta = await driveFolder();
  const q = encodeURIComponent(`'${meta.folderId}' in parents and trashed=false`);
  const r = await (await driveFetch(`${API}/files?q=${q}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size)&pageSize=200`)).json();
  return (r.files || []).map((f) => ({ name: f.name, sub: 'Google Drive', modified: Date.parse(f.modifiedTime), size: +f.size || 0, read: async () => (await driveFetch(`${API}/files/${f.id}?alt=media`)).text() }));
}

// =========================================================================
// Sauvegarde automatique et complète
// =========================================================================
const lastRun = { folder: 0, drive: 0 };
let running = false;

/** Sauvegarde le projet ouvert vers les destinations activées (force : sans attendre). */
export async function backupCurrent(app, { force = false } = {}) {
  if (running) return;
  const wantFolder = app.state.backupFolder && folderSupported;
  const wantDrive = app.state.backupDrive && driveConnected();
  const now = Date.now();
  const doFolder = wantFolder && (force || now - lastRun.folder > MIN_GAP);
  const doDrive = wantDrive && (force || now - lastRun.drive > MIN_GAP);
  if (!doFolder && !doDrive) return;
  running = true;
  try {
    const json = await docToFileJSON(app.doc);
    if (doFolder) {
      lastRun.folder = now;
      try {
        const dir = await folderHandle();
        if (!dir) throw new Error('autorisation du dossier à renouveler');
        await writeToFolder(app, dir, app.doc, json);
        setStatus(app, 'folder', true);
      } catch (err) { setStatus(app, 'folder', false, err.message || String(err)); }
    }
    if (doDrive) {
      lastRun.drive = now;
      try {
        await writeToDrive(app.doc, json);
        setStatus(app, 'drive', true);
      } catch (err) { setStatus(app, 'drive', false, err.message || String(err)); }
    }
  } finally {
    running = false;
  }
}

/** Tous les projets enregistrés (le projet ouvert dans son état actuel). */
async function* allProjects(app) {
  await app.storage?.saveNow();
  const metas = (await app.storage?.list()) || [];
  for (const m of metas) {
    try {
      const doc = m.id === app.doc.id ? app.doc : await app.storage.load(m.id);
      yield doc;
    } catch (err) { console.warn('[backup]', m.id, err); }
  }
}

/** Sauvegarde tous les projets vers le dossier et/ou Google Drive. Retourne le nombre de projets. */
export async function backupAll(app, { folder = !!app.state.backupFolder, drive = !!app.state.backupDrive } = {}) {
  const dir = folder ? await folderHandle({ ask: true }) : null;
  const toDrive = drive && driveConnected();
  let n = 0;
  try {
    for await (const doc of allProjects(app)) {
      const json = await docToFileJSON(doc);
      if (dir) await writeToFolder(app, dir, doc, json);
      if (toDrive) await writeToDrive(doc, json);
      n++;
    }
    if (dir) setStatus(app, 'folder', true);
    if (toDrive) setStatus(app, 'drive', true);
  } catch (err) {
    app.toast('Sauvegarde interrompue : ' + (err.message || err), 4000);
    if (dir) setStatus(app, 'folder', false, err.message);
    if (toDrive) setStatus(app, 'drive', false, err.message);
  }
  return n;
}

/** Archive ZIP de tous les projets (tous navigateurs). */
export async function downloadAllZip(app) {
  const files = [];
  for await (const doc of allProjects(app)) files.push({ name: backupName(doc), data: await docToFileJSON(doc) });
  if (!files.length) return app.toast('Aucun projet à sauvegarder');
  downloadBlob(makeZip(files), `pixel-atelier_sauvegarde_${today()}.zip`);
  setStatus(app, 'zip', true);
  app.toast(`Sauvegarde téléchargée : ${files.length} projet${files.length > 1 ? 's' : ''}`);
}

/**
 * Restaure des fichiers de sauvegarde ({ name, read() }) dans les projets du navigateur.
 * Un projet du même identifiant est remplacé ; le projet ouvert est rechargé s'il est concerné.
 */
export async function restoreFiles(app, files) {
  let n = 0, reopen = null;
  const known = new Set(((await app.storage?.list()) || []).map((m) => m.id));
  for (const f of files) {
    try {
      const doc = await fileJSONToDoc(await f.read());
      if (doc.id === app.doc.id) reopen = doc;
      else await app.storage.save(doc);
      known.add(doc.id);
      n++;
    } catch (err) {
      console.warn('[restore]', f.name, err);
    }
  }
  if (reopen) app.setDoc(reopen);
  await app.storage.saveNow(); // le projet ouvert reste le « dernier projet »
  app.emit('projects');
  app.toast(n ? `${n} projet${n > 1 ? 's' : ''} restauré${n > 1 ? 's' : ''}` : 'Aucun projet n\'a pu être restauré', 3000);
  return n;
}

/** Restaure une archive ZIP (ou un fichier .pxa.json) choisie sur l'appareil. */
export async function restoreFromZip(app) {
  const file = await pickFile('.zip,.json,application/zip,application/json');
  if (!file) return 0;
  let files;
  if (file.name.toLowerCase().endsWith('.zip')) {
    const entries = await readZip(new Uint8Array(await file.arrayBuffer()));
    files = entries.filter((e) => e.name.endsWith('.pxa.json')).map((e) => ({ name: e.name, read: async () => new TextDecoder().decode(e.data) }));
  } else files = [{ name: file.name, read: () => file.text() }];
  return restoreFiles(app, files);
}

// =========================================================================
// Mise en route
// =========================================================================
export async function initBackup(app) {
  await loadStatus();
  app.on('saved', () => { backupCurrent(app); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') backupCurrent(app, { force: true });
  });
  // rappel : aucune sauvegarde hors du navigateur depuis longtemps
  const days = app.state.backupReminderDays ?? 7;
  if (!days) return;
  const last = Math.max(status.folder || 0, status.drive || 0, status.zip || 0);
  const lastRemind = (await db.get('kv', 'backup:remind').catch(() => 0)) || 0;
  const metas = (await app.storage?.list().catch(() => [])) || [];
  const changedSince = metas.some((m) => m.updated > last && m.layers > 0);
  if (changedSince && Date.now() - last > days * 86400e3 && Date.now() - lastRemind > 86400e3 && metas.length) {
    db.put('kv', Date.now(), 'backup:remind').catch(() => {});
    setTimeout(() => app.toast(last ? 'Pensez à sauvegarder vos projets hors du navigateur : Paramètres > Sauvegarde' : 'Vos projets ne sont enregistrés que dans ce navigateur. Paramètres > Sauvegarde pour les mettre à l\'abri (dossier, Google Drive ou ZIP).', 7000), 4000);
  }
}
