// Petits utilitaires DOM sans framework.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * h('button', { class: 'btn', onclick: fn, title: 'x' }, 'texte', autreNoeud)
 * Les clés commençant par "on" deviennent des écouteurs ; "style" accepte un objet ;
 * "dataset" un objet ; "html" injecte du innerHTML (uniquement contenu de confiance).
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function debounce(fn, ms) {
  let t = null;
  const d = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  d.flush = (...args) => {
    clearTimeout(t);
    fn(...args);
  };
  return d;
}

/** Nom de fichier propre : sans accents, minuscules, [a-z0-9_-]. */
export function slugify(s, fallback = 'sans_nom') {
  const out = String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return out || fallback;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function pickFile(accept, multiple = false) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, multiple, style: { position: 'fixed', left: '-1000px', top: '0', opacity: '0', width: '1px', height: '1px' } });
    input.addEventListener('change', () => {
      resolve(multiple ? [...input.files] : input.files[0] || null);
      input.remove();
    });
    // Annulation : certains navigateurs n'émettent pas d'évènement ; on laisse la promesse en attente.
    document.body.append(input);
    input.click();
  });
}

export function isMac() {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export function imageToRGBA(img, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export function bytesToBase64(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(s);
}

export function base64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/**
 * Reconstruit un contenu sans perdre la position de défilement : mémorise le
 * défilement de `el` et de ses ancêtres qui défilent, exécute fn, puis le rétablit.
 */
export function keepScroll(el, fn) {
  const saved = [];
  for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
    if (n.scrollTop || n.scrollLeft) saved.push([n, n.scrollTop, n.scrollLeft]);
  }
  const r = fn();
  for (const [n, t, l] of saved) { n.scrollTop = t; n.scrollLeft = l; }
  return r;
}
