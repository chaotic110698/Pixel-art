// Moteur d'avatar PNGtuber, partagé par :
//  - le mode PNGtuber de l'éditeur,
//  - la fenêtre de capture (capture.html),
//  - l'avatar autonome exporté en .html (source navigateur OBS).
//
// IMPORTANT : createAvatar doit rester AUTONOME (aucune référence à une variable
// du module ni import) : son code source est copié tel quel (Function.toString)
// dans l'avatar exporté.
//
// o = {
//   canvas, stage,                 // canvas de rendu et élément qui donne la taille
//   width, height,                 // taille de l'image en pixels du dessin
//   getImage(exprId, mouth, blink) // mouth : 'closed' | 'half' | 'open' -> image ou canvas
//   cfg()                          // réglages (doc.pngtuber) lus en direct
//   expressions()                  // [{ id, key, hold }]
//   initialExpression, onChange(state)
// }
export function createAvatar(o) {
  const st = {
    level: 0,
    lastLoud: 0,
    talking: false,
    mouth: 'closed',
    blinkUntil: 0,
    nextBlink: 0,
    expression: o.initialExpression || null,
    held: null, // expression précédente pendant une expression temporaire
    manual: false,
    stream: null,
    audio: null,
    analyser: null,
    raf: 0,
    lastKey: '',
    shakeX: 0,
    shakeY: 0,
  };
  const buf = new Float32Array(1024);

  function cfg() {
    return o.cfg() || {};
  }

  function readLevel() {
    if (!st.analyser) return 0;
    st.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    // échelle perceptive approximative 0..1 (-60 dB .. 0 dB)
    return Math.min(1, Math.max(0, (20 * Math.log10(rms + 1e-8) + 60) / 60));
  }

  async function startMic() {
    if (st.stream) return true;
    try {
      st.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      st.audio = new (window.AudioContext || window.webkitAudioContext)();
      if (st.audio.state === 'suspended') await st.audio.resume().catch(() => {});
      const src = st.audio.createMediaStreamSource(st.stream);
      st.analyser = st.audio.createAnalyser();
      st.analyser.fftSize = 1024;
      src.connect(st.analyser);
      return true;
    } catch (err) {
      stopMic();
      throw err;
    }
  }

  function stopMic() {
    if (st.stream) st.stream.getTracks().forEach((t) => t.stop());
    if (st.audio) st.audio.close().catch(() => {});
    st.stream = null;
    st.audio = null;
    st.analyser = null;
    st.level = 0;
  }

  function update(now) {
    const c = cfg();
    const thr = c.threshold ?? 0.12;
    const thr2 = Math.max(thr, c.threshold2 ?? 0.35);
    st.level = st.level * 0.6 + readLevel() * 0.4;
    const loud = st.level > thr || st.manual;
    if (loud) st.lastLoud = now;
    st.talking = loud || now - st.lastLoud < 140; // petite tenue : pas de clignotement de la bouche
    if (!st.talking) st.mouth = 'closed';
    else if (st.manual || !c.hasHalf) st.mouth = 'open';
    else st.mouth = st.level >= thr2 ? 'open' : 'half';
    if (!st.nextBlink) st.nextBlink = now + (c.blinkEvery || 4) * 1000;
    if (c.blinkEvery > 0 && now >= st.nextBlink) {
      st.blinkUntil = now + (c.blinkDuration || 0.15) * 1000;
      st.nextBlink = now + c.blinkEvery * 1000 * (0.7 + Math.random() * 0.6);
    }
    // secousse quand on crie (au-dessus du 2e seuil, avec une marge)
    const shouting = c.shake && st.level > Math.min(0.98, thr2 + 0.18);
    st.shakeX = shouting ? Math.round((Math.random() * 2 - 1) * 2) : 0;
    st.shakeY = shouting ? Math.round((Math.random() * 2 - 1) * 2) : 0;
  }

  function draw(now) {
    const c = cfg();
    const canvas = o.canvas;
    const blink = now < st.blinkUntil;
    const img = o.getImage(st.expression, st.mouth, blink);
    const r = o.stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const maxW = Math.max(1, r.width * dpr), maxH = Math.max(1, r.height * dpr);
    const fit = Math.max(1, Math.floor(Math.min(maxW / o.width, maxH / o.height) * 0.92));
    const s = c.scale > 0 ? c.scale : fit;
    const bounce = c.bounce && st.talking ? Math.round(Math.abs(Math.sin(now / 90)) * Math.max(1, s * 1.5)) : 0;
    const breath = c.breathe && !st.talking ? Math.round(((Math.sin(now / 900) + 1) / 2) * Math.max(1, s * 0.6)) : 0;
    const tilt = c.tilt && st.talking ? Math.sin(now / 160) * 0.035 : 0;
    const dx = st.shakeX * Math.max(1, Math.round(s / 2));
    const dy = st.shakeY * Math.max(1, Math.round(s / 2));
    const W = o.width * s + s * 4, H = o.height * s + s * 4;
    const key = [st.expression, st.mouth, blink, s, bounce, breath, tilt.toFixed(3), dx, dy, maxW, maxH, img ? 1 : 0].join('|');
    if (key === st.lastKey) return;
    st.lastKey = key;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = W / dpr + 'px';
      canvas.style.height = H / dpr + 'px';
    }
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!img) return;
    g.imageSmoothingEnabled = false;
    const x = (W - o.width * s) / 2 + dx;
    const y = H - o.height * s - s * 2 - bounce - breath + dy;
    if (tilt) {
      // inclinaison autour du bas de l'avatar
      g.translate(W / 2, y + o.height * s);
      g.rotate(tilt);
      g.translate(-W / 2, -(y + o.height * s));
    }
    g.drawImage(img, Math.round(x), Math.round(y), o.width * s, o.height * s);
  }

  function loop() {
    const now = performance.now();
    update(now);
    draw(now);
    if (o.onFrame) o.onFrame(st);
    st.raf = requestAnimationFrame(loop);
  }

  function setExpression(id) {
    st.held = null;
    st.expression = id;
    st.lastKey = '';
    if (o.onChange) o.onChange(st);
  }

  // touches : expression normale (bascule) ou temporaire (tant que la touche est maintenue)
  function onKey(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (e.code === 'Space') {
      st.manual = e.type === 'keydown';
      e.preventDefault();
      return;
    }
    const k = (e.key || '').toUpperCase();
    const ex = o.expressions().find((x) => x.key && x.key === k);
    if (!ex) return;
    e.preventDefault();
    if (e.type === 'keydown') {
      if (e.repeat) return;
      if (ex.hold) {
        if (st.held === null) st.held = st.expression || '';
        st.expression = ex.id;
      } else setExpression(ex.id);
    } else if (ex.hold && st.held !== null && st.expression === ex.id) {
      st.expression = st.held || null;
      st.held = null;
    }
    st.lastKey = '';
    if (o.onChange) o.onChange(st);
  }

  return {
    state: st,
    start() {
      cancelAnimationFrame(st.raf);
      loop();
    },
    stop() {
      cancelAnimationFrame(st.raf);
      stopMic();
    },
    startMic,
    stopMic,
    setExpression,
    setManualTalk(v) {
      st.manual = !!v;
    },
    refresh() {
      st.lastKey = '';
    },
    attachKeys(target = window) {
      target.addEventListener('keydown', onKey);
      target.addEventListener('keyup', onKey);
      return () => {
        target.removeEventListener('keydown', onKey);
        target.removeEventListener('keyup', onKey);
      };
    },
  };
}
