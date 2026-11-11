// Polices pixel de l'outil Texte : glyphes dessinés à la main (une ligne = une chaîne,
// « # » = pixel). Largeur variable (police proportionnelle). Les accents du français sont
// ajoutés au-dessus des minuscules de la police Classique ; ailleurs, la lettre de base
// est utilisée.

const P = (s) => s.split(' ');

/** Petite 3×5 : majuscules, chiffres, ponctuation (minuscules affichées en majuscules). */
const SMALL = {
  A: P('.#. #.# ### #.# #.#'), B: P('##. #.# ##. #.# ##.'), C: P('.## #.. #.. #.. .##'), D: P('##. #.# #.# #.# ##.'),
  E: P('### #.. ##. #.. ###'), F: P('### #.. ##. #.. #..'), G: P('.## #.. #.# #.# .##'), H: P('#.# #.# ### #.# #.#'),
  I: P('### .#. .#. .#. ###'), J: P('..# ..# ..# #.# .#.'), K: P('#.# #.# ##. #.# #.#'), L: P('#.. #.. #.. #.. ###'),
  M: P('#.# ### ### #.# #.#'), N: P('##. #.# #.# #.# #.#'), O: P('.#. #.# #.# #.# .#.'), P: P('##. #.# ##. #.. #..'),
  Q: P('.#. #.# #.# ##. .##'), R: P('##. #.# ##. #.# #.#'), S: P('.## #.. .#. ..# ##.'), T: P('### .#. .#. .#. .#.'),
  U: P('#.# #.# #.# #.# ###'), V: P('#.# #.# #.# #.# .#.'), W: P('#.# #.# ### ### #.#'), X: P('#.# #.# .#. #.# #.#'),
  Y: P('#.# #.# .#. .#. .#.'), Z: P('### ..# .#. #.. ###'),
  0: P('### #.# #.# #.# ###'), 1: P('.#. ##. .#. .#. ###'), 2: P('##. ..# .#. #.. ###'), 3: P('##. ..# .#. ..# ##.'),
  4: P('#.# #.# ### ..# ..#'), 5: P('### #.. ##. ..# ##.'), 6: P('.## #.. ### #.# ###'), 7: P('### ..# .#. .#. .#.'),
  8: P('### #.# ### #.# ###'), 9: P('### #.# ### ..# ##.'),
  '.': P('. . . . #'), ',': P('. . . # #'), '!': P('# # # . #'), '?': P('##. ..# .#. ... .#.'), ':': P('. # . # .'),
  ';': P('. # . # #'), '-': P('... ... ### ... ...'), '+': P('... .#. ### .#. ...'), '=': P('... ### ... ### ...'),
  '/': P('..# ..# .#. #.. #..'), '\\': P('#.. #.. .#. ..# ..#'), '(': P('.# #. #. #. .#'), ')': P('#. .# .# .# #.'),
  '[': P('## #. #. #. ##'), ']': P('## .# .# .# ##'), "'": P('# # . . .'), '"': P('#.# #.# ... ... ...'),
  '*': P('#.# .#. #.# ... ...'), '#': P('#.# ### #.# ### #.#'), '%': P('#.# ..# .#. #.. #.#'), '&': P('.#. #.# .#. #.# .##'),
  '<': P('..# .#. #.. .#. ..#'), '>': P('#.. .#. ..# .#. #..'), '_': P('... ... ... ... ###'), '|': P('# # # # #'),
  '@': P('### #.# #.# #.. ###'), '$': P('.## ##. .#. .## ##.'), '^': P('.#. #.# ... ... ...'), '~': P('... .## ##. ... ...'),
  '♥': P('#.# ### ### .#. ...'), '★': P('.#. ### .#. #.# ...'), '€': P('.## ##. #.. ##. .##'),
};

/** Classique 5×7 : majuscules, minuscules (avec jambages), chiffres, ponctuation, accents. */
const STD = {
  A: P('.###. #...# #...# ##### #...# #...# #...#'), B: P('####. #...# #...# ####. #...# #...# ####.'),
  C: P('.###. #...# #.... #.... #.... #...# .###.'), D: P('####. #...# #...# #...# #...# #...# ####.'),
  E: P('##### #.... #.... ####. #.... #.... #####'), F: P('##### #.... #.... ####. #.... #.... #....'),
  G: P('.###. #...# #.... #.### #...# #...# .####'), H: P('#...# #...# #...# ##### #...# #...# #...#'),
  I: P('### .#. .#. .#. .#. .#. ###'), J: P('..### ...#. ...#. ...#. ...#. #..#. .##..'),
  K: P('#...# #..#. #.#.. ##... #.#.. #..#. #...#'), L: P('#.... #.... #.... #.... #.... #.... #####'),
  M: P('#...# ##.## #.#.# #.#.# #...# #...# #...#'), N: P('#...# ##..# ##..# #.#.# #..## #..## #...#'),
  O: P('.###. #...# #...# #...# #...# #...# .###.'), P: P('####. #...# #...# ####. #.... #.... #....'),
  Q: P('.###. #...# #...# #...# #.#.# #..#. .##.#'), R: P('####. #...# #...# ####. #.#.. #..#. #...#'),
  S: P('.###. #...# #.... .###. ....# #...# .###.'), T: P('##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..'),
  U: P('#...# #...# #...# #...# #...# #...# .###.'), V: P('#...# #...# #...# #...# #...# .#.#. ..#..'),
  W: P('#...# #...# #...# #.#.# #.#.# #.#.# .#.#.'), X: P('#...# #...# .#.#. ..#.. .#.#. #...# #...#'),
  Y: P('#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..'), Z: P('##### ....# ...#. ..#.. .#... #.... #####'),
  a: P('..... ..... .###. ....# .#### #...# .####'), b: P('#.... #.... ####. #...# #...# #...# ####.'),
  c: P('.... .... .### #... #... #... .###'), d: P('....# ....# .#### #...# #...# #...# .####'),
  e: P('..... ..... .###. #...# ##### #.... .###.'), f: P('..## .#.. .#.. ###. .#.. .#.. .#..'),
  g: P('..... ..... .#### #...# #...# .#### ....# ....# .###.'), h: P('#.... #.... ####. #...# #...# #...# #...#'),
  i: P('# . # # # # #'), j: P('..# ... ..# ..# ..# ..# ..# #.# .#.'), k: P('#... #... #..# #.#. ##.. #.#. #..#'),
  l: P('#. #. #. #. #. #. .#'), m: P('..... ..... ##.#. #.#.# #.#.# #.#.# #.#.#'),
  n: P('..... ..... ####. #...# #...# #...# #...#'), o: P('..... ..... .###. #...# #...# #...# .###.'),
  p: P('..... ..... ####. #...# #...# #...# ####. #.... #....'), q: P('..... ..... .#### #...# #...# #...# .#### ....# ....#'),
  r: P('.... .... #.## ##.. #... #... #...'), s: P('..... ..... .#### #.... .###. ....# ####.'),
  t: P('.#.. .#.. ###. .#.. .#.. .#.. ..##'), u: P('..... ..... #...# #...# #...# #...# .####'),
  v: P('..... ..... #...# #...# #...# .#.#. ..#..'), w: P('..... ..... #...# #...# #.#.# #.#.# .#.#.'),
  x: P('..... ..... #...# .#.#. ..#.. .#.#. #...#'), y: P('..... ..... #...# #...# #...# .#### ....# ....# .###.'),
  z: P('..... ..... ##### ...#. ..#.. .#... #####'),
  0: P('.###. #...# #..## #.#.# ##..# #...# .###.'), 1: P('.#. ##. .#. .#. .#. .#. ###'),
  2: P('.###. #...# ....# ...#. ..#.. .#... #####'), 3: P('####. ....# ....# .###. ....# ....# ####.'),
  4: P('...#. ..##. .#.#. #..#. ##### ...#. ...#.'), 5: P('##### #.... ####. ....# ....# #...# .###.'),
  6: P('.###. #.... #.... ####. #...# #...# .###.'), 7: P('##### ....# ...#. ..#.. .#... .#... .#...'),
  8: P('.###. #...# #...# .###. #...# #...# .###.'), 9: P('.###. #...# #...# .#### ....# ....# .###.'),
  '.': P('. . . . . . #'), ',': P('. . . . . . # #'), '!': P('# # # # # . #'), '?': P('.###. #...# ....# ...#. ..#.. ..... ..#..'),
  ':': P('. . # . . . #'), ';': P('.. .. .# .. .. .# .# #.'), "'": P('# #'), '"': P('#.# #.#'),
  '-': P('.... .... .... ####'), '+': P('..... ..#.. ..#.. ##### ..#.. ..#..'), '=': P('.... .... #### .... ####'),
  '/': P('....# ....# ...#. ..#.. .#... #.... #....'), '\\': P('#.... #.... .#... ..#.. ...#. ....# ....#'),
  '(': P('..# .#. #.. #.. #.. .#. ..#'), ')': P('#.. .#. ..# ..# ..# .#. #..'), '[': P('### #.. #.. #.. #.. #.. ###'),
  ']': P('### ..# ..# ..# ..# ..# ###'), '*': P('..... #.#.# .###. ##### .###. #.#.# .....'),
  '#': P('.#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.'), '%': P('##..# ##..# ...#. ..#.. .#... #..## #..##'),
  '&': P('.##.. #..#. #.#.. .#... #.#.# #..#. .##.#'), '<': P('...# ..#. .#.. #... .#.. ..#. ...#'),
  '>': P('#... .#.. ..#. ...# ..#. .#.. #...'), '_': P('..... ..... ..... ..... ..... ..... #####'), '|': P('# # # # # # #'),
  '@': P('.###. #...# #.### #.#.# #.### #.... .###.'), '$': P('..#.. .#### #.#.. .###. ..#.# ####. ..#..'),
  '^': P('..#.. .#.#. #...#'), '~': P('..... ..... .#... #.#.# ...#.'), '♥': P('..... .#.#. ##### ##### .###. ..#..'),
  '★': P('..#.. ..#.. ##### .###. .#.#. #...#'), '€': P('..### .#... ####. .#... ####. .#... ..###'),
};

/** Accents (3 de large) posés au-dessus des minuscules de la police Classique. */
const ACCENTS = { '\u0301': ['..#', '.#.'], '\u0300': ['#..', '.#.'], '\u0302': ['.#.', '#.#'], '\u0308': ['#.#', '...'] };

export const FONTS = [
  { id: 'std', name: 'Classique 5×7', glyphs: STD, height: 7, descent: 2, space: 3, upper: false },
  { id: 'small', name: 'Petite 3×5', glyphs: SMALL, height: 5, descent: 0, space: 2, upper: true },
];
export const fontById = (id) => FONTS.find((f) => f.id === id) || FONTS[0];

/** Glyphe d'un caractère (lignes « # »), accents compris ; null si inconnu. */
function glyph(font, ch) {
  const g = font.glyphs;
  if (font.upper) ch = ch.toUpperCase();
  if (g[ch]) return g[ch];
  const nfd = ch.normalize('NFD');
  const base = nfd[0];
  const mark = nfd.slice(1);
  if (!g[base] && !g[base.toUpperCase()]) return null;
  if (font.id === 'std' && (base === 'c' || base === 'C') && mark === '\u0327') {
    // ç, Ç : cédille sous la lettre
    return base === 'c' ? [...g.c, '..#.', '.#..'] : [...g.C, '..#..', '.#...'];
  }
  const bg = g[base] || g[base.toUpperCase()];
  const acc = ACCENTS[mark];
  // accent sur une minuscule sans jambage haut (a e i o u…) : lignes 0 et 1 libres
  const lowerFree = base === base.toLowerCase() && bg.slice(0, 2).every((r) => !r.includes('#'));
  if (font.id === 'std' && acc && (lowerFree || base === 'i')) {
    const src = base === 'i' ? ['.', '.', '#', '#', '#', '#', '#'] : bg;
    const w = Math.max(src[0].length, 3);
    const pad = (r, n) => '.'.repeat(Math.floor((w - n) / 2)) + r + '.'.repeat(w - n - Math.floor((w - n) / 2));
    const rows = src.map((r) => pad(r, r.length));
    rows[0] = pad(acc[0], 3);
    rows[1] = pad(acc[1], 3);
    return rows;
  }
  return bg;
}

/**
 * Texte -> masque de pixels { w, h, mask (Uint8Array) }.
 * scale : taille des pixels ; spacing : espace entre lettres ; align : left | center | right.
 */
export function renderText(text, fontId = 'std', { scale = 1, spacing = 1, align = 'left', lineGap = 2 } = {}) {
  const font = fontById(fontId);
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const lineH = font.height + font.descent + lineGap;
  const laid = lines.map((line) => {
    const glyphs = [];
    let x = 0;
    for (const ch of [...line]) {
      if (ch === ' ' || ch === '\t') { x += font.space + spacing; continue; }
      const g = glyph(font, ch) || glyph(font, '?');
      glyphs.push({ g, x });
      x += g[0].length + spacing;
    }
    return { glyphs, w: Math.max(0, x - spacing) };
  });
  const w0 = Math.max(1, ...laid.map((l) => l.w));
  const h0 = Math.max(1, lines.length * lineH - lineGap);
  const W = w0 * scale, H = h0 * scale;
  const mask = new Uint8Array(W * H);
  laid.forEach((l, li) => {
    const ox = align === 'center' ? Math.floor((w0 - l.w) / 2) : align === 'right' ? w0 - l.w : 0;
    const oy = li * lineH;
    for (const { g, x } of l.glyphs) {
      g.forEach((row, j) => [...row].forEach((c, i) => {
        if (c !== '#') return;
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
          const px = (ox + x + i) * scale + sx, py = (oy + j) * scale + sy;
          if (px < W && py < H) mask[py * W + px] = 1;
        }
      }));
    }
  });
  return { w: W, h: H, mask };
}

/** Pixels colorés (Uint32) d'un texte, avec contour facultatif (couleur outline). */
export function textPixels(text, fontId, opts = {}) {
  const { color = 0xff000000, outline = null } = opts;
  const t = renderText(text, fontId, opts);
  const pad = outline !== null ? Math.max(1, opts.scale || 1) : 0;
  const W = t.w + pad * 2, H = t.h + pad * 2;
  const data = new Uint32Array(W * H);
  const at = (x, y) => x >= pad && y >= pad && x < pad + t.w && y < pad + t.h && t.mask[(y - pad) * t.w + x - pad];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (at(x, y)) { data[y * W + x] = color; continue; }
    if (outline === null) continue;
    let near = false;
    for (let dy = -pad; dy <= pad && !near; dy++) for (let dx = -pad; dx <= pad; dx++) if (at(x + dx, y + dy)) { near = true; break; }
    if (near) data[y * W + x] = outline;
  }
  return { data, w: W, h: H };
}
