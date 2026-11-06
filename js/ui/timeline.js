// Timeline d'animation : images multiples, lecture, FPS, onion skin.

import { h, clear, debounce } from '../util/dom.js';
import { icon } from './icons.js';
import { composeToCanvas } from '../render/compose.js';
import { promptDialog, openDialog } from './dialogs.js';

let initialized = false;
let playing = null;

export function setFrame(app, i) {
  const doc = app.doc;
  i = Math.max(0, Math.min(doc.frames.length - 1, i));
  if (doc.frame === i) return;
  app.selection.commitFloating();
  doc.frame = i;
  app.renderer.invalidateAll();
  app.emit('frame');
}

/** Plage de lecture / de sélection d'images (null = toutes). */
let range = null;
export function getRange() {
  return range;
}

function shiftTagsOnInsert(doc, at) {
  // nouvelle image à l'index `at`, juste après l'image courante (at - 1)
  for (const t of doc.tags) {
    if (t.from >= at) {
      t.from++;
      t.to++;
    } else if (t.to >= at - 1) t.to++; // ajoutée dans la balise : elle s'agrandit
  }
}

function shiftTagsOnDelete(doc, at) {
  for (const t of doc.tags) {
    if (t.from > at) t.from--;
    if (t.to >= at) t.to--;
  }
  doc.tags = doc.tags.filter((t) => t.to >= t.from && t.from >= 0);
}

/** mode : 'empty' | 'copy' | 'linked' (image liée : mêmes pixels, modifiés ensemble). */
export function addFrame(app, mode = 'empty') {
  const doc = app.doc;
  app.selection.commitFloating();
  const label = { empty: 'Nouvelle image', copy: 'Dupliquer l\'image', linked: 'Image liée' }[mode] || 'Nouvelle image';
  app.history.transact(label, () => {
    const at = doc.frame + 1;
    doc.frames.splice(at, 0, { duration: doc.frames[doc.frame]?.duration || Math.round(1000 / doc.fps) });
    for (const l of doc.allLayers()) {
      const src = l.cels[doc.frame];
      let cel;
      if (mode === 'linked' && src) cel = src;
      else if (mode === 'copy' && src) cel = src.slice();
      else cel = doc.newCel();
      l.cels.splice(at, 0, cel);
    }
    shiftTagsOnInsert(doc, at);
    doc.frame = at;
  });
  range = null;
  app.emit('frame');
}

/** Rend indépendante l'image courante (copie des cels partagées). */
export function unlinkFrame(app) {
  const doc = app.doc;
  const f = doc.frame;
  const shared = doc.allLayers().filter((l) => l.cels.some((c, i) => i !== f && c === l.cels[f]));
  if (!shared.length) return app.toast('Cette image n\'est liée à aucune autre');
  app.selection.commitFloating();
  app.history.transact('Délier l\'image', () => {
    for (const l of shared) l.cels[f] = l.cels[f].slice();
  });
  app.emit('frame');
}

export function isLinked(doc, f) {
  return doc.allLayers().some((l) => l.cels[f] && l.cels.some((c, i) => i !== f && c === l.cels[f]));
}

export function deleteFrame(app) {
  const doc = app.doc;
  if (doc.frames.length < 2) return app.toast('Il faut au moins une image');
  app.selection.commitFloating();
  app.history.transact('Supprimer l\'image', () => {
    const at = doc.frame;
    doc.frames.splice(at, 1);
    for (const l of doc.allLayers()) l.cels.splice(at, 1);
    shiftTagsOnDelete(doc, at);
    doc.frame = Math.min(at, doc.frames.length - 1);
  });
  range = null;
  app.emit('frame');
}

export function moveFrame(app, dir) {
  const doc = app.doc;
  const a = doc.frame, b = a + dir;
  if (b < 0 || b >= doc.frames.length) return;
  app.history.transact('Déplacer l\'image', () => {
    [doc.frames[a], doc.frames[b]] = [doc.frames[b], doc.frames[a]];
    for (const l of doc.allLayers()) [l.cels[a], l.cels[b]] = [l.cels[b], l.cels[a]];
    doc.frame = b;
  });
  app.emit('frame');
}

// ---------- Balises ----------
const TAG_COLORS = ['#ff5ab4', '#7f8cff', '#4ad991', '#ffb347', '#4ab0ff', '#d97aff', '#ff6b6b'];

export function addTag(app, name, from, to) {
  const doc = app.doc;
  return app.history.transact('Nouvelle balise', () => {
    const t = { id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, from, to, color: TAG_COLORS[doc.tags.length % TAG_COLORS.length] };
    doc.tags.push(t);
    return t;
  });
}

export function updateTag(app, id, patch) {
  app.history.transact('Modifier la balise', () => {
    const t = app.doc.tags.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  });
}

export function removeTag(app, id) {
  app.history.transact('Supprimer la balise', () => {
    app.doc.tags = app.doc.tags.filter((x) => x.id !== id);
  });
}

export function togglePlay(app) {
  if (playing) {
    clearTimeout(playing);
    playing = null;
    app.emit('playstate');
    return;
  }
  const step = () => {
    const doc = app.doc;
    const from = range ? Math.max(0, range.from) : 0;
    const to = range ? Math.min(doc.frames.length - 1, range.to) : doc.frames.length - 1;
    if (to <= from) {
      playing = null;
      app.emit('playstate');
      return;
    }
    // boucle sur la plage sélectionnée (ou la balise choisie)
    setFrame(app, doc.frame >= to || doc.frame < from ? from : doc.frame + 1);
    playing = setTimeout(step, doc.frames[doc.frame].duration || 1000 / doc.fps);
  };
  playing = setTimeout(step, app.doc.frames[app.doc.frame].duration || 125);
  app.emit('playstate');
}

export function toggleTimeline(app) {
  const el = document.getElementById('timeline');
  if (!initialized) init(app, el);
  app.timelineOpen = el.hidden;
  el.hidden = !el.hidden;
  if (el.hidden && playing) togglePlay(app);
  window.dispatchEvent(new Event('resize'));
  app.renderer.resize();
}

function tagDialog(app, tag) {
  const doc = app.doc;
  const nameIn = h('input', { class: 'input wide', value: tag.name });
  const fromIn = h('input', { type: 'number', class: 'input num', min: 1, max: doc.frames.length, value: tag.from + 1 });
  const toIn = h('input', { type: 'number', class: 'input num', min: 1, max: doc.frames.length, value: tag.to + 1 });
  const colorIn = h('input', { type: 'color', value: tag.color, style: { width: '44px', height: '36px', border: 0, background: 'none' } });
  return openDialog({
    title: `Balise « ${tag.name} »`,
    body: [
      h('label', { class: 'field' }, h('span', {}, 'Nom'), nameIn),
      h('div', { class: 'row' }, h('span', {}, 'Images'), fromIn, h('span', {}, 'à'), toIn, h('span', {}, 'Couleur'), colorIn),
      h('p', { class: 'hint' }, 'Cliquez sur une balise dans la timeline pour la lire en boucle. L\'export (GIF, planche, images) peut produire une animation par balise.'),
    ],
    buttons: [
      { label: 'Supprimer', danger: true, value: 'delete' },
      { label: 'Annuler', value: null },
      { label: 'OK', primary: true, value: 'ok' },
    ],
  }).result.then((v) => {
    if (v === 'delete') removeTag(app, tag.id);
    if (v === 'ok') {
      let from = Math.max(1, Math.min(doc.frames.length, parseInt(fromIn.value, 10) || 1)) - 1;
      let to = Math.max(1, Math.min(doc.frames.length, parseInt(toIn.value, 10) || 1)) - 1;
      if (to < from) [from, to] = [to, from];
      updateTag(app, tag.id, { name: nameIn.value.trim() || tag.name, from, to, color: colorIn.value });
    }
  });
}

function init(app, el) {
  initialized = true;
  const CELL = 56; // largeur d'une case image + espacement
  const frames = h('div', { class: 'frames' });
  const tagsRow = h('div', { class: 'tags-row' });
  const strip = h('div', { class: 'frame-strip' }, tagsRow, frames);
  const playBtn = h('button', { class: 'icon-btn', title: 'Lecture / pause (boucle sur la plage ou la balise choisie)', 'aria-label': 'Lecture' }, icon('play'));
  playBtn.addEventListener('click', () => togglePlay(app));
  const fpsIn = h('input', { type: 'number', class: 'input num', min: 1, max: 60, title: 'Images par seconde' });
  fpsIn.addEventListener('change', () => {
    const doc = app.doc;
    const fps = Math.max(1, Math.min(60, parseInt(fpsIn.value, 10) || 8));
    app.history.transact('Images par seconde', () => {
      doc.fps = fps;
      for (const f of doc.frames) f.duration = Math.round(1000 / fps);
    });
  });
  const onion = h('button', { class: 'icon-btn toggle', title: 'Onion skin (N)', 'aria-label': 'Onion skin', onclick: () => app.setState({ onion: !app.state.onion }) }, '🧅');
  const tb = (ic, title, fn) => h('button', { class: 'icon-btn small', title, 'aria-label': title, onclick: fn }, typeof ic === 'string' && ic.length > 2 ? icon(ic) : ic);
  const rangeLbl = h('span', { class: 'small muted' });
  el.append(
    playBtn,
    h('span', { class: 'small muted' }, 'FPS'), fpsIn, onion,
    tb('plus', 'Nouvelle image vide', () => addFrame(app, 'empty')),
    tb('copy', 'Dupliquer l\'image', () => addFrame(app, 'copy')),
    tb('🔗', 'Dupliquer en image liée (mêmes pixels, modifiés ensemble)', () => addFrame(app, 'linked')),
    tb('✂', 'Délier l\'image courante', () => unlinkFrame(app)),
    tb('chevronRight', 'Déplacer à droite', () => moveFrame(app, 1)),
    tb('trash', 'Supprimer l\'image', () => deleteFrame(app)),
    tb('🏷', 'Nouvelle balise (sur la plage sélectionnée avec Maj+clic, ou l\'image courante)', async () => {
      const doc = app.doc;
      const r = range || { from: doc.frame, to: doc.frame };
      const name = await promptDialog('Nom de la balise (ex. Marche, Saut)', `Balise ${doc.tags.length + 1}`, { title: 'Nouvelle balise' });
      if (name) addTag(app, name.trim(), r.from, r.to);
    }),
    rangeLbl,
    strip,
    tb('close', 'Fermer la timeline', () => toggleTimeline(app)));

  const render = () => {
    const doc = app.doc;
    if (range && (range.to >= doc.frames.length)) range = null;
    fpsIn.value = doc.fps;
    onion.classList.toggle('on', app.state.onion);
    playBtn.replaceChildren(icon(playing ? 'pause' : 'play'));
    rangeLbl.textContent = range ? `Plage ${range.from + 1}–${range.to + 1}` : '';
    clear(frames);
    clear(tagsRow);
    tagsRow.style.width = doc.frames.length * CELL + 'px';
    // bandes de balises (sur plusieurs lignes si elles se chevauchent)
    const lanes = [];
    for (const t of doc.tags) {
      let lane = lanes.findIndex((end) => end < t.from);
      if (lane < 0) { lane = lanes.length; lanes.push(-1); }
      lanes[lane] = t.to;
      const active = range && range.from === t.from && range.to === t.to;
      tagsRow.append(h('button', {
        class: 'tag-band' + (active ? ' on' : ''),
        style: { left: t.from * CELL + 'px', width: (t.to - t.from + 1) * CELL - 4 + 'px', top: lane * 22 + 'px', background: t.color },
        title: `${t.name} (images ${t.from + 1}–${t.to + 1}) — clic : lire en boucle, double-clic : modifier`,
        onclick: () => { range = active ? null : { from: t.from, to: t.to }; if (!active) setFrame(app, t.from); render(); },
        ondblclick: () => tagDialog(app, t),
        translate: 'no',
      }, t.name));
    }
    tagsRow.style.height = Math.max(0, lanes.length) * 22 + 'px';
    doc.frames.forEach((f, i) => {
      const c = h('canvas', { width: 80, height: 80 });
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      const k = Math.min(80 / doc.width, 80 / doc.height);
      g.drawImage(composeToCanvas(doc, { frame: i, includeReference: false }), (80 - doc.width * k) / 2, (80 - doc.height * k) / 2, doc.width * k, doc.height * k);
      const inRange = range && i >= range.from && i <= range.to;
      const cell = h('button', {
        class: 'frame-cell' + (i === doc.frame ? ' on' : '') + (inRange ? ' in-range' : ''),
        title: `Image ${i + 1} — ${f.duration} ms (Maj+clic : plage, double-clic : durée)`,
        onclick: (e) => {
          if (e.shiftKey) {
            const a = Math.min(doc.frame, i), b = Math.max(doc.frame, i);
            range = { from: a, to: b };
            render();
            return;
          }
          if (range && (i < range.from || i > range.to)) range = null;
          setFrame(app, i);
          render();
        },
        ondblclick: async () => {
          const v = await promptDialog('Durée de cette image (ms)', String(f.duration), { title: `Image ${i + 1}` });
          const n = parseInt(v, 10);
          if (n > 0) {
            app.history.transact('Durée de l\'image', () => {
              app.doc.frames[i].duration = Math.min(10000, n);
            });
            render();
          }
        },
      }, c, h('span', {}, (isLinked(doc, i) ? '🔗' : '') + (i + 1)));
      frames.append(cell);
    });
  };
  const lazy = debounce(render, 200);
  app.on('frame', render);
  app.on('doc', () => { range = null; render(); });
  app.on('structure', lazy);
  app.on('pixels', lazy);
  app.on('playstate', render);
  app.on('state', () => onion.classList.toggle('on', app.state.onion));
  render();
}
