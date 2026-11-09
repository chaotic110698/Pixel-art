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
//   getImage(profileId, exprId, mouth, blink) // mouth : 'closed' | 'half' | 'open' -> image ou canvas
//   cfg(profileId)                 // réglages (doc.pngtuber + profil) lus en direct
//   expressions()                  // [{ id, key, hold }]
//   profiles()                     // [{ id, key }] (touches F13–F24 conseillées)
//   initialExpression, initialProfile, onChange(state)
//   fx                             // effets (createEffects), facultatif
//   onBackground(id)               // touche de fond pressée (cfg().bgKeys)
//   background()                   // fond affiché (retour d'état pour le Stream Deck)
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
    profile: o.initialProfile || null,
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
    return o.cfg(st.profile) || {};
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
    // cri : au-dessus du 2e seuil, avec une marge (secousse, effets « quand je crie »)
    st.shouting = !st.manual && st.level > Math.min(0.98, thr2 + 0.18);
    const shouting = c.shake && st.shouting;
    st.shakeX = shouting ? Math.round((Math.random() * 2 - 1) * 2) : 0;
    st.shakeY = shouting ? Math.round((Math.random() * 2 - 1) * 2) : 0;
  }

  function draw(now) {
    const c = cfg();
    const canvas = o.canvas;
    const blink = now < st.blinkUntil;
    const img = o.getImage(st.profile, st.expression, st.mouth, blink);
    // transformation / tenue en cours (effets) : image recolorée, transparence, flottement
    const look = o.fx && o.fx.look ? o.fx.look(now) : null;
    const r = o.stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const maxW = Math.max(1, r.width * dpr), maxH = Math.max(1, r.height * dpr);
    const fill = c.fill > 0 ? Math.max(0.1, Math.min(1, c.fill)) : 0.92;
    const fit = Math.max(1, Math.floor(Math.min(maxW / o.width, maxH / o.height) * fill));
    const s = c.scale > 0 ? c.scale : fit;
    const bounce = c.bounce && st.talking ? Math.round(Math.abs(Math.sin(now / 90)) * Math.max(1, s * 1.5)) : 0;
    const breath = c.breathe && !st.talking ? Math.round(((Math.sin(now / 900) + 1) / 2) * Math.max(1, s * 0.6)) : 0;
    const tilt = c.tilt && st.talking ? Math.sin(now / 160) * 0.035 : 0;
    const dx = st.shakeX * Math.max(1, Math.round(s / 2));
    const dy = st.shakeY * Math.max(1, Math.round(s / 2));
    // rebond élastique (squash & stretch) : l'avatar s'écrase d'un ou deux pixels à chaque syllabe
    const squash = c.effects && (c.effects.voice || []).includes('squash') && st.talking
      ? Math.round(Math.abs(Math.sin(now / 85)) * Math.min(1, st.level * 1.5 + (st.manual ? 0.6 : 0)) * 2) * Math.max(1, Math.round(s / 2)) : 0;
    const W = o.width * s + s * 4, H = o.height * s + s * 4;
    const x = (W - o.width * s) / 2 + dx;
    const y = H - o.height * s - s * 2 - bounce - breath + dy;
    // position de repos (sans rebond, respiration ni secousse) : sert d'ancrage fixe au fond et aux effets
    const by = H - o.height * s - s * 2;
    st.geom = { x: Math.round(x), y: Math.round(y), bx: Math.round((W - o.width * s) / 2), by: Math.round(by), s, tilt, img };
    const key = [st.profile, st.expression, st.mouth, blink, s, bounce, breath, tilt.toFixed(3), dx, dy, squash, maxW, maxH, img ? 1 : 0, look ? look.key : ''].join('|');
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
    if (tilt) {
      // inclinaison autour du bas de l'avatar
      g.translate(W / 2, y + o.height * s);
      g.rotate(tilt);
      g.translate(-W / 2, -(y + o.height * s));
    }
    g.globalAlpha = look && look.alpha ? look.alpha : 1;
    g.drawImage(look ? look.img(img) : img, Math.round(x) - squash, Math.round(y) + squash + (look ? look.dy * s : 0), o.width * s + squash * 2, o.height * s - squash);
    g.globalAlpha = 1;
  }

  function loop() {
    const now = performance.now();
    update(now);
    draw(now);
    if (o.fx) o.fx.frame(now, st);
    if (o.onFrame) o.onFrame(st);
    st.raf = requestAnimationFrame(loop);
  }

  function setProfile(id) {
    st.profile = id;
    st.lastKey = '';
    if (o.onChange) o.onChange(st);
  }

  function setExpression(id) {
    st.held = null;
    st.expression = id;
    st.lastKey = '';
    if (o.onChange) o.onChange(st);
  }

  // ---------- raccourcis : touche simple (« C », « 1 », « F13 ») ou combinaison (« Ctrl+Maj+1 ») ----------
  // Les chiffres sont lus sur la touche physique : sur un clavier AZERTY, « 1 » marche sans Maj.
  function keyName(e) {
    const code = e.code || '';
    let m = code.match(/^(?:Digit|Numpad)(\d)$/);
    if (m) return m[1];
    if (/^F\d{1,2}$/.test(e.key || '')) return e.key;
    if (!e.key || e.key.length !== 1 || e.key === ' ') return null;
    m = code.match(/^Key([A-Z])$/);
    // Alt (Option sur Mac) change le caractère : on garde alors la lettre de la touche
    if ((e.altKey || e.ctrlKey) && m && !/^[a-z]$/i.test(e.key)) return m[1];
    return e.key.toUpperCase();
  }
  function comboOf(e) {
    const n = keyName(e);
    if (!n) return null;
    return [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Maj', e.metaKey && 'Cmd', n].filter(Boolean).join('+');
  }
  /** La touche enregistrée `k` correspond-elle à l'évènement ? (Maj ignorée pour une touche simple) */
  function matches(e, k) {
    if (!k) return false;
    k = String(k).replace(/Shift\+/g, 'Maj+').replace(/Meta\+/g, 'Cmd+');
    const n = keyName(e);
    if (!n) return false;
    if (!k.includes('+') || k.length === 1) return !e.ctrlKey && !e.altKey && !e.metaKey && k.toUpperCase() === n;
    return comboOf(e) === k;
  }
  /** Touche principale d'un raccourci (relâchement d'une expression temporaire). */
  const mainKey = (k) => { const p = String(k || '').split('+'); return (p[p.length - 1] || '+').toUpperCase(); };

  // touches : profil, expression normale (bascule) ou temporaire (tant que la touche est maintenue),
  // effet ponctuel, fond
  function onKey(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      st.manual = e.type === 'keydown';
      e.preventDefault();
      return;
    }
    const down = e.type === 'keydown';
    if (!down) {
      // relâchement d'une expression temporaire : seule la touche principale compte
      const n = keyName(e);
      if (st.held !== null && n) {
        const ex = o.expressions().find((x) => x.hold && x.id === st.expression && mainKey(x.key) === n);
        if (ex) {
          st.expression = st.held || null;
          st.held = null;
          st.lastKey = '';
          if (o.onChange) o.onChange(st);
        }
      }
      return;
    }
    const c = cfg();
    // profils (tenues / personnages), en général sur F13–F24
    const pf = o.profiles ? o.profiles().find((x) => matches(e, x.key)) : null;
    if (pf) {
      e.preventDefault();
      if (!e.repeat) setProfile(pf.id);
      return;
    }
    const ex = o.expressions().find((x) => matches(e, x.key));
    if (ex) {
      e.preventDefault();
      if (e.repeat) return;
      if (ex.hold) {
        if (st.held === null) st.held = st.expression || '';
        st.expression = ex.id;
      } else setExpression(ex.id);
      st.lastKey = '';
      if (o.onChange) o.onChange(st);
      return;
    }
    // effet ponctuel associé à cette touche
    const fk = (c.effects && c.effects.keys) || {};
    const fid = o.fx ? Object.keys(fk).find((id) => matches(e, fk[id])) : null;
    if (fid) {
      e.preventDefault();
      if (!e.repeat) o.fx.trigger(fid);
      return;
    }
    // fond associé à cette touche
    const bk = c.bgKeys || {};
    const bid = o.onBackground ? Object.keys(bk).find((id) => matches(e, bk[id])) : null;
    if (bid) {
      e.preventDefault();
      if (!e.repeat) o.onBackground(bid);
    }
  }

  return {
    state: st,
    fx: o.fx || null,
    start() {
      cancelAnimationFrame(st.raf);
      loop();
    },
    stop() {
      cancelAnimationFrame(st.raf);
      stopMic();
      if (o.fx) o.fx.clear();
    },
    startMic,
    stopMic,
    setExpression,
    setProfile,
    setManualTalk(v) {
      st.manual = !!v;
    },
    /**
     * Commande venue de l'extérieur (plugin Stream Deck) :
     * { action: 'expression' | 'profile' | 'effect' | 'background' | 'talk', id, down, hold, toggle }
     * down : touche enfoncée (true) ou relâchée (false). Les expressions « hold » durent tant
     * que la touche est enfoncée ; les ambiances s'allument / s'éteignent à chaque appui.
     */
    command(c) {
      const a = c && c.action;
      const down = c.down !== false;
      const id = c.id === undefined || c.id === '' ? null : c.id;
      if (a === 'expression') {
        if (c.hold) {
          if (down) {
            if (st.held === null) st.held = st.expression || '';
            st.expression = id;
          } else if (st.held !== null && st.expression === id) {
            st.expression = st.held || null;
            st.held = null;
          }
          st.lastKey = '';
          if (o.onChange) o.onChange(st);
        } else if (down) setExpression(id);
      } else if (a === 'profile') {
        if (down) setProfile(id);
      } else if (a === 'effect') {
        if (!down || !o.fx) return;
        if (o.fx.trigger(id, false)) return; // effet ponctuel
        if (o.fx.toggleAmbient) { // ambiance : allumer / éteindre
          o.fx.toggleAmbient(id);
          if (o.onChange) o.onChange(st);
        }
      } else if (a === 'background') {
        if (down && o.onBackground) o.onBackground(id || 'transparent');
      } else if (a === 'talk') {
        st.manual = c.toggle ? (down ? !st.manual : st.manual) : down;
        if (o.onChange) o.onChange(st);
      }
    },
    /** État pour le retour visuel des touches (Stream Deck). */
    snapshot() {
      return {
        expression: st.expression || null,
        profile: st.profile || null,
        background: o.background ? o.background() : null,
        talking: !!st.manual,
        ambient: o.fx && o.fx.ambientOn ? o.fx.ambientOn() : [],
      };
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
