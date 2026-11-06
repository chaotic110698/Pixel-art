// Opérations sur calques, groupes, variantes et expressions — toutes annulables.

import { blendOver } from '../util/color.js';
import { uid } from './doc.js';
import { tr } from '../ui/i18n.js';

function fresh(app) {
  app.selection.commitFloating();
  return app.doc;
}

/** Position d'insertion « au-dessus du nœud actif ». */
function insertionPoint(doc) {
  const a = doc.active;
  if (!a) return ['root', null];
  if (a.type === 'group' && !a.collapsed) return [a.id, null];
  const parent = doc.get(a.parent);
  return [parent.id, parent.children.indexOf(a.id) + 1];
}

export function uniqueName(doc, base) {
  base = tr(base);
  const names = new Set([...doc.nodes.values()].map((n) => n.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
}

export function addLayer(app, name = null, { parentId, index, opts } = {}) {
  const doc = fresh(app);
  return app.history.transact('Nouveau calque', () => {
    const [p, i] = parentId ? [parentId, index ?? null] : insertionPoint(doc);
    const layer = doc.createLayer(name || uniqueName(doc, 'Calque'), opts);
    doc.insert(layer, p, i);
    doc.activeId = layer.id;
    return layer;
  });
}

export function addGroup(app, { variant = false, name = null } = {}) {
  const doc = fresh(app);
  return app.history.transact(variant ? 'Nouveau groupe de variantes' : 'Nouveau groupe', () => {
    const [p, i] = insertionPoint(doc);
    const g = doc.createGroup(name || uniqueName(doc, variant ? 'Variantes' : 'Groupe'), { variant });
    doc.insert(g, p, i);
    if (variant) {
      const a = doc.createLayer(tr('Variante 1'));
      doc.insert(a, g.id);
      g.active = a.id;
      doc.activeId = a.id;
    } else doc.activeId = g.id;
    return g;
  });
}

/** Regroupe le nœud actif dans un nouveau groupe. */
export function groupActive(app, variant = false) {
  const doc = fresh(app);
  const a = doc.active;
  if (!a) return;
  app.history.transact('Grouper', () => {
    const parent = doc.get(a.parent);
    const idx = parent.children.indexOf(a.id);
    const g = doc.createGroup(uniqueName(doc, variant ? 'Variantes' : 'Groupe'), { variant });
    doc.insert(g, parent.id, idx);
    doc.move(a.id, g.id, 0);
    if (variant) g.active = a.id;
    doc.activeId = g.id;
  });
}

function cloneNode(doc, node, parentId, suffix = ' copie') {
  if (node.type === 'layer') {
    const c = { ...node, id: uid('l'), name: node.name + suffix, cels: node.cels.map((cel) => (cel ? cel.slice() : doc.newCel())), part: node.part ? { ...node.part } : null };
    c.parent = parentId;
    return [c];
  }
  const g = { ...node, id: uid('g'), name: node.name + suffix, children: [], active: null, parent: parentId };
  const out = [g];
  for (const cid of node.children) {
    const child = doc.get(cid);
    const sub = cloneNode(doc, child, g.id, '');
    g.children.push(sub[0].id);
    if (node.active === cid) g.active = sub[0].id;
    out.push(...sub);
  }
  return out;
}

export function duplicate(app, id = app.doc.activeId) {
  const doc = fresh(app);
  const node = doc.get(id);
  if (!node || id === 'root') return;
  app.history.transact('Dupliquer', () => {
    const parent = doc.get(node.parent);
    const nodes = cloneNode(doc, node, parent.id);
    for (const n of nodes) doc.nodes.set(n.id, n);
    parent.children.splice(parent.children.indexOf(id) + 1, 0, nodes[0].id);
    doc.activeId = nodes[0].id;
  });
}

export function removeNode(app, id = app.doc.activeId) {
  const doc = fresh(app);
  const node = doc.get(id);
  if (!node || id === 'root') return;
  app.history.transact('Supprimer', () => {
    const parent = doc.get(node.parent);
    const idx = parent.children.indexOf(id);
    doc.remove(id);
    const next = parent.children[Math.max(0, idx - 1)] || parent.children[0];
    doc.activeId = next || (parent.id !== 'root' ? parent.id : doc.firstLayer()?.id || null);
  });
}

export function moveNode(app, id, dir) {
  const doc = fresh(app);
  const node = doc.get(id);
  if (!node) return;
  const parent = doc.get(node.parent);
  const i = parent.children.indexOf(id);
  app.history.transact('Réordonner', () => {
    if (dir > 0) {
      // vers le haut
      if (i < parent.children.length - 1) {
        const above = doc.get(parent.children[i + 1]);
        if (above.type === 'group' && !above.collapsed && !above.variant) doc.move(id, above.id, 0);
        else doc.move(id, parent.id, i + 2);
      } else if (parent.id !== 'root') {
        const gp = doc.get(parent.parent);
        doc.move(id, gp.id, gp.children.indexOf(parent.id) + 1);
      } else return false;
    } else {
      if (i > 0) {
        const below = doc.get(parent.children[i - 1]);
        if (below.type === 'group' && !below.collapsed && !below.variant) doc.move(id, below.id, below.children.length);
        else doc.move(id, parent.id, i - 1);
      } else if (parent.id !== 'root') {
        const gp = doc.get(parent.parent);
        doc.move(id, gp.id, gp.children.indexOf(parent.id));
      } else return false;
    }
  });
}

/** Déplacement direct (glisser-déposer) : place `id` avant/après/dans `targetId`. */
export function dropNode(app, id, targetId, where) {
  const doc = fresh(app);
  if (id === targetId) return;
  const target = doc.get(targetId);
  if (!target) return;
  app.history.transact('Déplacer le calque', () => {
    if (where === 'inside' && target.type === 'group') return doc.move(id, target.id, target.children.length) || false;
    const parent = doc.get(target.parent);
    const ti = parent.children.indexOf(targetId);
    // la liste affichée est inversée : « au-dessus » = index + 1
    return doc.move(id, parent.id, where === 'above' ? ti + 1 : ti) || false;
  });
}

export function setProp(app, id, prop, value, label) {
  const doc = fresh(app);
  const node = doc.get(id);
  if (!node || node[prop] === value) return;
  app.history.transact(label || 'Propriété du calque', () => {
    node[prop] = value;
  });
}

export function toggleVisible(app, id) {
  const n = app.doc.get(id);
  if (!n) return;
  setProp(app, id, 'visible', !n.visible, n.visible ? 'Masquer' : 'Afficher');
}

export function toggleLock(app, id) {
  const n = app.doc.get(id);
  if (!n) return;
  setProp(app, id, 'locked', !n.locked, n.locked ? 'Déverrouiller' : 'Verrouiller');
}

export function rename(app, id, name) {
  name = String(name || '').trim();
  if (!name) return;
  setProp(app, id, 'name', name, 'Renommer');
}

export function setVariantGroup(app, id, on) {
  const doc = fresh(app);
  const g = doc.get(id);
  if (!g || g.type !== 'group') return;
  app.history.transact(on ? 'Groupe de variantes' : 'Groupe normal', () => {
    g.variant = on;
    if (on && !g.children.includes(g.active)) g.active = g.children[g.children.length - 1] || null;
    if (on) for (const cid of g.children) doc.get(cid).visible = true;
  });
}

export function setActiveVariant(app, groupId, childId) {
  const doc = app.doc;
  const g = doc.get(groupId);
  if (!g || !g.variant || g.active === childId) return;
  app.selection.commitFloating();
  app.history.transact('Changer de variante', () => {
    g.active = childId;
    // garder la sélection de calque cohérente : si le calque actif était dans le groupe
    const a = doc.active;
    if (a && a.id !== childId && doc.ancestors(a).includes(g)) {
      const c = doc.get(childId);
      doc.activeId = c.type === 'layer' ? c.id : doc.activeId;
    }
  });
}

/** Variante suivante/précédente du groupe. */
export function cycleVariant(app, groupId, dir = 1) {
  const g = app.doc.get(groupId);
  if (!g || !g.variant || !g.children.length) return;
  const i = g.children.indexOf(g.active);
  const n = g.children.length;
  setActiveVariant(app, groupId, g.children[(i + dir + n) % n]);
}

/** Fusionne le calque actif avec le calque visible immédiatement en dessous (même parent). */
export function mergeDown(app) {
  const doc = fresh(app);
  const a = doc.active;
  if (!a || a.type !== 'layer') return app.toast('Sélectionnez un calque à fusionner');
  const parent = doc.get(a.parent);
  const i = parent.children.indexOf(a.id);
  const below = doc.get(parent.children[i - 1]);
  if (!below || below.type !== 'layer') return app.toast('Aucun calque juste en dessous à fusionner');
  if (parent.variant) return app.toast('Impossible dans un groupe de variantes');
  app.history.transact('Fusionner vers le bas', () => {
    below.cels = below.cels.map((bc, f) => {
      const out = (bc || doc.newCel()).slice();
      const ac = a.cels[f];
      if (!ac || !a.visible) return out;
      for (let k = 0; k < out.length; k++) {
        const s = ac[k];
        if (s >>> 24) {
          // l'opacité du calque inférieur est conservée : on compense
          out[k] = blendOver(out[k], s, a.opacity / (below.opacity || 1));
        }
      }
      return out;
    });
    doc.remove(a.id);
    doc.activeId = below.id;
  });
}

/** Aplatit un groupe (ou tout le document) en un seul calque. */
export function flattenGroup(app, id) {
  const doc = fresh(app);
  const g = doc.get(id);
  if (!g || g.type !== 'group') return;
  app.history.transact('Aplatir le groupe', () => {
    const layer = doc.createLayer(g.name);
    layer.cels = doc.frames.map((_, f) => {
      const out = doc.newCel();
      for (const { layer: l, opacity } of doc.renderList({ root: g, frame: f })) {
        const c = l.cels[f];
        if (!c) continue;
        for (let k = 0; k < out.length; k++) if (c[k] >>> 24) out[k] = blendOver(out[k], c[k], opacity / (g.opacity || 1));
      }
      return out;
    });
    layer.opacity = g.opacity;
    layer.visible = g.visible;
    const parent = doc.get(g.parent);
    const idx = parent.children.indexOf(g.id);
    doc.remove(g.id);
    doc.insert(layer, parent.id, idx);
    doc.activeId = layer.id;
  });
}

export function clearLayer(app) {
  const layer = app.editableLayer();
  if (!layer) return;
  const doc = app.doc;
  const token = app.history.beginPixels(layer);
  const m = app.selection.mask;
  if (m) for (let i = 0; i < token.cel.length; i++) { if (m[i]) token.cel[i] = 0; }
  else token.cel.fill(0);
  app.markLayerDirty(token.cel);
  app.history.endPixels(token, m ? 'Effacer la sélection' : 'Effacer le calque');
  void doc;
}

// ---------- Expressions ----------
export function currentStates(doc) {
  const states = {};
  for (const g of doc.variantGroups()) if (g.active) states[g.id] = g.active;
  return states;
}

export function saveExpression(app, name) {
  const doc = app.doc;
  return app.history.transact('Enregistrer l\'expression', () => {
    const e = { id: uid('x'), name: name || uniqueExprName(doc), states: currentStates(doc), key: null };
    doc.expressions.push(e);
    return e;
  });
}

function uniqueExprName(doc) {
  const names = new Set(doc.expressions.map((e) => e.name));
  for (let i = 1; ; i++) if (!names.has(`Expression ${i}`)) return `Expression ${i}`;
}

export function updateExpression(app, id) {
  const doc = app.doc;
  const e = doc.expressions.find((x) => x.id === id);
  if (!e) return;
  app.history.transact('Mettre à jour l\'expression', () => {
    doc.expressions.find((x) => x.id === id).states = currentStates(doc);
  });
}

export function applyExpression(app, id, { record = true } = {}) {
  const doc = app.doc;
  const e = doc.expressions.find((x) => x.id === id);
  if (!e) return;
  const run = () => {
    for (const [gid, cid] of Object.entries(e.states)) {
      const g = doc.get(gid);
      if (g && g.variant && g.children.includes(cid)) g.active = cid;
    }
  };
  if (record) app.history.transact(`Expression « ${e.name} »`, run);
  else {
    run();
    app.renderer.invalidateAll();
    app.emit('structure');
  }
}

export function renameExpression(app, id, name) {
  name = String(name || '').trim();
  if (!name) return;
  app.history.transact('Renommer l\'expression', () => {
    const e = app.doc.expressions.find((x) => x.id === id);
    if (e) e.name = name;
  });
}

export function deleteExpression(app, id) {
  app.history.transact('Supprimer l\'expression', () => {
    app.doc.expressions = app.doc.expressions.filter((x) => x.id !== id);
  });
}

export function setExpressionKey(app, id, key, hold = false) {
  app.history.transact('Raccourci d\'expression', () => {
    for (const e of app.doc.expressions) if (key && e.key === key) e.key = null;
    const e = app.doc.expressions.find((x) => x.id === id);
    if (e) {
      e.key = key || null;
      e.hold = !!(key && hold);
    }
  });
}

export function moveExpression(app, id, dir) {
  app.history.transact('Réordonner les expressions', () => {
    const list = app.doc.expressions;
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return false;
    [list[i], list[j]] = [list[j], list[i]];
  });
}

// ---------- Plusieurs calques à la fois ----------
/** Garde seulement les nœuds dont aucun ancêtre n'est aussi sélectionné. */
function topLevel(doc, ids) {
  const set = new Set(ids.filter((id) => doc.get(id) && id !== 'root'));
  return [...set].filter((id) => !doc.ancestors(doc.get(id)).some((a) => set.has(a.id)));
}

/** Ordre d'affichage (haut -> bas) de tous les nœuds. */
export function displayOrder(doc) {
  const out = [];
  const visit = (g) => {
    for (let i = g.children.length - 1; i >= 0; i--) {
      const n = doc.get(g.children[i]);
      if (!n) continue;
      out.push(n.id);
      if (n.type === 'group') visit(n);
    }
  };
  visit(doc.root);
  return out;
}

function sortTopFirst(doc, ids) {
  const order = displayOrder(doc);
  return [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export function groupNodes(app, ids, { variant = false } = {}) {
  const doc = fresh(app);
  const list = sortTopFirst(doc, topLevel(doc, ids));
  if (!list.length) return null;
  return app.history.transact(variant ? 'Grouper en variantes' : 'Grouper les calques', () => {
    const top = doc.get(list[0]);
    const parent = doc.get(top.parent);
    const g = doc.createGroup(uniqueName(doc, variant ? 'Variantes' : 'Groupe'), { variant });
    doc.insert(g, parent.id, parent.children.indexOf(top.id) + 1);
    // du bas vers le haut pour conserver l'ordre d'empilement
    for (const id of [...list].reverse()) doc.move(id, g.id, g.children.length);
    if (variant) g.active = g.children[g.children.length - 1];
    doc.activeId = g.id;
    return g;
  });
}

export function removeNodes(app, ids) {
  const doc = fresh(app);
  const list = topLevel(doc, ids);
  if (!list.length) return;
  app.history.transact(`Supprimer ${list.length} éléments`, () => {
    for (const id of list) doc.remove(id);
    if (!doc.get(doc.activeId)) doc.activeId = doc.firstLayer()?.id || null;
  });
}

export function duplicateNodes(app, ids) {
  const doc = fresh(app);
  const list = sortTopFirst(doc, topLevel(doc, ids));
  app.history.transact(`Dupliquer ${list.length} éléments`, () => {
    for (const id of list) {
      const node = doc.get(id);
      const parent = doc.get(node.parent);
      const nodes = cloneNode(doc, node, parent.id);
      for (const n of nodes) doc.nodes.set(n.id, n);
      parent.children.splice(parent.children.indexOf(id) + 1, 0, nodes[0].id);
    }
  });
}

export function setVisibleMany(app, ids, visible) {
  const doc = fresh(app);
  app.history.transact(visible ? 'Afficher' : 'Masquer', () => {
    for (const id of ids) {
      const n = doc.get(id);
      if (n) n.visible = visible;
    }
  });
}

/** Fusionne les calques sélectionnés (et le contenu des groupes sélectionnés) en un seul. */
export function mergeNodes(app, ids) {
  const doc = fresh(app);
  const list = sortTopFirst(doc, topLevel(doc, ids));
  const inSet = new Set();
  for (const id of list) {
    const n = doc.get(id);
    if (n.type === 'layer') inSet.add(n.id);
    else doc.walk((c) => c.type === 'layer' && inSet.add(c.id), n);
  }
  const layers = doc.renderList({ ignoreVisibility: true, includeReference: false }).filter((x) => inSet.has(x.layer.id));
  if (layers.length < 2) return app.toast('Sélectionnez au moins deux calques visibles à fusionner');
  app.history.transact('Fusionner les calques', () => {
    const top = doc.get(list[0]);
    const parent = doc.get(top.parent);
    const merged = doc.createLayer(uniqueName(doc, 'Fusion'));
    merged.cels = doc.frames.map((_, f) => {
      const out = doc.newCel();
      for (const { layer, opacity } of layers) {
        const c = layer.cels[f];
        if (!c || !doc.get(layer.id).visible) continue;
        for (let k = 0; k < out.length; k++) if (c[k] >>> 24) out[k] = blendOver(out[k], c[k], opacity);
      }
      return out;
    });
    doc.insert(merged, parent.id, parent.children.indexOf(top.id) + 1);
    for (const id of list) doc.remove(id);
    doc.activeId = merged.id;
  });
}
