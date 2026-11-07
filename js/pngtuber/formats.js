// Formats de diffusion (taille de la scène capturée) et position de l'avatar dans le cadre.
// Partagé par le mode PNGtuber de l'éditeur et la fenêtre de capture.

export const FORMATS = [
  { id: 'free', name: 'Libre (toute la fenêtre)', w: 0, h: 0 },
  { id: '1080p', name: '1920 × 1080 — Full HD 16:9', w: 1920, h: 1080 },
  { id: '720p', name: '1280 × 720 — HD 16:9', w: 1280, h: 720 },
  { id: '1440p', name: '2560 × 1440 — 2K 16:9', w: 2560, h: 1440 },
  { id: 'vertical', name: '1080 × 1920 — vertical (TikTok, Shorts, Reels)', w: 1080, h: 1920 },
  { id: 'square', name: '1080 × 1080 — carré', w: 1080, h: 1080 },
  { id: '4-3', name: '1440 × 1080 — 4:3', w: 1440, h: 1080 },
  { id: 'cam', name: '500 × 500 — coin webcam', w: 500, h: 500 },
  { id: 'cam-tall', name: '400 × 600 — coin portrait', w: 400, h: 600 },
];

export const ANCHORS = [
  { id: 'bottom', name: 'En bas au centre', justify: 'center', align: 'flex-end' },
  { id: 'bottom-left', name: 'En bas à gauche', justify: 'flex-start', align: 'flex-end' },
  { id: 'bottom-right', name: 'En bas à droite', justify: 'flex-end', align: 'flex-end' },
  { id: 'center', name: 'Au centre', justify: 'center', align: 'center' },
];

export const formatById = (id) => FORMATS.find((f) => f.id === id) || FORMATS[0];

/** Place l'avatar dans la scène (élément en flex). */
export function applyAnchor(scene, id) {
  const a = ANCHORS.find((x) => x.id === id) || ANCHORS[0];
  scene.style.justifyContent = a.justify;
  scene.style.alignItems = a.align;
}

/**
 * Dimensionne la scène au format choisi, centrée dans `host` (bandes autour).
 * `exact` : taille réelle en pixels de l'écran si elle tient (fenêtre de capture),
 * sinon réduite pour tenir. Retourne l'échelle appliquée (1 = taille réelle).
 */
export function layoutScene(host, scene, id, { exact = false } = {}) {
  const f = formatById(id);
  if (!f.w) {
    Object.assign(scene.style, { left: '0', top: '0', width: '100%', height: '100%', right: '', bottom: '', transform: '' });
    return 1;
  }
  const r = host.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  let w, h;
  if (exact) {
    w = f.w / dpr; h = f.h / dpr;
    const k = Math.min(1, r.width / w, r.height / h);
    w *= k; h *= k;
  } else {
    const k = Math.min(r.width / f.w, r.height / f.h);
    w = f.w * k; h = f.h * k;
  }
  Object.assign(scene.style, { width: Math.floor(w) + 'px', height: Math.floor(h) + 'px', left: Math.floor((r.width - w) / 2) + 'px', top: Math.floor((r.height - h) / 2) + 'px', right: 'auto', bottom: 'auto' });
  return (w * dpr) / f.w;
}
