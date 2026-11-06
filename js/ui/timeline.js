// Timeline d'animation : images multiples, lecture, FPS, onion skin.

import { h, clear, debounce } from '../util/dom.js';
import { icon } from './icons.js';
import { composeToCanvas } from '../render/compose.js';
import { promptDialog } from './dialogs.js';

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

export function addFrame(app, duplicate = false) {
  const doc = app.doc;
  app.selection.commitFloating();
  app.history.transact(duplicate ? 'Dupliquer l\'image' : 'Nouvelle image', () => {
    const at = doc.frame + 1;
    doc.frames.splice(at, 0, { duration: doc.frames[doc.frame]?.duration || Math.round(1000 / doc.fps) });
    for (const l of doc.allLayers()) {
      const src = l.cels[doc.frame];
      l.cels.splice(at, 0, duplicate && src ? src.slice() : doc.newCel());
    }
    doc.frame = at;
  });
  app.emit('frame');
}

export function deleteFrame(app) {
  const doc = app.doc;
  if (doc.frames.length < 2) return app.toast('Il faut au moins une image');
  app.selection.commitFloating();
  app.history.transact('Supprimer l\'image', () => {
    const at = doc.frame;
    doc.frames.splice(at, 1);
    for (const l of doc.allLayers()) l.cels.splice(at, 1);
    doc.frame = Math.min(at, doc.frames.length - 1);
  });
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

export function togglePlay(app) {
  if (playing) {
    clearTimeout(playing);
    playing = null;
    app.emit('playstate');
    return;
  }
  const step = () => {
    const doc = app.doc;
    if (doc.frames.length < 2) {
      playing = null;
      app.emit('playstate');
      return;
    }
    setFrame(app, (doc.frame + 1) % doc.frames.length);
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

function init(app, el) {
  initialized = true;
  const frames = h('div', { class: 'frames' });
  const playBtn = h('button', { class: 'icon-btn', title: 'Lecture / pause (Entrée)', 'aria-label': 'Lecture' }, icon('play'));
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
  const tb = (ic, title, fn) => h('button', { class: 'icon-btn small', title, 'aria-label': title, onclick: fn }, icon(ic));
  el.append(
    playBtn,
    h('span', { class: 'small muted' }, 'FPS'), fpsIn, onion,
    tb('plus', 'Nouvelle image vide', () => addFrame(app, false)),
    tb('copy', 'Dupliquer l\'image', () => addFrame(app, true)),
    tb('chevronRight', 'Déplacer à droite', () => moveFrame(app, 1)),
    tb('trash', 'Supprimer l\'image', () => deleteFrame(app)),
    frames,
    tb('close', 'Fermer la timeline', () => toggleTimeline(app)));

  const render = () => {
    const doc = app.doc;
    fpsIn.value = doc.fps;
    onion.classList.toggle('on', app.state.onion);
    playBtn.replaceChildren(icon(playing ? 'pause' : 'play'));
    clear(frames);
    doc.frames.forEach((f, i) => {
      const c = h('canvas', { width: 80, height: 80 });
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      const k = Math.min(80 / doc.width, 80 / doc.height);
      g.drawImage(composeToCanvas(doc, { frame: i, includeReference: false }), (80 - doc.width * k) / 2, (80 - doc.height * k) / 2, doc.width * k, doc.height * k);
      const cell = h('button', {
        class: 'frame-cell' + (i === doc.frame ? ' on' : ''),
        title: `Image ${i + 1} — ${f.duration} ms (double-clic : durée)`,
        onclick: () => setFrame(app, i),
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
      }, c, h('span', {}, i + 1));
      frames.append(cell);
    });
  };
  const lazy = debounce(render, 200);
  app.on('frame', render);
  app.on('doc', render);
  app.on('structure', lazy);
  app.on('pixels', lazy);
  app.on('playstate', render);
  app.on('state', () => onion.classList.toggle('on', app.state.onion));
  render();
}
