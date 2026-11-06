// Modèle de document : arbre de nœuds (calques et groupes), images (frames),
// expressions, réglages de grille et palette. Aucune dépendance au DOM.
//
// - Les enfants d'un groupe sont rangés du BAS vers le HAUT (ordre de rendu).
// - Un calque possède un tableau `cels` : un Uint32Array (w*h, 0xAABBGGRR) par frame.
// - Un groupe « variantes » (variant: true) n'affiche que l'enfant `active`.

let counter = 0;
export function uid(prefix = 'n') {
  counter = (counter + 1) % 1e6;
  return prefix + Date.now().toString(36) + counter.toString(36) + Math.random().toString(36).slice(2, 5);
}

export function defaultGrid() {
  return {
    visible: false,
    cellW: 8,
    cellH: 8,
    offsetX: 0,
    offsetY: 0,
    majorEvery: 4,
    color: '#7f8cff',
    majorColor: '#ff5ab4',
    thickness: 1,
    majorThickness: 2,
    opacity: 0.45,
    snap: false,
    pixelGrid: true,
  };
}

export function defaultPngtuber() {
  return {
    background: 'green',
    customBg: null,
    threshold: 0.12,
    blinkEvery: 4,
    blinkDuration: 0.15,
    mouthGroup: null,
    mouthOpen: null,
    mouthClosed: null,
    mouthHalf: null, // bouche entrouverte (facultative) : parole à faible volume
    threshold2: 0.4, // au-dessus : bouche grande ouverte
    breathe: true,
    shake: true,
    tilt: false,
    eyesGroup: null,
    eyesOpen: null,
    eyesClosed: null,
    bounce: true,
    scale: 0,
  };
}

export class Doc {
  constructor(width = 32, height = 32, name = 'Sans titre') {
    this.id = uid('p');
    this.name = name;
    this.width = width;
    this.height = height;
    this.nodes = new Map();
    this.root = this._mkGroup('root', 'root');
    this.root.parent = null;
    this.nodes.set('root', this.root);
    this.frames = [{ duration: 100 }];
    this.frame = 0;
    this.fps = 8;
    this.tags = []; // balises d'animation : { id, name, from, to, color }
    this.activeId = null;
    this.expressions = [];
    this.grid = defaultGrid();
    this.palette = null; // tableau de hex, initialisé par l'app
    this.charColors = null; // couleurs de personnage (bibliothèque)
    this.pngtuber = defaultPngtuber();
    this.created = Date.now();
    this.updated = Date.now();
  }

  _mkGroup(id, name) {
    return { id, type: 'group', name, visible: true, locked: false, opacity: 1, children: [], variant: false, active: null, collapsed: false, parent: null, role: null };
  }

  get size() {
    return this.width * this.height;
  }

  get(id) {
    return this.nodes.get(id) || null;
  }

  get active() {
    return this.get(this.activeId);
  }

  get activeLayer() {
    const n = this.active;
    return n && n.type === 'layer' ? n : null;
  }

  newCel() {
    return new Uint32Array(this.width * this.height);
  }

  createLayer(name = 'Calque', opts = {}) {
    const layer = {
      id: uid('l'),
      type: 'layer',
      name,
      visible: true,
      locked: false,
      opacity: 1,
      reference: false,
      part: null,
      parent: null,
      cels: this.frames.map(() => this.newCel()),
      ...opts,
    };
    return layer;
  }

  createGroup(name = 'Groupe', opts = {}) {
    return { ...this._mkGroup(uid('g'), name), ...opts };
  }

  /** Insère un nœud (et ses descendants déjà construits) dans un groupe. */
  insert(node, parentId = 'root', index = null) {
    const parent = this.get(parentId) || this.root;
    this.nodes.set(node.id, node);
    node.parent = parent.id;
    if (index === null || index > parent.children.length) parent.children.push(node.id);
    else parent.children.splice(Math.max(0, index), 0, node.id);
    if (parent.variant && !parent.active) parent.active = node.id;
    return node;
  }

  /** Ajoute un nœud enfant à un groupe pas encore inséré (construction d'arbres). */
  adopt(group, node) {
    this.nodes.set(node.id, node);
    node.parent = group.id;
    group.children.push(node.id);
    if (group.variant && !group.active) group.active = node.id;
    return node;
  }

  remove(id) {
    const node = this.get(id);
    if (!node || id === 'root') return;
    const parent = this.get(node.parent);
    if (parent) {
      const i = parent.children.indexOf(id);
      if (i >= 0) parent.children.splice(i, 1);
      if (parent.variant && parent.active === id) parent.active = parent.children[Math.min(i, parent.children.length - 1)] || null;
    }
    const drop = (n) => {
      this.nodes.delete(n.id);
      if (n.type === 'group') for (const cid of n.children) {
        const c = this.get(cid);
        if (c) drop(c);
      }
    };
    drop(node);
    for (const e of this.expressions) delete e.states[id];
    if (this.activeId && !this.nodes.has(this.activeId)) this.activeId = null;
  }

  /** Déplace un nœud vers parentId à l'index donné (index dans le nouveau parent). */
  move(id, parentId, index) {
    const node = this.get(id);
    const target = this.get(parentId);
    if (!node || !target || target.type !== 'group') return false;
    // interdit de déplacer un groupe dans ses propres descendants
    for (let p = target; p; p = this.get(p.parent)) if (p.id === id) return false;
    const old = this.get(node.parent);
    const oi = old.children.indexOf(id);
    old.children.splice(oi, 1);
    if (old.variant && old.active === id) old.active = old.children[0] || null;
    if (old === target && index > oi) index--;
    node.parent = target.id;
    target.children.splice(Math.max(0, Math.min(index, target.children.length)), 0, id);
    if (target.variant && !target.active) target.active = id;
    return true;
  }

  indexOf(id) {
    const n = this.get(id);
    if (!n) return -1;
    return this.get(n.parent).children.indexOf(id);
  }

  ancestors(node) {
    const out = [];
    for (let p = this.get(node.parent); p && p.id !== 'root'; p = this.get(p.parent)) out.push(p);
    return out;
  }

  /** Parcours en profondeur (bas → haut). */
  walk(fn, group = this.root, depth = 0) {
    for (const cid of group.children) {
      const n = this.get(cid);
      if (!n) continue;
      fn(n, depth, group);
      if (n.type === 'group') this.walk(fn, n, depth + 1);
    }
  }

  allLayers() {
    const out = [];
    this.walk((n) => n.type === 'layer' && out.push(n));
    return out;
  }

  variantGroups() {
    const out = [];
    this.walk((n) => n.type === 'group' && n.variant && out.push(n));
    return out;
  }

  /**
   * Liste des calques à composer, du bas vers le haut, avec opacité effective.
   * opts.overrides : Map/objet groupId -> enfant actif (pour aperçus/exports)
   * opts.includeReference : inclure les calques de référence
   * opts.root : nœud de départ (pour rendre un sous-arbre)
   * opts.ignoreVisibility : rendre même les nœuds masqués (export de variantes)
   */
  renderList(opts = {}) {
    const { overrides = null, includeReference = true, root = this.root, ignoreVisibility = false } = opts;
    const ov = overrides instanceof Map ? overrides : overrides ? new Map(Object.entries(overrides)) : null;
    const out = [];
    const visit = (n, opacity) => {
      if (!ignoreVisibility && !n.visible) return;
      const op = opacity * (n.opacity ?? 1);
      if (n.type === 'layer') {
        if (n.reference && !includeReference) return;
        out.push({ layer: n, opacity: op });
        return;
      }
      if (n.variant) {
        const act = (ov && ov.has(n.id) ? ov.get(n.id) : n.active) || null;
        const c = act && this.get(act);
        if (c && c.parent === n.id) visit(c, op);
        return;
      }
      for (const cid of n.children) {
        const c = this.get(cid);
        if (c) visit(c, op);
      }
    };
    if (root.type === 'layer') visit(root, 1);
    else if (root === this.root) for (const cid of root.children) visit(this.get(cid), 1);
    else visit(root, 1);
    return out;
  }

  /** Visibilité effective (prend en compte parents et groupes de variantes). */
  isShown(node) {
    if (!node) return false;
    if (!node.visible) return false;
    let child = node;
    for (let p = this.get(node.parent); p; child = p, p = this.get(p.parent)) {
      if (!p.visible) return false;
      if (p.variant && p.active !== child.id) return false;
    }
    return true;
  }

  isLocked(node) {
    for (let n = node; n; n = this.get(n.parent)) if (n.locked) return true;
    return false;
  }

  cel(layer, frame = this.frame) {
    if (!layer || layer.type !== 'layer') return null;
    let c = layer.cels[frame];
    if (!c) c = layer.cels[frame] = this.newCel();
    return c;
  }

  // ---------- Instantanés de structure (historique) ----------
  // Les tableaux de pixels sont PARTAGÉS par référence : seules les opérations qui
  // remplacent un tableau (fusion, redimensionnement...) passent par ce mécanisme,
  // les modifications de pixels en place passent par des patchs rectangulaires.
  snapshot() {
    const nodes = [];
    for (const n of this.nodes.values()) {
      const c = { ...n };
      if (n.type === 'group') c.children = [...n.children];
      else c.cels = [...n.cels];
      if (n.part) c.part = { ...n.part };
      nodes.push(c);
    }
    return {
      width: this.width,
      height: this.height,
      nodes,
      activeId: this.activeId,
      frames: this.frames.map((f) => ({ ...f })),
      frame: this.frame,
      tags: this.tags.map((t) => ({ ...t })),
      expressions: JSON.parse(JSON.stringify(this.expressions)),
      charColors: this.charColors ? { ...this.charColors } : null,
      // métadonnées légères, annulables elles aussi
      name: this.name,
      fps: this.fps,
      grid: { ...this.grid },
      palette: this.palette ? [...this.palette] : null,
      pngtuber: { ...this.pngtuber },
    };
  }

  restore(s) {
    this.width = s.width;
    this.height = s.height;
    this.nodes = new Map();
    for (const n of s.nodes) {
      const c = { ...n };
      if (n.type === 'group') c.children = [...n.children];
      else c.cels = [...n.cels];
      if (n.part) c.part = { ...n.part };
      this.nodes.set(c.id, c);
    }
    this.root = this.nodes.get('root');
    this.activeId = s.activeId;
    this.frames = s.frames.map((f) => ({ ...f }));
    this.frame = Math.min(s.frame, this.frames.length - 1);
    if (s.tags) this.tags = s.tags.map((t) => ({ ...t }));
    this.expressions = JSON.parse(JSON.stringify(s.expressions));
    this.charColors = s.charColors ? { ...s.charColors } : null;
    if (s.name !== undefined) this.name = s.name;
    if (s.fps !== undefined) this.fps = s.fps;
    if (s.grid) this.grid = { ...s.grid };
    if (s.palette !== undefined) this.palette = s.palette ? [...s.palette] : null;
    if (s.pngtuber) this.pngtuber = { ...s.pngtuber };
  }

  /** Premier calque éditable trouvé (pour définir un calque actif par défaut). */
  firstLayer() {
    const ls = this.allLayers();
    return ls[ls.length - 1] || null;
  }

  /** Chemin lisible « Groupe / Sous-groupe / Calque ». */
  pathName(node) {
    return [...this.ancestors(node).reverse().map((a) => a.name), node.name].join(' / ');
  }
}
