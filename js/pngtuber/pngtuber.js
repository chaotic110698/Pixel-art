// Mode PNGtuber de l'éditeur : aperçu sur fond, bouche à 2 ou 3 états pilotée
// par le micro (Web Audio, 100 % local), clignement, respiration, secousse,
// inclinaison, expressions au clavier (normales ou temporaires).
// Le rendu est assuré par engine.js, partagé avec la fenêtre de capture et
// l'avatar exporté pour OBS.

import { h, clear, pickFile, debounce, downloadBlob, slugify, keepScroll } from '../util/dom.js';
import { openDialog } from '../ui/dialogs.js';
import { icon } from '../ui/icons.js';
import { autoPngtuber } from '../library/character.js';
import { createAvatar } from './engine.js';
import { createEffects, EFFECTS, SCENE_NAMES } from './effects.js';
import { makeImageProvider, avatarExpressions, avatarSettings, initialExpression, avatarProfiles, pngtuberConfig, effectsConfig } from './assets.js';
import { channel } from '../storage/storage.js';
import { captureCombo, formatCombo, keyOwner } from '../ui/keycapture.js';
import { FORMATS, ANCHORS, formatById, applyAnchor, layoutScene } from './formats.js';
import { createDeckLink, deckCatalog } from './decklink.js';

const BACKGROUNDS = [
  ['green', 'Vert', '#00ff00'],
  ['blue', 'Bleu', '#0047bb'],
  ['magenta', 'Magenta', '#ff00ff'],
  ['black', 'Noir', '#000000'],
  ['white', 'Blanc', '#ffffff'],
  ['checker', 'Damier', null],
  ['image', 'Image…', null],
];
// fonds de scène animés, dessinés en pixels par effects.js
const SCENES = Object.entries(SCENE_NAMES).map(([id, name]) => [id, name, null]);

let customBgUrl = null;

export function openPngtuber(app) {
  const doc = app.doc;
  app.selection.commitFloating();
  autoPngtuber(doc);
  // Réglages lus en direct sur doc.pngtuber. Les modifications sont regroupées
  // (après une courte pause) en une seule entrée d'historique annulable.
  let pendingBefore = null;
  const flushCfg = debounce(() => {
    if (!pendingBefore) return;
    const before = pendingBefore;
    const after = { ...doc.pngtuber };
    pendingBefore = null;
    app.history.push({
      label: 'Réglages PNGtuber',
      bytes: 512,
      undo: () => { doc.pngtuber = { ...before }; },
      redo: () => { doc.pngtuber = { ...after }; },
    });
  }, 700);
  const PT_KEYS = ['mouthGroup', 'mouthOpen', 'mouthClosed', 'mouthHalf', 'eyesGroup', 'eyesOpen', 'eyesClosed'];
  const activeProfile = () => (engine ? doc.profiles.find((p) => p.id === engine.state.profile) : null);
  const cfg = new Proxy({}, {
    get: (_, k) => (PT_KEYS.includes(k) ? pngtuberConfig(doc, engine?.state.profile)[k] : doc.pngtuber[k]),
    set: (_, k, v) => {
      // bouche / yeux : si un profil est actif, c'est le profil qui est modifié
      const prof = PT_KEYS.includes(k) ? activeProfile() : null;
      if (prof) {
        app.history.transact('Réglages du profil', () => {
          const p = doc.profiles.find((x) => x.id === prof.id);
          p.pngtuber = { ...(p.pngtuber || {}), [k]: v };
        });
        provider.clear();
        engine.refresh();
        return true;
      }
      if (doc.pngtuber[k] === v) return true;
      if (!pendingBefore) pendingBefore = { ...doc.pngtuber };
      doc.pngtuber[k] = v;
      flushCfg();
      provider.clear();
      engine?.refresh();
      return true;
    },
  });

  const canvas = h('canvas', { 'aria-label': 'Aperçu PNGtuber' });
  const fxBack = h('canvas', { class: 'fx-layer fx-back', 'aria-hidden': 'true' });
  const fxFront = h('canvas', { class: 'fx-layer fx-front', 'aria-hidden': 'true' });
  const fxBg = h('canvas', { class: 'fx-layer fx-bg', 'aria-hidden': 'true' });
  const scene = h('div', { class: 'pt-scene' }, fxBg, fxBack, canvas, fxFront);
  const stage = h('div', { class: 'pt-stage' }, scene);
  const side = h('div', { class: 'pt-side' });
  const wrap = h('div', { class: 'pt-wrap' }, stage, side);
  const provider = makeImageProvider(doc);

  const meterLvl = h('div', { class: 'lvl' });
  const meterThr = h('div', { class: 'thr', title: 'Seuil de parole' });
  const meterThr2 = h('div', { class: 'thr thr2', title: 'Seuil de bouche grande ouverte' });
  const meter = h('div', { class: 'meter', title: 'Volume du micro (rose = parole, violet = grande ouverture)' }, meterLvl, meterThr, meterThr2);
  const micBtn = h('button', { class: 'btn primary', onclick: toggleMic }, icon('mic'), 'Activer le micro');
  const talkBtn = h('button', { class: 'btn', title: 'Maintenir pour simuler la parole (ou touche Espace)' }, 'Maintenir pour parler');
  talkBtn.addEventListener('pointerdown', () => engine.setManualTalk(true));
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) talkBtn.addEventListener(ev, () => engine.setManualTalk(false));

  const fx = createEffects({
    stage: scene,
    scene,
    back: fxBack,
    front: fxFront,
    bg: fxBg,
    background: () => cfg.background,
    avatarCanvas: canvas,
    width: doc.width,
    height: doc.height,
    cfg: () => effectsConfig(doc, engine?.state.profile),
    onTrigger: (id) => channel?.postMessage({ type: 'effect', projectId: doc.id, id }),
  });
  const engine = createAvatar({
    canvas,
    stage: scene,
    fx,
    onBackground: (id) => setBackground(id === 'transparent' ? 'checker' : id),
    background: () => (cfg.background === 'checker' ? 'transparent' : cfg.background || 'green'),
    width: doc.width,
    height: doc.height,
    getImage: provider,
    cfg: (pf) => avatarSettings(doc, pf),
    expressions: () => avatarExpressions(doc),
    profiles: () => avatarProfiles(doc),
    initialExpression: initialExpression(doc),
    initialProfile: null,
    onChange: (s) => {
      channel?.postMessage({ type: 'expression', projectId: doc.id, id: s.expression });
      channel?.postMessage({ type: 'profile', projectId: doc.id, id: s.profile });
      if (lastProfile !== s.profile) {
        lastProfile = s.profile;
        renderSide(); // les sélecteurs bouche/yeux et l'ambiance suivent le profil
      } else renderExprChips();
    },
    onFrame: (s) => {
      meterLvl.style.width = s.level * 100 + '%';
      meterLvl.style.background = s.mouth === 'open' ? 'var(--accent2)' : s.talking ? 'var(--ok)' : 'var(--muted)';
    },
  });

  function groupSelect(key, label, onChange) {
    const sel = h('select', { class: 'input wide' }, h('option', { value: '' }, '— Aucun —'),
      doc.variantGroups().map((g) => h('option', { value: g.id, selected: cfg[key] === g.id, translate: 'no' }, g.name)));
    sel.addEventListener('change', () => { cfg[key] = sel.value || null; onChange(); });
    return h('label', { class: 'field' }, h('span', {}, label), sel);
  }
  function variantSelect(groupKey, key, label, optional = false) {
    const g = doc.get(cfg[groupKey]);
    const sel = h('select', { class: 'input wide' }, h('option', { value: '' }, optional ? '— Aucune —' : '—'),
      (g ? g.children : []).map((cid) => h('option', { value: cid, selected: cfg[key] === cid, translate: 'no' }, doc.get(cid).name)));
    sel.addEventListener('change', () => { cfg[key] = sel.value || null; });
    return h('label', { class: 'field' }, h('span', {}, label), sel);
  }
  const toggle = (key, label, title = '') => h('label', { class: 'chk', title },
    h('input', { type: 'checkbox', checked: !!cfg[key], onchange: (e) => { cfg[key] = e.target.checked; } }), label);

  const exprBox = h('div');
  const profBox = h('div');
  const fxBox = h('div', { class: 'fx-box' });
  const FXN = Object.fromEntries(EFFECTS.map((e) => [e.id, e.name]));
  const fxOf = (kind) => EFFECTS.filter((e) => e.kind === kind);
  /** Modifie les réglages d'effets (une entrée d'historique, comme les autres réglages). */
  function setFx(patch) {
    const base = { ...(doc.pngtuber.effects || {}) };
    if (patch.byExpr && !base.byExpr) base.byExpr = effectsConfig(doc).byExpr;
    cfg.effects = { ...base, ...patch };
    renderFx();
  }
  function setAmbient(list) {
    const prof = activeProfile();
    if (prof) {
      app.history.transact('Ambiance du profil', () => { doc.profiles.find((x) => x.id === prof.id).fxAmbient = list; });
      renderFx();
    } else setFx({ ambient: list });
  }
  const toggleIn = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  let capturing = false;
  let capStop = null;
  /** Noms affichés des effets et des fonds (conflits de touches). */
  const KEY_NAMES = () => ({ ...FXN, ...Object.fromEntries([...BACKGROUNDS, ...SCENES].map(([id, n]) => [id, n])) });
  /** Attend un raccourci (touche ou combinaison) et l'enregistre dans `store` (keys des effets ou bgKeys). */
  async function captureKey(kind, id, btn, onDone) {
    if (capturing) return;
    capturing = true;
    btn.textContent = 'Appuyez sur une touche…';
    capStop = new AbortController();
    const k = await captureCombo((t) => { btn.textContent = t; }, capStop.signal);
    capturing = false;
    if (k === undefined) return;
    if (k === null) return onDone(null);
    if (k) {
      const owner = keyOwner(doc, k, { kind, id }, KEY_NAMES());
      if (owner) { app.toast(`Touche ${formatCombo(k)} déjà utilisée par « ${owner} »`, 2600); return onDone(null); }
    }
    onDone(k);
  }
  function setFxKey(id, k) {
    if (k === null) return renderFx();
    const keys = { ...effectsConfig(doc).keys };
    if (k) keys[id] = k;
    else delete keys[id];
    setFx({ keys });
  }
  function editExprFx(e) {
    const cur = new Set(effectsConfig(doc).byExpr[e.id] || []);
    const box = h('div', { class: 'fx-pick' }, [...fxOf('oneshot'), ...fxOf('ambient'), ...fxOf('transform')].map((x) => h('label', { class: 'chk' },
      h('input', { type: 'checkbox', checked: cur.has(x.id), onchange: (ev) => { if (ev.target.checked) cur.add(x.id); else cur.delete(x.id); } }), x.name)));
    openDialog({
      title: `Effets de « ${e.name} »`,
      body: [h('p', { class: 'hint' }, 'Les effets ponctuels se déclenchent quand l\'expression commence ; les effets d\'ambiance et les transformations durent tant qu\'elle est affichée.'), box],
      buttons: [{ label: 'Annuler', value: null }, { label: 'Valider', primary: true, value: true, action: () => { const by = { ...effectsConfig(doc).byExpr, [e.id]: [...cur] }; if (!cur.size) delete by[e.id]; setFx({ byExpr: by }); } }],
    });
  }
  function renderFx() {
    keepScroll(fxBox, renderFxNow);
  }
  function renderFxNow() {
    clear(fxBox);
    const c = effectsConfig(doc, engine?.state.profile);
    const prof = activeProfile();
    const chipsOf = (list, active, onToggle) => h('div', { class: 'chips' }, list.map((x) => h('button', {
      class: 'chip' + (active.includes(x.id) ? ' on' : ''), 'aria-pressed': String(active.includes(x.id)), onclick: () => onToggle(x.id),
    }, x.name)));
    const intensity = h('div', { class: 'seg' }, [[0.6, 'Douce'], [1, 'Normale'], [1.6, 'Forte']].map(([v, l]) => h('button', { class: c.intensity === v ? 'on' : '', onclick: () => setFx({ intensity: v }) }, l)));
    fxBox.append(
      h('div', { class: 'row' }, h('span', { class: 'small' }, 'Intensité'), intensity),
      h('div', { class: 'fx-sub' }, 'Déclencher (clic) · touche facultative'),
      h('div', { class: 'fx-grid' }, fxOf('oneshot').map((x) => h('div', { class: 'fx-row' },
        h('button', { class: 'btn small grow', onclick: () => fx.trigger(x.id) }, '▶ ', x.name),
        h('button', { class: 'btn small fx-key', title: 'Associer une touche ou une combinaison (ex. Ctrl+Maj+C ; Retour arrière : retirer, Échap : annuler)', 'aria-label': `Touche pour ${x.name}`, onclick: (ev) => captureKey('fx', x.id, ev.currentTarget, (k) => setFxKey(x.id, k)) }, c.keys[x.id] ? h('kbd', {}, formatCombo(c.keys[x.id])) : 'Touche…')))),
      h('div', { class: 'fx-sub' }, prof ? h('span', {}, 'Ambiance en continu · profil ', h('b', { translate: 'no' }, prof.name)) : 'Ambiance en continu'),
      chipsOf(fxOf('ambient'), c.ambient, (id) => setAmbient(toggleIn(c.ambient, id))),
      h('div', { class: 'fx-sub' }, 'Transformations et tenues (le temps de l\'activation)'),
      h('div', { class: 'fx-grid' }, fxOf('transform').map((x) => {
        const on = fx.ambientOn().includes(x.id);
        return h('div', { class: 'fx-row' },
          h('button', { class: 'btn small grow' + (on ? ' primary' : ''), 'aria-pressed': String(on), onclick: () => { fx.trigger(x.id); renderFx(); } }, on ? '■ ' : '▶ ', x.name),
          h('button', { class: 'btn small fx-key', title: 'Associer une touche ou une combinaison (ex. Ctrl+Maj+C ; Retour arrière : retirer, Échap : annuler)', 'aria-label': `Touche pour ${x.name}`, onclick: (ev) => captureKey('fx', x.id, ev.currentTarget, (k) => setFxKey(x.id, k)) }, c.keys[x.id] ? h('kbd', {}, formatCombo(c.keys[x.id])) : 'Touche…'));
      })),
      h('div', { class: 'row' }, h('span', { class: 'small' }, 'Durée'),
        h('div', { class: 'seg' }, [[0, 'Jusqu\'au prochain appui'], [5, '5 s'], [10, '10 s'], [30, '30 s']].map(([v, l]) => h('button', { class: (c.transformDuration || 0) === v ? 'on' : '', onclick: () => setFx({ transformDuration: v }) }, l))),
        h('input', { type: 'number', class: 'input num', min: 0, max: 3600, step: 1, value: c.transformDuration || 0, title: 'Autre durée, en secondes (0 : jusqu\'au prochain appui)', 'aria-label': 'Durée en secondes', onchange: (ev) => setFx({ transformDuration: Math.max(0, Math.min(3600, Math.round(+ev.target.value || 0))) }) })),
      h('p', { class: 'hint' }, 'Sur le Stream Deck, chaque touche peut avoir sa propre durée (ex. Démon pendant 15 s) ou rester active tant qu\'elle est enfoncée.'),
      h('div', { class: 'fx-sub' }, 'Liés à la voix'),
      chipsOf(fxOf('voice'), c.voice, (id) => setFx({ voice: toggleIn(c.voice, id) })),
      h('div', { class: 'fx-sub' }, 'Quand je crie'),
      chipsOf(fxOf('oneshot'), c.shout, (id) => setFx({ shout: toggleIn(c.shout, id) })),
      h('div', { class: 'fx-sub' }, 'Liés aux expressions'),
      doc.expressions.length
        ? h('div', { class: 'fx-exprs' }, doc.expressions.map((e) => h('div', { class: 'fx-row' },
          h('span', { class: 'grow small' }, h('b', { translate: 'no' }, e.name), ' : ', (c.byExpr[e.id] || []).length ? (c.byExpr[e.id] || []).map((id, i) => [i ? ', ' : '', h('span', {}, FXN[id])]) : '—'),
          h('button', { class: 'btn small', onclick: () => editExprFx(e) }, 'Choisir…'))))
        : h('p', { class: 'hint' }, 'Aucune expression : créez-en dans l\'onglet Expressions.'),
      h('p', { class: 'hint' }, 'Les effets apparaissent aussi dans la fenêtre de capture et dans l\'avatar OBS (.html).'),
      h('button', { class: 'btn', onclick: downloadStreamDeck, title: 'Une icône 144 × 144 par effet et par décor, avec la liste de vos touches' }, icon('download'), 'Icônes Stream Deck (ZIP)'));
  }
  let lastProfile = null;
  function renderProfiles() {
    clear(profBox);
    if (!doc.profiles.length) {
      profBox.append(h('p', { class: 'hint' }, 'Aucun profil : créez-en dans l\'onglet Expressions (section Profils) pour changer de tenue ou de personnage avec F13 à F24.'));
      return;
    }
    const cur = engine?.state.profile || null;
    profBox.append(h('div', { class: 'chips' },
      h('button', { class: 'chip' + (!cur ? ' on' : ''), onclick: () => engine.setProfile(null) }, 'Actuel'),
      doc.profiles.map((p) => h('button', { class: 'chip' + (cur === p.id ? ' on' : ''), translate: 'no', onclick: () => engine.setProfile(p.id) },
        p.name, p.key ? h('kbd', { style: { marginLeft: '6px' } }, p.key) : null))));
  }
  function renderExprChips() {
    clear(exprBox);
    const cur = engine?.state.expression || null;
    if (!doc.expressions.length) {
      exprBox.append(h('p', { class: 'hint' }, 'Aucune expression : créez-en dans l\'onglet Expressions.'));
      return;
    }
    exprBox.append(h('div', { class: 'chips' },
      h('button', { class: 'chip' + (!cur ? ' on' : ''), onclick: () => engine.setExpression(null) }, 'Actuel'),
      doc.expressions.map((e) => h('button', { class: 'chip' + (cur === e.id ? ' on' : ''), translate: 'no', title: e.hold ? 'Expression temporaire (touche maintenue)' : '', onclick: () => engine.setExpression(e.id) },
        e.name, e.key ? h('kbd', { style: { marginLeft: '6px' } }, e.key + (e.hold ? ' ⏳' : '')) : null))));
  }

  function renderSide() {
    keepScroll(side, renderSideNow);
  }
  function renderSideNow() {
    clear(side);
    if (!doc.variantGroups().length) {
      side.append(h('p', { class: 'hint', style: { color: 'var(--danger)' } }, 'Ce projet n\'a pas de groupe de variantes : créez un groupe « Bouche » (fermée / ouverte) ou utilisez « Nouveau personnage ».'));
    }
    const bgKeys = doc.pngtuber.bgKeys || {};
    const chip = ([id, label]) => h('button', {
      class: 'chip' + (cfg.background === id ? ' on' : ''),
      onclick: async () => {
        if (id === 'image') {
          const f = await pickFile('image/*');
          if (!f) return;
          if (customBgUrl) URL.revokeObjectURL(customBgUrl);
          customBgUrl = URL.createObjectURL(f);
        }
        setBackground(id);
      },
    }, label, bgKeys[id] ? h('kbd', { style: { marginLeft: '6px' } }, formatCombo(bgKeys[id])) : null);
    const bgRow = h('div', { class: 'chips' }, BACKGROUNDS.map(chip));
    const sceneRow = h('div', { class: 'chips' }, SCENES.map(chip),
      h('button', { class: 'chip', onclick: openBgKeys, title: 'Associer une touche ou une combinaison à chaque fond' }, '⌨ Touches des fonds…'));
    const placeMarkers = () => {
      meterThr.style.left = cfg.threshold * 100 + '%';
      meterThr2.style.left = Math.max(cfg.threshold, cfg.threshold2) * 100 + '%';
      meterThr2.hidden = !avatarSettings(doc, engine?.state.profile).hasHalf;
    };
    const thr = h('input', { type: 'range', min: 1, max: 100, value: Math.round(cfg.threshold * 100), class: 'grow', oninput: (e) => { cfg.threshold = e.target.value / 100; placeMarkers(); } });
    const thr2 = h('input', { type: 'range', min: 1, max: 100, value: Math.round(cfg.threshold2 * 100), class: 'grow', oninput: (e) => { cfg.threshold2 = e.target.value / 100; placeMarkers(); } });
    const blink = h('input', { type: 'number', class: 'input num', 'aria-label': 'Clignement toutes les (s)', min: 0, max: 60, step: 0.5, value: cfg.blinkEvery, onchange: (e) => { cfg.blinkEvery = Math.max(0, parseFloat(e.target.value) || 0); } });
    const blinkDur = h('input', { type: 'number', class: 'input num', 'aria-label': 'Durée du clignement (s)', min: 0.05, max: 2, step: 0.05, value: cfg.blinkDuration, onchange: (e) => { cfg.blinkDuration = Math.max(0.05, parseFloat(e.target.value) || 0.15); } });

    side.append(
      h('h3', {}, 'Fond'), bgRow,
      h('div', { class: 'fx-sub' }, 'Décors animés'), sceneRow,
      h('h3', {}, 'Micro'),
      h('p', { class: 'hint' }, '🔒 Le son est analysé uniquement sur cet appareil : rien n\'est enregistré ni envoyé.'),
      h('div', { class: 'row' }, micBtn, talkBtn),
      h('div', { style: { margin: '8px 0' } }, meter),
      h('label', { class: 'row nowrap' }, h('span', { class: 'small', style: { width: '92px' } }, 'Seuil parole'), thr),
      h('label', { class: 'row nowrap' }, h('span', { class: 'small', style: { width: '92px' } }, 'Grande ouv.'), thr2),
      h('h3', {}, 'Bouche'),
      groupSelect('mouthGroup', 'Groupe de la bouche', () => { autoPick('mouth'); renderSide(); }),
      h('div', { class: 'fields' },
        variantSelect('mouthGroup', 'mouthClosed', 'Fermée (silence)'),
        variantSelect('mouthGroup', 'mouthHalf', 'Entrouverte (voix douce, facultatif)', true),
        variantSelect('mouthGroup', 'mouthOpen', 'Ouverte (voix forte)')),
      h('h3', {}, 'Yeux et clignement'),
      groupSelect('eyesGroup', 'Groupe des yeux', () => { autoPick('eyes'); renderSide(); }),
      h('div', { class: 'fields' }, variantSelect('eyesGroup', 'eyesOpen', 'Ouverts'), variantSelect('eyesGroup', 'eyesClosed', 'Fermés (clignement)')),
      h('div', { class: 'row' }, h('span', { class: 'small' }, 'Cligner toutes les'), blink, h('span', { class: 'small' }, 's (0 = jamais), durée'), blinkDur, h('span', { class: 'small' }, 's')),
      h('h3', {}, 'Animations'),
      toggle('bounce', 'Rebond en parlant'),
      toggle('breathe', 'Respiration au repos'),
      toggle('shake', 'Secousse quand on crie', 'Au-dessus du seuil de grande ouverture, avec une marge'),
      toggle('tilt', 'Inclinaison en parlant'),
      h('h3', {}, 'Effets'),
      fxBox,
      h('h3', {}, 'Profils (tenues, personnages)'),
      profBox,
      h('h3', {}, 'Expressions'),
      exprBox,
      h('p', { class: 'hint' }, 'Touches : F13 à F24 pour les profils, celles associées aux expressions (onglet Expressions > ⋯ > Associer une touche ; « temporaire » = seulement tant que la touche est maintenue). Espace = parler, Échap = quitter.'),
      h('h3', {}, 'Diffusion (OBS)'),
      frameUI(),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: openCapture, title: 'Fenêtre avec seulement l\'avatar, à capturer dans OBS (capture de fenêtre + incrustation chroma)' }, icon('tv'), 'Fenêtre de capture'),
        h('button', { class: 'btn', onclick: exportObs, title: 'Fichier .html autonome à ajouter dans OBS comme source navigateur (fond transparent)' }, icon('download'), 'Avatar OBS (.html)'),
        h('button', { class: 'btn', onclick: () => stage.requestFullscreen?.() }, icon('fit'), 'Plein écran')),
      deckUI(),
      h('p', { class: 'hint' }, 'Fenêtre de capture : elle suit vos changements d\'expression et vos enregistrements. Avatar OBS : ajoutez le fichier comme « Source navigateur » (fichier local) ; le fond est transparent. Pour le micro dans OBS, lancez OBS avec l\'option --use-fake-ui-for-media-stream et ajoutez ?mic=1 à l\'adresse, ou cliquez sur « Interagir ».'),
      h('div', { class: 'row', style: { marginTop: '8px' } },
        h('button', { class: 'btn', onclick: () => app.actions.exportDialog('pngtuber') }, icon('download'), 'Images pour logiciels PNGtuber')));
    placeMarkers();
    renderProfiles();
    renderExprChips();
    renderFx();
    micBtn.replaceChildren(icon('mic'), engine.state.stream ? 'Couper le micro' : 'Activer le micro');
    micBtn.classList.toggle('primary', !engine.state.stream);
  }

  /** Cadre de diffusion : format de la scène, taille et position de l'avatar. */
  function frameUI() {
    const fmt = h('select', { class: 'input wide', 'aria-label': 'Format de la scène' },
      FORMATS.map((f) => h('option', { value: f.id, selected: (cfg.format || 'free') === f.id }, f.name)));
    fmt.addEventListener('change', () => { cfg.format = fmt.value; layoutFrame(); broadcastFrame(); });
    const fillPct = Math.round((cfg.fill > 0 ? cfg.fill : 0.92) * 100);
    const fillOut = h('span', { class: 'small', style: { width: '44px' } }, fillPct + ' %');
    const fill = h('input', {
      type: 'range', min: 20, max: 100, value: fillPct, class: 'grow', 'aria-label': 'Taille de l\'avatar dans le cadre',
      oninput: (e) => { fillOut.textContent = e.target.value + ' %'; cfg.fill = e.target.value / 100; },
      onchange: () => broadcastFrame(),
    });
    const anchors = h('div', { class: 'chips' }, ANCHORS.map((a) => h('button', {
      class: 'chip' + ((cfg.anchor || 'bottom') === a.id ? ' on' : ''),
      onclick: () => { cfg.anchor = a.id; applyAnchor(scene, a.id); broadcastFrame(); renderSide(); },
    }, a.name)));
    return h('div', { class: 'fields' },
      h('label', { class: 'field' }, h('span', {}, 'Format de la scène (taille capturée)'), fmt),
      h('label', { class: 'row nowrap' }, h('span', { class: 'small', style: { width: '92px' } }, 'Taille avatar'), fill, fillOut),
      h('div', {}, h('span', { class: 'small' }, 'Position de l\'avatar'), anchors));
  }
  function layoutFrame() {
    layoutScene(stage, scene, cfg.format || 'free');
    applyAnchor(scene, cfg.anchor || 'bottom');
    stage.classList.toggle('framed', (cfg.format || 'free') !== 'free');
    engine?.refresh();
  }
  function broadcastFrame() {
    channel?.postMessage({ type: 'frame', projectId: doc.id, format: cfg.format || 'free', fill: cfg.fill || 0, anchor: cfg.anchor || 'bottom' });
  }

  /** Change de fond (bouton, touche) et prévient la fenêtre de capture. */
  // ---------- plugin Stream Deck (pilotage même quand un jeu est au premier plan) ----------
  let deck = null;
  let deckStatus = null;
  let deckUpdate = null;
  let deckLatest = null; // version du plugin publiée avec le site (stream-deck/version.json)
  /** Version a plus ancienne que b (« 1.1.0 » < « 1.2.0 »). */
  const olderThan = (a, b) => { const pa = a.split('.').map(Number), pb = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0); return false; };
  function showDeckStatus() {
    if (deckStatus) deckStatus.textContent = deckText();
    // plugin connecté plus ancien que celui du site (la 1.1 n'annonce pas sa version)
    const old = !!(deck?.connected && deckLatest && olderThan(deck.plugin?.version || '1.1.0', deckLatest));
    if (deckUpdate) deckUpdate.hidden = !old;
  }
  const deckText = () => (!cfg.deck ? '' : deck?.connected ? 'Plugin connecté' : 'En attente du plugin (logiciel Stream Deck lancé ?)');
  function syncDeck() {
    if (cfg.deck && !deck) {
      deck = createDeckLink({
        name: () => doc.name,
        catalog: () => deckCatalog({ expressions: avatarExpressions(doc), profiles: avatarProfiles(doc), effects: EFFECTS.filter((e) => e.kind !== 'voice'), scenes: SCENE_NAMES }),
        state: () => engine.snapshot(),
        onCommand: (c) => engine.command(c),
        onStatus: () => setTimeout(showDeckStatus, 300), // laisse le temps au plugin d'annoncer sa version
        onPlugin: showDeckStatus,
      });
      if (!deckLatest) fetch('stream-deck/version.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((v) => { deckLatest = v?.version || null; showDeckStatus(); }).catch(() => {});
    } else if (!cfg.deck && deck) {
      deck.close();
      deck = null;
    }
    showDeckStatus();
  }
  function deckUI() {
    deckStatus = h('span', { class: 'small muted' }, deckText());
    deckUpdate = h('p', { class: 'hint warn-text', hidden: true }, 'Une nouvelle version du plugin est disponible : téléchargez-la et double-cliquez sur le fichier pour l\'installer par-dessus (vos touches sont conservées). Ensuite, le plugin proposera lui-même ses mises à jour.');
    queueMicrotask(showDeckStatus);
    return h('div', { class: 'deck-box' },
      h('div', { class: 'row' },
        h('label', { class: 'chk', title: 'Le plugin Stream Deck « Pixel Atelier » pilote l\'avatar (expressions, effets, fonds, profils, parler) même quand un jeu est au premier plan' },
          h('input', { type: 'checkbox', checked: !!cfg.deck, onchange: (e) => { cfg.deck = e.target.checked; syncDeck(); } }), 'Plugin Stream Deck'),
        deckStatus),
      deckUpdate,
      h('div', { class: 'row' },
        h('a', { class: 'btn', href: 'stream-deck/com.pixelatelier.avatar.streamDeckPlugin', download: 'com.pixelatelier.avatar.streamDeckPlugin', title: 'Plugin pour le logiciel Stream Deck (Windows, Mac) : double-cliquez sur le fichier pour l\'installer' }, icon('download'), 'Télécharger le plugin Stream Deck')),
      h('p', { class: 'hint' }, 'Installez le plugin (double-clic sur le fichier), cochez « Plugin Stream Deck », puis glissez les actions Pixel Atelier (Expression, Effet, Fond, Profil, Parler) sur vos touches. La fenêtre de capture et l\'avatar OBS (.html) se connectent aussi au plugin : les touches marchent même quand le jeu est au premier plan.'));
  }

  function setBackground(id) {
    if (id === 'image' && !customBgUrl) return;
    cfg.background = id;
    applyBg();
    renderSide();
    channel?.postMessage({ type: 'background', projectId: doc.id, id });
  }
  function openBgKeys() {
    const body = h('div');
    const render = () => {
      const keys = doc.pngtuber.bgKeys || {};
      clear(body);
      body.append(h('p', { class: 'hint' }, 'Associez une touche (ex. B) ou une combinaison (ex. Ctrl+Maj+1) à chaque fond. Elles marchent dans le mode PNGtuber, la fenêtre de capture et l\'avatar OBS (.html). Retour arrière : retirer, Échap : annuler.'),
        h('div', { class: 'fx-grid' }, [...BACKGROUNDS.filter(([id]) => id !== 'image'), ...SCENES].map(([id, label]) => h('div', { class: 'fx-row' },
          h('span', { class: 'grow' }, label),
          h('button', {
            class: 'btn small fx-key', 'aria-label': `Touche pour ${label}`,
            onclick: (ev) => captureKey('bg', id, ev.currentTarget, (k) => {
              if (k !== null) {
                const next = { ...(doc.pngtuber.bgKeys || {}) };
                if (k) next[id] = k;
                else delete next[id];
                cfg.bgKeys = next;
              }
              render();
              renderSide();
            }),
          }, keys[id] ? h('kbd', {}, formatCombo(keys[id])) : 'Touche…')))));
    };
    render();
    openDialog({ title: 'Touches des fonds', wide: true, body, buttons: [{ label: 'Fermer', primary: true, value: true }] });
  }

  function autoPick(which) {
    const g = doc.get(cfg[which + 'Group']);
    cfg[which + 'Open'] = null;
    cfg[which + 'Closed'] = null;
    if (which === 'mouth') cfg.mouthHalf = null;
    if (!g) return;
    const kids = g.children.map((id) => doc.get(id));
    const find = (st, rx) => kids.find((c) => c.part?.state === st)?.id || kids.find((c) => rx.test(c.name))?.id || null;
    cfg[which + 'Open'] = find('open', /ouvert|open/i) || g.children[g.children.length - 1];
    cfg[which + 'Closed'] = find('closed', /ferm|closed/i) || g.children[0];
    if (which === 'mouth') cfg.mouthHalf = find('half', /entrouv|half/i);
  }

  function applyBg() {
    // le fond est peint dans le cadre (scene) ; autour, la zone d'aperçu reste sombre
    if (SCENE_NAMES[cfg.background]) {
      scene.style.background = '#000';
      scene.style.backgroundImage = '';
      return;
    }
    const bg = BACKGROUNDS.find((b) => b[0] === cfg.background) || BACKGROUNDS[0];
    scene.style.background = '';
    scene.style.backgroundImage = '';
    if (bg[0] === 'checker') scene.style.background = 'repeating-conic-gradient(#888 0% 25%, #bbb 0% 50%) 0 0 / 24px 24px';
    else if (bg[0] === 'image' && customBgUrl) {
      scene.style.backgroundImage = `url(${customBgUrl})`;
      scene.style.backgroundSize = 'cover';
      scene.style.backgroundPosition = 'center';
    } else scene.style.background = bg[2] || '#00ff00';
  }

  async function toggleMic() {
    if (engine.state.stream) engine.stopMic();
    else {
      try {
        await engine.startMic();
        app.toast('Micro activé (traitement local)');
      } catch (err) {
        app.toast('Micro indisponible : ' + (err.message || err), 3000);
      }
    }
    renderSide();
  }

  async function openCapture() {
    flushCfg.flush();
    await app.storage?.saveNow();
    const bg = ['green', 'blue', 'magenta', 'black', 'white'].includes(cfg.background) || SCENE_NAMES[cfg.background] ? cfg.background : 'green';
    const f = formatById(cfg.format || 'free');
    const dpr = window.devicePixelRatio || 1;
    const ww = f.w ? Math.round(f.w / dpr) : 520, wh = f.h ? Math.round(f.h / dpr) : 560;
    const w = window.open(`capture.html?project=${encodeURIComponent(doc.id)}&bg=${bg}&fmt=${f.id}`, 'pixel-atelier-capture', `width=${ww},height=${wh}`);
    if (!w) app.toast('Fenêtre bloquée : autorisez les fenêtres pop-up pour ce site', 3500);
  }

  async function downloadStreamDeck() {
    const { streamDeckZip } = await import('./streamdeck.js');
    downloadBlob(await streamDeckZip(doc), 'pixel-atelier_icones_stream_deck.zip');
    app.toast('Icônes Stream Deck téléchargées');
  }

  async function exportObs() {
    const { buildStandaloneAvatar } = await import('./standalone.js');
    const html = await buildStandaloneAvatar(doc);
    downloadBlob(new Blob([html], { type: 'text/html' }), `${slugify(doc.name)}_avatar_obs.html`);
    app.toast('Avatar OBS exporté');
  }

  app.pngtuberOpen = true;
  const detachKeys = engine.attachKeys(window);
  const d = openDialog({
    title: `Mode PNGtuber — ${doc.name}`,
    full: true,
    body: wrap,
    onClose: () => {
      deck?.close();
      ro?.disconnect();
      capStop?.abort();
      flushCfg.flush();
      engine.stop();
      detachKeys();
      app.pngtuberOpen = false;
    },
  });
  d.el.querySelector('.dlg-body').style.overflow = 'hidden';
  const ro = new ResizeObserver(() => layoutFrame());
  ro.observe(stage);
  layoutFrame();
  applyBg();
  renderSide();
  engine.start();
  syncDeck();
}
