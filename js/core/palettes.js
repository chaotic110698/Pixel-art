// Palettes prédéfinies + import/export (.hex, .gpl, .json) + extraction (median cut).

import { toRgba, rgba, u32ToHex, hexToU32 } from '../util/color.js';

const P = (s) => s.split(/\s+/).filter(Boolean).map((x) => '#' + x);

export const PRESET_PALETTES = [
  { id: 'pico8', name: 'PICO-8', colors: P('000000 1d2b53 7e2553 008751 ab5236 5f574f c2c3c7 fff1e8 ff004d ffa300 ffec27 00e436 29adff 83769c ff77a8 ffccaa') },
  { id: 'endesga32', name: 'Endesga 32', colors: P('be4a2f d77643 ead4aa e4a672 b86f50 733e39 3e2731 a22633 e43b44 f77622 feae34 fee761 63c74d 3e8948 265c42 193c3e 124e89 0099db 2ce8f5 ffffff c0cbdc 8b9bb4 5a6988 3a4466 262b44 181425 ff0044 68386c b55088 f6757a e8b796 c28569') },
  { id: 'gameboy', name: 'Game Boy', colors: P('0f380f 306230 8bac0f 9bbc0f') },
  { id: 'sweetie16', name: 'Sweetie 16', colors: P('1a1c2c 5d275d b13e53 ef7d57 ffcd75 a7f070 38b764 257179 29366f 3b5dc9 41a6f6 73eff7 f4f4f4 94b0c2 566c86 333c57') },
  { id: 'db16', name: 'DawnBringer 16', colors: P('140c1c 442434 30346d 4e4a4e 854c30 346524 d04648 757161 597dce d27d2c 8595a1 6daa2c d2aa99 6dc2ca dad45e deeed6') },
  { id: 'cga', name: 'CGA', colors: P('000000 555555 aaaaaa ffffff 0000aa 5555ff 00aa00 55ff55 00aaaa 55ffff aa0000 ff5555 aa00aa ff55ff aa5500 ffff55') },
  { id: 'skin', name: 'Peaux & cheveux', colors: P('ffe0cc f5c6a5 e8a87c d08b5b b06a3e 8a4b2a 5e3220 3b1f14 fff2a8 f2c94c c98a2e 7a4a1e 3d2314 1e1410 b0b0b8 f0f0f4 d94a4a ff8fb0 7a5cff 4ab0ff') },
  { id: 'gray', name: 'Niveaux de gris', colors: P('000000 1c1c1c 383838 555555 717171 8e8e8e aaaaaa c6c6c6 e2e2e2 ffffff') },
];

export function presetById(id) {
  return PRESET_PALETTES.find((p) => p.id === id) || PRESET_PALETTES[1];
}

// ---------- Import / export ----------
export function exportHex(colors) {
  return colors.map((c) => c.replace('#', '').slice(0, 6)).join('\n') + '\n';
}

export function exportGpl(colors, name = 'Palette') {
  const lines = ['GIMP Palette', `Name: ${name}`, 'Columns: 8', '#'];
  for (const c of colors) {
    const [r, g, b] = toRgba(hexToU32(c));
    lines.push(`${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${c}`);
  }
  return lines.join('\n') + '\n';
}

export function parsePalette(text, filename = '') {
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    const j = JSON.parse(t);
    const arr = Array.isArray(j) ? j : j.colors;
    return arr.map((c) => u32ToHex(hexToU32(c)));
  }
  if (/^GIMP Palette/i.test(t) || filename.endsWith('.gpl')) {
    const out = [];
    for (const line of t.split(/\r?\n/)) {
      const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)/);
      if (m) out.push(u32ToHex(rgba(+m[1], +m[2], +m[3])));
    }
    return out;
  }
  // JASC-PAL
  if (/^JASC-PAL/.test(t)) {
    return t.split(/\r?\n/).slice(3).map((l) => l.trim().split(/\s+/).map(Number)).filter((a) => a.length >= 3 && a.every((n) => !isNaN(n))).map(([r, g, b]) => u32ToHex(rgba(r, g, b)));
  }
  // .hex : une couleur par ligne
  return t.split(/[\s,;]+/).filter((x) => /^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(x)).map((x) => u32ToHex(hexToU32(x)));
}

/** Extraction de palette par « median cut » à partir de pixels RGBA. */
export function extractPalette(imageData, maxColors = 32) {
  const d = imageData.data;
  const counts = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let colors = [...counts.entries()].map(([k, n]) => ({ r: (k >> 16) & 255, g: (k >> 8) & 255, b: k & 255, n }));
  if (colors.length <= maxColors) {
    return colors.sort((a, b) => b.n - a.n).map((c) => u32ToHex(rgba(c.r, c.g, c.b)));
  }
  let boxes = [colors];
  while (boxes.length < maxColors) {
    // boîte avec la plus grande étendue pondérée
    let best = -1, bestScore = -1, bestCh = 'r';
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (const ch of ['r', 'g', 'b']) {
        let mn = 255, mx = 0;
        for (const c of box) { if (c[ch] < mn) mn = c[ch]; if (c[ch] > mx) mx = c[ch]; }
        const score = (mx - mn) * Math.log2(box.length + 1);
        if (score > bestScore) { bestScore = score; best = i; bestCh = ch; }
      }
    });
    if (best < 0) break;
    const box = boxes[best].sort((a, b) => a[bestCh] - b[bestCh]);
    const total = box.reduce((s, c) => s + c.n, 0);
    let acc = 0, cut = 1;
    for (let i = 0; i < box.length; i++) {
      acc += box[i].n;
      if (acc >= total / 2) { cut = Math.max(1, Math.min(box.length - 1, i + 1)); break; }
    }
    boxes.splice(best, 1, box.slice(0, cut), box.slice(cut));
  }
  return boxes
    .map((box) => {
      const t = box.reduce((s, c) => s + c.n, 0);
      const avg = (ch) => Math.round(box.reduce((s, c) => s + c[ch] * c.n, 0) / t);
      return { hex: u32ToHex(rgba(avg('r'), avg('g'), avg('b'))), n: t };
    })
    .sort((a, b) => b.n - a.n)
    .map((x) => x.hex);
}
