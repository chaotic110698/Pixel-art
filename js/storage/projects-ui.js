// Fenêtre « Mes projets » : miniatures, ouverture, duplication, suppression.

import { h, clear } from '../util/dom.js';
import { openDialog, confirmDialog, promptDialog } from '../ui/dialogs.js';
import { icon } from '../ui/icons.js';
import { uid } from '../core/doc.js';

function fmtDate(t) {
  try {
    return new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch (_) {
    return '';
  }
}

export async function openProjects(app) {
  const st = app.storage;
  if (!st) return app.toast('Stockage local indisponible sur ce navigateur');
  await st.saveNow();
  const grid = h('div', { class: 'cards' });
  const urls = [];
  const d = openDialog({
    title: 'Mes projets',
    wide: true,
    body: [
      h('div', { class: 'row', style: { marginBottom: '10px' } },
        h('button', { class: 'btn primary', onclick: () => { d.close(); app.actions.newDocument(); } }, icon('plus'), 'Nouveau dessin'),
        h('button', { class: 'btn', onclick: () => { d.close(); app.actions.newCharacter(); } }, icon('user'), 'Nouveau personnage'),
        h('button', { class: 'btn', onclick: () => { d.close(); app.actions.openProjectFile(); } }, icon('upload'), 'Ouvrir un fichier')),
      h('p', { class: 'hint' }, 'Les projets sont enregistrés automatiquement dans ce navigateur. Pensez à télécharger un fichier projet pour en garder une copie de sécurité.'),
      grid,
    ],
    onClose: () => urls.forEach((u) => URL.revokeObjectURL(u)),
  });

  async function render() {
    clear(grid);
    const list = await st.list();
    if (!list.length) grid.append(h('p', { class: 'hint' }, 'Aucun projet enregistré.'));
    for (const m of list) {
      const url = m.thumb ? URL.createObjectURL(m.thumb) : null;
      if (url) urls.push(url);
      const isCurrent = m.id === app.doc.id;
      const open = async () => {
        if (isCurrent) return d.close();
        try {
          await st.saveNow();
          const doc = await st.load(m.id);
          app.setDoc(doc);
          d.close();
        } catch (err) {
          app.toast('Impossible d\'ouvrir : ' + err.message);
        }
      };
      const card = h('div', { class: 'card', style: isCurrent ? { borderColor: 'var(--accent)' } : {} },
        h('button', { style: { border: 0, background: 'none', padding: 0 }, onclick: open, title: 'Ouvrir' },
          url ? h('img', { src: url, alt: m.name }) : h('canvas', { width: 1, height: 1 })),
        h('div', { class: 't' }, h('span', { translate: 'no' }, m.name), isCurrent ? ' (ouvert)' : ''),
        h('div', { class: 's' }, `${m.width}×${m.height} · ${fmtDate(m.updated)}`),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'icon-btn small', title: 'Renommer', 'aria-label': 'Renommer', onclick: async () => {
            const name = (await promptDialog('Nom du projet', m.name, { title: 'Renommer le projet' }))?.trim();
            if (!name) return;
            if (isCurrent) {
              app.history.transact('Renommer le projet', () => { app.doc.name = name; });
              app.emit('meta');
              await st.saveNow();
            } else await st.rename(m.id, name);
            render();
          } }, icon('pencil')),
          h('button', { class: 'icon-btn small', title: 'Dupliquer', 'aria-label': 'Dupliquer', onclick: async () => {
            const doc = await st.load(m.id);
            doc.id = uid('p');
            doc.name = m.name + ' (copie)';
            doc.created = Date.now();
            await st.save(doc);
            await st.save(app.doc); // garder le projet courant comme « dernier ouvert »
            render();
          } }, icon('copy')),
          h('button', { class: 'icon-btn small', title: 'Supprimer', 'aria-label': 'Supprimer', disabled: isCurrent, onclick: async () => {
            if (!(await confirmDialog(`Supprimer définitivement « ${m.name} » ? Cette action est irréversible.`, { danger: true, ok: 'Supprimer' }))) return;
            await st.remove(m.id);
            render();
          } }, icon('trash'))));
      grid.append(card);
    }
  }
  render();
}
