// Fenêtre « Guide » : tutoriel complet (outils, navigation, fonctionnalités).
// Le contenu (guide-content.js) existe en français et en anglais ; il est affiché
// dans la langue de l'interface et marqué translate="no" pour que la traduction
// automatique (i18n.js) n'y touche pas.

import { h, clear, debounce } from '../util/dom.js';
import { icon } from './icons.js';
import { openDialog } from './dialogs.js';
import { getLang } from './i18n.js';
import { GUIDE, TOOL_SECTION } from './guide-content.js';
import { tr } from './i18n.js';
import { formatCombo } from './keycapture.js';
import { singleKeyActions } from './shortcuts.js';
import { EFFECTS, SCENE_NAMES } from '../pngtuber/effects.js';

const BG_NAMES = { green: 'Vert', blue: 'Bleu', magenta: 'Magenta', black: 'Noir', white: 'Blanc', checker: 'Damier', ...SCENE_NAMES };

const L = (t) => (t ? (getLang() === 'en' ? t.en : t.fr) : '');
const KEY_EN = { Maj: 'Shift', Suppr: 'Del', 'Entrée': 'Enter', 'Échap': 'Esc', 'Flèches': 'Arrows', Espace: 'Space', 'Retour arrière': 'Backspace', 'Clic droit': 'Right click', 'Clic milieu': 'Middle click', Molette: 'Wheel', 'Appui long': 'Long press', '1 doigt': '1 finger', '2 doigts': '2 fingers', 'Tape à 2 doigts': '2-finger tap', 'Tape à 3 doigts': '3-finger tap' };
/** Nom de touche affiché dans la langue de l'interface. */
const keyLabel = (k) => (getLang() === 'en' ? (KEY_EN[k] || k.split('+').map((x) => KEY_EN[x] || x).join('+')) : k);
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Texte avec **gras** et [[touche]]. */
function rich(text) {
  const out = [];
  const re = /\*\*(.+?)\*\*|\[\[(.+?)\]\]/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[1] !== undefined ? h('strong', {}, m[1]) : h('kbd', {}, keyLabel(m[2])));
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Texte brut d'une section (recherche). */
function plain(sec) {
  const parts = [L(sec.title)];
  for (const b of sec.body) {
    if (b.p) parts.push(L(b.p));
    if (b.tip) parts.push(L(b.tip));
    for (const k of ['list', 'steps']) if (b[k]) parts.push(...b[k].map(L));
    if (b.keys) parts.push(...b.keys.map(([k, t]) => `${k} ${L(t)}`));
  }
  return parts.join(' ').replace(/\*\*|\[\[|\]\]/g, '');
}

let current = null;

export function openGuide(app, chapterId = null, sectionId = null) {
  if (current) {
    current.go(chapterId || current.chapter, sectionId);
    return current.dialog;
  }
  let chapter = GUIDE.find((c) => c.id === (chapterId || app.state.guideChapter))?.id || GUIDE[0].id;
  const navList = h('nav', { class: 'guide-nav', 'aria-label': L({ fr: 'Sommaire du guide', en: 'Guide contents' }) });
  const main = h('div', { class: 'guide-main', tabindex: '-1' });
  const search = h('input', {
    type: 'search', class: 'input wide guide-search',
    placeholder: L({ fr: 'Rechercher dans le guide…', en: 'Search the guide…' }),
    'aria-label': L({ fr: 'Rechercher dans le guide', en: 'Search the guide' }),
  });
  const root = h('div', { class: 'guide', translate: 'no', lang: getLang() },
    h('aside', { class: 'guide-side' }, search, navList), main);

  function act(target) {
    const [kind, arg] = target.split(':');
    const close = () => dialog.close();
    if (kind === 'tool') { close(); app.tools.select(arg); app.closeDrawer?.(); app.toast?.(app.tools.get(arg)?.name || ''); }
    else if (kind === 'action') { close(); app.actions[arg]?.(); }
    else if (kind === 'panel') { close(); app.showPanel?.(arg); }
    else if (kind === 'settings') { close(); app.openSettings?.(arg); }
    else if (kind === 'tutorial') { close(); app.startTutorial?.(); }
    else if (kind === 'timeline') { close(); if (!app.timelineOpen) app.actions.toggleAnimation(); }
    else if (kind === 'shortcuts') import('./shortcuts.js').then((m) => m.showShortcuts(app));
  }

  function block(b) {
    if (b.p) return h('p', {}, rich(L(b.p)));
    if (b.tip) return h('p', { class: 'guide-tip' }, icon('star'), h('span', {}, rich(L(b.tip))));
    if (b.list) return h('ul', {}, b.list.map((t) => h('li', {}, rich(L(t)))));
    if (b.steps) return h('ol', {}, b.steps.map((t) => h('li', {}, rich(L(t)))));
    if (b.keys) return h('dl', { class: 'guide-keys' }, b.keys.map(([k, t]) => [h('dt', {}, k.split(' / ').map((x, i) => [i ? ' / ' : '', h('kbd', {}, keyLabel(x))])), h('dd', {}, rich(L(t)))]));
    if (b.dyn) return dynBlock(b.dyn);
    if (b.try) return h('button', { class: 'btn small guide-try', onclick: () => act(b.try) }, icon('chevronRight'), L(b.label));
    return null;
  }

  /** Listes générées : touches simples de l'éditeur, raccourcis choisis dans ce projet. */
  function dynBlock(kind) {
    const rows = [];
    const row = (k, label) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, label)];
    if (kind === 'editor') {
      for (const a of singleKeyActions(app)) rows.push(row(a.key ? keyLabel(a.key.toUpperCase()) : '—', tr(a.label)));
    } else if (kind === 'project') {
      const doc = app.doc;
      const names = { ...Object.fromEntries(EFFECTS.map((x) => [x.id, x.name])), ...BG_NAMES };
      for (const e of doc.expressions) if (e.key) rows.push(row(formatCombo(e.key), [L({ fr: 'Expression ', en: 'Expression ' }), h('b', { translate: 'no' }, e.name), e.hold ? L({ fr: ' (temporaire)', en: ' (temporary)' }) : '']));
      for (const pf of doc.profiles) if (pf.key) rows.push(row(formatCombo(pf.key), [L({ fr: 'Profil ', en: 'Profile ' }), h('b', { translate: 'no' }, pf.name)]));
      for (const [id, k] of Object.entries(doc.pngtuber.effects?.keys || {})) if (k) rows.push(row(formatCombo(k), [L({ fr: 'Effet : ', en: 'Effect: ' }), tr(names[id] || id)]));
      for (const [id, k] of Object.entries(doc.pngtuber.bgKeys || {})) if (k) rows.push(row(formatCombo(k), [L({ fr: 'Fond : ', en: 'Background: ' }), tr(names[id] || id)]));
      if (!rows.length) return h('p', { class: 'hint' }, L({ fr: 'Aucun raccourci choisi dans ce projet pour l\'instant.', en: 'No shortcut chosen in this project yet.' }));
    }
    return h('dl', { class: 'guide-keys' }, rows);
  }

  function sectionEl(ch, sec) {
    return h('section', { class: 'guide-sec', id: `guide-${ch.id}-${sec.id}` },
      h('h3', {}, sec.icon ? icon(sec.icon) : null, rich(L(sec.title))),
      sec.body.map(block).filter(Boolean));
  }

  function renderNav() {
    clear(navList);
    for (const c of GUIDE) {
      navList.append(h('button', {
        class: 'guide-chap' + (c.id === chapter && !search.value.trim() ? ' on' : ''),
        'aria-current': c.id === chapter ? 'true' : null,
        onclick: () => { search.value = ''; go(c.id); },
      }, icon(c.icon), h('span', {}, L(c.title))));
    }
  }

  function renderChapter(sectionId = null) {
    const i = GUIDE.findIndex((c) => c.id === chapter);
    const ch = GUIDE[i];
    clear(main);
    // (append natif : on aplatit les tableaux, sinon ils seraient écrits comme du texte)
    main.append(...[
      h('header', { class: 'guide-head' }, h('span', { class: 'guide-icon' }, icon(ch.icon)),
        h('div', {}, h('div', { class: 'guide-count' }, `${i + 1} / ${GUIDE.length}`), h('h2', {}, L(ch.title)))),
      h('p', { class: 'guide-intro' }, rich(L(ch.intro))),
      ch.sections.length > 2 ? h('div', { class: 'guide-toc' }, ch.sections.map((s) => h('button', {
        class: 'chip', onclick: () => main.querySelector(`#guide-${ch.id}-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      }, L(s.title).replace(/\[\[|\]\]/g, '')))) : null,
      ch.sections.map((s) => sectionEl(ch, s)),
      h('footer', { class: 'guide-foot' },
        i > 0 ? h('button', { class: 'btn', onclick: () => go(GUIDE[i - 1].id) }, '‹ ', L(GUIDE[i - 1].title)) : h('span'),
        i < GUIDE.length - 1 ? h('button', { class: 'btn primary', onclick: () => go(GUIDE[i + 1].id) }, L(GUIDE[i + 1].title), ' ›') : null),
    ].flat().filter(Boolean));
    if (sectionId) {
      const el = main.querySelector(`#guide-${ch.id}-${sectionId}`);
      if (el) requestAnimationFrame(() => { main.scrollTop = el.offsetTop - main.offsetTop - 8; el.classList.add('flash'); });
    } else main.scrollTop = 0;
  }

  function renderSearch(q) {
    clear(main);
    const n = norm(q);
    const hits = [];
    for (const c of GUIDE) for (const s of c.sections) if (norm(plain(s) + ' ' + L(c.title)).includes(n)) hits.push([c, s]);
    main.append(h('header', { class: 'guide-head' }, h('span', { class: 'guide-icon' }, icon('help')),
      h('h2', {}, L({ fr: `Résultats pour « ${q} »`, en: `Results for "${q}"` }))));
    if (!hits.length) main.append(h('p', { class: 'hint' }, L({ fr: 'Aucun résultat. Essayez un autre mot (ex. calque, export, micro).', en: 'No results. Try another word (e.g. layer, export, microphone).' })));
    for (const [c, s] of hits) {
      main.append(h('div', { class: 'guide-hit' },
        h('button', { class: 'guide-hit-title', onclick: () => { search.value = ''; go(c.id, s.id); } }, icon(c.icon), `${L(c.title)} › `, rich(L(s.title))),
        sectionEl(c, s)));
    }
    main.scrollTop = 0;
  }

  function go(id, sectionId = null) {
    chapter = GUIDE.find((c) => c.id === id)?.id || chapter;
    if ((app.state.guideChapter || '') !== chapter) app.setState({ guideChapter: chapter });
    renderNav();
    renderChapter(sectionId);
    navList.querySelector('.guide-chap.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  search.addEventListener('input', debounce(() => {
    const q = search.value.trim();
    renderNav();
    if (q.length >= 2) renderSearch(q);
    else renderChapter();
  }, 150));

  const dialog = openDialog({
    title: L({ fr: 'Guide', en: 'Guide' }),
    wide: true,
    className: 'guide-dlg',
    body: root,
    onClose: () => { current = null; },
  });
  current = { dialog, go, get chapter() { return chapter; } };
  go(chapter, sectionId);
  return dialog;
}

/** Ouvre le guide à la section de l'outil actif. */
export function openToolGuide(app, toolId = app.tools.current.id) {
  const [c, s] = TOOL_SECTION[toolId] || ['draw', null];
  return openGuide(app, c, s);
}
