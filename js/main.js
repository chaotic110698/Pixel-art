// Point d'entrée : construit l'interface et relie les modules.

import { App } from './app.js';
import { Doc } from './core/doc.js';
import { h, $, debounce } from './util/dom.js';
import { icon } from './ui/icons.js';
import { toast, promptDialog } from './ui/dialogs.js';
import { initToolbar, renderOptions } from './ui/toolbar.js';
import { initColorsPanel } from './ui/colors-panel.js';
import { initLayersPanel } from './ui/layers-panel.js';
import { initExpressionsPanel } from './ui/expressions-panel.js';
import { initGridPanel } from './ui/grid-panel.js';
import { initHistoryPanel } from './ui/history-panel.js';
import { initShortcuts } from './ui/shortcuts.js';
import { openMainMenu } from './ui/menu.js';
import { createActions } from './ui/actions.js';
import { startTutorial } from './ui/tutorial.js';
import { applyAppearance, openSettings } from './ui/settings.js';
import { setLanguage, tr } from './ui/i18n.js';
import { composeToCanvas } from './render/compose.js';
import * as ops from './core/layer-ops.js';

const app = new App();
window.pixelAtelier = app; // pratique pour le débogage

function setupTheme() {
  app.setTheme = (t) => {
    app.setState({ ui: { ...(app.state.ui || {}), theme: t === 'light' ? 'clair' : t === 'dark' ? 'sombre' : t } });
    applyAppearance(app);
  };
  applyAppearance(app);
}

function setupTopbar() {
  const set = (id, ic, fn) => {
    const b = document.getElementById(id);
    b.append(icon(ic));
    b.addEventListener('click', fn);
    return b;
  };
  const menuBtn = set('btn-menu', 'menu', () => openMainMenu(app, menuBtn));
  const undo = set('btn-undo', 'undo', () => app.history.undo());
  const redo = set('btn-redo', 'redo', () => app.history.redo());
  set('btn-grid', 'grid', () => app.toggleGrid());
  set('btn-fit', 'fit', () => app.viewport.fit());
  set('btn-zoomin', 'zoomIn', () => app.viewport.stepZoom(1));
  set('btn-zoomout', 'zoomOut', () => app.viewport.stepZoom(-1));
  set('btn-library', 'book', () => app.actions.openLibrary());
  set('btn-pngtuber', 'tv', () => app.actions.openPngtuber());
  set('btn-export', 'download', () => app.actions.exportDialog());
  set('btn-settings', 'settings', () => openSettings(app));
  app.openSettings = (tab) => openSettings(app, tab);
  const syncHist = () => {
    undo.disabled = !app.history.canUndo();
    redo.disabled = !app.history.canRedo();
  };
  app.on('history', syncHist);
  syncHist();

  const title = document.getElementById('doc-title');
  const syncTitle = () => {
    title.textContent = app.doc.name;
    document.title = `${app.doc.name} — Pixel Atelier`;
  };
  const rename = async () => {
    const n = await promptDialog('Nom du projet', app.doc.name, { title: 'Renommer le projet' });
    if (n && n.trim()) {
      app.history.transact('Renommer le projet', () => {
        app.doc.name = n.trim();
      });
      syncTitle();
    }
  };
  title.addEventListener('click', rename);
  title.addEventListener('keydown', (e) => e.key === 'Enter' && rename());
  app.on('doc', syncTitle);
  app.on('meta', syncTitle);
  syncTitle();
}

function setupPanels() {
  const sidebar = document.getElementById('sidebar');
  const tabs = document.getElementById('panel-tabs');
  const mobile = () => window.matchMedia('(max-width: 760px)').matches;
  const defs = [
    ['colors', 'Couleurs', 'palette'],
    ['layers', 'Calques', 'layers'],
    ['expressions', 'Expressions', 'face'],
    ['grid', 'Grille', 'grid'],
    ['history', 'Historique', 'undo'],
  ];
  let current = 'layers';
  let mobileCurrent = 'colors';
  const tabBtns = {};
  for (const [id, label] of defs) {
    const b = h('button', { role: 'tab', dataset: { tab: id }, onclick: () => show(id) }, label);
    tabBtns[id] = b;
    tabs.append(b);
  }
  function apply() {
    const m = mobile();
    const active = m ? mobileCurrent : current;
    for (const [id] of defs) {
      const p = document.getElementById('panel-' + id);
      const on = id === active;
      p.classList.toggle('tab-on', on && (m || id !== 'colors'));
      tabBtns[id].classList.toggle('on', on);
      tabBtns[id].setAttribute('aria-selected', on);
    }
    for (const b of nav.querySelectorAll('button[data-tab]')) b.classList.toggle('on', sidebar.classList.contains('open') && b.dataset.tab === mobileCurrent);
  }
  function show(id) {
    if (mobile()) mobileCurrent = id;
    else if (id !== 'colors') current = id;
    apply();
    if (id === 'history') app.renderHistoryPanel?.();
  }
  app.showPanel = (id) => {
    show(id);
    if (mobile()) openDrawer(id);
  };

  // tiroir mobile
  const nav = document.getElementById('mobilenav');
  const chip = h('span', { class: 'mini-chip' });
  const navDefs = [
    ['colors', 'Couleurs', chip],
    ['layers', 'Calques', icon('layers')],
    ['expressions', 'Expressions', icon('face')],
  ];
  for (const [id, label, ic] of navDefs) {
    nav.append(h('button', { dataset: { tab: id }, 'aria-label': label, onclick: () => toggleDrawer(id) }, ic, label));
  }
  nav.append(h('button', { 'aria-label': 'Bibliothèque de pièces', onclick: () => { closeDrawer(); app.actions.openLibrary(); } }, icon('book'), 'Pièces'));
  nav.append(h('button', { 'aria-label': 'Mode PNGtuber', onclick: () => { closeDrawer(); app.actions.openPngtuber(); } }, icon('tv'), 'PNGtuber'));
  const syncChip = () => (chip.style.background = app.state.primary);
  app.on('color', syncChip);
  syncChip();

  function openDrawer(id) {
    mobileCurrent = id;
    sidebar.classList.add('open');
    apply();
  }
  function closeDrawer() {
    sidebar.classList.remove('open');
    apply();
  }
  function toggleDrawer(id) {
    if (sidebar.classList.contains('open') && mobileCurrent === id) closeDrawer();
    else openDrawer(id);
  }
  app.closeDrawer = closeDrawer;
  app.closeTransient = () => {
    if (!mobile() || !sidebar.classList.contains('open')) return false;
    closeDrawer();
    return true;
  };
  // glisser la poignée vers le bas pour fermer
  const handle = sidebar.querySelector('.drawer-handle');
  let sy = null;
  sidebar.addEventListener('pointerdown', (e) => {
    if (e.target === handle || e.target === tabs) sy = e.clientY;
  });
  window.addEventListener('pointerup', (e) => {
    if (sy !== null && e.clientY - sy > 40) closeDrawer();
    sy = null;
  });
  window.addEventListener('resize', apply);
  apply();
}

function setupStatus() {
  const bar = document.getElementById('statusbar');
  let pos = null;
  const render = () => {
    const doc = app.doc;
    const z = Math.round(app.viewport.zoom * 100);
    const p = pos ? `${pos.ix}, ${pos.iy}` : '–';
    const sel = app.selection.bounds ? ` · sél. ${app.selection.bounds.x1 - app.selection.bounds.x0 + 1}×${app.selection.bounds.y1 - app.selection.bounds.y0 + 1}` : '';
    const fr = doc.frames.length > 1 ? ` · image ${doc.frame + 1}/${doc.frames.length}` : '';
    bar.textContent = `${doc.width}×${doc.height} · ${z} % · ${p}${sel}${fr}`;
  };
  app.on('hover', (p) => { pos = p; render(); });
  app.on('viewport', render);
  app.on('doc', render);
  app.on('selection', render);
  app.on('frame', render);
  render();
}

function setupMinimap() {
  const box = document.getElementById('minimap');
  const c = document.createElement('canvas');
  box.append(c);
  box.addEventListener('click', () => app.viewport.fit());
  const draw = debounce(() => {
    const doc = app.doc;
    const show = app.state.showMinimap !== false && app.viewport.zoom > 1.5 && doc.width <= 512 && doc.height <= 512;
    box.classList.toggle('hidden', !show);
    if (!show) return;
    // aperçu à l'échelle 1 (ou 2 si très petit)
    const k = Math.max(1, Math.min(4, Math.floor(96 / Math.max(doc.width, doc.height))));
    c.width = doc.width * k;
    c.height = doc.height * k;
    c.style.width = c.width + 'px';
    c.style.height = c.height + 'px';
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(composeToCanvas(doc, { includeReference: false }), 0, 0, c.width, c.height);
    box.title = k === 1 ? 'Aperçu taille réelle (clic : ajuster)' : `Aperçu ×${k} (clic : ajuster)`;
  }, 150);
  app.on('pixels', draw);
  app.on('structure', draw);
  app.on('viewport', draw);
  app.on('doc', draw);
  app.on('state', draw);
  app.on('frame', draw);
  app.on('meta', draw);
  draw();
}

function setupVariantBar() {
  const bar = document.getElementById('variantbar');
  const render = () => {
    const doc = app.doc;
    bar.replaceChildren();
    if (app.state.showVariantBar === false) return;
    for (const g of doc.variantGroups()) {
      if (!doc.isShown(g) && g.visible === false) continue;
      const act = doc.get(g.active);
      bar.append(h('div', { class: 'vb' },
        h('button', { title: `${g.name} : variante précédente`, 'aria-label': 'Précédente', onclick: () => ops.cycleVariant(app, g.id, -1) }, '‹'),
        h('span', { class: 'lbl', translate: 'no' }, `${g.name} : `, h('b', {}, act ? act.name : '—')),
        h('button', { title: `${g.name} : variante suivante`, 'aria-label': 'Suivante', onclick: () => ops.cycleVariant(app, g.id, 1) }, '›')));
    }
  };
  app.on('structure', render);
  app.on('doc', render);
  app.on('state', render);
  render();
}

function setupGlobalToggles() {
  app.toggleGrid = () => {
    const g = app.doc.grid;
    app.history.transact(g.visible ? 'Masquer la grille' : 'Afficher la grille', () => {
      app.doc.grid.visible = !g.visible;
    });
    app.emit('grid');
    app.renderGridPanel?.();
    app.renderer.requestRender();
    app.toast(app.doc.grid.visible ? 'Grille affichée' : 'Grille masquée', 900);
  };
  app.toggleTileMode = () => {
    app.setState({ tileMode: !app.state.tileMode });
    app.viewport.fit();
    app.toast(app.state.tileMode ? 'Mode tuiles : aperçu en mosaïque' : 'Mode tuiles désactivé');
  };
  app.startTutorial = () => startTutorial(app);
}

function setupErrorReporting() {
  // Sur mobile il n'y a pas de console : on affiche les erreurs inattendues.
  let last = 0;
  const report = (msg) => {
    const now = Date.now();
    if (now - last < 3000) return;
    last = now;
    toast(`Erreur : ${msg}`, 5000);
  };
  window.addEventListener('error', (e) => report(e.message || 'inconnue'));
  window.addEventListener('unhandledrejection', (e) => report(e.reason?.message || String(e.reason)));
  // iOS : empêcher le zoom de la page entière par pincement (le canevas gère son propre zoom)
  for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}

async function boot() {
  setupErrorReporting();
  setupTheme();
  app.on('toast', (m, ms) => toast(m, ms));
  app.actions = createActions(app);
  const canvas = $('#view');
  app.init(canvas);

  // document de départ (remplacé par le dernier projet si disponible)
  setLanguage(app.state.lang);
  const doc = new Doc(64, 64, tr('Sans titre'));
  doc.palette = app.doc.palette;
  const l = doc.createLayer(tr('Calque 1'));
  doc.insert(l, 'root');
  doc.activeId = l.id;
  app.doc = doc;

  setupTopbar();
  setupGlobalToggles();
  initToolbar(app, { openColorEditor: (w) => app.openColorEditor(w) });
  initColorsPanel(app);
  initLayersPanel(app);
  initExpressionsPanel(app);
  initGridPanel(app);
  initHistoryPanel(app);
  setupPanels();
  setupStatus();
  setupMinimap();
  setupVariantBar();
  initShortcuts(app);
  app.on('selection', () => {
    if (['select', 'lasso', 'wand', 'move'].includes(app.tools.current.id)) renderOptions(app);
  });

  const ro = new ResizeObserver(() => {
    const first = !app._sized;
    app._sized = true;
    app.renderer.resize();
    if (first) app.viewport.fit();
  });
  ro.observe($('#stage'));

  // stockage local (autosave) + reprise du dernier projet
  try {
    const storage = await import('./storage/storage.js');
    app.storage = await storage.initStorage(app);
    const restored = await app.storage.restoreLast();
    if (!restored) app.setDoc(doc);
  } catch (err) {
    console.warn('Stockage indisponible', err);
    app.setDoc(doc);
  }

  // PWA
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js').then((reg) => reg.update()).catch((e) => console.warn('SW', e));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // nouvelle version installée : on propose de recharger (sans interrompre le dessin)
      if (!hadController || document.getElementById('update-banner')) return;
      const banner = h('div', { id: 'update-banner', role: 'status' },
        h('span', {}, 'Une nouvelle version de Pixel Atelier est disponible.'),
        h('button', { class: 'btn small primary', onclick: async () => {
          banner.querySelector('button').disabled = true;
          await app.storage?.saveNow();
          location.reload();
        } }, 'Recharger'),
        h('button', { class: 'icon-btn small', 'aria-label': 'Plus tard', title: 'Plus tard', onclick: () => banner.remove() }, '✕'));
      document.body.append(banner);
    });
  }

  if (!app.state.tutorialDone) setTimeout(() => startTutorial(app), 400);
}

boot();
