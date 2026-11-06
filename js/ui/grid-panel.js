// Panneau Grille : entièrement modulable, réglages enregistrés dans le projet.

import { h, clear } from '../util/dom.js';

export function initGridPanel(app) {
  const panel = document.getElementById('panel-grid');

  function render() {
    const g = app.doc.grid;
    clear(panel);
    const set = (patch) => {
      Object.assign(app.doc.grid, patch);
      app.emit('grid');
      app.emit('changed');
      app.renderer.requestRender();
    };
    const num = (label, key, min, max, step = 1) => h('label', { class: 'field' }, h('span', {}, label),
      h('input', {
        type: 'number', class: 'input', min, max, step, value: g[key],
        onchange: (e) => {
          let v = parseFloat(e.target.value);
          if (isNaN(v)) v = min;
          set({ [key]: Math.max(min, Math.min(max, v)) });
        },
      }));
    const color = (label, key) => h('label', { class: 'field' }, h('span', {}, label),
      h('input', { type: 'color', value: g[key], style: { width: '100%', height: '36px', border: 0, background: 'none' }, oninput: (e) => set({ [key]: e.target.value }) }));
    const chk = (label, key, title = '') => h('label', { class: 'chk', title },
      h('input', { type: 'checkbox', checked: !!g[key], onchange: (e) => { set({ [key]: e.target.checked }); render(); } }), label);

    panel.append(
      h('div', { class: 'row' }, chk('Afficher la grille', 'visible'), chk('Aimanter les formes et sélections', 'snap', 'Les rectangles, ellipses et sélections s\'alignent sur les cellules')),
      h('h3', {}, 'Cellules'),
      h('div', { class: 'fields' }, num('Largeur de cellule', 'cellW', 1, 1024), num('Hauteur de cellule', 'cellH', 1, 1024), num('Décalage X', 'offsetX', -1024, 1024), num('Décalage Y', 'offsetY', -1024, 1024)),
      h('h3', {}, 'Lignes principales'),
      h('div', { class: 'fields' }, num('Toutes les N cellules (0 = aucune)', 'majorEvery', 0, 256), num('Épaisseur principale (px écran)', 'majorThickness', 1, 8)),
      h('h3', {}, 'Apparence'),
      h('div', { class: 'fields' }, color('Couleur', 'color'), color('Couleur principale', 'majorColor'), num('Épaisseur (px écran)', 'thickness', 1, 8)),
      h('label', { class: 'field' }, h('span', {}, `Opacité : ${Math.round(g.opacity * 100)} %`),
        h('input', { type: 'range', min: 5, max: 100, value: Math.round(g.opacity * 100), oninput: (e) => { app.doc.grid.opacity = e.target.value / 100; app.renderer.requestRender(); e.target.previousSibling.textContent = `Opacité : ${e.target.value} %`; }, onchange: () => app.emit('changed') })),
      h('div', { class: 'row' }, chk('Grille de pixels au fort zoom', 'pixelGrid')),
      h('h3', {}, 'Préréglages'),
      h('div', { class: 'row' }, ...[[8, 8], [16, 16], [32, 32], [16, 32], [4, 4]].map(([w, hh]) =>
        h('button', { class: 'btn small', onclick: () => { set({ cellW: w, cellH: hh, visible: true }); render(); } }, `${w}×${hh}`)),
      h('button', { class: 'btn small', onclick: () => { set({ cellW: app.doc.width, cellH: app.doc.height, visible: true, majorEvery: 0 }); render(); } }, 'Canevas entier')),
      h('p', { class: 'hint' }, 'La grille est un simple repère visuel : elle n\'est jamais exportée. Raccourci : touche # ou le bouton grille en haut.'));
  }

  app.on('doc', render);
  app.on('grid', () => {
    document.getElementById('btn-grid')?.classList.toggle('on', app.doc.grid.visible);
  });
  render();
  app.renderGridPanel = render;
}
