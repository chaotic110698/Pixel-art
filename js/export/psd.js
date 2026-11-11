// Export PSD (Photoshop, GIMP, Krita, Photopea…) : calques RGBA, groupes (dossiers),
// opacité, visibilité, noms Unicode, image fusionnée. Sans compression (raw).
// Spécification : https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/

import { contentBounds } from '../core/raster.js';
import { composePixels } from '../render/compose.js';

class Writer {
  constructor() {
    this.chunks = [];
    this.len = 0;
  }
  push(u8) {
    this.chunks.push(u8);
    this.len += u8.length;
  }
  u8(v) { this.push(new Uint8Array([v & 255])); }
  u16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v); this.push(b); }
  i16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, v); this.push(b); }
  u32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0); this.push(b); }
  i32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v); this.push(b); }
  str(s) { this.push(new Uint8Array([...s].map((c) => c.charCodeAt(0) & 255))); }
  zeros(n) { this.push(new Uint8Array(n)); }
  result() {
    const out = new Uint8Array(this.len);
    let o = 0;
    for (const c of this.chunks) { out.set(c, o); o += c.length; }
    return out;
  }
}

function pascalName(name) {
  // nom « classique » ASCII, longueur + octets, complété à un multiple de 4
  const ascii = [...name].map((c) => (c.charCodeAt(0) < 128 ? c : '_')).join('').slice(0, 255);
  const total = Math.ceil((ascii.length + 1) / 4) * 4;
  const b = new Uint8Array(total);
  b[0] = ascii.length;
  for (let i = 0; i < ascii.length; i++) b[i + 1] = ascii.charCodeAt(i);
  return b;
}

function unicodeBlock(name) {
  // bloc « luni » : nom Unicode complet
  const w = new Writer();
  w.u32(name.length);
  for (const ch of name) w.u16(ch.charCodeAt(0));
  if (name.length % 2 === 1) w.u16(0); // alignement sur 4 octets
  const data = w.result();
  const out = new Writer();
  out.str('8BIM');
  out.str('luni');
  out.u32(data.length);
  out.push(data);
  return out.result();
}

function sectionBlock(type) {
  const w = new Writer();
  w.str('8BIM');
  w.str('lsct');
  w.u32(4);
  w.u32(type); // 1 = dossier ouvert, 2 = dossier fermé, 3 = séparateur de fin de groupe
  return w.result();
}

/**
 * Liste aplatie des enregistrements de calques, du BAS vers le HAUT (ordre PSD),
 * avec les marqueurs de début / fin de groupe.
 */
function collectRecords(doc, frame) {
  const recs = [];
  const visit = (node, parentVariant, parentGroup) => {
    if (node.type === 'layer') {
      if (node.reference) return;
      const visible = node.visible && (!parentVariant || parentGroup.active === node.id);
      recs.push({ kind: 'layer', name: node.name, opacity: node.opacity, visible, pixels: node.cels[frame] || doc.newCel(), blend: node.blend, clip: !!node.clip, alphaLock: !!node.alphaLock });
      return;
    }
    // groupe : séparateur de fin (en bas), enfants, puis l'en-tête du dossier (en haut)
    recs.push({ kind: 'end', name: '</Layer group>' });
    for (const cid of node.children) visit(doc.get(cid), node.variant, node);
    const visible = node.visible && (!parentVariant || parentGroup.active === node.id);
    recs.push({ kind: 'group', name: node.name + (node.variant ? ' [variantes]' : ''), opacity: node.opacity, visible, collapsed: node.collapsed });
  };
  for (const cid of doc.root.children) visit(doc.get(cid), false, doc.root);
  return recs;
}

/** Clés Photoshop des modes de fusion. */
const PSD_BLEND = { multiply: 'mul ', screen: 'scrn', overlay: 'over', 'soft-light': 'sLit', 'hard-light': 'hLit', darken: 'dark', lighten: 'lite', 'color-dodge': 'div ', 'color-burn': 'idiv', add: 'lddg', difference: 'diff' };

export function encodePSD(doc, { frame = doc.frame } = {}) {
  const W = doc.width, H = doc.height;
  const recs = collectRecords(doc, frame);

  // ----- informations sur les calques -----
  const li = new Writer();
  li.i16(recs.length);
  const channelData = [];
  for (const r of recs) {
    let b = null;
    if (r.kind === 'layer') b = contentBounds(r.pixels, W, H);
    const top = b ? b.y0 : 0, left = b ? b.x0 : 0, bottom = b ? b.y1 + 1 : 0, right = b ? b.x1 + 1 : 0;
    const lw = right - left, lh = bottom - top;
    li.i32(top); li.i32(left); li.i32(bottom); li.i32(right);
    li.u16(4);
    // canaux : -1 alpha, 0 R, 1 G, 2 B — données brutes
    const planes = [new Uint8Array(lw * lh), new Uint8Array(lw * lh), new Uint8Array(lw * lh), new Uint8Array(lw * lh)];
    if (b) {
      for (let y = 0; y < lh; y++) {
        for (let x = 0; x < lw; x++) {
          const c = r.pixels[(top + y) * W + left + x];
          const i = y * lw + x;
          planes[0][i] = c >>> 24;
          planes[1][i] = c & 255;
          planes[2][i] = (c >>> 8) & 255;
          planes[3][i] = (c >>> 16) & 255;
        }
      }
    }
    const ids = [-1, 0, 1, 2];
    for (let k = 0; k < 4; k++) {
      li.i16(ids[k]);
      li.u32(2 + planes[k].length);
    }
    channelData.push(planes);
    li.str('8BIM');
    li.str(PSD_BLEND[r.blend] || 'norm');
    li.u8(Math.round((r.opacity ?? 1) * 255));
    li.u8(r.clip ? 1 : 0); // écrêtage : 1 = calque écrêté sur celui du dessous
    let flags = r.alphaLock ? 1 : 0; // bit 0 : transparence verrouillée
    if (r.visible === false) flags |= 2;
    if (r.kind === 'end') flags |= 2 | 16; // séparateur invisible
    li.u8(flags);
    li.u8(0);
    // données supplémentaires
    const extra = new Writer();
    extra.u32(0); // masque
    extra.u32(0); // plages de fusion
    extra.push(pascalName(r.name));
    extra.push(unicodeBlock(r.name));
    if (r.kind === 'group') extra.push(sectionBlock(r.collapsed ? 2 : 1));
    if (r.kind === 'end') extra.push(sectionBlock(3));
    const ex = extra.result();
    li.u32(ex.length);
    li.push(ex);
  }
  for (const planes of channelData) {
    for (const p of planes) {
      li.u16(0); // brut
      li.push(p);
    }
  }
  let layerInfo = li.result();
  if (layerInfo.length % 2) {
    const padded = new Uint8Array(layerInfo.length + 1);
    padded.set(layerInfo);
    layerInfo = padded;
  }

  // ----- fichier -----
  const w = new Writer();
  w.str('8BPS');
  w.u16(1);
  w.zeros(6);
  w.u16(4); // R, G, B, A pour l'image fusionnée
  w.u32(H);
  w.u32(W);
  w.u16(8);
  w.u16(3); // RVB
  w.u32(0); // données du mode couleur
  w.u32(0); // ressources d'image
  w.u32(4 + layerInfo.length + 4); // calques et masques
  w.u32(layerInfo.length);
  w.push(layerInfo);
  w.u32(0); // masque global
  // image fusionnée (plans R, G, B, A)
  const merged = composePixels(doc, { frame, includeReference: false });
  w.u16(0);
  for (const shift of [0, 8, 16, 24]) {
    const plane = new Uint8Array(W * H);
    for (let i = 0; i < merged.length; i++) plane[i] = (merged[i] >>> shift) & 255;
    w.push(plane);
  }
  return w.result();
}
