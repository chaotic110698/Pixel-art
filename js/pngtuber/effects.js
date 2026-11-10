// Effets PNGtuber : confettis, cœurs, émotes manga, ambiances, effets liés à la voix…
// Dessinés en gros pixels nets, alignés sur la grille de l'avatar, sur deux calques
// qui couvrent toute la scène : `back` (derrière l'avatar) et `front` (devant).
//
// IMPORTANT : createEffects doit rester AUTONOME (aucune référence extérieure) :
// son code est copié tel quel (Function.toString) dans l'avatar .html exporté.
//
// o = {
//   stage, scene,          // élément qui donne la taille ; élément secoué/zoomé (Impact)
//   back, front,           // canvas plein cadre, derrière / devant l'avatar
//   avatarCanvas,          // canvas du moteur d'avatar (position à l'écran)
//   width, height,         // taille de l'image de l'avatar (pixels du dessin)
//   cfg(),                 // réglages : { ambient[], voice[], keys{}, byExpr{}, shout[], intensity }
//   onTrigger(id)          // effet déclenché à la main (touche, bouton) : pour relayer à la capture
//   bg, background()       // canvas du fond animé et identifiant du fond choisi (SCENE_IDS)
// }
// Le moteur appelle fx.frame(now, st) à chaque image (st : level, talking, shouting,
// expression, geom).
export function createEffects(o) {
  const ONESHOT = ['confetti', 'hearts', 'sparkles', 'fireworks', 'stars', 'impact', 'bang', 'quest', 'sweat', 'vein', 'tears', 'lines', 'zzz'];
  const CONF = ['#ff3b6b', '#ffd84a', '#59c2ff', '#b6ff6a', '#b48cff', '#ffffff', '#ff9a2e'];
  const PAL = { r: '#ff3b6b', R: '#e8262e', w: '#ffffff', y: '#ffd84a', b: '#59c2ff', k: '#140c10', n: '#ffe9a8', c: '#bff4ff' };
  const SP = {
    heart: ['rr.rr', 'rrrrr', 'rrrrr', '.rrr.', '..r..'],
    heartS: ['r.r', 'rrr', '.r.'],
    star: ['..w..', '.www.', 'wwwww', '.www.', '..w..'],
    starS: ['.y.', 'yyy', '.y.'],
    // 💢 : quatre coins dont la pointe est tournée vers le centre
    vein: ['..R.R..', '..R.R..', 'RRR.RRR', '.......', 'RRR.RRR', '..R.R..', '..R.R..'],
    // « ! » rouge cerné de noir
    bang: ['.kkk.', 'kRRRk', 'kRRRk', 'kRRRk', 'kRRRk', '.kRk.', '..k..', '.kkk.', 'kRRRk', '.kkk.'],
    quest: ['.www.', 'w...w', '...w.', '..w..', '.....', '..w..'],
    drop: ['.b.', 'bbb', 'bcb', '.b.'],
    tear: ['.b.', 'bcb', '.b.'],
    z: ['www', '..w', '.w.', 'w..', 'www'],
    note: ['.nnn', '.n.n', '.n.n', 'nn.n', 'nn..'],
    bubble: ['.c.', 'c.c', '.c.'],
  };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const P = [];
  const st = { t: 0, last: 0, flash: 0, zoom: 0, shake: 0, lines: 0, emote: null, expr: undefined, shoutCd: 0, talkTime: 0, dirty: true, U: 1, GW: 64, GH: 48, ox: 0, oy: 0, head: null, sx: 0, sy: 0, manualAmb: new Set(), transId: null, transUntil: Infinity, linkedTrans: null, ambUntil: {} };
  const bctx = o.back.getContext('2d');
  const fctx = o.front.getContext('2d');
  const unit = Math.max(1, Math.round(Math.min(o.width, o.height) / 40)); // pixels du dessin par pixel d'effet
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const cfg = () => o.cfg() || {};
  const mult = () => Math.max(0.3, Math.min(3, cfg().intensity || 1));
  function add(p) { P.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 1, age: 0, layer: 1 }, p)); }

  // ---------- géométrie : grille d'effets alignée sur les pixels de l'avatar ----------
  const bboxCache = new WeakMap();
  function bbox(img) {
    if (!img) return null;
    let b = bboxCache.get(img);
    if (b) return b;
    const w = o.width, h = o.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, w, h);
    let d;
    try { d = x.getImageData(0, 0, w, h).data; } catch (e) { d = null; }
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    if (d) for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 20) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
    // tête : bande du haut ; centre = moyenne des pixels opaques de cette bande
    const hh = Math.max(4, Math.round((y1 - y0 + 1) * 0.45));
    let sum = 0, n = 0, hx0 = w, hx1 = 0;
    if (d) for (let y = y0; y < y0 + hh; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 20) { sum += i; n++; if (i < hx0) hx0 = i; if (i > hx1) hx1 = i; }
    b = { x0, y0, x1, y1, hh, hcx: n ? sum / n : (x0 + x1) / 2, hx0: n ? hx0 : x0, hx1: n ? hx1 : x1 };
    bboxCache.set(img, b);
    return b;
  }
  function layout(geom) {
    const sr = o.stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(sr.width * dpr)), H = Math.max(1, Math.round(sr.height * dpr));
    for (const c of [o.back, o.front, o.bg]) if (c && (c.width !== W || c.height !== H)) { c.width = W; c.height = H; st.dirty = true; }
    if (!geom || !o.avatarCanvas) return;
    const ar = o.avatarCanvas.getBoundingClientRect();
    const k = o.avatarCanvas.width ? (ar.width * dpr) / o.avatarCanvas.width : 1;
    const px = geom.s * k; // pixels écran par pixel du dessin
    st.U = Math.max(1, px * unit);
    // ancrage fixe (avatar au repos) : la grille du fond et des effets ne suit pas
    // la respiration, le rebond ni la secousse ; seul le contour (aura) suit l'avatar
    const bx = (ar.left - sr.left) * dpr + (geom.bx ?? geom.x) * k;
    const by = (ar.top - sr.top) * dpr + (geom.by ?? geom.y) * k;
    st.ax = bx;
    st.ay = by;
    st.mx = (ar.left - sr.left) * dpr + geom.x * k; // position réelle (en mouvement)
    st.my = (ar.top - sr.top) * dpr + geom.y * k;
    st.px = px;
    st.ox = ((bx % st.U) + st.U) % st.U;
    st.oy = ((by % st.U) + st.U) % st.U;
    st.GW = Math.ceil(W / st.U) + 1;
    st.GH = Math.ceil(H / st.U) + 1;
    st.geom = geom;
    const b = bbox(geom.img);
    if (b) {
      const g = (dx, dy) => [(st.ax + dx * px - st.ox) / st.U, (st.ay + dy * px - st.oy) / st.U];
      const [hx, top] = g(b.hcx, b.y0);
      const [, hb] = g(0, b.y0 + b.hh);
      const [l] = g(b.hx0, 0), [r] = g(b.hx1, 0);
      const [, bottom] = g(0, b.y1);
      const [al] = g(b.x0, 0), [ar2] = g(b.x1, 0);
      st.head = { x: hx, top, bottom: hb, cy: (top + hb) / 2, l, r, eyeY: top + (hb - top) * 0.52, body: { l: al, r: ar2, bottom } };
    }
  }
  const H = () => st.head || { x: st.GW / 2, top: st.GH * 0.3, bottom: st.GH * 0.55, cy: st.GH * 0.42, l: st.GW * 0.4, r: st.GW * 0.6, eyeY: st.GH * 0.42, body: { l: st.GW * 0.3, r: st.GW * 0.7, bottom: st.GH } };

  // ---------- effets ponctuels ----------
  const FX = {
    confetti() {
      // canons des deux côtés : les confettis montent au-dessus de la tête, puis retombent
      // en voletant jusqu'à sortir de l'écran par le bas
      const h = H(), b = h.body, w = Math.max(6, (b.r - b.l) / 2);
      const n = Math.round(110 * mult());
      const g = st.GH * 1.25;
      for (let i = 0; i < n; i++) {
        setTimeout(() => {
          const left = i % 2 === 0;
          const x0 = left ? -rnd(0, 2) : st.GW + rnd(0, 2);
          const y0 = st.GH * rnd(0.6, 0.98);
          const xa = h.x + rnd(-w * 1.7, w * 1.7); // sommet de la trajectoire : au-dessus de l'avatar
          const ya = Math.max(-st.GH * 0.04, h.top - rnd(3, st.GH * 0.22));
          const vy = -Math.sqrt(2 * g * Math.max(4, y0 - ya));
          const ta = -vy / g;
          const term = rnd(6, 12); // vitesse de chute limitée : les confettis voltigent
          add({ kind: 'conf', x: x0, y: y0, vx: (xa - x0) / ta, vy, g, term, life: ta + (st.GH + 10 - ya) / term + 1, sway: rnd(0, 6), color: pick(CONF), flip: rnd(0, 6) });
        }, Math.floor(i / Math.max(1, n / 3)) * 160 + (i % 7) * 12);
      }
    },
    hearts() {
      const h = H(), w = (h.r - h.l) / 2;
      for (let i = 0; i < Math.round(9 * mult()); i++) setTimeout(() => add({ kind: 'spr', spr: Math.random() < 0.4 ? 'heartS' : 'heart', x: i % 2 ? h.r + rnd(1, w * 0.6) : h.l - rnd(1, w * 0.6), y: h.cy + rnd(0, w), vy: -rnd(7, 12), sway: rnd(0, 6), life: rnd(1.6, 2.4), fade: true }), i * 110);
    },
    sparkles() {
      const h = H(), r0 = (h.r - h.l) * 0.6;
      for (let i = 0; i < Math.round(12 * mult()); i++) setTimeout(() => { const a = rnd(0, Math.PI * 2), r = r0 * rnd(1, 1.5); add({ kind: 'twinkle', x: h.x + Math.cos(a) * r, y: h.cy + Math.sin(a) * r * 0.8, life: rnd(0.6, 1) }); }, i * 70);
    },
    fireworks() {
      for (let k = 0; k < Math.round(3 * mult()); k++) setTimeout(() => add({ kind: 'rocket', x: rnd(0.12, 0.88) * st.GW, y: st.GH, vy: -st.GH * 1.2, top: rnd(0.1, 0.32) * st.GH, color: pick(CONF), life: 3, layer: 0 }), k * 380);
    },
    stars() { for (let i = 0; i < Math.round(6 * mult()); i++) setTimeout(() => add({ kind: 'shoot', x: rnd(0.15, 1.3) * st.GW, y: rnd(-0.05, 0.2) * st.GH, vx: -st.GW * 0.6, vy: st.GW * 0.32, life: 1.3, layer: 0 }), i * 160); },
    impact() { st.flash = 1; st.zoom = 1; st.shake = 0.35; },
    vein() { const h = H(); st.emote = { spr: 'vein', t: 0, life: 1.6, x: h.x + (h.r - h.x) * 0.55, y: h.top + 1, pulse: true }; },
    bang() { const h = H(); st.emote = { spr: 'bang', t: 0, life: 1.4, x: h.r + 3, y: Math.max(1, h.top - 5) }; },
    quest() { const h = H(); st.emote = { spr: 'quest', t: 0, life: 1.6, x: h.r + 3, y: Math.max(1, h.top - 4), tilt: true }; },
    sweat() { const h = H(); add({ kind: 'spr', spr: 'drop', x: h.l + 1, y: h.top + 2, vy: 4, life: 1.6, fade: true, layer: 2 }); },
    tears() {
      const h = H(), w = h.r - h.l;
      for (let i = 0; i < Math.round(10 * mult()); i++) setTimeout(() => add({ kind: 'spr', spr: 'tear', x: h.x + (i % 2 ? 0.18 : -0.12) * w, y: h.eyeY + 1, vy: 8, g: 60, life: 0.9, layer: 2 }), i * 140);
    },
    zzz() { const h = H(); for (let i = 0; i < 3; i++) setTimeout(() => add({ kind: 'spr', spr: 'z', x: h.r, y: h.top + 2, vx: 6, vy: -7, life: 1.8, fade: true, sway: 1 }), i * 500); },
    lines() { st.lines = 0.9; },
  };
  // ---------- effets continus ----------
  const AMB = {
    snow(dt) { if (Math.random() < dt * 0.35 * st.GW * mult()) add({ kind: 'px', x: rnd(-4, st.GW + 4), y: -1, vy: rnd(5, 10), vx: rnd(-2, 2), sway: rnd(0, 6), life: st.GH / 5 + 2, color: '#ffffff', layer: 0 }); },
    rain(dt) { if (Math.random() < dt * st.GW * mult()) add({ kind: 'rain', x: rnd(0, st.GW + 16), y: -3, vx: -12, vy: 70, life: st.GH / 60 + 0.5, layer: 2 }); },
    petals(dt) { if (Math.random() < dt * 0.11 * st.GW * mult()) add({ kind: 'petal', x: rnd(0.15, 1.15) * st.GW, y: -2, vx: rnd(-9, -4), vy: rnd(6, 11), sway: rnd(0, 6), life: st.GH / 6 + 3, layer: 2 }); },
    fireflies(dt) { if (P.filter((p) => p.kind === 'fly').length < 14 * mult() && Math.random() < dt * 4) add({ kind: 'fly', x: rnd(2, st.GW - 2), y: rnd(0.15, 0.9) * st.GH, vx: rnd(-3, 3), vy: rnd(-3, 3), life: rnd(4, 7), seed: rnd(0, 6), layer: 0 }); },
    bubbles(dt) { if (Math.random() < dt * 0.05 * st.GW * mult()) add({ kind: 'spr', spr: 'bubble', x: rnd(4, st.GW - 4), y: st.GH + 2, vy: -rnd(6, 10), sway: rnd(0, 6), life: st.GH / 6 + 2, layer: 2 }); },
    flames(dt) {
      // brasier : large, haut et dense, flammes épaisses qui rétrécissent en montant
      const b = H().body, w = b.r - b.l, l = b.l - w * 0.15, r = b.r + w * 0.15;
      const n = dt * 2.4 * (r - l) * mult();
      for (let i = 0; i < 6; i++) if (Math.random() < n) {
        const x = rnd(l, r), edge = Math.abs(x - (l + r) / 2) / ((r - l) / 2);
        add({ kind: 'flame', x, y: b.bottom - rnd(0, 3), vx: rnd(-4, 4), vy: -rnd(22, 44) * (1.15 - edge * 0.5), sway: rnd(0, 6), sz: Math.random() < 0.6 ? 3 : 2, life: rnd(0.7, 1.5) * (1.1 - edge * 0.4), layer: 0 });
      }
    },
    notes(dt, s) { if (st.talkTime > 1.2 && s.talking && Math.random() < dt * 3) { const h = H(); add({ kind: 'spr', spr: 'note', x: h.r + 1, y: h.cy, vx: rnd(4, 8), vy: -rnd(6, 9), sway: rnd(0, 6), life: 2, fade: true, layer: 2, color: pick(['#ffe9a8', '#ff9ccf', '#bff4ff']) }); } },
  };

  // ---------- transformations et tenues : l'avatar change d'apparence le temps de l'activation ----------
  // Chaque transformation recolore l'image de l'avatar pixel par pixel (en gardant ses ombres)
  // et peut y ajouter des éléments (cornes, casque, bouclier…) calés sur la tête et les épaules
  // détectées dans l'image : elle marche donc avec n'importe quel personnage.
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  /** Couleur d'une rampe (du plus sombre au plus clair) selon la luminosité t (0..1). */
  const ramp = (cols) => { const rgb = cols.map(hex); return (t) => rgb[Math.max(0, Math.min(rgb.length - 1, Math.floor(t * rgb.length)))]; };
  const noise = (x, y) => { let n = (x * 374761393 + y * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  /** Repères de l'image : boîte, tête (largeur, bas), début du torse (épaules). */
  function info(d, w, h) {
    const rows = [];
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let y = 0; y < h; y++) {
      let l = w, r = -1;
      for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 20) { if (x < l) l = x; r = x; }
      rows.push([l, r]);
      if (r >= 0) { if (y < y0) y0 = y; y1 = y; if (l < x0) x0 = l; if (r > x1) x1 = r; }
    }
    if (y1 < 0) return null;
    const span = y1 - y0 + 1;
    const band = Math.max(4, Math.round(span * 0.45));
    let hx0 = w, hx1 = -1;
    for (let y = y0; y < y0 + band; y++) if (rows[y][1] >= 0) { hx0 = Math.min(hx0, rows[y][0]); hx1 = Math.max(hx1, rows[y][1]); }
    const headW = hx1 - hx0 + 1;
    // bas de la tête : la silhouette se resserre (menton, cou) ; épaules : elle s'élargit
    // nettement par rapport au cou le plus étroit
    let headB = -1, bodyY = -1, minW = Infinity;
    for (let y = y0 + Math.round(span * 0.3); y <= y1; y++) {
      if (rows[y][1] < 0) continue;
      const rw = rows[y][1] - rows[y][0] + 1;
      if (headB < 0 && rw < headW * 0.8) headB = y;
      if (headB >= 0) {
        if (rw < minW) minW = rw;
        else if (rw >= minW * 1.6 && rw >= minW + 6) { bodyY = y; break; }
      } else if (rw > headW * 1.15) { bodyY = y; break; }
    }
    if (headB < 0) headB = y0 + band;
    if (bodyY < 0) {
      // pas d'élargissement net (cheveux longs, capuche…) : buste si le bas de l'image est large,
      // sinon tête seule (les tenues ne recolorent alors pas de torse)
      const bw = rows[y1][1] - rows[y1][0] + 1;
      bodyY = bw >= headW * 0.9 ? Math.min(y1, y0 + Math.round(span * 0.62)) : h;
    }
    if (headB > bodyY) headB = bodyY;
    return { w, h, x0, x1, y0, y1, rows, hx0, hx1, headW, hcx: (hx0 + hx1) / 2, headB, headH: headB - y0, bodyY };
  }
  /** Outils de dessin en pixels de l'avatar. */
  // k : taille d'un pixel du dessin (2 pour un gabarit détaillé ×2…) ; les coordonnées des
  // fonctions de dessin sont alors en « pixels du dessin » (voir scaled()).
  // (ox, oy : décalage de la grille du dessin dans l'image, pour rester calé sur ses gros pixels)
  function pen(g, k = 1, ox = 0, oy = 0) {
    const px = (x, y, c) => { g.fillStyle = c; g.fillRect(ox + Math.round(x) * k, oy + Math.round(y) * k, k, k); };
    const rect = (x, y, w, hh, c) => { g.fillStyle = c; g.fillRect(ox + Math.round(x) * k, oy + Math.round(y) * k, Math.round(w) * k, Math.round(hh) * k); };
    const clear = (x, y) => g.clearRect(ox + Math.round(x) * k, oy + Math.round(y) * k, k, k);
    const art = (rows, x, y, pal) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.' && pal[ch]) px(x + i, y + j, pal[ch]); }));
    /** Calotte (casque) : moitié haute d'une ellipse, ombrée, avec contour. */
    const dome = (cx, base, rx, ry, cols, outline) => {
      for (let y = Math.floor(base - ry); y <= base; y++) {
        const k = 1 - ((base - y) / ry) ** 2;
        if (k < 0) continue;
        const hw = Math.round(rx * Math.sqrt(k));
        for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
          const edge = x === Math.round(cx - hw) || x === Math.round(cx + hw) || y === Math.floor(base - ry) || (y > base - ry && Math.round(rx * Math.sqrt(Math.max(0, 1 - ((base - y + 1) / ry) ** 2))) < Math.abs(x - cx));
          const sh = (x - cx) / rx;
          px(x, y, edge ? outline : sh < -0.45 && y < base - ry * 0.4 ? cols[2] : sh > 0.4 ? cols[0] : cols[1]);
        }
      }
    };
    const ring = (cx, cy, rx, ry, c) => { for (let a = 0; a < Math.PI * 2; a += 0.02) px(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, c); };
    return { g, px, rect, art, dome, ring, clear };
  }
  /** Repères ramenés à l'échelle des pixels du dessin (k pixels de l'image par pixel du dessin). */
  function scaled(I, k, ox = 0, oy = 0) {
    if (k === 1) return I;
    const dx = (v) => Math.floor((v - ox) / k), dy = (v) => Math.floor((v - oy) / k);
    const rows = [];
    for (let y = 0; y < Math.ceil((I.h - oy) / k); y++) { const r = I.rows[Math.min(I.h - 1, oy + y * k)]; rows.push(r[1] >= 0 ? [dx(r[0]), dx(r[1])] : r); }
    return { ...I, w: Math.ceil((I.w - ox) / k), h: Math.ceil((I.h - oy) / k), x0: dx(I.x0), x1: dx(I.x1), y0: dy(I.y0), y1: dy(I.y1), rows, hx0: dx(I.hx0), hx1: dx(I.hx1), headW: Math.round(I.headW / k), hcx: (I.hcx - ox) / k, headB: dy(I.headB), headH: Math.round(I.headH / k), bodyY: dy(I.bodyY) };
  }
  /** Taille des gros pixels de l'image (dessin 32×32 doublé…) : { k, ox, oy } ou null. */
  function blockSize(d, w, h, I) {
    const u = new Uint32Array(d.buffer, d.byteOffset, w * h);
    for (const k of [4, 3, 2]) {
      for (let oy = 0; oy < k; oy++) for (let ox = 0; ox < k; ox++) {
        let bad = 0, n = 0;
        const lim = (I.x1 - I.x0 + 1) * (I.y1 - I.y0 + 1) * 0.004;
        for (let y = I.y0; y <= I.y1 && bad <= lim; y++) {
          const by = oy + Math.floor((y - oy) / k) * k;
          if (by < 0) continue;
          for (let x = I.x0; x <= I.x1; x++) {
            const bx = ox + Math.floor((x - ox) / k) * k;
            if (bx < 0) continue;
            n++;
            if (u[y * w + x] !== u[by * w + bx] && ++bad > lim) break;
          }
        }
        if (bad <= lim && n) return { k, ox, oy };
      }
    }
    return null;
  }
  /** Sens du personnage : -1 tourné à gauche, 1 à droite, 0 de face. */
  const side = (I) => (I.facing === 'left' ? -1 : I.facing === 'right' ? 1 : 0);
  /**
   * Crâne à la hauteur du front (fraction frac de la tête) : bords réels de la silhouette à
   * cette ligne (et non la largeur maximale, qui compte le chignon, le nez ou le volume des
   * cheveux), sommet du crâne au-dessus de son centre, côté visage et côté nuque.
   */
  function skull(I, frac) {
    const L = Math.max(I.y0 + 2, Math.min(I.headB, Math.round(I.y0 + I.headH * frac)));
    let [l, r] = I.rows[L];
    if (r < 0) { l = I.hx0; r = I.hx1; }
    const w = r - l + 1, cx = (l + r) / 2, f = side(I);
    let top = I.y0;
    while (top < L && !(I.rows[top][1] >= 0 && I.rows[top][0] <= cx && I.rows[top][1] >= cx)) top++;
    return { L, l, r, w, cx, top, f, face: f < 0 ? l + w * 0.28 : f > 0 ? r - w * 0.28 : cx, back: f < 0 ? r - w * 0.22 : f > 0 ? l + w * 0.22 : cx };
  }
  /**
   * Couvre-chef ajusté au crâne : efface ce qui dépasse au-dessus (mèches, chignon), puis
   * dessine la calotte. grow : pixels de plus de chaque côté. Renvoie les repères du crâne.
   */
  function cap(p, I, frac, cols, outline, grow = 0) {
    const S = skull(I, frac);
    // calotte assez haute pour être bombée (un crâne aplati par le dessin donnerait un « chapeau champignon »)
    const rx = S.w / 2 + 0.5 + grow, ry = Math.max(S.L - S.top + 1.5, rx * 0.8) + grow * 0.5;
    for (let y = I.y0; y < S.L; y++) {
      const [l, r] = I.rows[y] || [0, -1];
      for (let x = l; x <= r; x++) if (((x - S.cx) / (rx + 0.5)) ** 2 + ((S.L - y) / (ry + 0.5)) ** 2 > 1) p.clear(x, y);
    }
    p.dome(S.cx, S.L, rx, ry, cols, outline);
    S.rx = rx; S.ry = ry;
    return S;
  }
  /** Motif retourné (pour les éléments orientés : plumet, visière). */
  const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));
  /** Contour de la tête seule (du sommet au menton) : centre et demi-largeur. */
  function headBox(I, bot = I.headB) {
    let l = Infinity, r = -1;
    for (let y = I.y0; y <= bot; y++) if (I.rows[y][1] >= 0) { l = Math.min(l, I.rows[y][0]); r = Math.max(r, I.rows[y][1]); }
    return r < 0 ? { cx: I.hcx, hw: I.headW / 2 } : { cx: (l + r) / 2, hw: (r - l + 1) / 2 };
  }
  /** Torse : seuls les pixels sous les épaules (le cou et le visage restent). */
  const body = (I, y) => y >= I.bodyY;
  const TF = {
    demon: {
      map: (r, g, b, a, x, y) => { const t = lum(r, g, b); return [...ramp(['#120306', '#3a070d', '#6e0f17', '#a81c22', '#dd3a2a', '#ff8a4a'])(t), a]; },
      deco(p, I) {
        // cornes recourbées au sommet du crâne
        // la pointe part vers l'extérieur ; la base est posée sur le crâne
        const horn = ['....k', '...kH', '..kHk', '..kHk', '.kHhk', '.kHhk', 'kHhhk', 'khhhk'];
        const pal = { k: '#1a0507', H: '#f2e2c8', h: '#a88a6a' };
        const base = I.y0 + 2, off = Math.max(2, Math.round(I.headW * 0.2));
        p.art(horn, Math.round(I.hcx + off), base - horn.length + 1, pal);
        p.art(horn.map((r) => [...r].reverse().join('')), Math.round(I.hcx - off) - 5, base - horn.length + 1, pal);
      },
      aura: '#ff2a2a', tick: (dt) => { const b = H().body; if (Math.random() < dt * 9 * mult()) add({ kind: 'flame', x: rnd(b.l - 2, b.r + 2), y: b.bottom - rnd(0, 2), vx: rnd(-3, 3), vy: -rnd(18, 34), sz: 2, life: rnd(0.6, 1.1), layer: 0 }); if (Math.random() < dt * 4) add({ kind: 'px', x: rnd(b.l, b.r), y: b.bottom, vy: -rnd(8, 16), sway: rnd(0, 6), life: 2, color: pick(['#ff6a3a', '#ffb43a', '#ff2a2a']), layer: 2 }); },
      poof: '#ff3a2a',
    },
    angel: {
      map: (r, g, b, a) => [Math.min(255, r * 0.75 + 70), Math.min(255, g * 0.75 + 66), Math.min(255, b * 0.7 + 52), a],
      deco(p, I) { p.ring(I.hcx, I.y0 - 3, Math.max(3, I.headW * 0.3), 1.2, '#ffe680'); p.ring(I.hcx, I.y0 - 3, Math.max(2, I.headW * 0.3 - 1), 0.6, '#fff6c4'); },
      behind(p, I) {
        // ailes de part et d'autre du torse (dessinées derrière l'avatar)
        // aile : bord d'attaque qui monte vers l'extérieur, plumes en festons dessous
        const y = I.bodyY + 1, L = Math.round(I.headW * 0.8);
        for (const dir of [-1, 1]) {
          const x0 = dir < 0 ? I.rows[Math.min(I.y1, y)][0] + 3 : I.rows[Math.min(I.y1, y)][1] - 3;
          for (let i = 0; i <= L; i++) {
            const k = i / L, top = Math.round(y - k * L * 0.75 - Math.sin(k * Math.PI) * 2), bot = Math.round(y + 7 - k * 9 + (i % 4 < 2 ? 1 : 0));
            const x = x0 + dir * i;
            for (let yy = top; yy <= bot; yy++) p.px(x, yy, yy === top || yy === bot ? '#9aa6d8' : (yy - top) % 4 === 3 ? '#d6dcff' : '#ffffff');
          }
        }
      },
      aura: '#fff1a8', tick: (dt) => { if (Math.random() < dt * 3) { const h = H(); add({ kind: 'twinkle', x: rnd(h.l - 6, h.r + 6), y: rnd(h.top - 4, h.body.bottom - 4), life: rnd(0.6, 1) }); } },
      poof: '#ffffff',
    },
    ghost: {
      map: (r, g, b, a, x, y, I) => { const t = lum(r, g, b); const c = ramp(['#3a4a7a', '#7d8fd0', '#b8c6ff', '#e6ecff', '#ffffff'])(t); return [c[0], c[1], c[2], y > I.y1 - 3 && noise(x, 9) > 0.45 ? 0 : a]; },
      alpha: 0.62, float: 2, poof: '#dfe6ff',
      tick: (dt) => { if (Math.random() < dt * 2) { const b = H().body; add({ kind: 'px', x: rnd(b.l, b.r), y: b.bottom - 1, vy: -rnd(4, 9), sway: rnd(0, 6), life: 1.6, fade: true, color: '#e6ecff', layer: 0 }); } },
    },
    statue: {
      map: (r, g, b, a, x, y) => { const t = lum(r, g, b) + (noise(x, y) - 0.5) * 0.12; return [...ramp(['#2e2c33', '#55525c', '#7d7a84', '#a8a5ad', '#cfccd2'])(t), a]; },
      poof: '#a8a5ad',
    },
    frozen: {
      map: (r, g, b, a, x, y) => { const t = lum(r, g, b); return [...ramp(['#173a66', '#2f6fb0', '#5fb0e8', '#a8e2ff', '#e8faff'])(t * 0.85 + (noise(x, y) > 0.985 ? 0.3 : 0)), a]; },
      post(p, I) {
        // givre : neige sur les surfaces tournées vers le haut
        const g = p.g, d = g.getImageData(0, 0, I.w, I.h), D = d.data, w = I.w;
        const op = (x, y) => y >= 0 && D[(y * w + x) * 4 + 3] > 20;
        for (let y = I.h - 1; y >= 0; y--) for (let x = 0; x < w; x++) {
          if (!op(x, y) || op(x, y - 1)) continue;
          const i = (y * w + x) * 4;
          D[i] = 255; D[i + 1] = 255; D[i + 2] = 255;
          if (op(x, y + 1) && noise(x, y) > 0.4) { const j = ((y + 1) * w + x) * 4; D[j] = 214; D[j + 1] = 244; D[j + 2] = 255; }
        }
        g.putImageData(d, 0, 0);
      },
      aura: '#bff4ff', poof: '#e8faff',
      tick: (dt) => { if (Math.random() < dt * 4) { const h = H(); add({ kind: 'twinkle', x: rnd(h.l - 4, h.r + 4), y: rnd(h.top, h.body.bottom), life: rnd(0.5, 0.9) }); } },
    },
    golden: {
      map: (r, g, b, a) => { const t = lum(r, g, b); return [...ramp(['#4a2a06', '#8a5a10', '#c8901c', '#f2c43a', '#ffe680', '#fff8d0'])(t), a]; },
      aura: '#ffd84a', poof: '#fff3b0',
      tick: (dt) => { const b = H().body; if (Math.random() < dt * 10 * mult()) add({ kind: 'px', x: rnd(b.l - 3, b.r + 3), y: b.bottom - rnd(0, 6), vy: -rnd(16, 30), life: rnd(0.8, 1.5), fade: true, color: pick(['#ffe680', '#fff8d0', '#ffd84a']), layer: 0 }); },
    },
    zombie: {
      map: (r, g, b, a) => { const t = lum(r, g, b); return [Math.round(r * 0.45 + 40 * t), Math.round(g * 0.55 + 70 * t + 20), Math.round(b * 0.4 + 20 * t), a]; },
      deco(p, I) { for (let k = 0; k < 4; k++) { const x = Math.round(I.hx0 + 2 + noise(k, 5) * (I.headW - 4)); p.px(x, I.y0 + Math.round(I.headH * (0.3 + noise(k, 8) * 0.4)), '#3a5a20'); } },
      poof: '#8fbf5a',
      tick: (dt) => { if (Math.random() < dt * 1.5) { const h = H(); add({ kind: 'fly', x: rnd(h.l - 5, h.r + 5), y: rnd(h.top - 3, h.cy), vx: rnd(-4, 4), vy: rnd(-3, 3), life: 3, seed: rnd(0, 6), layer: 2 }); } },
    },
    shadow: {
      map: (r, g, b, a) => [18, 10, 30, a],
      aura: '#b04aff', poof: '#3a1a5a',
    },
    glitch: {
      anim: 90, frames: 4, poof: '#59c2ff',
      post(p, I, f) {
        // décalage des couches rouge / bleue et bandes horizontales déplacées
        const g = p.g, w = I.w, hh = I.h;
        const src = g.getImageData(0, 0, w, hh), out = g.createImageData(w, hh);
        const sh = [1, -1, 2, 0][f], cut = I.y0 + Math.round(((f * 37) % 100) / 100 * (I.y1 - I.y0)), cutH = 2 + (f % 3), off = [3, -2, 4, -3][f];
        for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
          const sx = y >= cut && y < cut + cutH ? x - off : x;
          const at = (xx) => (xx >= 0 && xx < w ? (y * w + xx) * 4 : -1);
          const o4 = (y * w + x) * 4, c = at(sx), rr = at(sx - sh), bb = at(sx + sh);
          out.data[o4] = rr >= 0 ? src.data[rr] : 0;
          out.data[o4 + 1] = c >= 0 ? src.data[c + 1] : 0;
          out.data[o4 + 2] = bb >= 0 ? src.data[bb + 2] : 0;
          out.data[o4 + 3] = Math.max(c >= 0 ? src.data[c + 3] : 0, rr >= 0 ? src.data[rr + 3] : 0, bb >= 0 ? src.data[bb + 3] : 0);
        }
        g.putImageData(out, 0, 0);
      },
    },
    retro: {
      map: (r, g, b, a) => [...ramp(['#0f380f', '#306230', '#8bac0f', '#9bbc0f'])(lum(r, g, b)), a],
      poof: '#9bbc0f',
    },
    // ---------- tenues ----------
    knight: {
      map: (r, g, b, a, x, y, I) => (body(I, y) ? [...ramp(['#2a2d36', '#4f5564', '#7c8496', '#b4bccb', '#e6ecf5'])(lum(r, g, b) * 0.8 + (Math.floor((y - I.bodyY) / I.k) % 4 === 1 ? 0.2 : 0)), a] : null),
      deco(p, I) {
        const S = cap(p, I, 0.42, ['#5a6070', '#8a92a4', '#cfd6e2'], '#1c1e26');
        p.rect(S.cx - S.rx, S.L, S.rx * 2 + 1, 1, '#3a3f4c');
        p.rect(S.face - 0.5, S.L, 1, Math.max(2, Math.round(I.headH * 0.22)), '#5a6070'); // nasal, côté visage
        p.px(S.face, S.L + Math.max(2, Math.round(I.headH * 0.22)), '#1c1e26');
        // plumet sur le sommet, qui flotte vers l'arrière
        const plume = ['..rr', '.rRr', 'rRr.', 'rRr.', '.rr.', '.r..'];
        const px = S.f ? S.cx + (S.back - S.cx) * 0.5 : S.cx;
        p.art(S.f > 0 ? mirror(plume) : plume, Math.round(px) - 2, S.top - 6, { r: '#c8282c', R: '#ff6a4a' });
        // épaulières
        if (I.bodyY + 2 <= I.y1) for (const dir of [-1, 1]) { const x = dir < 0 ? I.rows[I.bodyY + 2][0] : I.rows[I.bodyY + 2][1] - 4; p.dome(x + 2, I.bodyY + 3, 3, 3, ['#5a6070', '#8a92a4', '#cfd6e2'], '#1c1e26'); }
      },
      poof: '#cfd6e2',
    },
    paladin: {
      map: (r, g, b, a, x, y, I) => (body(I, y) ? [...ramp(['#5a5040', '#a89a7a', '#e8e2d2', '#ffffff'])(lum(r, g, b)), a] : null),
      deco(p, I) {
        const S = cap(p, I, 0.38, ['#b8b0a0', '#e8e2d2', '#ffffff'], '#3a3020');
        p.rect(S.cx - S.rx, S.L, S.rx * 2 + 1, 1, '#d8a828');
        p.rect(S.cx - 0.5, S.top - 1, 1, S.L - S.top + 1, '#d8a828'); // crête dorée
        if (I.bodyY + 4 > I.y1) return; // pas de torse : casque seulement
        const cx = I.hcx;
        // croix dorée sur la poitrine
        const y = I.bodyY + 3;
        p.rect(cx - 0.5, y, 1, 5, '#d8a828'); p.rect(cx - 2, y + 1, 5, 1, '#d8a828');
        // bouclier devant, en bas à gauche du torse
        const bx = I.rows[Math.min(I.y1, I.bodyY + 4)][0] + 1, by = I.bodyY + 1, sw = Math.max(7, Math.round(I.headW * 0.42)), sh = Math.round(sw * 1.3);
        for (let yy = 0; yy < sh; yy++) {
          const k = yy < sh * 0.55 ? 1 : 1 - (yy - sh * 0.55) / (sh * 0.45);
          const hw = Math.round((sw / 2) * k);
          for (let xx = -hw; xx <= hw; xx++) p.px(bx + sw / 2 + xx, by + yy, Math.abs(xx) === hw || yy === 0 ? '#d8a828' : xx < 0 ? '#2a5ab8' : '#1f4590');
        }
        p.rect(bx + sw / 2 - 0.5, by + 2, 1, sh - 5, '#ffe680'); p.rect(bx + sw / 2 - 2, by + Math.round(sh * 0.35), 5, 1, '#ffe680');
      },
      aura: '#fff1a8', poof: '#ffe680',
    },
    soldier: {
      map: (r, g, b, a, x, y, I) => { if (!body(I, y)) return null; const n = noise(Math.floor(x / I.k / 2), Math.floor(y / I.k / 2)); const t = lum(r, g, b); const c = n < 0.33 ? '#4a5a2a' : n < 0.66 ? '#6b7a3a' : '#3a3020'; const k = hex(c); return [Math.round(k[0] * (0.6 + t * 0.6)), Math.round(k[1] * (0.6 + t * 0.6)), Math.round(k[2] * (0.6 + t * 0.6)), a]; },
      deco(p, I) {
        const S = cap(p, I, 0.38, ['#3a4a22', '#566a30', '#7a8c48'], '#1a2010', 1);
        p.rect(S.cx - S.rx - 1, S.L, S.rx * 2 + 3, 1, '#2a3418'); // bord du casque
        for (let x = Math.round(S.cx - S.rx) + 2; x < S.cx + S.rx - 1; x += 3) p.px(x, S.L - 2 - (x % 2), '#2a3418'); // filet
        // jugulaire
        const jx = S.f ? S.back + S.f * S.w * 0.08 : null;
        if (jx !== null) p.rect(jx, S.L + 1, 1, Math.max(2, Math.round(I.headH * 0.35)), '#2a3418');
      },
      poof: '#8a8a6a',
    },
    pilot: {
      map: (r, g, b, a, x, y, I) => (body(I, y) ? (y < I.bodyY + 2 * I.k ? [...ramp(['#c8b89a', '#efe6d2', '#ffffff'])(lum(r, g, b)), a] : [...ramp(['#2a160c', '#4a2a16', '#6e4024', '#8e5a32'])(lum(r, g, b)), a]) : null),
      deco(p, I) {
        const S = cap(p, I, 0.45, ['#4a2a16', '#6e4024', '#9a6a3c'], '#1e0e06');
        const fh = Math.round(I.headH * 0.3);
        // rabats : les deux de face, celui de l'oreille (côté nuque) de profil
        if (S.f) p.rect(Math.round(S.back - 1), S.L, 3, fh, '#5a321a');
        else for (const dir of [-1, 1]) p.rect(dir < 0 ? S.l - 1 : S.r - 1, S.L, 3, fh, '#5a321a');
        // lunettes relevées sur le front
        const gy = S.L - Math.max(2, Math.round((S.L - S.top) * 0.45)), r0 = Math.max(2, Math.round(S.w * 0.12));
        p.rect(S.cx - S.rx + 1, gy, S.rx * 2 - 1, 1, '#2a1a10'); // sangle
        const lens = S.f ? [S.face - S.f * 0.5] : [S.cx - r0 - 1, S.cx + r0 + 1];
        for (const x of lens) {
          const rr = S.f ? r0 + 0.5 : r0;
          for (let yy = -rr; yy <= rr; yy++) for (let xx = -rr; xx <= rr; xx++) if ((xx / (rr + 0.5)) ** 2 + (yy / (rr * 0.8 + 0.5)) ** 2 <= 1) p.px(x + xx, gy + yy, '#8fd8ff');
          p.ring(x, gy, rr, rr * 0.8, '#c8c8d0');
          p.px(x - 1, gy - 1, '#ffffff');
        }
      },
      poof: '#efe6d2',
    },
    astronaut: {
      map: (r, g, b, a, x, y, I) => (body(I, y) ? [...ramp(['#7a8496', '#b4bccb', '#e6ecf5', '#ffffff'])(lum(r, g, b) * 0.6 + 0.45), a] : null),
      deco(p, I) {
        // bulle de verre autour de la tête (tête seule : sans les épaules)
        const bot = I.bodyY < I.h ? Math.min(I.bodyY - 1, I.y1) : Math.min(I.y1, I.headB + Math.round(I.headH * 0.3)), B = headBox(I, bot);
        const cx = B.cx, cy = (I.y0 + bot) / 2, rx = B.hw + 2, ry = (bot - I.y0) / 2 + 2;
        const inside = (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
        p.g.globalAlpha = 0.22;
        for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (inside(x, y)) p.px(x, y, '#8fd8ff');
        p.g.globalAlpha = 1;
        // contour : pixels du bord de la bulle (sans pixels isolés qui dépassent)
        for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (inside(x, y) && !(inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1))) p.px(x, y, '#e6ecf5');
        const f = side(I), a0 = f > 0 ? -1.4 : -2.4;
        for (let a = a0; a < a0 + 0.8; a += 0.08) p.px(cx + Math.cos(a) * (rx - 2), cy + Math.sin(a) * (ry - 2), '#ffffff'); // reflet
        if (I.bodyY + 4 > I.y1) return;
        p.rect(cx - rx, I.bodyY - 1, rx * 2, 2, '#b4bccb'); // col
        // panneau de commande sur la poitrine
        const px = I.hcx + f * I.headW * 0.15, py = I.bodyY + 3;
        p.rect(px - 3, py, 6, 3, '#3a4a6a'); p.px(px - 2, py + 1, '#ff3b6b'); p.px(px, py + 1, '#b6ff6a'); p.px(px + 2, py + 1, '#59c2ff');
      },
      poof: '#e6ecf5',
    },
    worker: {
      map: (r, g, b, a, x, y, I) => {
        if (!body(I, y)) return null;
        const t = lum(r, g, b), dy = Math.floor((y - I.bodyY) / I.k);
        if (dy === 4 || dy === 5 || dy === 9 || dy === 10) return [...ramp(['#9aa0aa', '#d8dce4', '#ffffff'])(t), a]; // bandes réfléchissantes
        return [...ramp(['#a83a06', '#e85a10', '#ff7a1a', '#ff9a3a'])(t), a];
      },
      deco(p, I) {
        const S = cap(p, I, 0.38, ['#c89a10', '#ffd21a', '#fff07a'], '#5a4206');
        // visière : tout autour de face, prolongée côté visage de profil
        const x0 = S.f < 0 ? S.cx - S.rx - 3 : S.cx - S.rx - (S.f ? 1 : 2), x1 = S.f > 0 ? S.cx + S.rx + 3 : S.cx + S.rx + (S.f ? 1 : 2);
        p.rect(x0, S.L, x1 - x0 + 1, 1, '#e8b810');
        p.rect(x0, S.L + 1, x1 - x0 + 1, 1, '#8a6a08');
        p.rect(S.cx - 0.5, S.top - 1, 1, S.L - S.top + 1, '#fff07a'); // arête
      },
      poof: '#ffd21a',
    },
  };
  const lookCache = new WeakMap();
  /** Image de l'avatar transformée (mise en cache par image, transformation et image d'animation). */
  function transformed(img, id, f = 0) {
    let m = lookCache.get(img);
    if (!m) { m = {}; lookCache.set(img, m); }
    const facing = cfg().facing || '';
    const key = id + ':' + f + ':' + facing;
    if (m[key]) return m[key];
    const def = TF[id], w = o.width, hh = o.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = hh;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0, w, hh);
    let data;
    try { data = g.getImageData(0, 0, w, hh); } catch (e) { return img; }
    const I = info(data.data, w, hh);
    if (!I) return img;
    // taille d'un pixel du dessin : gros pixels de l'image (dessin doublé…), sinon d'après la tête
    const B = blockSize(data.data, w, hh, I) || { k: Math.max(1, Math.round(I.headW / 24)), ox: 0, oy: 0 };
    I.k = B.k; I.ox = B.ox; I.oy = B.oy; I.facing = facing;
    const Ik = scaled(I, I.k, B.ox, B.oy);
    if (def.map) {
      const d = data.data;
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (!d[i + 3]) continue;
        const res = def.map(d[i], d[i + 1], d[i + 2], d[i + 3], x, y, I);
        if (res) { d[i] = res[0]; d[i + 1] = res[1]; d[i + 2] = res[2]; d[i + 3] = res[3]; }
      }
      g.putImageData(data, 0, 0);
    }
    const p = pen(g, I.k, I.ox, I.oy);
    if (def.deco) def.deco(p, Ik, f);
    if (def.behind) { g.globalCompositeOperation = 'destination-over'; def.behind(p, Ik, f); g.globalCompositeOperation = 'source-over'; }
    if (def.post) def.post(pen(g), I, f);
    m[key] = c;
    return c;
  }
  /** Transformation affichée : celle activée à la main, sinon celle liée à l'expression. */
  const currentTransform = () => st.transId || st.linkedTrans || null;
  // seconds : durée de cette activation (0 = jusqu'au prochain appui) ; sinon durée des réglages
  function toggleTransform(id, on, seconds) {
    const next = on === undefined ? st.transId !== id : !!on;
    st.transId = next ? id : st.transId === id ? null : st.transId;
    if (next) {
      const dur = seconds !== undefined && seconds !== null ? +seconds || 0 : +(cfg().transformDuration || 0);
      st.transUntil = dur > 0 ? st.t + dur : Infinity;
      // petit nuage magique au moment de la transformation
      const h = H(), col = TF[id].poof || '#ffffff';
      for (let k = 0; k < Math.round(22 * mult()); k++) { const a = rnd(0, Math.PI * 2), v = rnd(6, 16); add({ kind: 'px', x: h.x + Math.cos(a) * (h.r - h.l) * 0.5, y: h.cy + Math.sin(a) * (h.r - h.l) * 0.6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.94, life: rnd(0.4, 0.8), fade: true, color: col, layer: 2 }); }
    }
    st.dirty = true;
    return next;
  }

  // ---------- sprites ----------
  const sprCache = {};
  function sprite(name, color) {
    const key = name + (color || '');
    if (sprCache[key]) return sprCache[key];
    const rows = SP[name];
    const c = document.createElement('canvas');
    c.width = rows[0].length; c.height = rows.length;
    const x = c.getContext('2d');
    rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') { x.fillStyle = color && ch !== 'k' && ch !== 'c' ? color : PAL[ch]; x.fillRect(i, j, 1, 1); } }));
    return (sprCache[key] = c);
  }
  // contour de la silhouette (aura, arc-en-ciel)
  const ringCache = new WeakMap();
  function ring(img) {
    let r = ringCache.get(img);
    if (r) return r;
    const w = o.width + unit * 2, h = o.height + unit * 2;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) x.drawImage(img, unit + dx * unit, unit + dy * unit, o.width, o.height);
    x.globalCompositeOperation = 'destination-out';
    x.drawImage(img, unit, unit, o.width, o.height);
    r = { c, tint: document.createElement('canvas') };
    r.tint.width = w; r.tint.height = h;
    ringCache.set(img, r);
    return r;
  }

  // ---------- dessin ----------
  function cell(g, x, y, color, w = 1, h = 1) {
    g.fillStyle = color;
    g.fillRect(st.ox + Math.round(x) * st.U, st.oy + Math.round(y) * st.U, w * st.U, h * st.U);
  }
  function drawSprite(g, s, x, y) {
    g.drawImage(s, st.ox + Math.round(x) * st.U, st.oy + Math.round(y) * st.U, s.width * st.U, s.height * st.U);
  }
  function line(g, x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 400; n++) { cell(g, x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  function particle(g, p) {
    const a = p.fade ? Math.min(1, (p.life - p.age) / 0.5) : 1;
    g.globalAlpha = Math.max(0, a);
    switch (p.kind) {
      case 'conf': { const f = Math.floor((st.t * 10 + p.flip) % 3); cell(g, p.x, p.y, p.color, f === 0 ? 2 : 1, f === 1 ? 2 : 1); break; }
      case 'spr': { const s = sprite(p.spr, p.color); drawSprite(g, s, p.x - s.width / 2, p.y); break; }
      case 'twinkle': { const k = Math.sin((p.age / p.life) * Math.PI); const big = k > 0.6; drawSprite(g, sprite(big ? 'star' : 'starS'), p.x - (big ? 2 : 1), p.y - (big ? 2 : 1)); break; }
      case 'rocket': cell(g, p.x, p.y, '#fff3c4'); cell(g, p.x, p.y + 1, p.color); break;
      case 'spark': { const k = 1 - p.age / p.life; g.globalAlpha = k > 0.3 || Math.floor(st.t * 20) % 2 ? 1 : 0; cell(g, p.x, p.y, k > 0.6 ? '#ffffff' : p.color); break; }
      case 'shoot': line(g, p.x, p.y, p.x + 5, p.y - 3, '#bfd8ff'); cell(g, p.x, p.y, '#ffffff'); break;
      case 'px': cell(g, p.x, p.y, p.color); break;
      case 'rain': cell(g, p.x, p.y, '#9fd3ff'); cell(g, p.x, p.y + 1, '#6fb6ff'); break;
      case 'petal': { const f = Math.floor((st.t * 6 + p.sway) % 2); cell(g, p.x, p.y, '#ff9ccf', f ? 2 : 1, f ? 1 : 2); cell(g, p.x, p.y, '#ffc4e1'); break; }
      case 'fly': { const b = (Math.sin(st.t * 4 + p.seed) + 1) / 2; if (b > 0.35) { cell(g, p.x, p.y, '#e9ff8a'); if (b > 0.8) { g.globalAlpha = 0.45; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cell(g, p.x + dx, p.y + dy, '#b6ff6a'); } } break; }
      case 'flame': {
        const k = p.age / p.life;
        const c = k < 0.18 ? '#fffbe0' : k < 0.38 ? '#ffe04a' : k < 0.6 ? '#ff9a2e' : k < 0.8 ? '#e8402a' : '#8a1c26';
        const sz = Math.max(1, Math.round((p.sz || 1) * (1 - k * 0.8)));
        cell(g, p.x - (sz >> 1), p.y, c, sz, sz);
        if (k < 0.45) cell(g, p.x - (sz >> 1), p.y + sz, '#ffb43a', sz, 1);
        break;
      }
      default: break;
    }
    g.globalAlpha = 1;
  }
  function silhouette(g, color, alpha, grow) {
    const geom = st.geom;
    if (!geom || !geom.img) return;
    const r = ring(geom.img);
    const t = r.tint.getContext('2d');
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, r.tint.width, r.tint.height);
    t.drawImage(r.c, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = color;
    t.fillRect(0, 0, r.tint.width, r.tint.height);
    const px = st.px;
    g.save();
    g.globalAlpha = alpha;
    g.imageSmoothingEnabled = false;
    if (geom.tilt) {
      const cx = st.mx + (o.width * px) / 2, by = st.my + o.height * px;
      g.translate(cx, by); g.rotate(geom.tilt); g.translate(-cx, -by);
    }
    const e = grow * px;
    g.drawImage(r.tint, st.mx - unit * px - e, st.my - unit * px - e, (o.width + unit * 2) * px + e * 2, (o.height + unit * 2) * px + e * 2);
    g.restore();
  }


  // ---------- fonds de scène animés (dessinés sur une petite grille puis agrandis) ----------
  const sc = document.createElement('canvas');
  const sg = sc.getContext('2d');
  const hsh = (a, b = 0) => { let n = (a * 374761393 + b * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  let W = 64, Hh = 48, T = 0;
  const R = Math.round;
  function spx(x, y, c) { sg.fillStyle = c; sg.fillRect(R(x), R(y), 1, 1); }
  function rect(x, y, w, h, c) { sg.fillStyle = c; sg.fillRect(R(x), R(y), R(w), R(h)); }
  function bands(cols, y0 = 0, y1 = Hh) { const n = cols.length, hh = (y1 - y0) / n; cols.forEach((c, i) => rect(0, y0 + i * hh, W, Math.ceil(hh) + 1, c)); }
  function disc(cx, cy, r, c, cut) { cx = R(cx); cy = R(cy); r = Math.max(1, R(r)); for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6 && (!cut || !cut(cx + x, cy + y))) spx(cx + x, cy + y, c); }
  function cloud(x, y, s, c = '#ffffff', sh = '#e6ecff') { rect(x, y + 2 * s, 9 * s, 2 * s, sh); rect(x + s, y + s, 7 * s, 2 * s, c); rect(x + 2 * s, y, 3 * s, s, c); rect(x + 5 * s, y, 2 * s, s, c); }
  function stars(n, seed, col, top = 0.6) { for (let i = 0; i < n; i++) { const on = Math.sin(T * (1 + hsh(i, 9) * 2) + i) > -0.6; if (on) spx(hsh(i, seed) * W, hsh(seed, i) * Hh * top, hsh(i, 3) > 0.8 ? '#ffffff' : col); } }
  function ridge(base, amp, freq, phase, col) { for (let x = 0; x < W; x++) { const y = R(base - amp * (Math.sin(x * freq + phase) * 0.6 + Math.sin(x * freq * 2.3 + phase * 1.7) * 0.4)); rect(x, y, 1, Hh - y, col); } }
  function pine(x, base, h, col) { for (let k = 0; k < h; k++) { const w = Math.max(1, R((k / h) * h * 0.45)); rect(x - w / 2, base - h + k, w, 1, col); } rect(x, base, 1, 2, col); }
  function sline(x0, y0, x1, y1, c) { x0 = R(x0); y0 = R(y0); x1 = R(x1); y1 = R(y1); const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy; for (let n = 0; n < 600; n++) { spx(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } } }
  const wrapX = (v, span) => ((v % span) + span) % span;
  const SCENES = {
    sky() {
      bands(['#5fb4ff', '#74c0ff', '#8ccaff', '#a8d6ff', '#c6e2ff', '#e6ecff', '#ffe1ef']);
      const s = Math.max(1, R(Hh / 24));
      cloud(wrapX(T * 2, W + 30) - 24, Hh * 0.12, s); cloud(wrapX(T * 1.2 + 40, W + 30) - 24, Hh * 0.31, Math.max(1, s - 1)); cloud(wrapX(T * 1.6 + 70, W + 30) - 24, Hh * 0.54, Math.max(1, s - 1));
    },
    night() {
      bands(['#0b0a1c', '#110f26', '#17132f', '#1f1838', '#291d41', '#33224a']);
      stars(R(W * Hh / 110), 7, '#7c78b8');
      const r = Math.max(3, R(Hh / 12)), mx = W * 0.83, my = Hh * 0.17;
      disc(mx, my, r, '#fff6cf', (x, y) => (x - mx - r * 0.5) ** 2 + (y - my + r * 0.25) ** 2 <= (r * 0.85) ** 2);
    },
    sunset() {
      const hz = R(Hh * 0.66), sx = W * 0.78, r = Math.max(4, R(Hh / 6));
      bands(['#2b1b4d', '#4d2160', '#8a2e6b', '#c2405f', '#e8644f', '#ff9a3c', '#ffcf6b'], 0, hz);
      disc(sx, hz, r, '#fff1a8'); disc(sx, hz, r - 2, '#ffe27a');
      bands(['#3a2457', '#2f1d4a', '#251740', '#1c1236'], hz, Hh);
      for (let y = hz + 1; y < Hh; y += 2) { const w = Math.max(2, r * 1.6 - (y - hz)); const o = R(Math.sin(T * 3 + y) * 1.5); rect(sx - w / 2 + o, y, w, 1, y % 4 ? '#ffd36b' : '#ff9a3c'); }
    },
    aurora() {
      bands(['#06121f', '#081a2a', '#0b2234', '#0f2a3d']);
      stars(R(W * Hh / 150), 3, '#5f7f9f');
      const base = Hh * 0.19, amp = Hh / 16, len = Math.max(4, R(Hh / 5));
      for (let x = 0; x < W; x++) {
        const y = R(base + Math.sin(x * 0.14 + T * 0.8) * amp + Math.sin(x * 0.06 - T * 0.5) * amp);
        const k = (Math.sin(x * 0.2 + T) + 1) / 2;
        sg.globalAlpha = 0.55 + k * 0.4; rect(x, y, 1, 2, '#7dffb8');
        sg.globalAlpha = 0.45; rect(x, y + 2, 1, len * 0.4, '#3ed69c');
        sg.globalAlpha = 0.3; rect(x, y + 2 + len * 0.4, 1, len * 0.4, '#8a6bff');
        sg.globalAlpha = 1;
      }
      ridge(Hh * 0.83, Hh / 8, 0.12, 1, '#13243a'); ridge(Hh * 0.92, Hh / 12, 0.2, 3, '#0a1522');
    },
    synthwave() {
      const hz = R(Hh * 0.62), r = R(Hh * 0.21), cy = hz - R(Hh * 0.17);
      bands(['#140826', '#24093a', '#3c0c4d', '#5e1460', '#8a1f6f', '#c7337a'], 0, hz);
      disc(W / 2, cy, r, '#ffd36b', (x, y) => y > cy && ((y - cy) % 3 === 0 || (y - cy > r * 0.5 && (y - cy) % 2 === 0)));
      disc(W / 2, cy, r, '#ff7a9c', (x, y) => y < cy + r * 0.3 || (y - cy) % 3 === 0 || (y - cy > r * 0.5 && (y - cy) % 2 === 0));
      rect(0, hz, W, Hh - hz, '#10051f');
      const gh = Hh - hz;
      for (let i = 0; i < 6; i++) { const k = (i + (T * 0.8) % 1) / 6; rect(0, R(hz + 1 + k * k * gh), W, 1, '#ff4fd8'); }
      for (let i = -8; i <= 8; i++) sline(W / 2 + i * 2, hz + 1, W / 2 + i * W / 6, Hh, '#7a1f86');
      rect(0, hz, W, 1, '#ff7ae8');
    },
    city() {
      bands(['#100a26', '#170d33', '#22113f', '#2f164c', '#3e1c58']);
      stars(R(W / 6), 11, '#6a5a9a', 0.4);
      for (let i = 0, x = 0; x < W; i++) {
        const w = 5 + Math.floor(hsh(i, 1) * 6), h = R(Hh * (0.25 + hsh(i, 2) * 0.45)), top = Hh - h;
        rect(x, top, w, h, i % 2 ? '#1b1336' : '#22183f');
        for (let wy = top + 2; wy < Hh - 1; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 2) {
          if (hsh(wx, wy) > 0.55 && Math.sin(T * 0.3 + hsh(wy, wx) * 40) > -0.7) spx(wx, wy, hsh(wx + 1, wy) > 0.85 ? '#7ff0ff' : '#ffd36b');
        }
        if (hsh(i, 5) > 0.7 && Math.sin(T * 3 + i) > -0.3) rect(x + 1, top - 3, w - 2, 2, hsh(i, 6) > 0.5 ? '#ff4fa3' : '#4ff2ff');
        x += w + 1;
      }
    },
    space() {
      rect(0, 0, W, Hh, '#05040d');
      for (const [n, sp, col, seed] of [[R(W * Hh / 100), 1, '#3d3a66', 1], [R(W * Hh / 170), 3, '#8c88c8', 2], [R(W * Hh / 380), 7, '#ffffff', 3]]) for (let i = 0; i < n; i++) spx(wrapX(hsh(i, seed) * W - T * sp, W), hsh(seed, i) * Hh, col);
      const px0 = W * 0.8, py = Hh * 0.27, r = Math.max(4, R(Hh * 0.15));
      disc(px0, py, r, '#e8935a');
      for (let y = R(py - r); y <= py + r; y += 3) for (let x = R(px0 - r); x <= px0 + r; x++) if ((x - px0) ** 2 + (y - py) ** 2 <= r * r) spx(x, y, '#c96f3e');
      for (let a = 0; a < Math.PI * 2; a += 0.04) { const x = px0 + Math.cos(a) * r * 1.7, y = py + Math.sin(a) * r * 0.43; if (Math.sin(a) > 0 || (x - px0) ** 2 + ((y - py) * 2.3) ** 2 > r * r) spx(x, y, '#f3d9a6'); }
    },
    forest() {
      const k = Hh / 48;
      bands(['#2d3a5c', '#4a4a6e', '#7a5a76', '#b36e72', '#e09474', '#f2b880']);
      disc(W * 0.22, Hh * 0.46, Math.max(3, R(5 * k)), '#ffe2a8');
      for (let i = 0; i * 6 < W + 6; i++) pine(i * 6 + 2, R(Hh * 0.71), R((12 + (i % 3) * 2) * k), '#4a5470');
      for (let i = 0; i * 8 < W + 8; i++) pine(i * 8 + 5, R(Hh * 0.83), R((16 + (i % 2) * 3) * k), '#2b3348');
      rect(0, Hh * 0.83, W, 3, '#2b3348'); rect(0, Hh * 0.87, W, Hh, '#151a26');
      for (let i = 0; i * 15 < W + 15; i++) pine(i * 15 + 1, Hh, R((20 + (i % 2) * 4) * k), '#151a26');
    },
    mountains() {
      bands(['#8fd3ff', '#a6dcff', '#bfe6ff', '#d8f0ff', '#eef8ff']);
      disc(W * 0.78, Hh * 0.19, Math.max(3, R(Hh / 12)), '#fffbe0');
      const P2 = Math.max(20, R(W * 0.4)), base = Hh * 0.58, snow = Hh * 0.46;
      for (let x = 0; x < W; x++) { const y = R(base - (P2 / 2 - Math.abs(((x + P2 / 4) % P2) - P2 / 2)) * 0.9); rect(x, y, 1, Hh - y, '#a9b8d9'); if (y < snow) rect(x, y, 1, snow - y, '#ffffff'); }
      ridge(Hh * 0.79, Hh / 10, 0.1, 2, '#6b84b8'); ridge(Hh * 0.92, Hh / 16, 0.18, 5, '#4f6697');
    },
    beach() {
      const s1 = R(Hh * 0.54), s2 = R(Hh * 0.79);
      bands(['#5fc3ff', '#7fd0ff', '#a3ddff', '#c8f0ff'], 0, s1);
      disc(W * 0.19, Hh * 0.17, Math.max(3, R(Hh / 12)), '#fff3a6'); cloud(wrapX(T * 1.5, W + 30) - 24, Hh * 0.21, 1);
      bands(['#2a8fd4', '#2f9fdc', '#36b0e2', '#4fc3e6'], s1, s2);
      for (let y = s1 + 2; y < s2; y += 3) for (let x = 0; x < W; x += 8) rect(x + R(Math.sin(T * 1.5 + y) * 3) + (y % 2) * 4, y, 3, 1, '#bfe9ff');
      const sw = R(Math.sin(T * 0.9) * 2);
      rect(0, s2 + sw, W, Hh, '#f2d38a'); rect(0, s2 + sw, W, 1, '#ffffff');
      for (let i = 0; i < W / 3; i++) spx(hsh(i, 4) * W, s2 + 3 + hsh(4, i) * (Hh - s2 - 3), '#d9b46a');
    },
    underwater() {
      bands(['#3fb5c9', '#2a9bb8', '#1f84a6', '#176c8f', '#115578', '#0c4263']);
      sg.globalAlpha = 0.18;
      for (let i = 0; i * 18 < W + 20; i++) { const x0 = wrapX(i * 18 + T * 3, W + 20) - 10; for (let y = 0; y < Hh; y++) rect(x0 + y * 0.4, y, 3, 1, '#e6fbff'); }
      sg.globalAlpha = 1;
      const fl = Hh - 3;
      rect(0, fl, W, 3, '#d9c48a');
      for (let i = 0; i * 7 < W; i++) { const x = i * 7 + 3, h = R((14 + (i % 3) * 4) * Hh / 48); for (let y = 0; y < h; y++) spx(x + R(Math.sin(T * 1.6 + y * 0.35 + i) * 1.2), fl - y, y % 4 ? '#2fa36b' : '#47c47e'); }
    },
    pastel() {
      bands(['#c7b8ff', '#d6b8ff', '#e6bdf5', '#f6c6ec', '#ffd6ef', '#ffe6f1']);
      const s = Math.max(1, R(Hh / 16));
      cloud(wrapX(T + 5, W + 40) - 30, Hh * 0.08, s, '#ffffff', '#ffd6ef');
      cloud(wrapX(T * 1.6 + 50, W + 40) - 30, Hh * 0.46, Math.max(1, s - 1), '#fff4fb', '#f6c6ec');
      cloud(wrapX(T * 0.7 + 20, W + 40) - 30, Hh * 0.75, Math.max(1, s - 1), '#ffffff', '#e6bdf5');
    },
    room() {
      rect(0, 0, W, Hh, '#3b2f4a');
      for (let x = 0; x < W; x += 4) rect(x, 0, 2, Hh, '#42355a');
      const ws = R(Hh * 0.33), wx = R(W * 0.07), wy = R(Hh * 0.13);
      rect(wx, wy, ws, ws, '#2a2036'); rect(wx + 1, wy + 1, ws - 2, ws - 2, '#141133');
      for (let i = 0; i < 6; i++) spx(wx + 2 + hsh(i, 8) * (ws - 4), wy + 2 + hsh(8, i) * (ws - 4), '#c9c3ff');
      disc(wx + ws * 0.68, wy + ws * 0.32, Math.max(1, R(ws / 8)), '#fff6cf');
      rect(wx + ws / 2, wy, 1, ws, '#2a2036'); rect(wx, wy + ws / 2, ws, 1, '#2a2036');
      const shx = R(W * 0.68), shy = R(Hh * 0.5), shw = R(W * 0.28);
      rect(shx, shy, shw, 2, '#5a4630');
      let bx = shx + 2;
      for (const [c, h] of [['#e05a6a', 3], ['#5aa0e0', 4], ['#e0c45a', 3], ['#7ac07a', 5], ['#b07ae0', 3], ['#e09a5a', 4]]) { if (bx + 2 > shx + shw) break; rect(bx, shy - h, 2, h, c); bx += 3; }
      const pw = R(Hh * 0.21), pxx = R(W * 0.74), pyy = R(Hh * 0.13);
      rect(pxx, pyy, pw, pw * 1.2, '#ff9ccf'); rect(pxx + 1, pyy + 1, pw - 2, pw * 1.2 - 2, '#ffd6ef');
      const hs = sprite('heart'); sg.drawImage(hs, R(pxx + pw / 2 - 2.5), R(pyy + pw * 0.4));
      for (let x = 0; x < W; x++) { const y = R(2 + Math.sin(x * 0.2) * 1.5); spx(x, y, '#2a2036'); if (x % 5 === 0 && Math.sin(T * 2 + x) > -0.4) spx(x, y + 1, ['#ffd36b', '#ff6b9a', '#6bd3ff', '#9bff6b'][(x / 5) % 4]); }
    },
    tiles() {
      const t = Math.max(6, R(Hh / 6)), o = Math.floor((T * 4) % (t * 2));
      for (let y = -t * 2; y < Hh + t; y += t) for (let x = -t * 2; x < W + t; x += t) rect(x + o, y + o, t, t, ((((x + y) / t) % 2) + 2) % 2 ? '#ffd6ef' : '#d8ccff');
      const st2 = sprite('starS');
      for (let y = -t * 2; y < Hh + t; y += t * 2) for (let x = -t * 2; x < W + t; x += t * 2) sg.drawImage(st2, x + o + R(t / 2) - 1, y + o + R(t / 2) - 1);
    },
  };
  function drawScene(id, dt) {
    const c = o.bg;
    if (!c) return;
    const g = c.getContext('2d');
    if (!SCENES[id]) {
      if (st.sceneOn) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); st.sceneOn = false; }
      return;
    }
    st.sceneOn = true;
    T += dt;
    W = st.GW; Hh = st.GH;
    if (sc.width !== W || sc.height !== Hh) { sc.width = W; sc.height = Hh; }
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, W, Hh);
    sg.globalAlpha = 1;
    SCENES[id]();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(sc, st.ox - st.U, st.oy - st.U, W * st.U, Hh * st.U);
  }

  let wasActive = false;
  function frame(now, s) {
    const dt = Math.min(0.05, st.last ? (now - st.last) / 1000 : 0.016);
    st.last = now;
    st.t += dt;
    const c = cfg();
    layout(s.geom);
    drawScene(o.background ? o.background() : null, dt);
    // expression : effets ponctuels liés au moment où elle commence ; effets continus tant qu'elle dure
    if (s.expression !== st.expr) {
      const first = st.expr === undefined;
      st.expr = s.expression;
      if (!first) for (const id of (c.byExpr || {})[s.expression || ''] || []) if (ONESHOT.includes(id)) trigger(id, false);
    }
    const linked = ((c.byExpr || {})[s.expression || ''] || []).filter((id) => AMB[id]);
    st.linkedTrans = ((c.byExpr || {})[s.expression || ''] || []).find((id) => TF[id]) || null;
    if (st.transId && st.t > st.transUntil) { st.transId = null; st.dirty = true; }
    for (const id in st.ambUntil) if (st.t > st.ambUntil[id]) { delete st.ambUntil[id]; st.manualAmb.delete(id); st.dirty = true; }
    const tr = currentTransform();
    if (tr && TF[tr].tick) TF[tr].tick(dt, s);
    const amb = new Set([...(c.ambient || []), ...linked, ...st.manualAmb]);
    const voice = new Set(c.voice || []);
    if (voice.has('notes')) amb.add('notes');
    st.talkTime = s.talking ? st.talkTime + dt : Math.max(0, st.talkTime - dt * 3);
    // cri
    st.shoutCd = Math.max(0, st.shoutCd - dt);
    if (s.shouting && st.shoutCd <= 0 && (c.shout || []).length) {
      st.shoutCd = 1.6;
      for (const id of c.shout) if (ONESHOT.includes(id)) trigger(id, false);
    }
    for (const id of amb) if (AMB[id]) AMB[id](dt, s);
    // particules
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.age += dt;
      if (p.age > p.life || p.y > st.GH + 8 || p.x < -30 || p.x > st.GW + 40) { P.splice(i, 1); continue; }
      if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
      p.vy += p.g * dt;
      if (p.term) {
        // freinage de l'air une fois la chute commencée (confettis)
        if (p.vy > 0) p.vx *= Math.pow(0.05, dt);
        if (p.vy > p.term) p.vy = p.term;
      }
      p.x += (p.vx + (p.sway !== undefined ? Math.sin(st.t * 3 + p.sway) * 6 : 0)) * dt;
      p.y += p.vy * dt;
      if (p.kind === 'rocket' && p.y <= p.top) {
        for (let k = 0; k < 26; k++) { const a = (k / 26) * Math.PI * 2, v = rnd(16, 24); add({ kind: 'spark', x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 18, drag: 0.96, life: rnd(0.9, 1.4), color: p.color, layer: 0 }); }
        P.splice(i, 1);
      }
    }
    st.flash = Math.max(0, st.flash - dt * 3.2);
    st.zoom = Math.max(0, st.zoom - dt * 3.5);
    st.shake = Math.max(0, st.shake - dt);
    st.lines = Math.max(0, st.lines - dt);
    if (st.emote) { st.emote.t += dt; if (st.emote.t > st.emote.life) st.emote = null; }
    // Impact : la scène entière tremble et zoome
    if (o.scene) {
      const z = 1 + st.zoom * 0.08;
      const dx = st.shake > 0 && !reduce ? Math.round(rnd(-1, 1)) * st.U / (window.devicePixelRatio || 1) : 0;
      const dy = st.shake > 0 && !reduce ? Math.round(rnd(-1, 1)) * st.U / (window.devicePixelRatio || 1) : 0;
      const tr = z !== 1 || dx || dy ? `translate(${dx}px, ${dy}px) scale(${z.toFixed(3)})` : '';
      if (o.scene.style.transform !== tr) o.scene.style.transform = tr;
    }
    const trAura = tr && TF[tr].aura;
    const active = P.length || st.flash || st.lines || st.emote || voice.has('aura') || voice.has('rainbow') || trAura;
    if (!active && !wasActive && !st.dirty) return;
    wasActive = !!active;
    st.dirty = false;
    // dessin
    for (const g of [bctx, fctx]) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, o.back.width, o.back.height); g.imageSmoothingEnabled = false; }
    if (voice.has('aura') && s.geom) {
      const lvl = Math.max(0.18, Math.min(1, s.level * 1.4));
      const hue = 320 + Math.sin(st.t * 2) * 20;
      silhouette(bctx, `hsl(${hue}, 100%, 65%)`, lvl, 0);
      if (s.level > 0.45) silhouette(bctx, `hsl(${hue + 30}, 100%, 75%)`, Math.min(1, (s.level - 0.3) * 0.9), unit);
    }
    if (voice.has('rainbow') && s.geom) silhouette(bctx, `hsl(${(st.t * (s.talking ? 360 : 90)) % 360}, 100%, 60%)`, 1, 0);
    if (trAura && s.geom) { silhouette(bctx, TF[tr].aura, 0.55 + Math.sin(st.t * 6) * 0.25, 0); silhouette(bctx, TF[tr].aura, 0.25, unit); }
    for (const p of P) if (p.layer === 0) particle(bctx, p);
    if (st.lines > 0) {
      const h = H(), R = Math.max(st.GW, st.GH);
      const r0 = (h.r - h.l) * 0.9;
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2 + 0.2, r1 = r0 * (k % 2 ? 1 : 1.2) + (1 - st.lines) * 6;
        line(fctx, h.x + Math.cos(a) * R, h.cy + Math.sin(a) * R, h.x + Math.cos(a) * r1, h.cy + Math.sin(a) * r1, k % 3 ? '#ffffff' : '#1b1420');
      }
    }
    for (const p of P) if (p.layer !== 0) particle(fctx, p);
    if (st.emote) {
      const e = st.emote, k = e.t / e.life;
      const pop = k < 0.12 ? -3 + Math.round((k / 0.12) * 3) : 0;
      const vis = e.pulse ? Math.floor(e.t * 6) % 2 === 0 || k < 0.3 : true;
      if (vis && k < 0.92) { const s2 = sprite(e.spr); drawSprite(fctx, s2, e.x - s2.width / 2 + (e.tilt ? Math.round(Math.sin(e.t * 5)) : 0), e.y + pop); }
    }
    if (st.flash > 0) { fctx.fillStyle = `rgba(255,255,255,${(st.flash * 0.75).toFixed(3)})`; fctx.fillRect(0, 0, o.front.width, o.front.height); }
  }

  function trigger(id, manual = true) {
    if (TF[id]) {
      toggleTransform(id);
      if (manual && o.onTrigger) o.onTrigger(id);
      return true;
    }
    if (!FX[id]) return false;
    FX[id]();
    st.dirty = true;
    if (manual && o.onTrigger) o.onTrigger(id);
    return true;
  }

  /**
   * Ambiance allumée / éteinte à la demande (Stream Deck). on : true, false ou indéfini (bascule) ;
   * seconds : extinction automatique au bout de ce temps.
   */
  function toggleAmbient(id, on, seconds) {
    if (!AMB[id]) return false;
    const next = on === undefined ? !st.manualAmb.has(id) : !!on;
    if (next) st.manualAmb.add(id); else st.manualAmb.delete(id);
    if (next && +seconds > 0) st.ambUntil[id] = st.t + +seconds; else delete st.ambUntil[id];
    st.dirty = true;
    return next;
  }
  /**
   * Effet qui dure (transformation, tenue ou ambiance) : allumer (on true), éteindre (false) ou
   * basculer (indéfini), éventuellement pour seconds secondes. null si l'effet est ponctuel.
   */
  function setPersistent(id, on, seconds) {
    if (TF[id]) {
      return toggleTransform(id, on, seconds);
    }
    if (AMB[id]) return toggleAmbient(id, on, seconds);
    return null;
  }
  /** Secondes restantes des effets à durée limitée : { id: secondes (arrondies au-dessus) }. */
  function timers() {
    const r = {};
    if (st.transId && st.transUntil < Infinity) r[st.transId] = Math.max(0, Math.ceil(st.transUntil - st.t));
    for (const id in st.ambUntil) r[id] = Math.max(0, Math.ceil(st.ambUntil[id] - st.t));
    return r;
  }

  return {
    frame,
    trigger,
    toggleAmbient,
    setPersistent,
    timers,
    /** Effet qui dure (ambiance, transformation, tenue), par opposition aux effets ponctuels. */
    isPersistent: (id) => !!(TF[id] || AMB[id]),
    /** Ambiances (et transformation) allumées à la demande. */
    ambientOn: () => [...st.manualAmb, ...(st.transId ? [st.transId] : [])],
    clear() { P.length = 0; st.emote = null; st.flash = st.zoom = st.shake = st.lines = 0; st.transId = null; st.dirty = true; },
    /**
     * Apparence de l'avatar (transformation en cours) pour le moteur : { key, alpha, dy, img(img) }
     * ou null. Appelée à chaque image avant le dessin de l'avatar.
     */
    look(now) {
      const id = currentTransform();
      if (!id) return null;
      const def = TF[id];
      const f = def.anim ? Math.floor(now / def.anim) % (def.frames || 4) : 0;
      const dy = def.float ? Math.round(Math.sin(now / 600) * def.float) : 0;
      return { key: id + ':' + f + ':' + dy, alpha: def.alpha || 1, dy, img: (img) => transformed(img, id, f) };
    },
    /** Image transformée (icônes Stream Deck, aperçus). */
    transformImage: (img, id) => (TF[id] ? transformed(img, id, 0) : img),
    /** Vignette d'un décor (w×h pixels d'art, instant t en secondes) : icônes Stream Deck. */
    sceneThumb(id, w, h, t = 2) {
      if (!SCENES[id]) return null;
      const keep = [W, Hh, T];
      W = w; Hh = h; T = t;
      sc.width = w; sc.height = h;
      sg.setTransform(1, 0, 0, 1, 0, 0);
      sg.clearRect(0, 0, w, h);
      sg.globalAlpha = 1;
      SCENES[id]();
      const out = document.createElement('canvas');
      out.width = w; out.height = h;
      out.getContext('2d').drawImage(sc, 0, 0);
      [W, Hh, T] = keep;
      return out;
    },
  };
}

/** Fonds de scène animés (identifiant -> nom affiché). */
export const SCENE_NAMES = {
  sky: 'Ciel', night: 'Nuit étoilée', sunset: 'Coucher de soleil', aurora: 'Aurore boréale', synthwave: 'Synthwave', city: 'Ville néon',
  space: 'Espace', forest: 'Forêt au crépuscule', mountains: 'Montagnes', beach: 'Plage', underwater: 'Sous l\'eau', pastel: 'Nuages pastel',
  tiles: 'Motif qui défile', room: 'Chambre cosy',
};

/** Catalogue des effets (identifiant, nom affiché, famille). */
export const EFFECTS = [
  { id: 'confetti', name: 'Confettis', kind: 'oneshot' },
  { id: 'hearts', name: 'Cœurs', kind: 'oneshot' },
  { id: 'sparkles', name: 'Étincelles', kind: 'oneshot' },
  { id: 'fireworks', name: 'Feu d\'artifice', kind: 'oneshot' },
  { id: 'stars', name: 'Étoiles filantes', kind: 'oneshot' },
  { id: 'impact', name: 'Impact', kind: 'oneshot' },
  { id: 'bang', name: 'Point d\'exclamation', kind: 'oneshot' },
  { id: 'quest', name: 'Point d\'interrogation', kind: 'oneshot' },
  { id: 'sweat', name: 'Goutte de gêne', kind: 'oneshot' },
  { id: 'vein', name: 'Veine de colère', kind: 'oneshot' },
  { id: 'tears', name: 'Larmes', kind: 'oneshot' },
  { id: 'lines', name: 'Lignes de choc', kind: 'oneshot' },
  { id: 'zzz', name: 'Zzz', kind: 'oneshot' },
  { id: 'snow', name: 'Neige', kind: 'ambient' },
  { id: 'rain', name: 'Pluie', kind: 'ambient' },
  { id: 'petals', name: 'Pétales', kind: 'ambient' },
  { id: 'fireflies', name: 'Lucioles', kind: 'ambient' },
  { id: 'bubbles', name: 'Bulles', kind: 'ambient' },
  { id: 'flames', name: 'Flammes', kind: 'ambient' },
  { id: 'demon', name: 'Démon', kind: 'transform' },
  { id: 'angel', name: 'Ange', kind: 'transform' },
  { id: 'ghost', name: 'Fantôme', kind: 'transform' },
  { id: 'statue', name: 'Statue de pierre', kind: 'transform' },
  { id: 'frozen', name: 'Gelé', kind: 'transform' },
  { id: 'golden', name: 'Doré légendaire', kind: 'transform' },
  { id: 'zombie', name: 'Zombie', kind: 'transform' },
  { id: 'shadow', name: 'Ombre', kind: 'transform' },
  { id: 'glitch', name: 'Glitch', kind: 'transform' },
  { id: 'retro', name: 'Rétro 4 couleurs', kind: 'transform' },
  { id: 'knight', name: 'Chevalier', kind: 'transform' },
  { id: 'paladin', name: 'Paladin au bouclier', kind: 'transform' },
  { id: 'soldier', name: 'Soldat', kind: 'transform' },
  { id: 'pilot', name: 'Pilote d\'avion', kind: 'transform' },
  { id: 'astronaut', name: 'Pilote de vaisseau', kind: 'transform' },
  { id: 'worker', name: 'Ouvrier du bâtiment', kind: 'transform' },
  { id: 'aura', name: 'Aura de voix', kind: 'voice' },
  { id: 'rainbow', name: 'Contour arc-en-ciel', kind: 'voice' },
  { id: 'notes', name: 'Notes de musique', kind: 'voice' },
  { id: 'squash', name: 'Rebond élastique', kind: 'voice' },
];
