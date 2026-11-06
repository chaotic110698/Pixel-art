// Panneau Calques : arbre (groupes, groupes de variantes), propriétés,
// glisser-déposer via poignée (souris + tactile), miniatures.

import { h, clear, debounce } from '../util/dom.js';
import { icon } from './icons.js';
import { popupMenu, promptDialog, confirmDialog } from './dialogs.js';
import { celCanvas } from '../render/celcache.js';
import { composeToCanvas } from '../render/compose.js';
import * as ops from '../core/layer-ops.js';

export function initLayersPanel(app) {
  const panel = document.getElementById('panel-layers');
  const tb = (ic, title, fn) => h('button', { class: 'icon-btn small', title, 'aria-label': title, onclick: fn }, icon(ic));
  const moreBtn = tb('more', 'Plus d\'actions', () => popupMenu(moreBtn, moreItems(), { align: 'right' }));
  const tools = h('div', { class: 'layer-tools' },
    tb('plus', 'Nouveau calque (Ctrl+Maj+N)', () => ops.addLayer(app)),
    tb('folderPlus', 'Nouveau groupe', () => ops.addGroup(app)),
    tb('variants', 'Nouveau groupe de variantes', () => ops.addGroup(app, { variant: true })),
    tb('copy', 'Dupliquer', () => ops.duplicate(app)),
    tb('merge', 'Fusionner vers le bas', () => ops.mergeDown(app)),
    tb('up', 'Monter', () => ops.moveNode(app, app.doc.activeId, 1)),
    tb('down', 'Descendre', () => ops.moveNode(app, app.doc.activeId, -1)),
    tb('trash', 'Supprimer', () => ops.removeNode(app)),
    moreBtn);
  const tree = h('div', { class: 'layer-tree', role: 'tree' });
  const props = h('div', { class: 'layer-props' });
  panel.append(tools, tree, props);

  function moreItems() {
    const a = app.doc.active;
    return [
      { label: 'Grouper le calque actif', icon: 'folderPlus', action: () => ops.groupActive(app, false), disabled: !a },
      { label: 'En faire un groupe de variantes', icon: 'variants', action: () => ops.groupActive(app, true), disabled: !a },
      { label: 'Aplatir le groupe', icon: 'merge', action: () => ops.flattenGroup(app, a.id), disabled: !a || a.type !== 'group' },
      { label: 'Effacer le contenu', icon: 'eraser', action: () => ops.clearLayer(app), disabled: !a || a.type !== 'layer' },
      { sep: true },
      { label: 'Importer une image comme calque', icon: 'image', action: () => app.actions.importImage('layer') },
      { label: 'Importer une image de référence', icon: 'ref', action: () => app.actions.importImage('reference') },
      { sep: true },
      { label: 'Ajouter à ma bibliothèque', icon: 'star', action: () => app.actions.saveToLibrary(), disabled: !a },
      { label: 'Recolorer le personnage', icon: 'palette', action: () => app.actions.recolor() },
    ];
  }

  const thumbs = new Map(); // id -> canvas

  function drawThumb(node, c) {
    const doc = app.doc;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.imageSmoothingEnabled = false;
    const k = Math.min(c.width / doc.width, c.height / doc.height);
    const w = doc.width * k, hh = doc.height * k;
    let src;
    if (node.type === 'layer') {
      const cel = node.cels[doc.frame];
      if (!cel) return;
      src = celCanvas(cel, doc.width, doc.height);
    } else src = composeToCanvas(doc, { root: node, ignoreVisibility: false });
    g.drawImage(src, (c.width - w) / 2, (c.height - hh) / 2, w, hh);
  }

  function row(node, depth, parent) {
    const doc = app.doc;
    const isActive = doc.activeId === node.id;
    const inVariant = parent && parent.variant;
    const el = h('div', {
      class: `lrow ${node.type} ${isActive ? 'active' : ''} ${doc.isShown(node) ? '' : 'hidden-eff'}`,
      role: 'treeitem',
      'aria-selected': isActive,
      dataset: { id: node.id },
      style: { marginLeft: depth * 14 + 'px' },
    });
    const handle = h('span', { class: 'icon-btn small drag-handle', title: 'Glisser pour déplacer', 'aria-label': 'Déplacer', style: { cursor: 'grab', touchAction: 'none', minWidth: '22px', padding: 0, color: 'var(--muted)' } }, '⋮⋮');
    el.append(handle);
    if (node.type === 'group') {
      el.append(h('button', {
        class: 'icon-btn small', title: node.collapsed ? 'Déplier' : 'Replier', 'aria-label': 'Déplier/replier',
        onclick: (e) => { e.stopPropagation(); node.collapsed = !node.collapsed; render(); },
      }, icon(node.collapsed ? 'chevronRight' : 'chevronDown')));
    }
    if (inVariant) {
      el.append(h('button', {
        class: 'icon-btn small', title: 'Afficher cette variante', 'aria-label': 'Variante active',
        onclick: (e) => { e.stopPropagation(); ops.setActiveVariant(app, parent.id, node.id); },
      }, h('span', { class: 'radio' + (parent.active === node.id ? ' on' : '') })));
    } else {
      el.append(h('button', {
        class: 'icon-btn small', title: node.visible ? 'Masquer' : 'Afficher', 'aria-label': 'Visibilité',
        onclick: (e) => { e.stopPropagation(); ops.toggleVisible(app, node.id); },
      }, icon(node.visible ? 'eye' : 'eyeOff')));
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const th = h('canvas', { class: 'thumb', width: 34 * dpr, height: 34 * dpr });
    thumbs.set(node.id, th);
    drawThumb(node, th);
    el.append(th);
    el.append(h('span', { class: 'name', title: doc.pathName(node) }, node.name));
    if (node.variant) el.append(h('span', { class: 'badge', title: 'Groupe de variantes : une seule visible à la fois' }, 'variantes'));
    if (node.reference) el.append(h('span', { class: 'badge ref', title: 'Calque de référence : non exporté' }, 'réf.'));
    if (node.opacity < 1) el.append(h('span', { class: 'small muted' }, Math.round(node.opacity * 100) + '%'));
    el.append(h('button', {
      class: 'icon-btn small', title: node.locked ? 'Déverrouiller' : 'Verrouiller', 'aria-label': 'Verrou',
      style: { opacity: node.locked ? 1 : 0.35 },
      onclick: (e) => { e.stopPropagation(); ops.toggleLock(app, node.id); },
    }, icon(node.locked ? 'lock' : 'unlock')));
    el.addEventListener('click', () => {
      if (doc.activeId !== node.id) {
        app.selection.commitFloating();
        doc.activeId = node.id;
        app.emit('structure');
        app.emit('active');
      }
    });
    el.addEventListener('dblclick', () => renameNode(node));
    bindDrag(handle, el, node);
    return el;
  }

  async function renameNode(node) {
    const name = await promptDialog('Nom', node.name, { title: 'Renommer' });
    if (name) ops.rename(app, node.id, name);
  }

  function render() {
    const doc = app.doc;
    clear(tree);
    thumbs.clear();
    const visit = (group, depth) => {
      for (let i = group.children.length - 1; i >= 0; i--) {
        const n = doc.get(group.children[i]);
        if (!n) continue;
        tree.append(row(n, depth, group === doc.root ? null : group));
        if (n.type === 'group' && !n.collapsed) visit(n, depth + 1);
      }
    };
    visit(doc.root, 0);
    if (!doc.root.children.length) tree.append(h('p', { class: 'hint' }, 'Aucun calque. Ajoutez-en un avec +.'));
    renderProps();
  }

  function renderProps() {
    const doc = app.doc;
    const a = doc.active;
    clear(props);
    if (!a) return;
    const parent = doc.get(a.parent);
    const op = h('input', {
      type: 'range', min: 0, max: 100, value: Math.round(a.opacity * 100), class: 'grow',
      oninput: (e) => {
        a.opacity = e.target.value / 100;
        opLbl.textContent = e.target.value + ' %';
        app.renderer.invalidateAll();
      },
      onchange: (e) => {
        // enregistre dans l'historique : on restaure l'ancienne valeur puis on applique
        const v = e.target.value / 100;
        a.opacity = startOpacity;
        ops.setProp(app, a.id, 'opacity', v, 'Opacité');
        startOpacity = v;
      },
    });
    let startOpacity = a.opacity;
    const opLbl = h('span', { class: 'small muted', style: { width: '44px', textAlign: 'right' } }, Math.round(a.opacity * 100) + ' %');
    props.append(
      h('div', { class: 'row nowrap' },
        h('strong', { class: 'grow', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, a.name),
        h('button', { class: 'btn small', onclick: () => renameNode(a) }, 'Renommer')),
      h('div', { class: 'row nowrap', style: { marginTop: '6px' } }, h('span', { class: 'small muted' }, 'Opacité'), op, opLbl));
    if (a.type === 'group') {
      props.append(h('label', { class: 'chk' },
        h('input', { type: 'checkbox', checked: a.variant, onchange: (e) => ops.setVariantGroup(app, a.id, e.target.checked) }),
        'Groupe de variantes (une seule visible)'));
      if (a.variant) props.append(h('p', { class: 'hint' }, 'Astuce : chaque enfant est une variante (ex. bouche fermée / ouverte). Utilisez le bouton rond pour choisir celle qui est visible, ou l\'onglet Expressions.'));
    }
    if (a.type === 'layer') {
      props.append(h('label', { class: 'chk', title: 'Un calque de référence est semi-transparent à l\'écran et jamais exporté' },
        h('input', { type: 'checkbox', checked: !!a.reference, onchange: (e) => {
          const on = e.target.checked;
          app.history.transact(on ? 'Calque de référence' : 'Calque normal', () => {
            a.reference = on;
            if (on && a.opacity === 1) a.opacity = 0.5;
          });
        } }),
        'Calque de référence (non exporté)'));
    }
    if (parent && parent.variant) props.append(h('p', { class: 'hint' }, `Variante du groupe « ${parent.name} ».`));
  }

  // ----- glisser-déposer -----
  function bindDrag(handle, el, node) {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      let target = null, where = null;
      const clearMarks = () => tree.querySelectorAll('.drop-above,.drop-below,.drop-inside').forEach((r) => r.classList.remove('drop-above', 'drop-below', 'drop-inside'));
      const move = (ev) => {
        clearMarks();
        const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.lrow');
        // défilement automatique
        const tr = panel.getBoundingClientRect();
        if (ev.clientY < tr.top + 30) panel.scrollTop -= 8;
        else if (ev.clientY > tr.bottom - 30) panel.scrollTop += 8;
        if (!under || under === el) { target = null; return; }
        const r = under.getBoundingClientRect();
        const rel = (ev.clientY - r.top) / r.height;
        const tnode = app.doc.get(under.dataset.id);
        if (tnode.type === 'group' && rel > 0.3 && rel < 0.7) where = 'inside';
        else where = rel < 0.5 ? 'above' : 'below';
        target = tnode.id;
        under.classList.add(where === 'inside' ? 'drop-inside' : where === 'above' ? 'drop-above' : 'drop-below');
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        el.classList.remove('dragging');
        clearMarks();
        if (target) ops.dropNode(app, node.id, target, where);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
  }

  const refreshThumbs = debounce(() => {
    const doc = app.doc;
    for (const [id, c] of thumbs) {
      const n = doc.get(id);
      if (n) drawThumb(n, c);
    }
  }, 120);

  app.on('structure', render);
  app.on('doc', render);
  app.on('pixels', refreshThumbs);
  app.on('frame', refreshThumbs);
  app.renameActive = () => app.doc.active && renameNode(app.doc.active);
  app.confirmDelete = async () => {
    const a = app.doc.active;
    if (!a) return;
    if (a.type === 'group' && a.children.length && !(await confirmDialog(`Supprimer le groupe « ${a.name} » et son contenu ?`, { danger: true, ok: 'Supprimer' }))) return;
    ops.removeNode(app);
  };
  render();
}
