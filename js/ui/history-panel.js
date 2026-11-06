// Panneau Historique : liste des actions ; un clic revient à ce point
// (annule ou rétablit autant d'étapes que nécessaire).

import { h, clear, debounce } from '../util/dom.js';

export function initHistoryPanel(app) {
  const panel = document.getElementById('panel-history');
  const MAX = 300;

  function goTo(target) {
    // target = nombre d'entrées à garder dans la pile « annuler »
    const H = app.history;
    let guard = 10000;
    while (H.undoStack.length > target && guard--) if (!H.undo()) break;
    while (H.undoStack.length < target && guard--) if (!H.redo()) break;
  }

  function render() {
    const H = app.history;
    clear(panel);
    const done = H.undoStack;
    const undone = [...H.redoStack].reverse(); // prochaine action à rétablir en premier
    const total = done.length + undone.length;
    const mb = (H.bytes / (1024 * 1024)).toFixed(1);
    panel.append(h('div', { class: 'row', style: { marginBottom: '6px' } },
      h('span', { class: 'small muted grow' }, `${done.length} action(s) · ${mb} Mo`),
      h('button', { class: 'btn small', disabled: !done.length, title: 'Annuler (Ctrl+Z)', onclick: () => app.history.undo() }, '↶'),
      h('button', { class: 'btn small', disabled: !undone.length, title: 'Rétablir (Ctrl+Y)', onclick: () => app.history.redo() }, '↷')));
    const list = h('div', { class: 'hist-list' });
    const start = Math.max(0, total - MAX);
    list.append(h('button', { class: 'hist-row' + (done.length === 0 ? ' current' : ''), onclick: () => goTo(0) }, h('span', {}, '⟲ État initial')));
    for (let i = start; i < total; i++) {
      const isDone = i < done.length;
      const e = isDone ? done[i] : undone[i - done.length];
      list.append(h('button', {
        class: 'hist-row' + (isDone ? '' : ' undone') + (i === done.length - 1 ? ' current' : ''),
        title: isDone ? 'Revenir juste après cette action' : 'Rétablir jusqu\'à cette action',
        onclick: () => goTo(i + 1),
      }, h('span', { class: 'n' }, i + 1), h('span', { class: 'grow' }, e.label)));
    }
    panel.append(list);
    if (!total) panel.append(h('p', { class: 'hint' }, 'Les actions apparaîtront ici. Cliquez sur une ligne pour revenir à ce moment.'));
    const cur = list.querySelector('.current');
    if (cur && panel.classList.contains('tab-on')) cur.scrollIntoView({ block: 'nearest' });
  }

  const lazy = debounce(render, 80);
  app.on('history', lazy);
  app.on('doc', lazy);
  app.renderHistoryPanel = render;
  render();
}
