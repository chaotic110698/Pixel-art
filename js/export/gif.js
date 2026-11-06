// Encodeur GIF animé (GIF89a, LZW), transparence préservée (alpha < 128 = transparent).

import { extractPalette } from '../core/palettes.js';
import { hexToU32, toRgba } from '../util/color.js';

class ByteWriter {
  constructor() {
    this.buf = new Uint8Array(1 << 16);
    this.len = 0;
  }
  ensure(n) {
    if (this.len + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n) size *= 2;
    const nb = new Uint8Array(size);
    nb.set(this.buf.subarray(0, this.len));
    this.buf = nb;
  }
  byte(b) {
    this.ensure(1);
    this.buf[this.len++] = b & 255;
  }
  u16(v) {
    this.byte(v & 255);
    this.byte((v >> 8) & 255);
  }
  bytes(arr) {
    this.ensure(arr.length);
    this.buf.set(arr, this.len);
    this.len += arr.length;
  }
  str(s) {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }
  result() {
    return this.buf.slice(0, this.len);
  }
}

function lzwEncode(indices, minCodeSize, w) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  let dict = new Map();
  let cur = 0, bits = 0;
  const out = [];
  const emit = (code) => {
    cur |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      out.push(cur & 255);
      cur >>>= 8;
      bits -= 8;
    }
  };
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 4096 + k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > (1 << codeSize) && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      dict = new Map();
      codeSize = minCodeSize + 1;
      next = eoi + 1;
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bits > 0) out.push(cur & 255);
  void w;
  return out;
}

/**
 * frames : [{ data: Uint32Array, delay: ms }], toutes w×h.
 * Retourne Uint8Array GIF.
 */
export function encodeGIF(frames, w, h, { loop = 0 } = {}) {
  // palette globale
  let hasTransparent = false;
  const colors = new Map();
  for (const f of frames) {
    const d = f.data;
    for (let i = 0; i < d.length; i++) {
      const c = d[i];
      if ((c >>> 24) < 128) { hasTransparent = true; continue; }
      const key = c & 0xffffff;
      colors.set(key, (colors.get(key) || 0) + 1);
    }
  }
  const maxColors = hasTransparent ? 255 : 256;
  let palette; // tableau de [r,g,b]
  const exact = colors.size <= maxColors;
  if (exact) palette = [...colors.keys()].map((k) => [k & 255, (k >> 8) & 255, (k >> 16) & 255]);
  else {
    // quantification : median cut sur un échantillon de pixels
    const rgba = [];
    for (const [k, n] of colors) for (let j = 0; j < Math.min(n, 4); j++) rgba.push(k & 255, (k >> 8) & 255, (k >> 16) & 255, 255);
    palette = extractPalette({ data: new Uint8ClampedArray(rgba) }, maxColors).map((hx) => toRgba(hexToU32(hx)).slice(0, 3));
  }
  const offset = hasTransparent ? 1 : 0;
  const total = palette.length + offset;
  let bitsPer = 1;
  while (1 << bitsPer < total) bitsPer++;
  const tableSize = 1 << bitsPer;
  const lookup = new Map();
  if (exact) palette.forEach(([r, g, b], i) => lookup.set(r | (g << 8) | (b << 16), i + offset));
  const nearest = (key) => {
    let v = lookup.get(key);
    if (v !== undefined) return v;
    const r = key & 255, g = (key >> 8) & 255, b = (key >> 16) & 255;
    let best = 0, bd = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    v = best + offset;
    lookup.set(key, v);
    return v;
  };

  const out = new ByteWriter();
  out.str('GIF89a');
  out.u16(w);
  out.u16(h);
  out.byte(0x80 | ((bitsPer - 1) << 4) | (bitsPer - 1));
  out.byte(0);
  out.byte(0);
  for (let i = 0; i < tableSize; i++) {
    const p = i < offset ? [0, 0, 0] : palette[i - offset] || [0, 0, 0];
    out.byte(p[0]); out.byte(p[1]); out.byte(p[2]);
  }
  if (frames.length > 1) {
    out.bytes([0x21, 0xff, 0x0b]);
    out.str('NETSCAPE2.0');
    out.bytes([3, 1]);
    out.u16(loop);
    out.byte(0);
  }
  const minCode = Math.max(2, bitsPer);
  for (const f of frames) {
    // extension de contrôle graphique
    out.bytes([0x21, 0xf9, 4]);
    out.byte((hasTransparent ? 2 << 2 : 1 << 2) | (hasTransparent ? 1 : 0));
    out.u16(Math.max(2, Math.round((f.delay || 100) / 10)));
    out.byte(0);
    out.byte(0);
    out.byte(0x2c);
    out.u16(0); out.u16(0); out.u16(w); out.u16(h);
    out.byte(0);
    const idx = new Uint8Array(w * h);
    const d = f.data;
    for (let i = 0; i < d.length; i++) {
      const c = d[i];
      idx[i] = (c >>> 24) < 128 ? 0 : nearest(c & 0xffffff);
    }
    out.byte(minCode);
    const data = lzwEncode(idx, minCode, w);
    for (let i = 0; i < data.length; i += 255) {
      const n = Math.min(255, data.length - i);
      out.byte(n);
      out.bytes(data.slice(i, i + n));
    }
    out.byte(0);
  }
  out.byte(0x3b);
  return out.result();
}
