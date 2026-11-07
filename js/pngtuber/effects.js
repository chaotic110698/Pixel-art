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
  const st = { t: 0, last: 0, flash: 0, zoom: 0, shake: 0, lines: 0, emote: null, expr: undefined, shoutCd: 0, talkTime: 0, dirty: true, U: 1, GW: 64, GH: 48, ox: 0, oy: 0, head: null, sx: 0, sy: 0 };
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
      // une gerbe éclate au-dessus de la tête, puis les confettis retombent en voletant sur l'avatar
      const h = H(), b = h.body, w = Math.max(6, (b.r - b.l) / 2);
      const n = Math.round(90 * mult());
      const top = Math.max(1, h.top - st.GH * 0.28);
      for (let i = 0; i < n; i++) {
        if (i % 3 === 0) add({ kind: 'conf', x: h.x + rnd(-w * 1.4, w * 1.4), y: -rnd(1, st.GH * 0.25), vx: rnd(-3, 3), vy: rnd(6, 14), g: st.GH * 0.12, drag: 0.99, sway: rnd(0, 6), life: rnd(3.5, 5), color: pick(CONF), flip: rnd(0, 6) });
        else add({ kind: 'conf', x: h.x + rnd(-2, 2), y: top, vx: rnd(-1, 1) * w * 1.6, vy: -rnd(0.12, 0.42) * st.GH, g: st.GH * 0.55, drag: 0.965, sway: rnd(0, 6), life: rnd(3, 4.5), color: pick(CONF), flip: rnd(0, 6) });
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
    const amb = new Set([...(c.ambient || []), ...linked]);
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
    const active = P.length || st.flash || st.lines || st.emote || voice.has('aura') || voice.has('rainbow');
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
    if (!FX[id]) return false;
    FX[id]();
    st.dirty = true;
    if (manual && o.onTrigger) o.onTrigger(id);
    return true;
  }

  return {
    frame,
    trigger,
    clear() { P.length = 0; st.emote = null; st.flash = st.zoom = st.shake = st.lines = 0; st.dirty = true; },
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
  { id: 'aura', name: 'Aura de voix', kind: 'voice' },
  { id: 'rainbow', name: 'Contour arc-en-ciel', kind: 'voice' },
  { id: 'notes', name: 'Notes de musique', kind: 'voice' },
  { id: 'squash', name: 'Rebond élastique', kind: 'voice' },
];
