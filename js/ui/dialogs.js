// Fenêtres modales, confirmations, saisies, notifications.

import { h } from '../util/dom.js';
import { icon } from './icons.js';

let stack = [];

/**
 * openDialog({ title, body (Node|Node[]), buttons: [{label, value, primary, danger}], wide, onClose, className })
 * Retourne { el, close(value), result: Promise }.
 */
export function openDialog({ title, body, buttons = [], wide = false, full = false, className = '', onClose = null, dismissable = true }) {
  let resolve;
  const result = new Promise((r) => (resolve = r));
  const closeBtn = h('button', { class: 'icon-btn dlg-x', title: 'Fermer', 'aria-label': 'Fermer', onclick: () => close(undefined) }, icon('close'));
  const footer = buttons.length
    ? h('footer', { class: 'dlg-foot' }, buttons.map((b) =>
      h('button', {
        class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''),
        onclick: async () => {
          if (b.action) {
            const r = await b.action();
            if (r === false) return;
          }
          close(b.value);
        },
      }, b.label)))
    : null;
  const box = h('div', { class: `dlg ${wide ? 'wide' : ''} ${full ? 'full' : ''} ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', { class: 'dlg-head' }, h('h2', {}, title), closeBtn),
    h('div', { class: 'dlg-body' }, body),
    footer);
  const backdrop = h('div', { class: 'backdrop' }, box);
  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop && dismissable) close(undefined);
  });
  document.body.append(backdrop);
  const entry = { backdrop, close: (v) => close(v), dismissable };
  stack.push(entry);
  requestAnimationFrame(() => {
    backdrop.classList.add('show');
    const f = box.querySelector('[autofocus]') || box.querySelector('input, select, textarea');
    if (f && window.matchMedia('(pointer: fine)').matches) f.focus();
  });
  function close(v) {
    if (!backdrop.isConnected) return;
    backdrop.remove();
    stack = stack.filter((x) => x !== entry);
    onClose?.(v);
    resolve(v);
  }
  return { el: box, close, result };
}

export function topDialog() {
  return stack[stack.length - 1] || null;
}

export function closeTopDialog() {
  const d = topDialog();
  if (d && d.dismissable) {
    d.close(undefined);
    return true;
  }
  return false;
}

export function anyDialogOpen() {
  return stack.length > 0;
}

export function confirmDialog(message, { title = 'Confirmation', ok = 'OK', cancel = 'Annuler', danger = false } = {}) {
  return openDialog({
    title,
    body: h('p', {}, message),
    buttons: [
      { label: cancel, value: false },
      { label: ok, value: true, primary: !danger, danger },
    ],
  }).result.then((v) => !!v);
}

export function promptDialog(message, value = '', { title = 'Saisie', ok = 'OK' } = {}) {
  const input = h('input', { type: 'text', value, class: 'input wide', autofocus: true });
  const d = openDialog({
    title,
    body: [h('label', { class: 'field' }, h('span', {}, message), input)],
    buttons: [
      { label: 'Annuler', value: null },
      { label: ok, primary: true, value: '__ok__' },
    ],
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') d.close('__ok__');
  });
  setTimeout(() => input.select(), 30);
  return d.result.then((v) => (v === '__ok__' ? input.value : null));
}

// ---------- Notifications ----------
let toastEl = null;
let toastTimer = null;
export function toast(msg, ms = 1800) {
  if (!toastEl) {
    toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

/** Petit menu contextuel ancré à un élément. items: [{label, icon, action, danger, sep}] */
export function popupMenu(anchor, items, { align = 'left' } = {}) {
  closePopups();
  const menu = h('div', { class: 'popup-menu', role: 'menu' },
    items.map((it) => {
      if (it.sep) return h('div', { class: 'sep' });
      if (it.heading) return h('div', { class: 'menu-heading' }, it.heading);
      return h('button', {
        class: 'menu-item' + (it.danger ? ' danger' : '') + (it.checked ? ' checked' : ''),
        role: 'menuitem',
        disabled: it.disabled,
        onclick: () => {
          closePopups();
          it.action?.();
        },
      }, it.icon ? icon(it.icon) : h('span', { class: 'ico' }), h('span', { class: 'lbl' }, it.label), it.hint ? h('kbd', {}, it.hint) : null);
    }));
  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let x = align === 'right' ? r.right - mw : r.left;
  let y = r.bottom + 4;
  if (y + mh > window.innerHeight - 8) y = Math.max(8, r.top - mh - 4);
  x = Math.max(8, Math.min(window.innerWidth - mw - 8, x));
  menu.style.left = x + 'px';
  menu.style.top = Math.max(8, y) + 'px';
  setTimeout(() => {
    document.addEventListener('pointerdown', onDocDown, true);
  }, 0);
  function onDocDown(e) {
    if (!menu.contains(e.target)) closePopups();
  }
  menu._cleanup = () => document.removeEventListener('pointerdown', onDocDown, true);
  return menu;
}

export function closePopups() {
  for (const m of document.querySelectorAll('.popup-menu')) {
    m._cleanup?.();
    m.remove();
  }
}
