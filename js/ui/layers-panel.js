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
    tb('trash', 'Supprimer', () => app.confirmDelete()),
    moreBtn);
  // sélection de plusieurs calques (Ctrl/Maj + clic, ou mode tactile)
  const multi = new Set();
  let multiMode = false;
  app.layerSelection = multi;
  const multiBtn = h('button', { class: 'icon-btn small', title: 'Sélection multiple (ou Ctrl/Maj + clic)', 'aria-label': 'Sélection multiple', onclick: () => {
    multiMode = !multiMode;
    multiBtn.classList.toggle('active', multiMode);
    if (!multiMode) multi.clear();
    else if (app.doc.activeId) multi.add(app.doc.activeId);
    render();
  } }, icon('check'));
  tools.append(multiBtn);
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
    if (node.type === 'layer' && node.refImg) {
      // miniature de l'image de référence
      const img = new Image();
      img.onload = () => {
        g.imageSmoothingEnabled = true;
        const r = node.refImg;
        const s = Math.min(c.width / r.w, c.height / r.h);
        g.drawImage(img, (c.width - r.w * s) / 2, (c.height - r.h * s) / 2, r.w * s, r.h * s);
      };
      img.src = node.refImg.src;
      return;
    }
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
      class: `lrow ${node.type} ${isActive ? 'active' : ''} ${multi.has(node.id) ? 'multi' : ''} ${doc.isShown(node) ? '' : 'hidden-eff'}`,
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
    el.append(h('span', { class: 'name', title: doc.pathName(node), translate: 'no' }, node.name));
    if (node.variant) el.append(h('span', { class: 'badge', title: 'Groupe de variantes : une seule visible à la fois' }, 'variantes'));
    if (node.reference) el.append(h('span', { class: 'badge ref', title: 'Calque de référence : non exporté' }, 'réf.'));
    if (node.opacity < 1) el.append(h('span', { class: 'small muted' }, Math.round(node.opacity * 100) + '%'));
    el.append(h('button', {
      class: 'icon-btn small', title: node.locked ? 'Déverrouiller' : 'Verrouiller', 'aria-label': 'Verrou',
      style: { opacity: node.locked ? 1 : 0.35 },
      onclick: (e) => { e.stopPropagation(); ops.toggleLock(app, node.id); },
    }, icon(node.locked ? 'lock' : 'unlock')));
    el.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey || multiMode) {
        if (multi.size === 0 && doc.activeId) multi.add(doc.activeId);
        if (multi.has(node.id) && multi.size > 1) multi.delete(node.id);
        else multi.add(node.id);
        render();
        return;
      }
      if (e.shiftKey && doc.activeId) {
        const order = ops.displayOrder(doc);
        const [a, b] = [order.indexOf(doc.activeId), order.indexOf(node.id)].sort((x, y) => x - y);
        multi.clear();
        for (let i = a; i <= b; i++) multi.add(order[i]);
        render();
        return;
      }
      if (multi.size) {
        multi.clear();
        render();
      }
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
    for (const id of [...multi]) if (!doc.get(id)) multi.delete(id);
    if (multi.size > 1) {
      const ids = [...multi];
      const anyVisible = ids.some((id) => doc.get(id)?.visible);
      props.append(
        h('strong', {}, `${multi.size} éléments sélectionnés`),
        h('div', { class: 'row', style: { marginTop: '6px' } },
          h('button', { class: 'btn small', onclick: () => { ops.groupNodes(app, ids); multi.clear(); } }, icon('folderPlus'), 'Grouper'),
          h('button', { class: 'btn small', onclick: () => { ops.groupNodes(app, ids, { variant: true }); multi.clear(); } }, icon('variants'), 'En variantes'),
          h('button', { class: 'btn small', onclick: () => { ops.mergeNodes(app, ids); multi.clear(); } }, icon('merge'), 'Fusionner'),
          h('button', { class: 'btn small', onclick: () => ops.duplicateNodes(app, ids) }, icon('copy'), 'Dupliquer'),
          h('button', { class: 'btn small', onclick: () => ops.setVisibleMany(app, ids, !anyVisible) }, icon(anyVisible ? 'eyeOff' : 'eye'), anyVisible ? 'Masquer' : 'Afficher'),
          h('button', { class: 'btn small danger', onclick: async () => {
            if (await confirmDialog(`Supprimer ${ids.length} éléments ?`, { danger: true, ok: 'Supprimer' })) { ops.removeNodes(app, ids); multi.clear(); }
          } }, icon('trash'), 'Supprimer'),
          h('button', { class: 'btn small', onclick: () => { multi.clear(); render(); } }, 'Annuler la sélection')));
      return;
    }
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
        h('strong', { class: 'grow', translate: 'no', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, a.name),
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
      if (a.refImg) {
        const r = a.refImg;
        const fitScale = Math.min(app.doc.width / r.w, app.doc.height / r.h);
        const start = r;
        const pct = h('span', { class: 'small muted', style: { width: '52px', textAlign: 'right' } }, Math.round((r.scale / fitScale) * 100) + ' %');
        const range = h('input', {
          type: 'range', min: 10, max: 400, value: Math.round((r.scale / fitScale) * 100), class: 'grow',
          oninput: (e) => {
            // mise à l'échelle autour du centre de l'image
            const s = (e.target.value / 100) * fitScale;
            const cx = start.x + (start.w * start.scale) / 2, cy = start.y + (start.h * start.scale) / 2;
            app.doc.get(a.id).refImg = { ...start, scale: s, x: cx - (start.w * s) / 2, y: cy - (start.h * s) / 2 };
            pct.textContent = e.target.value + ' %';
            app.renderer.requestRender();
          },
          onchange: () => {
            const n = app.doc.get(a.id);
            app.actions.setReference(n, { scale: n.refImg.scale, x: n.refImg.x, y: n.refImg.y }, start);
          },
        });
        props.append(
          h('div', { class: 'row nowrap', style: { marginTop: '6px' } }, h('span', { class: 'small muted' }, 'Taille'), range, pct),
          h('div', { class: 'row' },
            h('button', { class: 'btn small', onclick: () => app.actions.fitReference(app.doc.get(a.id)) }, 'Ajuster au canevas'),
            h('button', { class: 'btn small', onclick: () => app.tools.select('move') }, 'Déplacer (outil V)')),
          h('p', { class: 'hint' }, 'Image affichée en pleine résolution, jamais exportée. Placez ce calque tout en bas pour la voir sous le dessin, ou en haut pour décalquer par-dessus.'));
      }
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
  // suppression avec confirmation selon le réglage (Paramètres > Affichage)
  app.confirmDelete = async () => {
    const mode = app.state.confirmDelete || 'groups';
    if (multi.size > 1) {
      const ids = [...multi];
      if (mode !== 'never' && !(await confirmDialog(`Supprimer ${ids.length} éléments ?`, { danger: true, ok: 'Supprimer' }))) return;
      ops.removeNodes(app, ids);
      multi.clear();
      return;
    }
    const a = app.doc.active;
    if (!a) return;
    const ask = mode === 'always' || (mode === 'groups' && a.type === 'group' && a.children.length);
    if (ask) {
      const msg = a.type === 'group' ? `Supprimer le groupe « ${a.name} » et son contenu ?` : `Supprimer le calque « ${a.name} » ?`;
      if (!(await confirmDialog(msg, { danger: true, ok: 'Supprimer' }))) return;
    }
    ops.removeNode(app);
  };

  render();
}
