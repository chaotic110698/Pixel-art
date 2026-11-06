// Création d'un personnage de base et réglages PNGtuber automatiques.

import { Doc, uid } from '../core/doc.js';
import { insertPiece, pieceById } from './library.js';
import { presetById } from '../core/palettes.js';

export const DEFAULT_CHARACTER = {
  body: 'body-moyen',
  head: 'head-round',
  hair: 'hair-short',
  eyes: 'eyes-big',
  brows: 'brows-thin',
  nose: 'nose-small',
  mouth: 'mouth-simple',
  top: 'top-tshirt',
  accessories: ['acc-blush'],
};

export const EXPRESSION_PRESETS = [
  { name: 'Neutre', key: '1', eyes: 'open', mouth: 'closed', brows: 'normal' },
  { name: 'Parle', key: '2', eyes: 'open', mouth: 'open', brows: 'normal' },
  { name: 'Content', key: '3', eyes: 'happy', mouth: 'smile', brows: 'high' },
  { name: 'Triste', key: '4', eyes: 'open', mouth: 'sad', brows: 'sad' },
  { name: 'Surpris', key: '5', eyes: 'surprised', mouth: 'surprised', brows: 'high' },
  { name: 'Fâché', key: '6', eyes: 'open', mouth: 'closed', brows: 'angry' },
  { name: 'Yeux fermés', key: '7', eyes: 'closed', mouth: 'closed', brows: 'normal' },
];

/** Groupe de variantes ayant un rôle donné (eyes, mouth, brows). */
export function groupByRole(doc, role) {
  return doc.variantGroups().find((g) => g.role === role) || null;
}

export function childByState(doc, group, state) {
  if (!group) return null;
  return group.children.map((id) => doc.get(id)).find((c) => c?.part?.state === state) || null;
}

/** Remplit doc.pngtuber (bouche/yeux) d'après les rôles, si non défini. */
export function autoPngtuber(doc, force = false) {
  const pt = doc.pngtuber;
  const mouth = groupByRole(doc, 'mouth') || doc.variantGroups().find((g) => /bouche|mouth/i.test(g.name));
  const eyes = groupByRole(doc, 'eyes') || doc.variantGroups().find((g) => /yeux|eyes|œil|oeil/i.test(g.name));
  const pick = (g, state, rx) => childByState(doc, g, state)?.id || g?.children.map((id) => doc.get(id)).find((c) => rx.test(c.name))?.id || null;
  if (mouth && (force || !doc.get(pt.mouthGroup))) {
    pt.mouthGroup = mouth.id;
    pt.mouthOpen = pick(mouth, 'open', /ouvert|open/i) || mouth.children[0];
    pt.mouthClosed = pick(mouth, 'closed', /ferm|closed/i) || mouth.children[mouth.children.length - 1];
    pt.mouthHalf = childByState(doc, mouth, 'half')?.id || mouth.children.map((id) => doc.get(id)).find((c) => /entrouv|half|mi-/i.test(c.name))?.id || null;
  }
  if (eyes && (force || !doc.get(pt.eyesGroup))) {
    pt.eyesGroup = eyes.id;
    pt.eyesOpen = pick(eyes, 'open', /ouvert|open/i) || eyes.children[eyes.children.length - 1];
    pt.eyesClosed = pick(eyes, 'closed', /ferm|closed/i) || eyes.children[0];
  }
}

export function addDefaultExpressions(doc) {
  const groups = { eyes: groupByRole(doc, 'eyes'), mouth: groupByRole(doc, 'mouth'), brows: groupByRole(doc, 'brows') };
  for (const p of EXPRESSION_PRESETS) {
    const states = {};
    for (const role of ['eyes', 'mouth', 'brows']) {
      const c = childByState(doc, groups[role], p[role]);
      if (c) states[groups[role].id] = c.id;
    }
    if (Object.keys(states).length) doc.expressions.push({ id: uid('x'), name: p.name, states, key: p.key });
  }
}

/** Construit un nouveau document personnage. sel : { body, head, ... , accessories[] } */
export function buildCharacter({ width = 64, height = 64, name = 'Mon personnage', colors, sel = DEFAULT_CHARACTER }) {
  const doc = new Doc(width, height, name);
  doc.palette = [...presetById('skin').colors];
  doc.charColors = { ...colors };
  const order = ['body', 'top', 'head', 'nose', 'mouth', 'eyes', 'brows', 'hair'];
  for (const k of order) {
    const p = sel[k] && pieceById(sel[k]);
    if (p) insertPiece(doc, p, { colors });
  }
  for (const id of sel.accessories || []) {
    const p = pieceById(id);
    if (p) insertPiece(doc, p, { colors, replace: true });
  }
  addDefaultExpressions(doc);
  autoPngtuber(doc, true);
  // calque libre pour dessiner par-dessus
  const free = doc.createLayer('Dessin libre');
  doc.insert(free, 'root');
  doc.activeId = free.id;
  return doc;
}
