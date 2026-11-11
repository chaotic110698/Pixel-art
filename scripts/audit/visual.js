// Tests visuels : des rendus calculés au pixel près (personnages des 3 vues, corps entier
// habillé, transformations et tenues, polices, modes de fusion, conversion d'image,
// animation de calque) sont comparés à des images de référence (scripts/audit/ref/*.png).
// Une différence = un changement visible, voulu ou non : regardez les images « _diff »
// dans le dossier de sortie. Pour accepter les nouveaux rendus : UPDATE_REFS=1.
const H = require('./h.js');
const fs = require('fs');
const path = require('path');

const REF = path.join(__dirname, 'ref');
const UPDATE = process.env.UPDATE_REFS === '1';

(async () => {
  const { b, p, errs } = await H.open();
  const { check } = H;
  fs.mkdirSync(REF, { recursive: true });
  // toutes les scènes sont calculées dans la page : { nom: { w, h, b64 (PNG exact) } }
  const scenes = await p.evaluate(async () => {
    const ch = await import('./js/library/character.js');
    const lib = await import('./js/library/library.js');
    const { composePixels } = await import('./js/render/compose.js');
    const { encodePNG } = await import('./js/export/png.js');
    const { createEffects } = await import('./js/pngtuber/effects.js');
    const { docFacing } = lib;
    const { renderText } = await import('./js/core/fonts.js');
    const { Doc } = await import('./js/core/doc.js');
    const { BLEND_MODES } = await import('./js/core/blend.js');
    const { pixelize } = await import('./js/core/pixelize.js');
    const { animateFrames } = await import('./js/ui/animate.js');
    const out = {};
    const put = async (name, px, w, h) => {
      const bytes = await encodePNG(px, w, h);
      let s = '';
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      out[name] = { w, h, b64: btoa(s), px: Array.from(px) };
    };
    const C = { skin: '#f5c6a5', hair: '#6b3e26', eyes: '#3b7dd8', clothes: '#4a7bd0', accent: '#d04a6a' };
    const docs = {
      face: ch.buildCharacter({ colors: C, sel: ch.DEFAULT_CHARACTER }),
      face_x2: ch.buildCharacter({ colors: C, sel: ch.DEFAULT_CHARACTER, scale: 2 }),
      trois_quarts: ch.buildCharacter({ colors: ch.PORTRAIT_COLORS, sel: ch.DEFAULT_CHARACTER_3Q }),
      portrait_detaille: ch.buildCharacter({ colors: ch.PORTRAIT_QD_COLORS, sel: ch.DEFAULT_CHARACTER_QD }),
      corps_entier: ch.buildCharacter({ colors: C, sel: { ...ch.DEFAULT_CHARACTER, body: 'body-entier-moyen', bottom: 'bottom-jeans', shoes: 'shoes-sneakers' } }),
    };
    for (const [name, d] of Object.entries(docs)) await put('perso_' + name, composePixels(d, { includeReference: false }), d.width, d.height);
    // transformations et tenues (vue de face et portrait détaillé)
    for (const [name, d] of [['face', docs.face], ['portrait_detaille', docs.portrait_detaille]]) {
      const src = document.createElement('canvas');
      src.width = d.width; src.height = d.height;
      src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(composePixels(d, { includeReference: false }).buffer), d.width, d.height), 0, 0);
      const facing = docFacing(d);
      const fx = createEffects({ stage: document.body, back: document.createElement('canvas'), front: document.createElement('canvas'), width: d.width, height: d.height, cfg: () => ({ facing }) });
      for (const id of ['demon', 'knight', 'pilot', 'astronaut', 'worker']) {
        const c = fx.transformImage(src, id);
        const data = c.getContext('2d').getImageData(0, 0, d.width, d.height).data;
        await put(`tenue_${name}_${id}`, new Uint32Array(data.buffer.slice(0)), d.width, d.height);
      }
    }
    // memes sur le portrait détaillé (repères du visage donnés par le document)
    {
      const { faceFeatures } = await import('./js/pngtuber/assets.js');
      const d = docs.portrait_detaille;
      const src = document.createElement('canvas');
      src.width = d.width; src.height = d.height;
      src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(composePixels(d, { includeReference: false }).buffer), d.width, d.height), 0, 0);
      const cfgM = { facing: docFacing(d), features: faceFeatures(d) };
      const fx = createEffects({ stage: document.body, back: document.createElement('canvas'), front: document.createElement('canvas'), width: d.width, height: d.height, cfg: () => cfgM });
      for (const id of ['deal', 'alone', 'doge', 'fine', 'laser', 'fried', 'stonks', 'brain', 'bonk', 'clown']) {
        const c = fx.transformImage(src, id);
        const data = c.getContext('2d').getImageData(0, 0, d.width, d.height).data;
        await put(`meme_${id}`, new Uint32Array(data.buffer.slice(0)), d.width, d.height);
      }
    }
    // polices
    for (const f of ['std', 'small']) {
      const t = renderText('Pixel Atelier 2026 !\nÉté, ça va ? àéèêç', f, {});
      const px = new Uint32Array(t.w * t.h);
      for (let i = 0; i < px.length; i++) if (t.mask[i]) px[i] = 0xff202030;
      await put('texte_' + f, px, t.w, t.h);
    }
    // modes de fusion et écrêtage (une bande par mode)
    {
      const W = 12 * BLEND_MODES.length, H = 24;
      const d = new Doc(W, H, 'fusion');
      const bg = d.createLayer('bg'); d.insert(bg, 'root');
      const base = d.createLayer('base'); d.insert(base, 'root');
      const top = d.createLayer('top'); d.insert(top, 'root');
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        bg.cels[0][y * W + x] = (((x >> 2) + (y >> 2)) & 1 ? 0xff9a7a40 : 0xff2050c0) >>> 0;
        if (y >= 12 && x % 12 > 1 && x % 12 < 10) base.cels[0][y * W + x] = 0xff40d0f0;
      }
      const out2 = new Uint32Array(W * H);
      BLEND_MODES.forEach(([mode], i) => {
        top.blend = mode;
        top.clip = false;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) top.cels[0][y * W + x] = x >= i * 12 && x < i * 12 + 12 ? 0xc06090e0 : 0;
        const a = composePixels(d, {});
        top.clip = true;
        const c = composePixels(d, {});
        for (let y = 0; y < H; y++) for (let x = i * 12; x < i * 12 + 12; x++) out2[y * W + x] = y < 12 ? a[y * W + x] : c[y * W + x];
      });
      await put('fusion_modes', out2, W, H);
    }
    // conversion d'image (image synthétique, sans dépendre du décodage d'une photo)
    {
      const w = 120, h = 90, data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, dx = x - 60, dy = y - 45, r = Math.hypot(dx, dy);
        data[i] = r < 30 ? 240 : 80 + y; data[i + 1] = r < 30 ? 190 - r : 140 + (x >> 1); data[i + 2] = r < 30 ? 150 : 220 - y; data[i + 3] = 255;
      }
      for (const [k, dither] of [['aplats', 'none'], ['diffusion', 'diffusion']]) {
        const r = pixelize({ data, width: w, height: h }, { width: 40, height: 30, mode: 'dominant', palette: 'extract', colors: 8, dither, saturation: 1.1, contrast: 1, clean: true });
        await put('conversion_' + k, r.pixels, r.w, r.h);
      }
    }
    // animation de calque : planche des images (flottement et déplacement)
    {
      const w = 16, h = 16, base = new Uint32Array(w * h);
      for (let y = 4; y < 12; y++) for (let x = 2; x < 7; x++) base[y * w + x] = 0xff3050e0;
      for (const [k, o] of [['respiration', { effect: 'breathe', frames: 6, amp: 2 }], ['deplacement', { effect: 'move', frames: 6, dx: 8, dy: 2, easing: 'out' }], ['fondu', { effect: 'fadein', frames: 6 }]]) {
        const fr = animateFrames(base, w, h, o);
        const sheet = new Uint32Array(w * fr.length * h);
        fr.forEach((f, n) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) sheet[y * w * fr.length + n * w + x] = f[y * w + x]; });
        await put('animation_' + k, sheet, w * fr.length, h);
      }
    }
    return out;
  });

  // comparaison avec les références (décodées dans la page)
  for (const [name, s] of Object.entries(scenes)) {
    const file = path.join(REF, name + '.png');
    if (UPDATE || !fs.existsSync(file)) {
      fs.writeFileSync(file, Buffer.from(s.b64, 'base64'));
      check(`Référence ${UPDATE ? 'mise à jour' : 'créée'} : ${name}`, true, `${s.w}×${s.h}`);
      continue;
    }
    const ref = fs.readFileSync(file).toString('base64');
    const res = await p.evaluate(async ([b64, w, h, px]) => {
      // décodage PNG exact (RGBA 8 bits) : le canvas prémultiplierait l'alpha
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dv = new DataView(bin.buffer);
      let pos = 8, iw = 0, ih = 0;
      const idat = [];
      while (pos < bin.length) {
        const len = dv.getUint32(pos), type = String.fromCharCode(...bin.subarray(pos + 4, pos + 8));
        if (type === 'IHDR') { iw = dv.getUint32(pos + 8); ih = dv.getUint32(pos + 12); }
        if (type === 'IDAT') idat.push(bin.subarray(pos + 8, pos + 8 + len));
        pos += 12 + len;
      }
      if (iw !== w || ih !== h) return { size: `${iw}×${ih} au lieu de ${w}×${h}` };
      const raw = new Uint8Array(await new Response(new Blob(idat).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
      const stride = w * 4, rgba = new Uint8Array(w * h * 4);
      for (let y = 0; y < h; y++) {
        const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        for (let x = 0; x < stride; x++) {
          const a = x >= 4 ? rgba[y * stride + x - 4] : 0, b = y ? rgba[(y - 1) * stride + x] : 0, c = x >= 4 && y ? rgba[(y - 1) * stride + x - 4] : 0;
          const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
          const pred = f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0;
          rgba[y * stride + x] = (src[x] + pred) & 255;
        }
      }
      const ref = new Uint32Array(rgba.buffer);
      let diff = 0;
      const out = new Uint32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const a = px[i] >>> 0, b = ref[i] >>> 0;
        // pixels transparents : seule la transparence compte
        const same = a === b || (!(a >>> 24) && !(b >>> 24));
        if (!same) { diff++; out[i] = 0xff0000ff; } else out[i] = (a >>> 24) ? 0x40ffffff & a | 0x40000000 : 0;
      }
      const { encodePNG } = await import('./js/export/png.js');
      let s = '';
      if (diff) { const bytes = await encodePNG(out, w, h); for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); }
      return { diff, png: diff ? btoa(s) : null };
    }, [ref, s.w, s.h, s.px]);
    if (res.png) {
      fs.writeFileSync(path.join(H.OUT, `visuel_${name}_diff.png`), Buffer.from(res.png, 'base64'));
      fs.writeFileSync(path.join(H.OUT, `visuel_${name}_nouveau.png`), Buffer.from(s.b64, 'base64'));
    }
    check(`Rendu identique à la référence : ${name}`, !res.size && !res.diff, res.size || (res.diff ? `${res.diff} pixel(s) différent(s) — voir visuel_${name}_diff.png` : ''));
  }
  H.summary(errs);
  await b.close();
})();
