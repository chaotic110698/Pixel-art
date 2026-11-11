// Palette de commandes (Ctrl+K) : taper quelques lettres pour retrouver et lancer une
// commande du menu, un outil ou un panneau, dans la langue de l'interface.

import { h, clear } from '../util/dom.js';
import { openDialog } from './dialogs.js';
import { icon } from './icons.js';
import { tr } from './i18n.js';
import { menuItems } from './menu.js';

/** Sans accents ni casse, pour comparer. */
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Score de correspondance : mots trouvés dans l'ordre, début de mot favorisé ; -1 si absent. */
export function matchScore(query, text) {
  const q = norm(query).trim();
  if (!q) return 0;
  const t = norm(text);
  let score = 0, pos = 0;
  for (const w of q.split(/\s+/)) {
    const i = t.indexOf(w, pos);
    const any = i >= 0 ? i : t.indexOf(w);
    if (any < 0) return -1;
    score += (any === 0 || /[\s(«'’-]/.test(t[any - 1]) ? 10 : 3) + (i >= 0 ? 2 : 0);
    pos = any + w.length;
  }
  return score - t.length / 100;
}

/** Toutes les commandes : menu principal, outils, panneaux. */
export function allCommands(app) {
  const out = [];
  let section = '';
  for (const it of menuItems(app)) {
    if (it.heading) { section = it.heading; continue; }
    if (!it.label || !it.action) continue;
    out.push({ label: it.label, section, icon: it.icon, hint: it.hint, run: it.action });
  }
  for (const c of app.paletteCommands?.() || []) out.push({ ...c, section: 'Palette' });
  for (const t of app.tools.list) out.push({ label: t.name, section: 'Outils', icon: t.id === 'select' ? 'select' : t.id, hint: (t.defaultKey || t.key || '').toUpperCase(), run: () => app.tools.select(t.id) });
  for (const [id, label] of [['layers', 'Panneau Calques'], ['colors', 'Panneau Couleurs'], ['expressions', 'Panneau Expressions'], ['grid', 'Panneau Grille'], ['history', 'Panneau Historique']]) {
    out.push({ label, section: 'Panneaux', icon: 'layers', run: () => app.showPanel?.(id) });
  }
  return out;
}

export function openCommandPalette(app) {
  const cmds = allCommands(app);
  const input = h('input', { type: 'search', class: 'input wide', placeholder: 'Tapez une commande (ex. exporter, rampe, texte…)', 'aria-label': 'Rechercher une commande', autofocus: true });
  const list = h('div', { class: 'cmd-list', role: 'listbox', 'aria-label': 'Commandes' });
  let shown = [], cur = 0, dlg = null;
  const run = (c) => { dlg?.close(null); setTimeout(() => c.run(), 0); };
  const render = () => {
    const q = input.value;
    // recherche dans le texte affiché (traduit) et dans le texte français
    shown = cmds
      .map((c) => ({ c, s: Math.max(matchScore(q, tr(c.label)), matchScore(q, c.label), matchScore(q, tr(c.section) + ' ' + tr(c.label)) - 5) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map((x) => x.c);
    cur = Math.min(cur, Math.max(0, shown.length - 1));
    clear(list);
    shown.forEach((c, i) => {
      list.append(h('button', {
        class: 'menu-item cmd-item' + (i === cur ? ' checked' : ''), role: 'option', 'aria-selected': String(i === cur),
        onclick: () => run(c), onpointermove: () => { if (cur !== i) { cur = i; render(); } },
      }, c.icon ? icon(c.icon) : null, h('span', { class: 'lbl' }, c.label), h('span', { class: 'small muted' }, c.section), c.hint ? h('kbd', {}, c.hint) : null));
    });
    if (!shown.length) list.append(h('p', { class: 'hint' }, 'Aucune commande trouvée'));
    list.children[cur]?.scrollIntoView?.({ block: 'nearest' });
  };
  input.addEventListener('input', () => { cur = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); cur = Math.min(shown.length - 1, cur + 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cur = Math.max(0, cur - 1); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[cur]) run(shown[cur]); }
  });
  render();
  dlg = openDialog({ title: 'Rechercher une commande', className: 'cmd-dlg', body: [input, list] });
  setTimeout(() => input.focus(), 30);
  return dlg;
}
