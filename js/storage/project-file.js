// Téléchargement / ouverture de fichiers projet (.pxa.json).

import { docToFileJSON, fileJSONToDoc } from './serialize.js';
import { downloadBlob, pickFile, slugify } from '../util/dom.js';
import { uid } from '../core/doc.js';
import { readZip } from '../export/zip.js';

export async function downloadProject(app) {
  app.selection.commitFloating();
  const json = await docToFileJSON(app.doc);
  downloadBlob(new Blob([json], { type: 'application/json' }), `${slugify(app.doc.name)}.pxa.json`);
  app.toast('Fichier projet téléchargé');
}

export async function openProjectFile(app, file = null) {
  file = file || (await pickFile('.json,.pxa,.zip,application/json,application/zip'));
  if (!file) return;
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
    app.toast(`Projet « ${doc.name} » ouvert`);
  } catch (err) {
    console.error(err);
    app.toast('Impossible d\'ouvrir ce fichier : ' + (err.message || err), 3000);
  }
}
