// Fenêtre de capture PNGtuber : affiche uniquement l'avatar (fond uni pour
// l'incrustation dans OBS). Elle suit l'éditeur : expression choisie et
// enregistrements (canal BroadcastChannel « pixel-atelier »).

import { readProject, channel } from '../storage/storage.js';
import { createAvatar } from './engine.js';
import { createEffects, SCENE_NAMES } from './effects.js';
import { FORMATS, formatById, applyAnchor, layoutScene } from './formats.js';
import { makeImageProvider, avatarExpressions, avatarSettings, initialExpression, avatarProfiles, effectsConfig } from './assets.js';

const BG = { green: '#00ff00', blue: '#0047bb', magenta: '#ff00ff', black: '#000000', white: '#ffffff', transparent: 'transparent' };
const params = new URLSearchParams(location.search);
const projectId = params.get('project');
const $ = (id) => document.getElementById(id);

let doc = null;
let provider = null;
let av = null;

function message(text) {
  $('msg').hidden = false;
  $('msg').textContent = text;
}

let bgId = 'green';
function setBg(v) {
  // fonds de l'éditeur sans équivalent ici : damier -> transparent, image -> inchangé
  if (v === 'checker') v = 'transparent';
  if (!BG[v] && !SCENE_NAMES[v]) return;
  bgId = v;
  // le fond est peint dans le cadre ; autour (format plus petit que la fenêtre) : noir
  $('scene').style.background = SCENE_NAMES[v] ? '#000' : BG[v] || v;
  document.body.style.background = v === 'transparent' ? 'transparent' : '#000';
  $('bg').value = v;
}
// cadre de diffusion : format, taille et position de l'avatar (suivent l'éditeur)
const frame = { format: params.get('fmt') || null, fill: 0, anchor: null };
function applyFrame() {
  const f = frame.format || doc?.pngtuber.format || 'free';
  $('fmt').value = f;
  document.body.classList.toggle('framed', f !== 'free');
  layoutScene($('stage'), $('scene'), f, { exact: true });
  applyAnchor($('scene'), frame.anchor || doc?.pngtuber.anchor || 'bottom');
  av?.refresh();
}
for (const f of FORMATS) {
  const o = document.createElement('option');
  o.value = f.id;
  o.textContent = f.name;
  $('fmt').append(o);
}
// décors animés dans la liste des fonds
for (const [id, name] of Object.entries(SCENE_NAMES)) {
  const o = document.createElement('option');
  o.value = id;
  o.textContent = name;
  $('bg').append(o);
}

function fillExpressions() {
  const sel = $('expr');
  sel.replaceChildren();
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '(état par défaut)';
  sel.append(none);
  for (const e of avatarExpressions(doc)) {
    const o = document.createElement('option');
    o.value = e.id;
    o.textContent = e.name + (e.key ? ` [${e.key}]` : '');
    sel.append(o);
  }
  sel.value = av?.state.expression || '';
}

async function load(keepExpression = null) {
  doc = (await readProject(projectId)).doc;
  provider = makeImageProvider(doc);
  document.title = `${doc.name} — avatar PNGtuber`;
  if (!av) {
    const fx = createEffects({
      stage: $('scene'), scene: $('scene'), back: $('fxb'), front: $('fxf'), bg: $('fxbg'), background: () => bgId, avatarCanvas: $('avatar'),
      width: doc.width, height: doc.height,
      cfg: () => (doc ? effectsConfig(doc, av?.state.profile) : {}),
    });
    av = createAvatar({
      canvas: $('avatar'),
      stage: $('scene'),
      fx,
      onBackground: (id) => setBg(id),
      width: doc.width,
      height: doc.height,
      getImage: (pf, ex, m, b) => provider(pf, ex, m, b),
      cfg: (pf) => (doc ? { ...avatarSettings(doc, pf), ...(frame.fill ? { fill: frame.fill } : {}) } : {}),
      expressions: () => (doc ? avatarExpressions(doc) : []),
      profiles: () => (doc ? avatarProfiles(doc) : []),
      initialExpression: keepExpression ?? initialExpression(doc),
      onChange: (s) => { $('expr').value = s.expression || ''; },
    });
    av.attachKeys(window);
    av.start();
  } else {
    if (keepExpression !== null && !doc.expressions.some((e) => e.id === keepExpression)) av.setExpression(initialExpression(doc));
    av.refresh();
  }
  fillExpressions();
}

async function boot() {
  if (!projectId) return message('Ouvrez cette fenêtre depuis le mode PNGtuber de Pixel Atelier.');
  try {
    await load();
  } catch (err) {
    return message('Projet introuvable : enregistrez-le dans l\'éditeur puis rouvrez cette fenêtre. (' + err.message + ')');
  }
  setBg(params.get('bg') || doc.pngtuber.background || 'green');
  $('bg').addEventListener('change', () => setBg($('bg').value));
  $('fmt').addEventListener('change', () => { frame.format = $('fmt').value; applyFrame(); });
  $('fit').addEventListener('click', () => {
    const f = formatById($('fmt').value);
    if (!f.w) return;
    const dpr = window.devicePixelRatio || 1;
    try { window.resizeTo(Math.round(f.w / dpr) + (window.outerWidth - window.innerWidth), Math.round(f.h / dpr) + (window.outerHeight - window.innerHeight)); } catch (e) { /* refusé */ }
  });
  window.addEventListener('resize', applyFrame);
  applyFrame();
  $('expr').addEventListener('change', () => av.setExpression($('expr').value || null));
  $('mic').addEventListener('click', () => {
    av.startMic().then(() => { $('mic').textContent = '🎤 Micro actif'; }).catch((e) => { $('mic').textContent = '🎤 Micro refusé (' + e.name + ')'; });
  });
  channel?.addEventListener('message', async (ev) => {
    const m = ev.data || {};
    if (m.projectId !== projectId) return;
    if (m.type === 'expression') av.setExpression(m.id || null);
    if (m.type === 'profile') av.setProfile(m.id || null);
    if (m.type === 'talk') av.setManualTalk(m.on);
    if (m.type === 'effect') av.fx?.trigger(m.id, false);
    if (m.type === 'background') setBg(m.id);
    if (m.type === 'frame') { frame.format = m.format; frame.fill = m.fill; frame.anchor = m.anchor; applyFrame(); }
    if (m.type === 'saved') {
      const keep = av.state.expression;
      await load(keep).catch(() => {});
    }
  });
  // masquer la barre après 3 s sans mouvement (capture propre)
  let t = null;
  const wake = () => {
    document.body.classList.remove('idle');
    clearTimeout(t);
    t = setTimeout(() => document.body.classList.add('idle'), 3000);
  };
  for (const ev of ['pointermove', 'pointerdown', 'keydown']) window.addEventListener(ev, wake);
  wake();
}

boot();
