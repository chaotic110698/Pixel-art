// Mode PNGtuber : aperçu sur fond (vert, noir, blanc, damier, image), bouche
// pilotée par le micro (Web Audio, 100 % local), clignement automatique,
// expressions au clavier, petit rebond quand on parle.

import { h, clear, pickFile } from '../util/dom.js';
import { openDialog } from '../ui/dialogs.js';
import { icon } from '../ui/icons.js';
import { composeToCanvas } from '../render/compose.js';
import { autoPngtuber } from '../library/character.js';

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
  const cfg = doc.pngtuber;
  const state = {
    talking: false,
    level: 0,
    lastLoud: 0,
    blinkUntil: 0,
    nextBlink: performance.now() + cfg.blinkEvery * 1000,
    expression: null,
    manualTalk: false,
    stream: null,
    audio: null,
    analyser: null,
    raf: 0,
    hideUi: false,
  };
  // expression de départ : celle qui correspond à l'état actuel, sinon « Neutre »
  const cur = JSON.stringify(Object.fromEntries(doc.variantGroups().map((g) => [g.id, g.active])));
  state.expression = doc.expressions.find((e) => JSON.stringify(e.states) === cur)?.id || doc.expressions.find((e) => /neutre/i.test(e.name))?.id || null;

  const canvas = h('canvas', { 'aria-label': 'Aperçu PNGtuber' });
  const stage = h('div', { class: 'pt-stage' }, canvas);
  const side = h('div', { class: 'pt-side' });
  const wrap = h('div', { class: 'pt-wrap' }, stage, side);

  const meterLvl = h('div', { class: 'lvl' });
  const meterThr = h('div', { class: 'thr' });
  const meter = h('div', { class: 'meter', title: 'Volume du micro (le trait rose = seuil)' }, meterLvl, meterThr);
  const micBtn = h('button', { class: 'btn primary', onclick: toggleMic }, icon('mic'), 'Activer le micro');
  const talkBtn = h('button', { class: 'btn', title: 'Maintenir pour simuler la parole (ou touche Espace)' }, 'Maintenir pour parler');
  talkBtn.addEventListener('pointerdown', () => (state.manualTalk = true));
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) talkBtn.addEventListener(ev, () => (state.manualTalk = false));

  function groupSelect(key, label, onChange) {
    const sel = h('select', { class: 'input wide' }, h('option', { value: '' }, '— Aucun —'),
      doc.variantGroups().map((g) => h('option', { value: g.id, selected: cfg[key] === g.id }, g.name)));
    sel.addEventListener('change', () => { cfg[key] = sel.value || null; onChange(); app.emit('changed'); });
    return h('label', { class: 'field' }, h('span', {}, label), sel);
  }
  function variantSelect(groupKey, key, label) {
    const g = doc.get(cfg[groupKey]);
    const sel = h('select', { class: 'input wide' }, h('option', { value: '' }, '—'),
      (g ? g.children : []).map((cid) => h('option', { value: cid, selected: cfg[key] === cid }, doc.get(cid).name)));
    sel.addEventListener('change', () => { cfg[key] = sel.value || null; app.emit('changed'); });
    return h('label', { class: 'field' }, h('span', {}, label), sel);
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
    const thr = h('input', { type: 'range', min: 1, max: 100, value: Math.round(cfg.threshold * 100), class: 'grow', oninput: (e) => { cfg.threshold = e.target.value / 100; } , onchange: () => app.emit('changed') });
    const blink = h('input', { type: 'number', class: 'input num', min: 0, max: 60, step: 0.5, value: cfg.blinkEvery, onchange: (e) => { cfg.blinkEvery = Math.max(0, parseFloat(e.target.value) || 0); app.emit('changed'); } });
    const blinkDur = h('input', { type: 'number', class: 'input num', min: 0.05, max: 2, step: 0.05, value: cfg.blinkDuration, onchange: (e) => { cfg.blinkDuration = Math.max(0.05, parseFloat(e.target.value) || 0.15); app.emit('changed'); } });

    side.append(
      h('h3', {}, 'Fond'), bgRow,
      h('h3', {}, 'Micro'),
      h('p', { class: 'hint' }, '🔒 Le son est analysé uniquement sur cet appareil : rien n\'est enregistré ni envoyé.'),
      h('div', { class: 'row' }, micBtn, talkBtn),
      h('div', { style: { margin: '8px 0' } }, meter),
      h('label', { class: 'row nowrap' }, h('span', { class: 'small' }, 'Seuil'), thr),
      h('h3', {}, 'Bouche'),
      groupSelect('mouthGroup', 'Groupe de la bouche', () => { autoPick('mouth'); renderSide(); }),
      h('div', { class: 'fields' }, variantSelect('mouthGroup', 'mouthClosed', 'Fermée (silence)'), variantSelect('mouthGroup', 'mouthOpen', 'Ouverte (parole)')),
      h('h3', {}, 'Yeux et clignement'),
      groupSelect('eyesGroup', 'Groupe des yeux', () => { autoPick('eyes'); renderSide(); }),
      h('div', { class: 'fields' }, variantSelect('eyesGroup', 'eyesOpen', 'Ouverts'), variantSelect('eyesGroup', 'eyesClosed', 'Fermés (clignement)')),
      h('div', { class: 'row' }, h('span', { class: 'small' }, 'Cligner toutes les'), blink, h('span', { class: 'small' }, 's (0 = jamais), durée'), blinkDur, h('span', { class: 'small' }, 's')),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: cfg.bounce, onchange: (e) => { cfg.bounce = e.target.checked; app.emit('changed'); } }), 'Petit rebond en parlant'),
      h('h3', {}, 'Expressions'),
      doc.expressions.length
        ? h('div', { class: 'chips' }, h('button', { class: 'chip' + (!state.expression ? ' on' : ''), onclick: () => { state.expression = null; renderSide(); } }, 'Actuel'),
          doc.expressions.map((e) => h('button', { class: 'chip' + (state.expression === e.id ? ' on' : ''), onclick: () => { state.expression = e.id; renderSide(); } }, e.name, e.key ? h('kbd', { style: { marginLeft: '6px' } }, e.key) : null)))
        : h('p', { class: 'hint' }, 'Aucune expression : créez-en dans l\'onglet Expressions.'),
      h('p', { class: 'hint' }, 'Touches : celles associées aux expressions (onglet Expressions > ⋯ > Associer une touche), Espace = parler, H = masquer les réglages, Échap = quitter.'),
      h('div', { class: 'row', style: { marginTop: '8px' } },
        h('button', { class: 'btn', onclick: () => stage.requestFullscreen?.() }, icon('fit'), 'Plein écran (pour la capture)'),
        h('button', { class: 'btn', onclick: () => app.actions.exportDialog('pack') }, icon('download'), 'Exporter le pack')));
    meterThr.style.left = cfg.threshold * 100 + '%';
    thr.addEventListener('input', () => (meterThr.style.left = cfg.threshold * 100 + '%'));
    micBtn.replaceChildren(icon('mic'), state.stream ? 'Couper le micro' : 'Activer le micro');
    micBtn.classList.toggle('primary', !state.stream);
  }

  function autoPick(which) {
    const g = doc.get(cfg[which + 'Group']);
    cfg[which + 'Open'] = null;
    cfg[which + 'Closed'] = null;
    if (!g) return;
    const kids = g.children.map((id) => doc.get(id));
    const find = (st, rx) => kids.find((c) => c.part?.state === st)?.id || kids.find((c) => rx.test(c.name))?.id || null;
    cfg[which + 'Open'] = find('open', /ouvert|open/i) || g.children[g.children.length - 1];
    cfg[which + 'Closed'] = find('closed', /ferm|closed/i) || g.children[0];
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
    if (state.stream) return stopMic();
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      state.audio = new (window.AudioContext || window.webkitAudioContext)();
      const src = state.audio.createMediaStreamSource(state.stream);
      state.analyser = state.audio.createAnalyser();
      state.analyser.fftSize = 1024;
      src.connect(state.analyser);
      app.toast('Micro activé (traitement local)');
    } catch (err) {
      app.toast('Micro indisponible : ' + (err.message || err), 3000);
      stopMic();
    }
    renderSide();
  }

  function stopMic() {
    state.stream?.getTracks().forEach((t) => t.stop());
    state.audio?.close().catch(() => {});
    state.stream = null;
    state.audio = null;
    state.analyser = null;
    state.level = 0;
  }

  const buf = new Float32Array(1024);
  function readLevel() {
    if (!state.analyser) return 0;
    state.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    // échelle perceptive approximative : 0..1
    return Math.min(1, Math.max(0, (20 * Math.log10(rms + 1e-8) + 60) / 60));
  }

  function overrides(now) {
    const ov = {};
    const e = doc.expressions.find((x) => x.id === state.expression);
    if (e) Object.assign(ov, e.states);
    if (cfg.mouthGroup && doc.get(cfg.mouthGroup)) {
      if (state.talking && cfg.mouthOpen) ov[cfg.mouthGroup] = cfg.mouthOpen;
      else if (!e?.states[cfg.mouthGroup] && cfg.mouthClosed) ov[cfg.mouthGroup] = cfg.mouthClosed;
    }
    if (cfg.eyesGroup && cfg.eyesClosed && now < state.blinkUntil) ov[cfg.eyesGroup] = cfg.eyesClosed;
    return ov;
  }

  function loop() {
    const now = performance.now();
    state.level = state.level * 0.6 + readLevel() * 0.4;
    const loud = state.level > cfg.threshold || state.manualTalk;
    if (loud) state.lastLoud = now;
    state.talking = loud || now - state.lastLoud < 140; // petite tenue pour éviter le clignotement
    meterLvl.style.width = state.level * 100 + '%';
    meterLvl.style.background = state.level > cfg.threshold ? 'var(--ok)' : 'var(--muted)';
    if (cfg.blinkEvery > 0 && now >= state.nextBlink) {
      state.blinkUntil = now + cfg.blinkDuration * 1000;
      state.nextBlink = now + cfg.blinkEvery * 1000 * (0.7 + Math.random() * 0.6);
    }
    draw(now);
    state.raf = requestAnimationFrame(loop);
  }

  let lastKey = '';
  function draw(now) {
    const ov = overrides(now);
    const key = JSON.stringify(ov);
    const r = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const maxW = r.width * dpr, maxH = r.height * dpr;
    const s = Math.max(1, Math.floor(Math.min(maxW / doc.width, maxH / doc.height) * 0.9));
    const bounce = cfg.bounce && state.talking ? Math.round(Math.abs(Math.sin(now / 90)) * Math.max(1, s * 1.5)) : 0;
    const k = `${key}|${s}|${bounce}|${maxW}|${maxH}`;
    if (k === lastKey) return;
    lastKey = k;
    const W = doc.width * s, H = doc.height * s + Math.max(1, s * 2);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = W / dpr + 'px';
      canvas.style.height = H / dpr + 'px';
    }
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.imageSmoothingEnabled = false;
    g.drawImage(composeToCanvas(doc, { overrides: ov, includeReference: false }), 0, H - doc.height * s - bounce, doc.width * s, doc.height * s);
  }

  function onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') {
      state.manualTalk = e.type === 'keydown';
      e.preventDefault();
      return;
    }
    if (e.type !== 'keydown' || e.repeat) return;
    if (e.key.toLowerCase() === 'h' && !doc.expressions.some((x) => x.key === 'H')) {
      state.hideUi = !state.hideUi;
      side.hidden = state.hideUi;
      wrap.style.gridTemplateColumns = state.hideUi ? '1fr' : '';
      return;
    }
    const ex = doc.expressions.find((x) => x.key && x.key === e.key.toUpperCase());
    if (ex) {
      state.expression = ex.id;
      renderSide();
      e.preventDefault();
    }
  }

  app.pngtuberOpen = true;
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  const d = openDialog({
    title: `Mode PNGtuber — ${doc.name}`,
    full: true,
    body: wrap,
    onClose: () => {
      cancelAnimationFrame(state.raf);
      stopMic();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      app.pngtuberOpen = false;
    },
  });
  d.el.querySelector('.dlg-body').style.overflow = 'hidden';
  applyBg();
  renderSide();
  loop();
}
