// Couleurs empaquetées en Uint32 little-endian : 0xAABBGGRR (ordre mémoire RGBA).
// Tous les navigateurs ciblés sont little-endian, ce qui permet de lire/écrire
// les pixels d'un Uint32Array partagé avec un ImageData sans conversion.

export const TRANSPARENT = 0;

export function rgba(r, g, b, a = 255) {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function toRgba(c) {
  return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, (c >>> 24) & 255];
}

export function alphaOf(c) {
  return c >>> 24;
}

export function hexToU32(hex) {
  if (typeof hex !== 'string') return 0;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3 || h.length === 4) h = [...h].map((ch) => ch + ch).join('');
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(h)) return 0;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255;
  return rgba(r, g, b, a);
}

const hx = (n) => n.toString(16).padStart(2, '0');

export function u32ToHex(c, forceAlpha = false) {
  const [r, g, b, a] = toRgba(c);
  return '#' + hx(r) + hx(g) + hx(b) + (forceAlpha || a !== 255 ? hx(a) : '');
}

export function isValidHex(hex) {
  return /^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test((hex || '').trim());
}

export function normHex(hex) {
  return u32ToHex(hexToU32(hex));
}

export function cssColor(c) {
  const [r, g, b, a] = toRgba(c);
  return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Variation de teinte façon pixel art : plus sombre = teinte qui glisse vers le bleu/violet. */
export function shadeHex(hex, dl, hueShift = 0, ds = 0) {
  const [r, g, b, a] = toRgba(hexToU32(hex));
  let [h, s, l] = rgbToHsl(r, g, b);
  l = Math.max(0, Math.min(1, l + dl));
  s = Math.max(0, Math.min(1, s + ds));
  h += hueShift;
  const [nr, ng, nb] = hslToRgb(h, s, l);
  return u32ToHex(rgba(nr, ng, nb, a));
}

/** Composition « source over » de deux couleurs non prémultipliées. */
export function blendOver(dst, src, opacity = 1) {
  const sa = ((src >>> 24) / 255) * opacity;
  if (sa <= 0) return dst;
  const da = (dst >>> 24) / 255;
  if (sa >= 1 || da === 0) {
    if (sa >= 1) return src;
    return rgba(src & 255, (src >>> 8) & 255, (src >>> 16) & 255, Math.round(sa * 255));
  }
  const oa = sa + da * (1 - sa);
  const ch = (shift) => {
    const s = (src >>> shift) & 255, d = (dst >>> shift) & 255;
    return Math.round((s * sa + d * da * (1 - sa)) / oa);
  };
  return rgba(ch(0), ch(8), ch(16), Math.round(oa * 255));
}

export function luminance(c) {
  const [r, g, b] = toRgba(c);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
