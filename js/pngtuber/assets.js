// Images de l'avatar : une combinaison (profil, expression, bouche, clignement)
// donne les variantes et visibilités à forcer. Utilisé par le mode PNGtuber, la
// fenêtre de capture et les exports.

import { composeToCanvas, composePixels } from '../render/compose.js';
import { encodePNG } from '../export/png.js';
import { bytesToBase64 } from '../util/dom.js';
import { docFacing } from '../library/library.js';

export const MOUTHS = ['closed', 'half', 'open'];

export function profileOf(doc, profileId) {
  return profileId ? doc.profiles.find((p) => p.id === profileId) || null : null;
}

/** Réglages bouche/yeux effectifs (ceux du profil s'il en définit). */
export function pngtuberConfig(doc, profileId = null) {
  const p = profileOf(doc, profileId);
  const c = { ...doc.pngtuber };
  if (p?.pngtuber) for (const [k, v] of Object.entries(p.pngtuber)) if (v !== undefined && (v === null || doc.get(v))) c[k] = v;
  return c;
}

export function hasHalf(doc, profileId = null) {
  const c = pngtuberConfig(doc, profileId);
  return !!(c.mouthHalf && doc.get(c.mouthHalf) && doc.get(c.mouthGroup));
}

/**
 * Rendu d'une combinaison : { overrides (variantes), visibility (profil) }.
 * profileId / exprId : null = état actuel du document.
 */
export function avatarRender(doc, profileId, exprId, mouth, blink) {
  const p = profileOf(doc, profileId);
  const c = pngtuberConfig(doc, profileId);
  const ov = {};
  if (p) Object.assign(ov, p.states);
  const e = exprId ? doc.expressions.find((x) => x.id === exprId) : null;
  if (e) Object.assign(ov, e.states);
  if (c.mouthGroup && doc.get(c.mouthGroup)) {
    const id = mouth === 'open' ? c.mouthOpen : mouth === 'half' ? (c.mouthHalf || c.mouthOpen) : null;
    if (id && doc.get(id)) ov[c.mouthGroup] = id;
    else if (mouth === 'closed' && !e?.states[c.mouthGroup] && c.mouthClosed && doc.get(c.mouthClosed)) ov[c.mouthGroup] = c.mouthClosed;
  }
  if (blink && c.eyesGroup && c.eyesClosed && doc.get(c.eyesClosed)) ov[c.eyesGroup] = c.eyesClosed;
  return { overrides: ov, visibility: p ? p.visibility : null };
}

/** Compatibilité : variantes seules (sans profil). */
export function avatarOverrides(doc, exprId, mouth, blink) {
  return avatarRender(doc, null, exprId, mouth, blink).overrides;
}

export function avatarExpressions(doc) {
  return doc.expressions.map((e) => ({ id: e.id, name: e.name, key: e.key || null, hold: !!e.hold }));
}

export function avatarProfiles(doc) {
  return doc.profiles.map((p) => ({ id: p.id, name: p.name, key: p.key || null }));
}

// Effets liés par défaut aux expressions, d'après leur nom (tant que l'utilisateur n'a rien choisi).
const DEFAULT_EXPR_FX = [
  [/content|joie|happy|heureu/i, ['hearts', 'sparkles']],
  [/f[âa]ch|col[èe]re|angry|mad/i, ['vein', 'flames']],
  [/surpri/i, ['bang', 'lines', 'impact']],
  [/triste|sad|pleur/i, ['tears']],
  [/endormi|dort|sleep|zzz/i, ['zzz']],
  [/g[êe]n|embarrass/i, ['sweat']],
  [/question|perplex|confus/i, ['quest']],
];

/** Réglages des effets (doc.pngtuber.effects complétés ; ambiance propre au profil si définie). */
export function effectsConfig(doc, profileId = null) {
  const e = doc.pngtuber.effects || {};
  let byExpr = e.byExpr;
  if (!byExpr) {
    byExpr = {};
    for (const x of doc.expressions) {
      const hit = DEFAULT_EXPR_FX.find(([rx]) => rx.test(x.name));
      if (hit) byExpr[x.id] = hit[1];
    }
  }
  const p = profileOf(doc, profileId);
  return {
    ambient: p && Array.isArray(p.fxAmbient) ? p.fxAmbient : e.ambient || [],
    voice: e.voice || [],
    keys: e.keys || {},
    byExpr,
    shout: e.shout || [],
    intensity: e.intensity || 1,
    transformDuration: e.transformDuration || 0, // transformations : 0 = jusqu'au prochain appui
    facing: docFacing(doc), // sens du personnage de profil (chapeaux des tenues) : 'left', 'right' ou null (face)
    features: faceFeatures(doc), // yeux et bouche (effets « memes »)
  };
}

/**
 * Repères du visage pour les effets (lunettes, lasers, nez de clown…) : boîtes des yeux
 * (une par œil, dans l'ordre gauche-droite), de la bouche et du visage, en pixels du
 * document, d'après les groupes de variantes « yeux » et « bouche » ; null sans pièces.
 */
export function faceFeatures(doc) {
  const box = (group) => {
    if (!group) return null;
    const W = doc.width, H = doc.height;
    const cols = new Uint8Array(W);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    const layers = [];
    doc.walk((n) => { if (n.type === 'layer') layers.push(n); }, group);
    for (const l of layers) {
      const c = l.cels[0];
      if (!c) continue;
      for (let i = 0; i < c.length; i++) {
        if (!(c[i] >>> 24)) continue;
        const x = i % W, y = (i / W) | 0;
        cols[x] = 1;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return null;
    // morceaux séparés par au moins une colonne vide (un par œil)
    const parts = [];
    for (let x = x0; x <= x1; x++) {
      if (!cols[x]) continue;
      let e = x;
      while (e + 1 <= x1 && cols[e + 1]) e++;
      parts.push([x, y0, e, y1]);
      x = e;
    }
    return { all: [x0, y0, x1, y1], parts };
  };
  const byRole = (role) => [...doc.nodes.values()].find((n) => n.type === 'group' && n.role === role);
  const eyes = box(byRole('eyes')), mouth = box(byRole('mouth'));
  if (!eyes && !mouth) return null;
  // nez : pièce « nez » de la bibliothèque (sinon estimé par les effets d'après le profil)
  const noseNode = [...doc.nodes.values()].find((n) => n.part?.category === 'nose' && doc.get(n.parent)?.id === 'root');
  const nose = noseNode ? box(noseNode.type === 'group' ? noseNode : { children: [noseNode.id] }) : null;
  // deux plus grands morceaux pour les yeux (les sourcils ou détails fins sont ignorés)
  let ep = eyes ? [...eyes.parts].sort((a, b) => (b[2] - b[0]) - (a[2] - a[0])).slice(0, 2).sort((a, b) => a[0] - b[0]) : [];
  return { eyes: ep, eyesAll: eyes ? eyes.all : null, mouth: mouth ? mouth.all : null, nose: nose ? nose.all : null };
}

/** Réglages utiles au moteur (copie), pour un profil donné. */
export function avatarSettings(doc, profileId = null) {
  return { ...pngtuberConfig(doc, profileId), hasHalf: hasHalf(doc, profileId), effects: effectsConfig(doc, profileId) };
}

/** Fournisseur d'images pour le moteur, avec cache (canvas composés). */
export function makeImageProvider(doc) {
  const cache = new Map();
  const get = (profileId, exprId, mouth, blink) => {
    const r = avatarRender(doc, profileId, exprId, mouth, blink);
    const key = JSON.stringify(r);
    let c = cache.get(key);
    if (!c) {
      c = composeToCanvas(doc, { overrides: r.overrides, visibility: r.visibility, includeReference: false });
      cache.set(key, c);
      if (cache.size > 96) cache.delete(cache.keys().next().value);
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
 * Toutes les images de l'avatar en PNG exact (data URL), clé « profil|expr|bouche|0/1 ».
 * Les images identiques sont partagées (dictionnaire `files`).
 */
export async function buildAvatarImages(doc) {
  const profiles = [null, ...doc.profiles.map((p) => p.id)];
  const exprs = [null, ...doc.expressions.map((e) => e.id)];
  const files = {}; // signature -> data URL
  const map = {}; // clé -> signature
  for (const pf of profiles) {
    const mouths = hasHalf(doc, pf) ? MOUTHS : ['closed', 'open'];
    for (const ex of exprs) {
      for (const m of mouths) {
        for (const b of [0, 1]) {
          const r = avatarRender(doc, pf, ex, m, !!b);
          const sig = JSON.stringify(r);
          if (!files[sig]) {
            const px = composePixels(doc, { overrides: r.overrides, visibility: r.visibility, includeReference: false });
            files[sig] = 'data:image/png;base64,' + bytesToBase64(await encodePNG(px, doc.width, doc.height));
          }
          map[`${pf || ''}|${ex || ''}|${m}|${b}`] = sig;
        }
      }
    }
  }
  // signatures longues -> identifiants courts
  const short = {};
  const out = {};
  Object.keys(files).forEach((sig, i) => { short[sig] = 'i' + i; out['i' + i] = files[sig]; });
  for (const k of Object.keys(map)) map[k] = short[map[k]];
  return { files: out, map };
}
