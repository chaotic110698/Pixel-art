// Images de l'avatar : une combinaison (expression, bouche, clignement) donne une
// liste de variantes à forcer (overrides), utilisée par le mode PNGtuber, la
// fenêtre de capture et les exports.

import { composeToCanvas, composePixels } from '../render/compose.js';
import { encodePNG } from '../export/png.js';
import { bytesToBase64 } from '../util/dom.js';

export const MOUTHS = ['closed', 'half', 'open'];

export function hasHalf(doc) {
  const c = doc.pngtuber;
  return !!(c.mouthHalf && doc.get(c.mouthHalf) && doc.get(c.mouthGroup));
}

/** Variantes à afficher pour une expression (null = état actuel), une bouche et un clignement. */
export function avatarOverrides(doc, exprId, mouth, blink) {
  const c = doc.pngtuber;
  const ov = {};
  const e = exprId ? doc.expressions.find((x) => x.id === exprId) : null;
  if (e) Object.assign(ov, e.states);
  if (c.mouthGroup && doc.get(c.mouthGroup)) {
    const id = mouth === 'open' ? c.mouthOpen : mouth === 'half' ? (c.mouthHalf || c.mouthOpen) : null;
    if (id && doc.get(id)) ov[c.mouthGroup] = id;
    else if (mouth === 'closed' && !e?.states[c.mouthGroup] && c.mouthClosed && doc.get(c.mouthClosed)) ov[c.mouthGroup] = c.mouthClosed;
  }
  if (blink && c.eyesGroup && c.eyesClosed && doc.get(c.eyesClosed)) ov[c.eyesGroup] = c.eyesClosed;
  return ov;
}

export function avatarExpressions(doc) {
  return doc.expressions.map((e) => ({ id: e.id, name: e.name, key: e.key || null, hold: !!e.hold }));
}

/** Réglages utiles au moteur (copie). */
export function avatarSettings(doc) {
  return { ...doc.pngtuber, hasHalf: hasHalf(doc) };
}

/** Fournisseur d'images pour le moteur, avec cache (canvas composés). */
export function makeImageProvider(doc) {
  const cache = new Map();
  const get = (exprId, mouth, blink) => {
    const ov = avatarOverrides(doc, exprId, mouth, blink);
    const key = JSON.stringify(ov);
    let c = cache.get(key);
    if (!c) {
      c = composeToCanvas(doc, { overrides: ov, includeReference: false });
      cache.set(key, c);
      if (cache.size > 64) cache.delete(cache.keys().next().value);
    }
    return c;
  };
  get.clear = () => cache.clear();
  return get;
}

/** Expression de départ : celle qui correspond à l'état actuel, sinon « Neutre », sinon aucune. */
export function initialExpression(doc) {
  const cur = JSON.stringify(Object.fromEntries(doc.variantGroups().map((g) => [g.id, g.active])));
  return doc.expressions.find((e) => JSON.stringify(e.states) === cur)?.id
    || doc.expressions.find((e) => /neutre|neutral/i.test(e.name))?.id
    || doc.expressions[0]?.id || null;
}

/**
 * Toutes les images de l'avatar en PNG exact (data URL), clé « expr|bouche|0/1 ».
 * Les images identiques sont partagées (dictionnaire `files`).
 */
export async function buildAvatarImages(doc) {
  const exprs = [null, ...doc.expressions.map((e) => e.id)];
  const mouths = hasHalf(doc) ? MOUTHS : ['closed', 'open'];
  const files = {}; // signature -> data URL
  const map = {}; // clé -> signature
  for (const ex of exprs) {
    for (const m of mouths) {
      for (const b of [0, 1]) {
        const ov = avatarOverrides(doc, ex, m, !!b);
        const sig = JSON.stringify(ov);
        if (!files[sig]) {
          const px = composePixels(doc, { overrides: ov, includeReference: false });
          files[sig] = 'data:image/png;base64,' + bytesToBase64(await encodePNG(px, doc.width, doc.height));
        }
        map[`${ex || ''}|${m}|${b}`] = sig;
      }
    }
  }
  return { files, map };
}
