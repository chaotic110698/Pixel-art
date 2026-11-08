// Raccourcis du mode PNGtuber : touche simple (« C », « 1 », « F13 ») ou combinaison
// (« Ctrl+Maj+1 », « Alt+B »). Même lecture que le moteur d'avatar (engine.js) :
// les chiffres sont lus sur la touche physique (AZERTY : « 1 » sans Maj).

import { getLang } from './i18n.js';

export function keyName(e) {
  const code = e.code || '';
  let m = code.match(/^(?:Digit|Numpad)(\d)$/);
  if (m) return m[1];
  if (/^F\d{1,2}$/.test(e.key || '')) return e.key;
  if (!e.key || e.key.length !== 1 || e.key === ' ') return null;
  m = code.match(/^Key([A-Z])$/);
  if ((e.altKey || e.ctrlKey) && m && !/^[a-z]$/i.test(e.key)) return m[1];
  return e.key.toUpperCase();
}

export function comboOf(e) {
  const n = keyName(e);
  if (!n) return null;
  return [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Maj', e.metaKey && 'Cmd', n].filter(Boolean).join('+');
}

/** Forme comparable d'un raccourci enregistré. */
export function normCombo(k) {
  if (!k) return '';
  k = String(k).replace(/Shift\+/g, 'Maj+').replace(/Meta\+/g, 'Cmd+');
  return k.length === 1 || !k.includes('+') ? k.toUpperCase() : k;
}

/** Texte affiché (Maj -> Shift hors du français). */
export function formatCombo(k) {
  const n = normCombo(k);
  return getLang() !== 'fr' ? n.replace(/Maj\+/g, 'Shift+') : n;
}

/**
 * Attend un raccourci. Résout : la combinaison, '' (Retour arrière / Suppr : retirer)
 * ou null (Échap : annuler). `onPreview(text)` reçoit les touches de modification tenues.
 * `signal` (AbortController.signal) arrête l'écoute : la promesse résout alors undefined.
 */
export function captureCombo(onPreview = null, signal = null) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(undefined);
    const onKey = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') return done(null);
      if ((e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.altKey && !e.metaKey) return done('');
      const c = comboOf(e);
      if (!c) {
        // touche de modification seule : on affiche ce qui est tenu
        const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Maj', e.metaKey && 'Cmd'].filter(Boolean);
        if (onPreview) onPreview(mods.length ? formatCombo(mods.join('+') + '+…') : '…');
        return;
      }
      done(c);
    };
    const done = (v) => {
      window.removeEventListener('keydown', onKey, true);
      resolve(v);
    };
    signal?.addEventListener('abort', () => done(undefined), { once: true });
    window.addEventListener('keydown', onKey, true);
  });
}

/**
 * Qui utilise déjà ce raccourci dans le projet ? (expressions, profils, effets, fonds)
 * `except` = { kind, id } de l'élément en cours de modification.
 */
export function keyOwner(doc, combo, except = {}, names = {}) {
  const k = normCombo(combo);
  if (!k) return null;
  const same = (x) => normCombo(x) === k;
  for (const e of doc.expressions) if (same(e.key) && !(except.kind === 'expr' && except.id === e.id)) return e.name;
  for (const p of doc.profiles) if (same(p.key) && !(except.kind === 'profile' && except.id === p.id)) return p.name;
  const fx = doc.pngtuber.effects?.keys || {};
  for (const [id, v] of Object.entries(fx)) if (same(v) && !(except.kind === 'fx' && except.id === id)) return names[id] || id;
  const bg = doc.pngtuber.bgKeys || {};
  for (const [id, v] of Object.entries(bg)) if (same(v) && !(except.kind === 'bg' && except.id === id)) return names[id] || id;
  return null;
}

/** L'évènement clavier correspond-il au raccourci enregistré ? (Maj ignorée pour une touche simple) */
export function matchesCombo(e, k) {
  const n = keyName(e);
  k = normCombo(k);
  if (!n || !k) return false;
  if (!k.includes('+') || k.length === 1) return !e.ctrlKey && !e.altKey && !e.metaKey && k === n;
  return comboOf(e) === k;
}
