// Onglet « Sauvegarde » des Paramètres : dossier de l'ordinateur, Google Drive, archive ZIP.

import { h } from '../util/dom.js';
import { icon } from '../ui/icons.js';
import { openDialog } from '../ui/dialogs.js';
import * as B from './backup.js';

const when = (t) => (t ? new Date(t).toLocaleString() : 'jamais');

/** Contenu de l'onglet (render : redessine l'onglet). */
export async function backupTab(app, render) {
  const st = app.state;
  const dirName = await B.folderName();
  const dirOk = dirName ? !!(await B.folderHandle()) : false;
  const err = B.status.error || {};
  const line = (label, value, bad = false, raw = false) => h('div', { class: 'small' + (bad ? ' warn-text' : ' muted') }, label, ' ', h('b', raw ? { translate: 'no' } : {}, value));

  const folderBox = h('div', { class: 'set-card' },
    h('h3', {}, icon('folder'), ' Dossier de l\'ordinateur'),
    h('p', { class: 'hint' }, 'Chaque projet est copié automatiquement dans un dossier de votre choix (au plus une fois par minute, et à la fermeture de l\'onglet), avec une copie par jour dans « historique » pendant 14 jours. Astuce : choisissez un dossier synchronisé (Google Drive pour ordinateur, OneDrive, Dropbox…) pour avoir aussi une copie en ligne, sans rien configurer d\'autre.'),
    B.folderSupported
      ? [
        dirName ? line('Dossier :', dirName, false, true) : null,
        dirName ? line('Dernière copie :', when(B.status.folder)) : null,
        err.folder ? line('Problème :', err.folder, true) : null,
        h('div', { class: 'row' },
          h('button', { class: 'btn' + (dirName ? '' : ' primary'), onclick: async () => { await B.chooseFolder(app); render(); } }, icon('folder'), dirName ? 'Changer de dossier…' : 'Choisir un dossier…'),
          dirName && !dirOk ? h('button', { class: 'btn primary', onclick: async () => { if (await B.folderHandle({ ask: true })) { await B.backupCurrent(app, { force: true }); app.toast('Accès au dossier rétabli'); } render(); } }, 'Autoriser à nouveau') : null,
          dirName ? h('button', { class: 'btn', onclick: async () => { const n = await B.backupAll(app, { folder: true, drive: false }); app.toast(`${n} projet${n > 1 ? 's' : ''} copié${n > 1 ? 's' : ''} dans « ${dirName} »`); render(); } }, icon('save'), 'Tout sauvegarder maintenant') : null,
          dirName ? h('button', { class: 'btn', onclick: async () => pickAndRestore(app, await B.listFolder(), render) }, icon('upload'), 'Restaurer…') : null,
          dirName ? h('button', { class: 'btn', onclick: async () => { await B.forgetFolder(app); render(); } }, 'Arrêter') : null),
        dirName ? h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: st.backupHistory !== false, onchange: (e) => app.setState({ backupHistory: e.target.checked }) }), 'Garder une copie par jour (dossier « historique », 14 jours)') : null,
      ]
      : h('p', { class: 'hint warn-text' }, 'Ce navigateur ne permet pas d\'écrire dans un dossier (c\'est possible avec Chrome, Edge ou Opera sur ordinateur). Utilisez Google Drive ou l\'archive ZIP ci-dessous.'));

  const connected = B.driveConnected();
  const clientIn = h('input', { class: 'input wide', value: st.driveClientId || '', placeholder: '1234567890-abc…apps.googleusercontent.com', 'aria-label': 'Identifiant client Google', spellcheck: 'false' });
  clientIn.addEventListener('change', () => app.setState({ driveClientId: clientIn.value.trim() }));
  const driveBox = h('div', { class: 'set-card' },
    h('h3', {}, icon('upload'), ' Google Drive'),
    h('p', { class: 'hint' }, 'Les projets sont envoyés dans un dossier « Pixel Atelier » de votre Drive. Pixel Atelier n\'a accès qu\'aux fichiers qu\'il a lui-même créés, pas au reste de votre Drive. La connexion dure environ une heure : ensuite, un clic sur « Se connecter » suffit.'),
    h('label', { class: 'field' }, h('span', {}, 'Identifiant client Google (OAuth)'), clientIn),
    connected ? line('Connecté. Dernier envoi :', when(B.status.drive)) : line('État :', st.backupDrive ? 'connexion expirée' : 'non connecté', !!st.backupDrive),
    err.drive ? line('Problème :', err.drive, true) : null,
    h('div', { class: 'row' },
      connected
        ? [
          h('button', { class: 'btn', onclick: async () => { const n = await B.backupAll(app, { folder: false, drive: true }); app.toast(`${n} projet${n > 1 ? 's' : ''} envoyé${n > 1 ? 's' : ''} sur Google Drive`); render(); } }, icon('save'), 'Tout envoyer maintenant'),
          h('button', { class: 'btn', onclick: async () => pickAndRestore(app, await B.listDrive().catch((e) => { app.toast(e.message, 3500); return []; }), render) }, icon('download'), 'Restaurer…'),
          h('button', { class: 'btn', onclick: () => { B.driveDisconnect(app); render(); } }, 'Se déconnecter'),
        ]
        : h('button', { class: 'btn primary', onclick: async () => { app.setState({ driveClientId: clientIn.value.trim() }); if (await B.driveConnect(app)) { await B.backupCurrent(app, { force: true }); app.toast('Google Drive connecté'); } render(); } }, icon('upload'), 'Se connecter à Google Drive')),
    h('details', { class: 'set-help' },
      h('summary', {}, 'Comment obtenir l\'identifiant client (une seule fois, environ 5 minutes)'),
      h('ol', {},
        h('li', {}, 'Ouvrez console.cloud.google.com avec votre compte Google et créez un projet (par exemple « Pixel Atelier »).'),
        h('li', {}, 'Menu « API et services » > « Bibliothèque » : activez « Google Drive API ».'),
        h('li', {}, '« Écran de consentement OAuth » : type « Externe », nom de l\'application, votre e-mail ; ajoutez-vous comme « utilisateur test ».'),
        h('li', {}, '« Identifiants » > « Créer des identifiants » > « ID client OAuth » > type « Application Web ».'),
        h('li', {}, ['« Origines JavaScript autorisées » : ', h('code', { translate: 'no' }, location.origin)]),
        h('li', {}, ['« URI de redirection autorisés » : ', h('code', { translate: 'no' }, B.redirectUri())]),
        h('li', {}, 'Copiez l\'« ID client » (il se termine par .apps.googleusercontent.com) dans le champ ci-dessus, puis « Se connecter ».'))));

  const zipBox = h('div', { class: 'set-card' },
    h('h3', {}, icon('download'), ' Archive de tous les projets'),
    h('p', { class: 'hint' }, 'Fonctionne partout (téléphone, tablette, tous les navigateurs) : un fichier ZIP avec tous vos projets, à garder où vous voulez. Il se restaure ici, sur n\'importe quel appareil.'),
    line('Dernière archive :', when(B.status.zip)),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: async () => { await B.downloadAllZip(app); render(); } }, icon('download'), 'Télécharger tous les projets (ZIP)'),
      h('button', { class: 'btn', onclick: async () => { await B.restoreFromZip(app); render(); } }, icon('upload'), 'Restaurer une archive…')));

  const remind = h('div', { class: 'set-row' },
    h('div', { class: 'set-label' }, h('span', {}, 'Me rappeler de sauvegarder'), h('small', { class: 'muted' }, 'Si aucune sauvegarde hors du navigateur depuis…')),
    h('div', { class: 'seg' }, [[3, '3 jours'], [7, '7 jours'], [30, '30 jours'], [0, 'Jamais']].map(([v, l]) =>
      h('button', { class: (st.backupReminderDays ?? 7) === v ? 'on' : '', onclick: () => { app.setState({ backupReminderDays: v }); render(); } }, l))));

  return [
    h('p', { class: 'hint' }, 'Vos projets sont enregistrés dans ce navigateur. Effacer les données du site, changer d\'appareil ou réinstaller le navigateur les ferait disparaître : gardez-en une copie ailleurs.'),
    folderBox, driveBox, zipBox, h('h3', {}, 'Rappel'), remind,
  ];
}

/** Choix des sauvegardes à restaurer. */
function pickAndRestore(app, files, render) {
  if (!files.length) return app.toast('Aucune sauvegarde trouvée');
  const checks = files.map((f, i) => ({ f, box: h('input', { type: 'checkbox', checked: i < 1 && !f.sub }) }));
  const d = openDialog({
    title: 'Restaurer des projets',
    body: [
      h('p', { class: 'hint' }, 'Un projet déjà présent dans ce navigateur est remplacé par la version choisie (les copies datées viennent de l\'historique).'),
      h('div', { class: 'restore-list' }, checks.map(({ f, box }) => h('label', { class: 'chk' }, box,
        h('span', { translate: 'no' }, f.name.replace(/__[^_]+?(__\d{4}-\d\d-\d\d)?\.pxa\.json$/, (m, d1) => (d1 ? ' ' + d1.slice(2) : ''))),
        h('small', { class: 'muted' }, ' ', f.sub ? `(${f.sub}) ` : '', new Date(f.modified).toLocaleString())))),
    ],
    buttons: [
      { label: 'Annuler', value: null },
      {
        label: 'Restaurer', primary: true, value: true, action: async () => {
          const sel = checks.filter((c) => c.box.checked).map((c) => c.f);
          if (!sel.length) { app.toast('Cochez au moins un projet'); return false; }
          await B.restoreFiles(app, sel);
          render();
        },
      },
    ],
  });
  return d;
}
