// Mode PNGtuber de l'éditeur : aperçu sur fond, bouche à 2 ou 3 états pilotée
// par le micro (Web Audio, 100 % local), clignement, respiration, secousse,
// inclinaison, expressions au clavier (normales ou temporaires).
// Le rendu est assuré par engine.js, partagé avec la fenêtre de capture et
// l'avatar exporté pour OBS.

import { h, clear, pickFile, debounce, downloadBlob, slugify } from '../util/dom.js';
import { openDialog } from '../ui/dialogs.js';
import { icon } from '../ui/icons.js';
import { autoPngtuber } from '../library/character.js';
import { createAvatar } from './engine.js';
import { makeImageProvider, avatarExpressions, avatarSettings, initialExpression } from './assets.js';
import { channel } from '../storage/storage.js';

const BACKGROUNDS = [
  ['green', 'Vert', '#00ff00'],
  ['blue', 'Bleu', '#0047bb'],
  ['magenta', 'Magenta', '#ff00ff'],
  ['black', 'Noir', '#000000'],
  ['white', 'Blanc', '#ffffff'],
  ['checker', 'Damier', null],
  ['image', 'Image…', null],
];

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
  const cfg = new Proxy({}, {
    get: (_, k) => doc.pngtuber[k],
    set: (_, k, v) => {
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
  const stage = h('div', { class: 'pt-stage' }, canvas);
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

  const engine = createAvatar({
    canvas,
    stage,
    width: doc.width,
    height: doc.height,
    getImage: provider,
    cfg: () => avatarSettings(doc),
    expressions: () => avatarExpressions(doc),
    initialExpression: initialExpression(doc),
    onChange: (s) => {
      channel?.postMessage({ type: 'expression', projectId: doc.id, id: s.expression });
      renderExprChips();
    },
    onFrame: (s) => {
      meterLvl.style.width = s.level * 100 + '%';
      meterLvl.style.background = s.mouth === 'open' ? 'var(--accent2)' : s.talking ? 'var(--ok)' : 'var(--muted)';
    },
  });

  function groupSelect(key, label, onChange) {
    const sel = h('select', { class: 'input wide' }, h('option', { value: '' }, '— Aucun —'),
      doc.variantGroups().map((g) => h('option', { value: g.id, selected: cfg[key] === g.id }, g.name)));
    sel.addEventListener('change', () => { cfg[key] = sel.value || null; onChange(); });
    return h('label', { class: 'field' }, h('span', {}, label), sel);
  }
  function variantSelect(groupKey, key, label, optional = false) {
    const g = doc.get(cfg[groupKey]);
    const sel = h('select', { class: 'input wide' }, h('option', { value: '' }, optional ? '— Aucune —' : '—'),
      (g ? g.children : []).map((cid) => h('option', { value: cid, selected: cfg[key] === cid }, doc.get(cid).name)));
    sel.addEventListener('change', () => { cfg[key] = sel.value || null; });
    return h('label', { class: 'field' }, h('span', {}, label), sel);
  }
  const toggle = (key, label, title = '') => h('label', { class: 'chk', title },
    h('input', { type: 'checkbox', checked: !!cfg[key], onchange: (e) => { cfg[key] = e.target.checked; } }), label);

  const exprBox = h('div');
  function renderExprChips() {
    clear(exprBox);
    const cur = engine?.state.expression || null;
    if (!doc.expressions.length) {
      exprBox.append(h('p', { class: 'hint' }, 'Aucune expression : créez-en dans l\'onglet Expressions.'));
      return;
    }
    exprBox.append(h('div', { class: 'chips' },
      h('button', { class: 'chip' + (!cur ? ' on' : ''), onclick: () => engine.setExpression(null) }, 'Actuel'),
      doc.expressions.map((e) => h('button', { class: 'chip' + (cur === e.id ? ' on' : ''), title: e.hold ? 'Expression temporaire (touche maintenue)' : '', onclick: () => engine.setExpression(e.id) },
        e.name, e.key ? h('kbd', { style: { marginLeft: '6px' } }, e.key + (e.hold ? ' ⏳' : '')) : null))));
  }

  function renderSide() {
    clear(side);
    if (!doc.variantGroups().length) {
      side.append(h('p', { class: 'hint', style: { color: 'var(--danger)' } }, 'Ce projet n\'a pas de groupe de variantes : créez un groupe « Bouche » (fermée / ouverte) ou utilisez « Nouveau personnage ».'));
    }
    const bgRow = h('div', { class: 'chips' }, BACKGROUNDS.map(([id, label]) => h('button', {
      class: 'chip' + (cfg.background === id ? ' on' : ''),
      onclick: async () => {
        if (id === 'image') {
          const f = await pickFile('image/*');
          if (!f) return;
          if (customBgUrl) URL.revokeObjectURL(customBgUrl);
          customBgUrl = URL.createObjectURL(f);
        }
        cfg.background = id;
        applyBg();
        renderSide();
      },
    }, label)));
    const placeMarkers = () => {
      meterThr.style.left = cfg.threshold * 100 + '%';
      meterThr2.style.left = Math.max(cfg.threshold, cfg.threshold2) * 100 + '%';
      meterThr2.hidden = !avatarSettings(doc).hasHalf;
    };
    const thr = h('input', { type: 'range', min: 1, max: 100, value: Math.round(cfg.threshold * 100), class: 'grow', oninput: (e) => { cfg.threshold = e.target.value / 100; placeMarkers(); } });
    const thr2 = h('input', { type: 'range', min: 1, max: 100, value: Math.round(cfg.threshold2 * 100), class: 'grow', oninput: (e) => { cfg.threshold2 = e.target.value / 100; placeMarkers(); } });
    const blink = h('input', { type: 'number', class: 'input num', min: 0, max: 60, step: 0.5, value: cfg.blinkEvery, onchange: (e) => { cfg.blinkEvery = Math.max(0, parseFloat(e.target.value) || 0); } });
    const blinkDur = h('input', { type: 'number', class: 'input num', min: 0.05, max: 2, step: 0.05, value: cfg.blinkDuration, onchange: (e) => { cfg.blinkDuration = Math.max(0.05, parseFloat(e.target.value) || 0.15); } });

    side.append(
      h('h3', {}, 'Fond'), bgRow,
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
      h('h3', {}, 'Expressions'),
      exprBox,
      h('p', { class: 'hint' }, 'Touches : celles associées aux expressions (onglet Expressions > ⋯ > Associer une touche ; « temporaire » = seulement tant que la touche est maintenue). Espace = parler, Échap = quitter.'),
      h('h3', {}, 'Diffusion (OBS)'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: openCapture, title: 'Fenêtre avec seulement l\'avatar, à capturer dans OBS (capture de fenêtre + incrustation chroma)' }, icon('tv'), 'Fenêtre de capture'),
        h('button', { class: 'btn', onclick: exportObs, title: 'Fichier .html autonome à ajouter dans OBS comme source navigateur (fond transparent)' }, icon('download'), 'Avatar OBS (.html)'),
        h('button', { class: 'btn', onclick: () => stage.requestFullscreen?.() }, icon('fit'), 'Plein écran')),
      h('p', { class: 'hint' }, 'Fenêtre de capture : elle suit vos changements d\'expression et vos enregistrements. Avatar OBS : ajoutez le fichier comme « Source navigateur » (fichier local) ; le fond est transparent. Pour le micro dans OBS, lancez OBS avec l\'option --use-fake-ui-for-media-stream et ajoutez ?mic=1 à l\'adresse, ou cliquez sur « Interagir ».'),
      h('div', { class: 'row', style: { marginTop: '8px' } },
        h('button', { class: 'btn', onclick: () => app.actions.exportDialog('pngtuber') }, icon('download'), 'Images pour logiciels PNGtuber')));
    placeMarkers();
    renderExprChips();
    micBtn.replaceChildren(icon('mic'), engine.state.stream ? 'Couper le micro' : 'Activer le micro');
    micBtn.classList.toggle('primary', !engine.state.stream);
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
    const bg = BACKGROUNDS.find((b) => b[0] === cfg.background) || BACKGROUNDS[0];
    stage.style.background = '';
    stage.style.backgroundImage = '';
    if (bg[0] === 'checker') stage.style.background = 'repeating-conic-gradient(#888 0% 25%, #bbb 0% 50%) 0 0 / 24px 24px';
    else if (bg[0] === 'image' && customBgUrl) {
      stage.style.backgroundImage = `url(${customBgUrl})`;
      stage.style.backgroundSize = 'cover';
      stage.style.backgroundPosition = 'center';
    } else stage.style.background = bg[2] || '#00ff00';
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
    const bg = ['green', 'blue', 'magenta', 'black', 'white'].includes(cfg.background) ? cfg.background : 'green';
    const w = window.open(`capture.html?project=${encodeURIComponent(doc.id)}&bg=${bg}`, 'pixel-atelier-capture', 'width=520,height=560');
    if (!w) app.toast('Fenêtre bloquée : autorisez les fenêtres pop-up pour ce site', 3500);
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
      flushCfg.flush();
      engine.stop();
      detachKeys();
      app.pngtuberOpen = false;
    },
  });
  d.el.querySelector('.dlg-body').style.overflow = 'hidden';
  applyBg();
  renderSide();
  engine.start();
}
