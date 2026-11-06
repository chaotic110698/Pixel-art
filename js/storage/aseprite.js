// Import de fichiers Aseprite (.ase / .aseprite).
// Gère : calques et groupes (hiérarchie), cels brutes, compressées (zlib) et liées,
// balises, palette, durées des images, modes RGBA / niveaux de gris / indexé,
// opacité des calques et des cels, calques de référence.
// Spécification : https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md

import { Doc, uid } from '../core/doc.js';
import { rgba, u32ToHex } from '../util/color.js';

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate'); // zlib
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer());
}

class Reader {
  constructor(bytes, offset = 0) {
    this.b = bytes;
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.p = offset;
  }
  byte() { return this.b[this.p++]; }
  word() { const v = this.dv.getUint16(this.p, true); this.p += 2; return v; }
  short() { const v = this.dv.getInt16(this.p, true); this.p += 2; return v; }
  dword() { const v = this.dv.getUint32(this.p, true); this.p += 4; return v; }
  skip(n) { this.p += n; }
  bytes(n) { const v = this.b.subarray(this.p, this.p + n); this.p += n; return v; }
  string() { const n = this.word(); return new TextDecoder().decode(this.bytes(n)); }
}

export async function importAseprite(bytes, fallbackName = 'Aseprite') {
  const r = new Reader(bytes);
  r.dword(); // taille du fichier
  if (r.word() !== 0xa5e0) throw new Error('Ce n\'est pas un fichier Aseprite');
  const nFrames = r.word();
  const width = r.word();
  const height = r.word();
  const depth = r.word(); // 32, 16 ou 8
  r.dword(); // flags
  const speed = r.word();
  r.skip(8);
  const transparentIndex = r.byte();
  r.skip(3);
  r.word(); // nombre de couleurs
  r.skip(2 + 4 + 4 + 84);
  if (width < 1 || height < 1 || width > 4096 || height > 4096) throw new Error('Taille d\'image non prise en charge');

  const doc = new Doc(width, height, fallbackName);
  doc.frames = [];
  const layers = []; // dans l'ordre du fichier (du bas vers le haut)
  let palette = []; // Uint32
  const tags = [];
  const pendingCels = []; // { frame, layerIndex, x, y, opacity, type, w, h, data, linkFrame }

  let p = 128;
  for (let f = 0; f < nFrames; f++) {
    const fr = new Reader(bytes, p);
    const frameBytes = fr.dword();
    if (fr.word() !== 0xf1fa) throw new Error('Fichier Aseprite corrompu (image ' + (f + 1) + ')');
    const oldChunks = fr.word();
    const duration = fr.word() || speed || 100;
    fr.skip(2);
    const newChunks = fr.dword();
    const nChunks = newChunks || oldChunks;
    doc.frames.push({ duration });
    for (let c = 0; c < nChunks; c++) {
      const start = fr.p;
      const size = fr.dword();
      const type = fr.word();
      const cr = new Reader(bytes, fr.p);
      if (type === 0x2004) {
        // calque
        const flags = cr.word();
        const ltype = cr.word();
        const level = cr.word();
        cr.skip(4);
        cr.word(); // mode de fusion (ignoré : normal)
        const opacity = cr.byte();
        cr.skip(3);
        const name = cr.string();
        layers.push({ flags, type: ltype, level, opacity, name });
      } else if (type === 0x2005) {
        // cel
        const layerIndex = cr.word();
        const x = cr.short();
        const y = cr.short();
        const opacity = cr.byte();
        const celType = cr.word();
        cr.short(); // z-index
        cr.skip(5);
        const cel = { frame: f, layerIndex, x, y, opacity, type: celType };
        if (celType === 0 || celType === 2) {
          cel.w = cr.word();
          cel.h = cr.word();
          cel.data = cr.bytes(start + size - cr.p);
        } else if (celType === 1) {
          cel.linkFrame = cr.word();
        }
        pendingCels.push(cel);
      } else if (type === 0x2019) {
        // nouvelle palette
        const total = cr.dword();
        const first = cr.dword();
        const last = cr.dword();
        cr.skip(8);
        if (palette.length < total) palette.length = total;
        for (let i = first; i <= last; i++) {
          const fl = cr.word();
          const R = cr.byte(), G = cr.byte(), B = cr.byte(), A = cr.byte();
          palette[i] = rgba(R, G, B, A);
          if (fl & 1) cr.string();
        }
      } else if ((type === 0x0004 || type === 0x0011) && !palette.length) {
        // ancienne palette
        const packets = cr.word();
        let idx = 0;
        for (let k = 0; k < packets; k++) {
          idx += cr.byte();
          let n = cr.byte();
          if (n === 0) n = 256;
          for (let i = 0; i < n; i++, idx++) {
            let R = cr.byte(), G = cr.byte(), B = cr.byte();
            if (type === 0x0011) { R = (R << 2) | (R >> 4); G = (G << 2) | (G >> 4); B = (B << 2) | (B >> 4); }
            palette[idx] = rgba(R, G, B);
          }
        }
      } else if (type === 0x2018) {
        // balises
        const n = cr.word();
        cr.skip(8);
        for (let i = 0; i < n; i++) {
          const from = cr.word();
          const to = cr.word();
          cr.byte(); // direction
          cr.word(); // répétitions
          cr.skip(6);
          const R = cr.byte(), G = cr.byte(), B = cr.byte();
          cr.skip(1);
          const name = cr.string();
          tags.push({ id: uid('t'), name, from, to, color: u32ToHex(rgba(R, G, B)) });
        }
      }
      fr.p = start + size;
    }
    p += frameBytes;
  }

  // ----- hiérarchie des calques (niveau d'enfant) -----
  const nodes = [];
  const stack = [doc.root];
  for (const L of layers) {
    while (stack.length > L.level + 1) stack.pop();
    const parent = stack[stack.length - 1];
    const common = { visible: !!(L.flags & 1), locked: !(L.flags & 2), opacity: L.opacity / 255 };
    let node;
    if (L.type === 1) {
      node = doc.createGroup(L.name || 'Groupe', { ...common, collapsed: !!(L.flags & 32) });
    } else {
      node = doc.createLayer(L.name || 'Calque', { ...common, reference: !!(L.flags & 64) });
      node.cels = doc.frames.map(() => doc.newCel());
      if (L.type === 2) node.name += ' (tilemap non importée)';
    }
    if (parent === doc.root) doc.insert(node, 'root');
    else doc.adopt(parent, node);
    nodes.push(node);
    if (L.type === 1) stack[L.level + 1] = node, stack.length = L.level + 2;
  }

  // ----- pixels -----
  const bpp = depth / 8;
  const toColor = (px, i) => {
    if (depth === 32) return rgba(px[i], px[i + 1], px[i + 2], px[i + 3]);
    if (depth === 16) return rgba(px[i], px[i], px[i], px[i + 1]);
    const idx = px[i];
    return idx === transparentIndex ? 0 : palette[idx] || 0;
  };
  const decoded = new Map(); // `${frame}:${layer}` -> Uint32Array
  for (const cel of pendingCels.filter((c) => c.type === 0 || c.type === 2)) {
    const node = nodes[cel.layerIndex];
    if (!node || node.type !== 'layer') continue;
    const px = cel.type === 2 ? await inflate(cel.data) : cel.data;
    const out = node.cels[cel.frame];
    const k = cel.opacity / 255;
    for (let y = 0; y < cel.h; y++) {
      const ty = y + cel.y;
      if (ty < 0 || ty >= height) continue;
      for (let x = 0; x < cel.w; x++) {
        const tx = x + cel.x;
        if (tx < 0 || tx >= width) continue;
        let c = toColor(px, (y * cel.w + x) * bpp);
        if (k < 1 && c >>> 24) c = ((c & 0x00ffffff) | (Math.round((c >>> 24) * k) << 24)) >>> 0;
        out[ty * width + tx] = c;
      }
    }
    decoded.set(`${cel.frame}:${cel.layerIndex}`, out);
  }
  // cels liées : même tableau partagé (images liées)
  for (const cel of pendingCels.filter((c) => c.type === 1)) {
    const node = nodes[cel.layerIndex];
    const src = decoded.get(`${cel.linkFrame}:${cel.layerIndex}`);
    if (node?.type === 'layer' && src) node.cels[cel.frame] = src;
  }

  doc.tags = tags.filter((t) => t.from <= t.to && t.to < doc.frames.length);
  doc.fps = Math.max(1, Math.min(60, Math.round(1000 / (doc.frames[0]?.duration || 100))));
  const pal = [...new Set(palette.filter((c) => c !== undefined && c >>> 24).map((c) => u32ToHex((c | 0xff000000) >>> 0)))];
  doc.palette = pal.length ? pal.slice(0, 256) : null;
  const first = doc.allLayers().filter((l) => !l.reference).pop();
  doc.activeId = first?.id || doc.firstLayer()?.id || null;
  return doc;
}
