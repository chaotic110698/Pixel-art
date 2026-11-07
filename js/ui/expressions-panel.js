// Panneau Expressions : bascule rapide des variantes + expressions nommées.

import { h, clear, debounce } from '../util/dom.js';
import { icon } from './icons.js';
import { popupMenu, promptDialog, confirmDialog, openDialog } from './dialogs.js';
import { composeToCanvas } from '../render/compose.js';
import * as ops from '../core/layer-ops.js';
import { captureCombo, formatCombo, keyOwner } from './keycapture.js';

export function initExpressionsPanel(app) {
  const panel = document.getElementById('panel-expressions');

  function render() {
    const doc = app.doc;
    clear(panel);
    const groups = doc.variantGroups();
    panel.append(h('h3', {}, icon('variants'), 'Variantes'));
    if (!groups.length) {
      panel.append(h('p', { class: 'hint' }, 'Aucun groupe de variantes. Créez-en un dans l\'onglet Calques (bouton « groupe de variantes ») ou utilisez « Nouveau personnage ».'));
    }
    for (const g of groups) {
      panel.append(h('div', { class: 'vgroup' },
        h('div', { class: 'vname' }, h('span', { class: 'grow', translate: 'no' }, g.name),
          h('button', { class: 'icon-btn small', title: 'Variante précédente', 'aria-label': 'Précédente', onclick: () => ops.cycleVariant(app, g.id, -1) }, '‹'),
          h('button', { class: 'icon-btn small', title: 'Variante suivante', 'aria-label': 'Suivante', onclick: () => ops.cycleVariant(app, g.id, 1) }, '›')),
        h('div', { class: 'chips' }, [...g.children].reverse().map((cid) => {
          const c = doc.get(cid);
          return h('button', { class: 'chip' + (g.active === cid ? ' on' : ''), translate: 'no', onclick: () => ops.setActiveVariant(app, g.id, cid) }, c.name);
        }))));
    }

    panel.append(h('h3', { style: { marginTop: '14px' } }, icon('face'), 'Expressions'));
    panel.append(h('p', { class: 'hint' }, 'Une expression mémorise la variante choisie dans chaque groupe (ex. « Content » = yeux contents + bouche ouverte).'));
    panel.append(h('button', {
      class: 'btn primary', style: { width: '100%', marginBottom: '8px' }, disabled: !groups.length,
      onclick: async () => {
        const name = await promptDialog('Nom de l\'expression', '', { title: 'Enregistrer l\'expression actuelle', ok: 'Enregistrer' });
        if (name !== null) ops.saveExpression(app, name.trim() || undefined);
      },
    }, icon('plus'), 'Enregistrer l\'expression actuelle'));

    const current = JSON.stringify(ops.currentStates(doc));
    for (const e of doc.expressions) {
      const isCur = JSON.stringify(e.states) === current;
      const thumb = h('canvas', { width: 80, height: 80 });
      drawExprThumb(e, thumb);
      const more = h('button', { class: 'icon-btn small', title: 'Options', 'aria-label': 'Options de l\'expression' }, icon('more'));
      more.addEventListener('click', () => popupMenu(more, [
        { label: 'Mettre à jour avec l\'état actuel', icon: 'save', action: () => ops.updateExpression(app, e.id) },
        { label: 'Renommer', icon: 'pencil', action: async () => { const n = await promptDialog('Nom', e.name, { title: 'Renommer l\'expression' }); if (n) ops.renameExpression(app, e.id, n); } },
        { label: e.key ? `Raccourci : ${formatCombo(e.key)} (changer)` : 'Associer une touche…', icon: 'key', action: () => askKey(e) },
        { label: 'Monter', icon: 'up', action: () => ops.moveExpression(app, e.id, -1) },
        { label: 'Descendre', icon: 'down', action: () => ops.moveExpression(app, e.id, 1) },
        { sep: true },
        { label: 'Supprimer', icon: 'trash', danger: true, action: async () => { if (await confirmDialog(`Supprimer l'expression « ${e.name} » ?`, { danger: true, ok: 'Supprimer' })) ops.deleteExpression(app, e.id); } },
      ], { align: 'right' }));
      panel.append(h('div', { class: 'expr-row', style: isCur ? { outline: '2px solid var(--accent)' } : {} },
        thumb,
        h('button', { class: 'btn small grow', style: { justifyContent: 'flex-start' }, title: 'Appliquer', onclick: () => ops.applyExpression(app, e.id) },
          h('span', { class: 'name', translate: 'no' }, e.name)),
        e.key ? h('kbd', { title: e.hold ? 'Touche associée (temporaire : tant qu\'elle est maintenue)' : 'Touche associée (mode PNGtuber)' }, formatCombo(e.key) + (e.hold ? ' ⏳' : '')) : null,
        more));
    }
    renderProfiles();
  }

  // ----- profils : tenues / personnages (touches F13–F24) -----
  function renderProfiles() {
    const doc = app.doc;
    panel.append(h('h3', { style: { marginTop: '16px' } }, icon('user'), 'Profils (tenues, personnages)'));
    panel.append(h('p', { class: 'hint' }, 'Un profil mémorise les calques visibles, les variantes et la bouche/les yeux du PNGtuber. Changez de tenue ou de personnage d\'une seule touche (F13 à F24, pratique avec un Stream Deck).'));
    panel.append(h('button', {
      class: 'btn', style: { width: '100%', marginBottom: '8px' },
      onclick: async () => {
        const name = await promptDialog('Nom du profil (ex. Tenue d\'hiver, Personnage 2)', '', { title: 'Enregistrer le profil actuel', ok: 'Enregistrer' });
        if (name !== null) ops.saveProfile(app, name.trim() || undefined);
      },
    }, icon('plus'), 'Enregistrer l\'état actuel comme profil'));
    for (const p of doc.profiles) {
      const thumb = h('canvas', { width: 80, height: 80 });
      const src = composeToCanvas(doc, { overrides: p.states, visibility: p.visibility, includeReference: false });
      const g = thumb.getContext('2d');
      g.imageSmoothingEnabled = false;
      const k = Math.min(80 / doc.width, 80 / doc.height);
      g.drawImage(src, (80 - doc.width * k) / 2, (80 - doc.height * k) / 2, doc.width * k, doc.height * k);
      const custom = p.key && !ops.PROFILE_KEYS.includes(p.key);
      const keySel = h('select', { class: 'input', 'aria-label': 'Touche du profil', title: 'Touche du profil (F13–F24 ou une combinaison)', style: { width: '96px' } },
        h('option', { value: '' }, '—'),
        ops.PROFILE_KEYS.map((k) => h('option', { value: k, selected: p.key === k }, k)),
        custom ? h('option', { value: p.key, selected: true }, formatCombo(p.key)) : null,
        h('option', { value: '__combo' }, 'Autre touche…'));
      keySel.addEventListener('change', async () => {
        if (keySel.value !== '__combo') return ops.setProfileKey(app, p.id, keySel.value || null);
        keySel.options[keySel.selectedIndex].textContent = 'Appuyez…';
        const k = await captureCombo((t) => { keySel.options[keySel.selectedIndex].textContent = t; });
        if (k === null) return render();
        if (k) {
          const owner = keyOwner(app.doc, k, { kind: 'profile', id: p.id });
          if (owner) { app.toast(`Touche ${formatCombo(k)} déjà utilisée par « ${owner} »`, 2600); return render(); }
        }
        ops.setProfileKey(app, p.id, k || null);
      });
      const more = h('button', { class: 'icon-btn small', title: 'Options', 'aria-label': 'Options du profil' }, icon('more'));
      more.addEventListener('click', () => popupMenu(more, [
        { label: 'Mettre à jour avec l\'état actuel', icon: 'save', action: () => ops.updateProfile(app, p.id) },
        { label: 'Renommer', icon: 'pencil', action: async () => { const n = await promptDialog('Nom', p.name, { title: 'Renommer le profil' }); if (n) ops.renameProfile(app, p.id, n); } },
        { sep: true },
        { label: 'Supprimer', icon: 'trash', danger: true, action: async () => { if (await confirmDialog(`Supprimer le profil « ${p.name} » ?`, { danger: true, ok: 'Supprimer' })) ops.deleteProfile(app, p.id); } },
      ], { align: 'right' }));
      panel.append(h('div', { class: 'expr-row' },
        thumb,
        h('button', { class: 'btn small grow', style: { justifyContent: 'flex-start' }, title: 'Appliquer ce profil', onclick: () => ops.applyProfile(app, p.id) },
          h('span', { class: 'name', translate: 'no' }, p.name)),
        keySel,
        more));
    }
  }

  function drawExprThumb(e, c) {
    const doc = app.doc;
    const src = composeToCanvas(doc, { overrides: e.states, includeReference: false });
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const k = Math.min(c.width / doc.width, c.height / doc.height);
    g.drawImage(src, (c.width - doc.width * k) / 2, (c.height - doc.height * k) / 2, doc.width * k, doc.height * k);
  }

  async function askKey(e) {
    let captured = null;
    const shown = h('div', { style: { fontSize: '28px', textAlign: 'center', margin: '12px' } }, e.key ? formatCombo(e.key) : '…');
    const holdChk = h('input', { type: 'checkbox', checked: !!e.hold });
    const d = openDialog({
      title: `Touche pour « ${e.name} »`,
      body: [
        h('p', {}, 'Appuyez sur une touche (lettre, chiffre, F1–F24) ou une combinaison (ex. Ctrl+Maj+1, Alt+H). Elle déclenchera l\'expression en mode PNGtuber, dans la fenêtre de capture et dans l\'avatar OBS.'),
        shown,
        h('label', { class: 'chk' }, holdChk, 'Temporaire : seulement tant que la touche est maintenue'),
        h('p', { class: 'hint' }, 'Exemple : maintenir S pour « Surpris », puis relâcher pour revenir à l\'expression précédente.'),
      ],
      buttons: [{ label: 'Retirer', value: 'remove' }, { label: 'Annuler', value: null }, { label: 'OK', value: 'ok', primary: true }],
    });
    // capture en continu tant que la fenêtre est ouverte (Échap ferme la fenêtre)
    const stop = new AbortController();
    d.result.then(() => stop.abort());
    (async () => {
      for (;;) {
        const k = await captureCombo((t) => { shown.textContent = t; }, stop.signal);
        if (k === undefined) break;
        if (k === null) { d.close(null); break; }
        if (k === '') { d.close('remove'); break; }
        const owner = keyOwner(app.doc, k, { kind: 'expr', id: e.id });
        if (owner) { shown.textContent = formatCombo(k) + ' ✖'; app.toast(`Touche ${formatCombo(k)} déjà utilisée par « ${owner} »`, 2400); continue; }
        captured = k;
        shown.textContent = formatCombo(k);
      }
    })();
    const v = await d.result;
    if (v === 'remove') ops.setExpressionKey(app, e.id, null);
    else if (v === 'ok' && (captured || e.key)) ops.setExpressionKey(app, e.id, captured || e.key, holdChk.checked);
  }

  const lazy = debounce(render, 300);
  app.on('structure', render);
  app.on('doc', render);
  app.on('pixels', lazy);
  render();
}
