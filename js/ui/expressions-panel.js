// Panneau Expressions : bascule rapide des variantes + expressions nommées.

import { h, clear, debounce } from '../util/dom.js';
import { icon } from './icons.js';
import { popupMenu, promptDialog, confirmDialog, openDialog } from './dialogs.js';
import { composeToCanvas } from '../render/compose.js';
import * as ops from '../core/layer-ops.js';

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
        h('div', { class: 'vname' }, h('span', { class: 'grow' }, g.name),
          h('button', { class: 'icon-btn small', title: 'Variante précédente', 'aria-label': 'Précédente', onclick: () => ops.cycleVariant(app, g.id, -1) }, '‹'),
          h('button', { class: 'icon-btn small', title: 'Variante suivante', 'aria-label': 'Suivante', onclick: () => ops.cycleVariant(app, g.id, 1) }, '›')),
        h('div', { class: 'chips' }, [...g.children].reverse().map((cid) => {
          const c = doc.get(cid);
          return h('button', { class: 'chip' + (g.active === cid ? ' on' : ''), onclick: () => ops.setActiveVariant(app, g.id, cid) }, c.name);
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
        { label: e.key ? `Raccourci : ${e.key} (changer)` : 'Associer une touche…', icon: 'key', action: () => askKey(e) },
        { label: 'Monter', icon: 'up', action: () => ops.moveExpression(app, e.id, -1) },
        { label: 'Descendre', icon: 'down', action: () => ops.moveExpression(app, e.id, 1) },
        { sep: true },
        { label: 'Supprimer', icon: 'trash', danger: true, action: async () => { if (await confirmDialog(`Supprimer l'expression « ${e.name} » ?`, { danger: true, ok: 'Supprimer' })) ops.deleteExpression(app, e.id); } },
      ], { align: 'right' }));
      panel.append(h('div', { class: 'expr-row', style: isCur ? { outline: '2px solid var(--accent)' } : {} },
        thumb,
        h('button', { class: 'btn small grow', style: { justifyContent: 'flex-start' }, title: 'Appliquer', onclick: () => ops.applyExpression(app, e.id) },
          h('span', { class: 'name' }, e.name)),
        e.key ? h('kbd', { title: e.hold ? 'Touche associée (temporaire : tant qu\'elle est maintenue)' : 'Touche associée (mode PNGtuber)' }, e.key + (e.hold ? ' ⏳' : '')) : null,
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
    const shown = h('div', { style: { fontSize: '28px', textAlign: 'center', margin: '12px' } }, e.key || '…');
    const holdChk = h('input', { type: 'checkbox', checked: !!e.hold });
    const d = openDialog({
      title: `Touche pour « ${e.name} »`,
      body: [
        h('p', {}, 'Appuyez sur une touche (lettre ou chiffre). Elle déclenchera l\'expression en mode PNGtuber, dans la fenêtre de capture et dans l\'avatar OBS.'),
        shown,
        h('label', { class: 'chk' }, holdChk, 'Temporaire : seulement tant que la touche est maintenue'),
        h('p', { class: 'hint' }, 'Exemple : maintenir S pour « Surpris », puis relâcher pour revenir à l\'expression précédente.'),
      ],
      buttons: [{ label: 'Retirer', value: 'remove' }, { label: 'Annuler', value: null }, { label: 'OK', value: 'ok', primary: true }],
    });
    const onKey = (ev) => {
      if (ev.key.length === 1 && /[\p{L}\p{N}]/u.test(ev.key)) {
        captured = ev.key.toUpperCase();
        shown.textContent = captured;
        ev.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const v = await d.result;
    window.removeEventListener('keydown', onKey, true);
    if (v === 'remove') ops.setExpressionKey(app, e.id, null);
    else if (v === 'ok' && (captured || e.key)) ops.setExpressionKey(app, e.id, captured || e.key, holdChk.checked);
  }

  const lazy = debounce(render, 300);
  app.on('structure', render);
  app.on('doc', render);
  app.on('pixels', lazy);
  render();
}
