// Objet application central : état de l'éditeur, document courant et services.
// Les modules UI reçoivent `app` et communiquent via ses évènements :
//   'doc' (nouveau document), 'structure' (arbre de calques), 'changed' (toute
//   modification), 'pixels', 'history', 'tool', 'color', 'selection', 'frame',
//   'viewport', 'hover', 'grid', 'state', 'rendered'.

import { Emitter } from './util/emitter.js';
import { Doc } from './core/doc.js';
import { History } from './core/history.js';
import { Selection } from './core/selection.js';
import { Viewport } from './render/viewport.js';
import { Renderer } from './render/renderer.js';
import { markDirty } from './render/celcache.js';
import { Tools } from './tools/index.js';
import { Input } from './ui/input.js';
import { hexToU32, normHex } from './util/color.js';
import { presetById } from './core/palettes.js';
import { debounce } from './util/dom.js';

const PREFS_KEY = 'pixelatelier.prefs.v1';

export const DEFAULT_STATE = {
  tool: 'pencil',
  primary: '#1a1c2c',
  secondary: '#ffffff',
  brushSize: 1,
  shapeSize: 1,
  brushShape: 'square',
  dither: false,
  ditherPattern: 'checker',
  ditherSecond: 'transparent',
  symmetry: 'none',
  symX: null,
  symY: null,
  shapeFill: false,
  fillContiguous: true,
  fillSampleAll: false,
  fillTolerance: 0,
  pickerSampleAll: true,
  pickerReturn: false,
  selectMode: 'replace',
  wandContiguous: true,
  wandSampleAll: false,
  tileMode: false,
  tileWrap: true,
  tileDim: 0.75,
  onion: false,
  loopOnion: false,
  showPixelGrid: true,
  wheelPans: false,
  theme: 'dark',
  recent: [],
  tutorialDone: false,
  exportScale: 8,
  lastPalette: 'endesga32',
};

export class App extends Emitter {
  constructor() {
    super();
    this.state = { ...DEFAULT_STATE, ...loadPrefs() };
    this.state.tileMode = false;
    this.doc = new Doc(32, 32);
    this.doc.palette = [...presetById(this.state.lastPalette).colors];
    this.history = new History(this);
    this.selection = new Selection(this);
    this.viewport = new Viewport(this);
    this.renderer = null;
    this.tools = null;
    this.input = null;
    this.clipboard = null;
    this.savePrefs = debounce(() => {
      try {
        const { tileMode, ...rest } = this.state;
        void tileMode;
        localStorage.setItem(PREFS_KEY, JSON.stringify(rest));
      } catch (_) { /* stockage indisponible */ }
    }, 400);
    this.on('state', () => this.savePrefs());
  }

  init(canvas) {
    this.renderer = new Renderer(this, canvas);
    this.tools = new Tools(this);
    this.input = new Input(this, canvas);
    const t = this.tools.get(this.state.tool);
    if (t) this.tools.current = t;
    this.renderer.resize();
    this.viewport.fit();
  }

  setDoc(doc, { fit = true } = {}) {
    this.selection.floating = null;
    this.selection.mask = null;
    this.selection.bounds = null;
    this.doc = doc;
    if (!doc.palette || !doc.palette.length) doc.palette = [...presetById(this.state.lastPalette).colors];
    if (!doc.activeId || !doc.get(doc.activeId)) doc.activeId = doc.firstLayer()?.id || null;
    this.history.clear();
    this.renderer.ensureBuffers();
    this.renderer.invalidateAll();
    if (fit) this.viewport.fit();
    this.emit('doc', doc);
    this.emit('structure');
    this.emit('selection');
    this.emit('frame');
    this.emit('grid');
  }

  setState(patch) {
    Object.assign(this.state, patch);
    this.emit('state', patch);
    this.renderer?.requestRender();
  }

  // ---------- Couleurs ----------
  colorU32(which = 'primary') {
    return hexToU32(this.state[which]);
  }

  setColor(which, hex) {
    this.state[which] = normHex(hex);
    this.emit('color');
    this.emit('state');
  }

  swapColors() {
    const { primary, secondary } = this.state;
    this.state.primary = secondary;
    this.state.secondary = primary;
    this.emit('color');
    this.emit('state');
  }

  useColor(hex = this.state.primary) {
    const r = this.state.recent.filter((c) => c !== hex);
    r.unshift(hex);
    this.state.recent = r.slice(0, 16);
    this.emit('recent');
    this.emit('state');
  }

  // ---------- Calques ----------
  /** Calque actif s'il est modifiable, sinon message et null. */
  editableLayer({ silent = false } = {}) {
    const doc = this.doc;
    const n = doc.active;
    const say = (m) => !silent && this.toast(m, 1600);
    if (!n) return say('Aucun calque sélectionné'), null;
    if (n.type !== 'layer') return say('Sélectionnez un calque (pas un groupe)'), null;
    if (doc.isLocked(n)) return say('Calque verrouillé 🔒'), null;
    if (!doc.isShown(n)) return say('Calque masqué : rendez-le visible pour dessiner'), null;
    return n;
  }

  markLayerDirty(cel, x0 = 0, y0 = 0, x1 = Infinity, y1 = Infinity) {
    markDirty(cel, x0, y0, x1, y1);
    this.renderer.invalidate(x0, y0, x1, y1);
    this.emitPixels();
  }

  emitPixels = debounce(() => this.emit('pixels'), 250);

  /** Appelé avant annuler/rétablir : pose les contenus flottants, stoppe les outils. */
  beforeHistoryJump() {
    this.tools?.current?.cancel?.();
    if (this.selection.floating) this.selection.commitFloating();
  }

  // ---------- Grille ----------
  gridSnapOn() {
    return !!this.doc.grid.snap;
  }

  snapPoint(x, y) {
    const g = this.doc.grid;
    const cw = Math.max(1, g.cellW), ch = Math.max(1, g.cellH);
    return [
      Math.round((x - g.offsetX) / cw) * cw + g.offsetX,
      Math.round((y - g.offsetY) / ch) * ch + g.offsetY,
    ];
  }

  // ---------- Divers ----------
  toast(msg, ms = 1800) {
    this.emit('toast', msg, ms);
  }
}

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  } catch (_) {
    return {};
  }
}
