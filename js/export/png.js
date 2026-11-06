// Encodeur PNG exact (RGBA 8 bits) : aucune perte, alpha non prémultiplié,
// aucun lissage. Compression zlib via CompressionStream('deflate') si disponible,
// sinon blocs « stored ».

import { crc32 } from './zip.js';

function adler32(bytes) {
  let a = 1, b = 0;
  const MOD = 65521;
  for (let i = 0; i < bytes.length;) {
    const end = Math.min(i + 5552, bytes.length);
    for (; i < end; i++) {
      a += bytes[i];
      b += a;
    }
    a %= MOD;
    b %= MOD;
  }
  return ((b << 16) | a) >>> 0;
}

async function zlib(bytes) {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('deflate');
      return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer());
    } catch (_) { /* repli */ }
  }
  // zlib « stored » (sans compression)
  const blocks = Math.ceil(bytes.length / 65535) || 1;
  const out = new Uint8Array(2 + bytes.length + blocks * 5 + 4);
  out[0] = 0x78; out[1] = 0x01;
  let o = 2;
  for (let i = 0; i < blocks; i++) {
    const start = i * 65535;
    const len = Math.min(65535, bytes.length - start);
    out[o++] = i === blocks - 1 ? 1 : 0;
    out[o++] = len & 255; out[o++] = len >> 8;
    out[o++] = ~len & 255; out[o++] = (~len >> 8) & 255;
    out.set(bytes.subarray(start, start + len), o);
    o += len;
  }
  const ad = adler32(bytes);
  out[o++] = ad >>> 24; out[o++] = (ad >>> 16) & 255; out[o++] = (ad >>> 8) & 255; out[o++] = ad & 255;
  return out;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** data : Uint32Array (0xAABBGGRR) w×h -> Uint8Array PNG */
export async function encodePNG(data, w, h) {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, w * h * 4);
  const stride = w * 4;
  // filtre « Sub » sur chaque ligne : bonne compression pour le pixel art
  const raw = new Uint8Array((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    const ro = y * (stride + 1);
    raw[ro] = 1;
    const so = y * stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= 4 ? bytes[so + i - 4] : 0;
      raw[ro + 1 + i] = (bytes[so + i] - left) & 255;
    }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  const idat = await zlib(raw);
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Agrandissement entier au plus proche voisin (aucun lissage possible). */
export function upscale(data, w, h, s) {
  if (s === 1) return data;
  const nw = w * s, nh = h * s;
  const out = new Uint32Array(nw * nh);
  for (let y = 0; y < h; y++) {
    const row = new Uint32Array(nw);
    for (let x = 0; x < w; x++) row.fill(data[y * w + x], x * s, x * s + s);
    for (let k = 0; k < s; k++) out.set(row, (y * s + k) * nw);
  }
  return out;
}

export function crop(data, w, x0, y0, cw, ch) {
  const out = new Uint32Array(cw * ch);
  for (let y = 0; y < ch; y++) out.set(data.subarray((y0 + y) * w + x0, (y0 + y) * w + x0 + cw), y * cw);
  return out;
}
