// Paramètres du site : apparence (thèmes, couleurs, taille), navigation, affichage,
// langue, données. Les réglages vivent dans app.state (localStorage).

import { h, clear, downloadBlob, pickFile, keepScroll } from '../util/dom.js';
import { openDialog, confirmDialog } from './dialogs.js';
import { icon } from './icons.js';
import { hexToU32, toRgba, rgbToHsl, hslToRgb, rgba, u32ToHex } from '../util/color.js';

// ---------- Thèmes ----------
// Chaque thème définit les variables CSS principales ; les autres en sont dérivées.
export const THEMES = {
  sombre: { name: 'Sombre', dark: true, bg: '#15151c', panel: '#22222d', text: '#ececf3', accent: '#ff5ab4', accent2: '#7f8cff', stage: '#101016' },
  clair: { name: 'Clair', dark: false, bg: '#eef0f6', panel: '#ffffff', text: '#1d1d2a', accent: '#d6318f', accent2: '#4d5bea', stage: '#d6d9e4' },
  minuit: { name: 'Minuit', dark: true, bg: '#0d1424', panel: '#16213a', text: '#e3ecff', accent: '#4ab0ff', accent2: '#9a7cff', stage: '#090f1c' },
  foret: { name: 'Forêt', dark: true, bg: '#121a15', panel: '#1c2a21', text: '#e6f2e8', accent: '#5fd38d', accent2: '#e0b04a', stage: '#0d140f' },
  sepia: { name: 'Sépia', dark: false, bg: '#ebe3d6', panel: '#f6f0e6', text: '#3b2a22', accent: '#b4532f', accent2: '#6b4a8a', stage: '#e2d8c8' },
  pastel: { name: 'Pastel', dark: false, bg: '#f6eef8', panel: '#ffffff', text: '#2e2238', accent: '#e05aa8', accent2: '#5a9ae0', stage: '#eadff0' },
  contraste: { name: 'Contraste élevé', dark: true, bg: '#000000', panel: '#0d0d0d', text: '#ffffff', accent: '#ffe600', accent2: '#00e5ff', stage: '#000000', line: '#ffffff' },
};

export const UI_SIZES = { s: { name: 'Compacte', font: 13, tap: 40 }, m: { name: 'Normale', font: 14, tap: 44 }, l: { name: 'Grande', font: 16, tap: 50 } };

function shift(hex, dl) {
  const [r, g, b] = toRgba(hexToU32(hex));
  const [hh, s, l] = rgbToHsl(r, g, b);
  const [nr, ng, nb] = hslToRgb(hh, s, Math.max(0, Math.min(1, l + dl)));
  return u32ToHex(rgba(nr, ng, nb));
}

/** Réglages d'apparence effectifs (thème + personnalisations). */
export function appearance(state) {
  const ui = state.ui || {};
  const base = THEMES[ui.theme] || THEMES[state.theme === 'light' ? 'clair' : 'sombre'];
  return {
    ...base,
    accent: ui.accent || base.accent,
    accent2: ui.accent2 || base.accent2,
    bg: ui.bg || base.bg,
    size: UI_SIZES[ui.size] ? ui.size : 'm',
  };
}

/** Applique l'apparence (variables CSS sur <html>). */
export function applyAppearance(app) {
  const a = appearance(app.state);
  const root = document.documentElement;
  const st = root.style;
  const d = a.dark ? 1 : -1;
  root.dataset.theme = a.dark ? 'dark' : 'light';
  st.setProperty('--bg', a.bg);
  st.setProperty('--bg2', shift(a.bg, 0.025 * d));
  st.setProperty('--panel', a.panel && !app.state.ui?.bg ? a.panel : shift(a.bg, 0.055 * d));
  st.setProperty('--panel2', shift(a.bg, 0.085 * d));
  st.setProperty('--line', a.line || shift(a.bg, 0.13 * d));
  st.setProperty('--text', a.text);
  st.setProperty('--muted', shift(a.text, a.dark ? -0.3 : 0.32));
  st.setProperty('--accent', a.accent);
  st.setProperty('--accent2', a.accent2);
  st.setProperty('--stage', app.state.ui?.stage || (app.state.ui?.bg ? shift(a.bg, -0.03 * d) : a.stage));
  const size = UI_SIZES[a.size];
  st.setProperty('--tap', size.tap + 'px');
  root.style.fontSize = size.font + 'px';
  document.body.style.fontSize = size.font + 'px';
  document.body.classList.toggle('left-handed', !!app.state.ui?.leftHanded);
  document.body.classList.toggle('reduce-motion', !!app.state.ui?.reduceMotion);
  document.body.classList.toggle('no-status', app.state.showStatus === false);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', shift(a.bg, 0.025 * d));
  app.state.theme = a.dark ? 'dark' : 'light'; // compatibilité (damier, etc.)
  app.renderer?.resetTheme();
}

/** Couleurs du damier de transparence. */
export function checkerColors(state) {
  const c = state.ui?.checker || 'auto';
  if (c === 'light') return ['#ffffff', '#d9dbe4'];
  if (c === 'dark') return ['#6a6a78', '#575764'];
  if (c === 'custom') return [state.ui.checkerA || '#ffffff', state.ui.checkerB || '#cccccc'];
  return state.theme === 'dark' ? ['#6a6a78', '#575764'] : ['#ffffff', '#d9dbe4'];
}

// ---------- Fenêtre ----------
const TABS = [
  ['look', 'Apparence', 'sun'],
  ['nav', 'Navigation', 'hand'],
  ['view', 'Affichage', 'eye'],
  ['lang', 'Langue et aide', 'help'],
  ['backup', 'Sauvegarde', 'folder'],
  ['data', 'Données', 'save'],
];

export function openSettings(app, initial = 'look') {
  let tab = initial;
  const side = h('nav', { class: 'settings-tabs', 'aria-label': 'Catégories de paramètres' });
  const body = h('div', { class: 'settings-body' });
  const st = () => app.state;
  const ui = () => ({ ...(app.state.ui || {}) });
  const setUi = (patch) => {
    app.setState({ ui: { ...ui(), ...patch } });
    applyAppearance(app);
    render();
  };
  const set = (patch) => {
    app.setState(patch);
    applyAppearance(app);
    render();
  };
  const row = (label, control, hint = null) => {
    if (control instanceof HTMLInputElement && !control.getAttribute('aria-label')) control.setAttribute('aria-label', label);
    return rowEl(label, control, hint);
  };
  const rowEl = (label, control, hint = null) => h('div', { class: 'set-row' },
    h('div', { class: 'set-label' }, h('span', {}, label), hint ? h('small', { class: 'muted' }, hint) : null), control);
  const toggle = (value, onChange) => h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!value, onchange: (e) => onChange(e.target.checked) }), h('span'));
  const segm = (options, value, onChange) => h('div', { class: 'seg' }, options.map(([v, label]) =>
    h('button', { class: v === value ? 'on' : '', onclick: () => onChange(v) }, label)));
  const color = (value, onChange) => {
    const inp = h('input', { type: 'color', value, class: 'set-color' });
    inp.addEventListener('change', () => onChange(inp.value));
    return inp;
  };

  function renderTabs() {
    clear(side);
    for (const [id, label, ic] of TABS) {
      side.append(h('button', { class: 'set-tab' + (id === tab ? ' on' : ''), onclick: () => { tab = id; renderTabs(); renderNow(); body.scrollTop = 0; } }, icon(ic), h('span', {}, label)));
    }
  }

  function render() {
    if (tab === 'backup') return renderBackup();
    keepScroll(body, renderNow);
  }
  // onglet Sauvegarde : contenu construit de façon asynchrone (état des dossiers), puis échangé
  let backupSeq = 0;
  async function renderBackup() {
    const seq = ++backupSeq;
    const { backupTab } = await import('../storage/backup-ui.js');
    const nodes = (await backupTab(app, render)).flat(3).filter(Boolean);
    if (seq !== backupSeq || tab !== 'backup') return;
    keepScroll(body, () => { clear(body); body.append(...nodes); });
  }
  function renderNow() {
    if (tab === 'backup') { clear(body); renderBackup(); return; }
    clear(body);
    const s = st();
    const u = s.ui || {};
    const a = appearance(s);
    if (tab === 'look') {
      body.append(
        h('h3', {}, 'Thème'),
        h('div', { class: 'theme-grid' }, Object.entries(THEMES).map(([id, t]) => h('button', {
          class: 'theme-card' + ((u.theme || (s.theme === 'light' ? 'clair' : 'sombre')) === id ? ' on' : ''),
          style: { background: t.bg, color: t.text, borderColor: t.accent },
          onclick: () => setUi({ theme: id, accent: null, accent2: null, bg: null, stage: null }),
        }, h('span', { class: 'theme-dots' }, h('i', { style: { background: t.accent } }), h('i', { style: { background: t.accent2 } }), h('i', { style: { background: t.panel } })), t.name))),
        h('h3', {}, 'Couleurs personnalisées'),
        row('Couleur principale (accent)', color(a.accent, (v) => setUi({ accent: v }))),
        row('Couleur secondaire', color(a.accent2, (v) => setUi({ accent2: v }))),
        row('Couleur de fond de l\'interface', color(a.bg, (v) => setUi({ bg: v })), 'Les panneaux et bordures sont déduits automatiquement'),
        row('Fond autour du dessin', color(u.stage || a.stage, (v) => setUi({ stage: v }))),
        h('button', { class: 'btn small', onclick: () => setUi({ accent: null, accent2: null, bg: null, stage: null }) }, 'Revenir aux couleurs du thème'),
        h('h3', {}, 'Taille de l\'interface'),
        row('Taille des textes et boutons', segm(Object.entries(UI_SIZES).map(([k, v]) => [k, v.name]), a.size, (v) => setUi({ size: v }))),
        h('h3', {}, 'Damier de transparence'),
        row('Couleurs du damier', segm([['auto', 'Selon le thème'], ['light', 'Clair'], ['dark', 'Sombre'], ['custom', 'Personnalisé']], u.checker || 'auto', (v) => setUi({ checker: v }))),
        ...(u.checker === 'custom' ? [h('div', { class: 'row' }, color(u.checkerA || '#ffffff', (v) => setUi({ checkerA: v })), color(u.checkerB || '#cccccc', (v) => setUi({ checkerB: v })))] : []),
      );
    } else if (tab === 'nav') {
      body.append(
        h('h3', {}, 'Souris et trackpad'),
        row('Molette', segm([['zoom', 'Zoome'], ['pan', 'Déplace la vue']], s.wheelPans ? 'pan' : 'zoom', (v) => set({ wheelPans: v === 'pan' })), 'Ctrl + molette (ou pincement du trackpad) zoome toujours'),
        row('Zoom à la molette', segm([['steps', 'Par paliers (nets)'], ['smooth', 'Progressif']], s.wheelZoom || 'steps', (v) => set({ wheelZoom: v }))),
        row('Inverser le sens de la molette', toggle(s.wheelInvert, (v) => set({ wheelInvert: v }))),
        h('h3', {}, 'Écran tactile et stylet'),
        row('Dessiner au doigt', segm([['all', 'Doigt et stylet'], ['pen', 'Stylet seulement']], s.touchDraw || 'all', (v) => set({ touchDraw: v })), '« Stylet seulement » : le doigt déplace la vue (idéal avec un stylet, évite les traits involontaires de la paume)'),
        row('Tape à 2 doigts = annuler', toggle(s.twoFingerUndo !== false, (v) => set({ twoFingerUndo: v }))),
        row('Tape à 3 doigts = rétablir', toggle(s.threeFingerRedo !== false, (v) => set({ threeFingerRedo: v }))),
        h('h3', {}, 'Disposition'),
        row('Mode gaucher (ordinateur)', toggle(u.leftHanded, (v) => setUi({ leftHanded: v })), 'Outils à droite, panneaux à gauche'),
        row('Réduire les animations', toggle(u.reduceMotion, (v) => setUi({ reduceMotion: v }))),
        h('h3', {}, 'Clavier'),
        h('button', { class: 'btn', onclick: async () => { const { openKeymapDialog } = await import('./shortcuts.js'); openKeymapDialog(app); } }, icon('key'), 'Personnaliser les raccourcis…'),
      );
    } else if (tab === 'view') {
      body.append(
        h('h3', {}, 'Sur le canevas'),
        row('Grille de pixels au fort zoom', toggle(s.showPixelGrid !== false, (v) => set({ showPixelGrid: v }))),
        row('Contour du pinceau sous le curseur', toggle(s.showBrushCursor !== false, (v) => set({ showBrushCursor: v }))),
        row('Barre de variantes sur le canevas', toggle(s.showVariantBar !== false, (v) => set({ showVariantBar: v }))),
        row('Aperçu taille réelle', toggle(s.showMinimap !== false, (v) => set({ showMinimap: v }))),
        row('Barre d\'état (taille, zoom, position)', toggle(s.showStatus !== false, (v) => set({ showStatus: v }))),
        h('h3', {}, 'Comportement'),
        row('Confirmer avant de supprimer un calque', segm([['groups', 'Groupes seulement'], ['always', 'Toujours'], ['never', 'Jamais']], s.confirmDelete || 'groups', (v) => set({ confirmDelete: v }))),
        row('Sauvegarde automatique', segm([['1500', 'Rapide'], ['5000', 'Toutes les 5 s'], ['0', 'Désactivée']], String(s.autosaveDelay ?? 1500), (v) => set({ autosaveDelay: +v })), 'Désactivée : enregistrez avec Ctrl+S ou le menu'),
      );
    } else if (tab === 'lang') {
      body.append(
        h('h3', {}, 'Langue'),
        row('Langue de l\'interface', segm([['fr', 'Français'], ['en', 'English']], s.lang || 'fr', (v) => {
          if (v === (s.lang || 'fr')) return;
          app.setState({ lang: v });
          app.savePrefs.flush();
          Promise.resolve(app.storage?.saveNow()).finally(() => location.reload());
        }), 'La page se recharge pour appliquer la langue'),
        h('h3', {}, 'Aide'),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: () => { app.openGuide?.(); } }, icon('book'), 'Guide complet'),
          h('button', { class: 'btn', onclick: () => { app.startTutorial(); } }, icon('help'), 'Revoir le tutoriel'),
          h('button', { class: 'btn', onclick: async () => { const { showShortcuts } = await import('./shortcuts.js'); showShortcuts(app); } }, icon('keyboard'), 'Raccourcis clavier et gestes')),
      );
    } else if (tab === 'data') {
      body.append(
        h('h3', {}, 'Vos réglages'),
        h('p', { class: 'hint' }, 'Les réglages sont enregistrés dans ce navigateur. Exportez-les pour les retrouver sur un autre appareil.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => exportSettings(app) }, icon('download'), 'Exporter les réglages'),
          h('button', { class: 'btn', onclick: () => importSettings(app).then(render) }, icon('upload'), 'Importer des réglages')),
        h('h3', {}, 'Réinitialiser'),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => { app.setState({ recent: [] }); app.emit('recent'); app.toast('Couleurs récentes effacées'); } }, 'Effacer les couleurs récentes'),
          h('button', { class: 'btn danger', onclick: async () => {
            if (!(await confirmDialog('Remettre tous les réglages par défaut (thème, navigation, raccourcis…) ? Vos projets ne sont pas touchés.', { danger: true, ok: 'Réinitialiser' }))) return;
            app.resetPrefs();
            applyAppearance(app);
            render();
            app.toast('Réglages réinitialisés');
          } }, 'Tout réinitialiser')),
      );
    }
  }

  renderTabs();
  render();
  openDialog({
    title: 'Paramètres',
    wide: true,
    className: 'settings-dlg',
    body: h('div', { class: 'settings' }, side, body),
  });
}

// clés d'état qui sont des réglages (exportés / réinitialisés)
const SETTING_KEYS = ['ui', 'theme', 'lang', 'wheelPans', 'wheelZoom', 'wheelInvert', 'touchDraw', 'twoFingerUndo', 'threeFingerRedo',
  'showPixelGrid', 'showBrushCursor', 'showVariantBar', 'showMinimap', 'showStatus', 'confirmDelete', 'autosaveDelay', 'keymap',
  'driveClientId', 'backupHistory', 'backupReminderDays'];

function exportSettings(app) {
  const data = { format: 'pixel-atelier-settings', version: 1 };
  for (const k of SETTING_KEYS) if (app.state[k] !== undefined) data[k] = app.state[k];
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'pixel_atelier_reglages.json');
}

async function importSettings(app) {
  const f = await pickFile('.json,application/json');
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j.format !== 'pixel-atelier-settings') throw new Error('format inconnu');
    const patch = {};
    for (const k of SETTING_KEYS) if (j[k] !== undefined) patch[k] = j[k];
    app.setState(patch);
    applyAppearance(app);
    const { applyKeymap } = await import('./shortcuts.js');
    applyKeymap(app);
    app.toast('Réglages importés');
  } catch (err) {
    app.toast('Fichier de réglages illisible : ' + err.message);
  }
}

export { SETTING_KEYS };
