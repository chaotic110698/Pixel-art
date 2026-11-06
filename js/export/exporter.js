// Logique d'export (sans UI) : produit une liste de fichiers prêts à télécharger.

import { encodePNG, upscale, crop } from './png.js';
import { encodeGIF } from './gif.js';
import { makeZip } from './zip.js';
import { docToFileJSON } from '../storage/serialize.js';
import {
  uniqueFile, groupPath, exportLayers, layerImage, nodeImage, compositeImage,
  combinations, boundsOf, slug,
} from './render.js';
import { contentBounds } from '../core/raster.js';

export const EXPORT_KINDS = [
  { id: 'png', name: 'Image (PNG)', desc: 'L\'image telle qu\'affichée (variantes actuelles).', zip: false },
  { id: 'pack', name: 'Pack PNGtuber complet (ZIP)', desc: 'Image, calques, variantes, expressions et manifest.json réunis.', zip: true },
  { id: 'pngtuber', name: 'Images pour logiciels PNGtuber (ZIP)', desc: 'Par expression : repos, parle, entrouverte, avec et sans clignement (veadotube, PNGTuber Plus…).', zip: true },
  { id: 'obs', name: 'Avatar OBS (.html)', desc: 'Un fichier à ajouter dans OBS comme source navigateur : fond transparent, micro, clignement, expressions.', zip: false },
  { id: 'psd', name: 'Photoshop (PSD)', desc: 'Calques et groupes conservés, pour Photoshop, GIMP, Krita, Photopea… (taille réelle, image actuelle).', zip: false },
  { id: 'layers', name: 'Calque par calque (ZIP)', desc: 'Un PNG par calque, tous à la taille du canevas pour un alignement parfait.', zip: true },
  { id: 'variants', name: 'Par variante (ZIP)', desc: 'Un PNG par variante de chaque groupe de variantes.', zip: true },
  { id: 'expressions', name: 'Par expression (ZIP)', desc: 'Un PNG composé par expression enregistrée.', zip: true },
  { id: 'combos', name: 'Toutes les combinaisons (ZIP)', desc: 'Un PNG pour chaque combinaison possible des groupes de variantes.', zip: true },
  { id: 'sheet', name: 'Spritesheet / planche de tuiles (PNG)', desc: 'Toutes les images d\'animation (ou tuiles) sur une planche.', zip: false },
  { id: 'gif', name: 'GIF animé', desc: 'Animation des images de la timeline.', zip: false },
  { id: 'frames', name: 'Images d\'animation séparées (ZIP)', desc: 'Un PNG par image de la timeline.', zip: true },
];

/** Applique recadrage + échelle à une liste d'items { path, pixels }. */
function finalize(doc, items, { scale = 1, crop: cropMode = 'none' }) {
  const W = doc.width, H = doc.height;
  let common = null;
  if (cropMode === 'common') common = boundsOf(items.map((i) => i.pixels), W, H);
  for (const it of items) {
    let b = null;
    if (cropMode === 'common') b = common;
    else if (cropMode === 'each') b = contentBounds(it.pixels, W, H);
    let px = it.pixels, w = W, h = H, x = 0, y = 0;
    if (b) {
      w = b.x1 - b.x0 + 1;
      h = b.y1 - b.y0 + 1;
      x = b.x0;
      y = b.y0;
      px = crop(px, W, x, y, w, h);
    }
    it.out = upscale(px, w, h, scale);
    it.w = w * scale;
    it.h = h * scale;
    it.rect = { x: x * scale, y: y * scale, width: w * scale, height: h * scale };
  }
  return items;
}

async function encodeItems(items) {
  const files = [];
  for (const it of items) {
    files.push({ name: it.path, data: await encodePNG(it.out, it.w, it.h), rect: it.rect, meta: it.meta });
    // laisser respirer l'interface
    await new Promise((r) => setTimeout(r, 0));
  }
  return files;
}

// ---------- Collecte des items ----------
function layerItems(doc, used, folder = '') {
  const layers = exportLayers(doc);
  const pad = String(layers.length).length;
  return layers.map((l, i) => {
    const path = [...groupPath(doc, l), l.name].map((s) => slug(s)).join('__');
    return {
      path: folder + uniqueFile(used, `${String(i + 1).padStart(Math.max(2, pad), '0')}_${path}`),
      pixels: layerImage(doc, l),
      meta: { type: 'layer', id: l.id },
    };
  });
}

function variantItems(doc, used, folder = '') {
  const out = [];
  for (const g of doc.variantGroups()) {
    const gname = slug(g.name);
    for (const cid of g.children) {
      const c = doc.get(cid);
      out.push({
        path: folder + uniqueFile(used, `${gname}/${slug(c.name)}`),
        pixels: nodeImage(doc, c),
        meta: { type: 'variant', group: g.id, id: c.id },
      });
    }
  }
  return out;
}

function expressionItems(doc, used, folder = '') {
  return doc.expressions.map((e) => ({
    path: folder + uniqueFile(used, slug(e.name, 'expression')),
    pixels: compositeImage(doc, { overrides: e.states }),
    meta: { type: 'expression', id: e.id },
  }));
}

function comboItems(doc, used, folder = '') {
  const { groups, combos } = combinations(doc);
  return combos.map((states) => {
    const name = groups.map((g) => `${slug(g.name)}-${slug(doc.get(states[g.id]).name)}`).join('_');
    return {
      path: folder + uniqueFile(used, name || 'image'),
      pixels: compositeImage(doc, { overrides: states }),
      meta: { type: 'combination', states },
    };
  });
}

// ---------- Manifest ----------
export function buildManifest(doc, files, opts) {
  const fileOf = (pred) => files.find((f) => f.meta && pred(f.meta));
  const fileInfo = (f) => (f ? { file: f.name, rect: f.rect } : {});
  const nodeOut = (n) => {
    const base = { id: n.id, name: n.name, visible: n.visible, opacity: n.opacity, locked: n.locked };
    if (n.type === 'layer') {
      return { ...base, type: 'layer', reference: !!n.reference, part: n.part ? n.part.category : undefined, ...fileInfo(fileOf((m) => m.type === 'layer' && m.id === n.id)) };
    }
    const g = {
      ...base,
      type: 'group',
      variantGroup: !!n.variant,
      role: n.role || undefined,
      children: [...n.children].reverse().map((cid) => nodeOut(doc.get(cid))), // haut -> bas
    };
    if (n.variant) {
      g.activeVariant = doc.get(n.active)?.name || null;
      g.variants = [...n.children].map((cid) => {
        const c = doc.get(cid);
        return { id: c.id, name: c.name, ...fileInfo(fileOf((m) => m.type === 'variant' && m.id === c.id)) };
      });
    }
    return g;
  };
  const statesByName = (states) => {
    const o = {};
    for (const [gid, cid] of Object.entries(states)) {
      const g = doc.get(gid), c = doc.get(cid);
      if (g && c) o[g.name] = c.name;
    }
    return o;
  };
  return {
    generator: 'Pixel Atelier',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    project: doc.name,
    canvas: { width: doc.width, height: doc.height },
    scale: opts.scale,
    crop: opts.crop,
    note: 'Les rect indiquent la position de chaque image dans le canevas exporté (à l\'échelle). Ordre des calques : du haut vers le bas.',
    composite: fileInfo(fileOf((m) => m.type === 'composite')),
    layers: [...doc.root.children].reverse().map((cid) => nodeOut(doc.get(cid))),
    variantGroups: doc.variantGroups().map((g) => ({
      id: g.id,
      name: g.name,
      role: g.role || undefined,
      active: doc.get(g.active)?.name || null,
      variants: g.children.map((cid) => ({ name: doc.get(cid).name, ...fileInfo(fileOf((m) => m.type === 'variant' && m.id === cid)) })),
    })),
    expressions: doc.expressions.map((e) => ({
      name: e.name,
      key: e.key || null,
      states: statesByName(e.states),
      ...fileInfo(fileOf((m) => m.type === 'expression' && m.id === e.id)),
    })),
    combinations: files.filter((f) => f.meta?.type === 'combination').map((f) => ({ states: statesByName(f.meta.states), file: f.name, rect: f.rect })),
    pngtuber: {
      mouthGroup: doc.get(doc.pngtuber.mouthGroup)?.name || null,
      mouthOpen: doc.get(doc.pngtuber.mouthOpen)?.name || null,
      mouthClosed: doc.get(doc.pngtuber.mouthClosed)?.name || null,
      eyesGroup: doc.get(doc.pngtuber.eyesGroup)?.name || null,
      eyesOpen: doc.get(doc.pngtuber.eyesOpen)?.name || null,
      eyesClosed: doc.get(doc.pngtuber.eyesClosed)?.name || null,
    },
  };
}

// ---------- Point d'entrée ----------
/**
 * Retourne { blob, filename, count }.
 * opts : { scale, crop, includeProject, includeCombos, sheetCols, spacing, frameRange }
 */
export async function runExport(app, kind, opts) {
  const doc = app.doc;
  app.selection.commitFloating();
  const base = slug(doc.name, 'pixel_art');
  const scale = Math.max(1, Math.min(64, opts.scale | 0 || 1));
  const o = { ...opts, scale };
  const used = new Set();

  if (kind === 'png') {
    const items = finalize(doc, [{ path: base + '.png', pixels: compositeImage(doc) }], o);
    const [f] = await encodeItems(items);
    return { blob: new Blob([f.data], { type: 'image/png' }), filename: `${base}${scale > 1 ? '_x' + scale : ''}.png`, count: 1 };
  }

  if (kind === 'gif' || kind === 'sheet' || kind === 'frames') {
    const allFrames = doc.frames.map((_, i) => i);
    const cropAnim = { ...o, crop: o.crop === 'each' ? 'common' : o.crop };
    // produit les fichiers d'une animation (liste d'indices d'images)
    const animFiles = async (idxs, name) => {
      const items = finalize(doc, idxs.map((i, k) => ({
        path: `${name}_${String(k + 1).padStart(3, '0')}.png`,
        pixels: compositeImage(doc, { frame: i }),
        delay: doc.frames[i].duration || Math.round(1000 / doc.fps),
      })), cropAnim);
      if (kind === 'gif') {
        const gif = encodeGIF(items.map((it) => ({ data: it.out, delay: it.delay })), items[0].w, items[0].h);
        return [{ name: `${name}.gif`, data: gif, type: 'image/gif' }];
      }
      if (kind === 'frames') return (await encodeItems(items)).map((f) => ({ name: f.name, data: f.data }));
      // planche
      const n = items.length;
      const cols = Math.max(1, Math.min(n, opts.sheetCols || n));
      const rows = Math.ceil(n / cols);
      const sp = Math.max(0, (opts.spacing | 0) * scale);
      const fw = items[0].w, fh = items[0].h;
      const SW = cols * fw + (cols - 1) * sp, SH = rows * fh + (rows - 1) * sp;
      const sheet = new Uint32Array(SW * SH);
      const frameMeta = [];
      items.forEach((it, i) => {
        const cx = (i % cols) * (fw + sp), cy = Math.floor(i / cols) * (fh + sp);
        for (let y = 0; y < fh; y++) sheet.set(it.out.subarray(y * fw, y * fw + fw), (cy + y) * SW + cx);
        frameMeta.push({ index: i, x: cx, y: cy, w: fw, h: fh, duration: it.delay });
      });
      const png = await encodePNG(sheet, SW, SH);
      const out = [{ name: `${name}_sheet.png`, data: png, type: 'image/png' }];
      if (opts.sheetJson) {
        // balises comprises dans cette planche, indices relatifs (format proche d'Aseprite « frameTags »)
        const tags = doc.tags
          .filter((t) => idxs.includes(t.from) && idxs.includes(t.to))
          .map((t) => ({ name: t.name, from: idxs.indexOf(t.from), to: idxs.indexOf(t.to), color: t.color }));
        out.push({ name: `${name}_sheet.json`, data: JSON.stringify({ generator: 'Pixel Atelier', image: `${name}_sheet.png`, size: { w: SW, h: SH }, frameSize: { w: fw, h: fh }, columns: cols, spacing: sp, frames: frameMeta, frameTags: tags }, null, 2) });
      }
      return out;
    };
    if (opts.perTag && doc.tags.length) {
      const all = [];
      const used = new Set();
      for (const t of doc.tags) {
        const idxs = allFrames.slice(t.from, t.to + 1);
        const name = uniqueFile(used, `${base}_${slug(t.name, 'balise')}`, '');
        const files = await animFiles(idxs, name);
        all.push(...files.map((f) => ({ name: kind === 'frames' ? `${slug(t.name, 'balise')}/${f.name}` : f.name, data: f.data })));
      }
      const suffix = { gif: 'gifs', sheet: 'planches', frames: 'images' }[kind];
      return { blob: makeZip(all), filename: `${base}_${suffix}_par_balise.zip`, count: all.length };
    }
    const files = await animFiles(allFrames, base);
    if (kind === 'frames') return { blob: makeZip(files), filename: `${base}_images.zip`, count: files.length };
    if (files.length === 1) return { blob: new Blob([files[0].data], { type: files[0].type }), filename: files[0].name, count: 1 };
    return { blob: makeZip(files), filename: `${base}_sheet.zip`, count: files.length };
  }

  if (kind === 'psd') {
    const { encodePSD } = await import('./psd.js');
    return { blob: new Blob([encodePSD(doc)], { type: 'image/vnd.adobe.photoshop' }), filename: `${base}.psd`, count: 1 };
  }

  if (kind === 'obs') {
    const { buildStandaloneAvatar } = await import('../pngtuber/standalone.js');
    const html = await buildStandaloneAvatar(doc);
    return { blob: new Blob([html], { type: 'text/html' }), filename: `${base}_avatar_obs.html`, count: 1 };
  }

  if (kind === 'pngtuber') {
    const { avatarOverrides, hasHalf } = await import('../pngtuber/assets.js');
    const exprs = doc.expressions.length ? doc.expressions : [{ id: null, name: 'defaut' }];
    const states = [['idle', 'closed', 0], ['idle_blink', 'closed', 1], ['talk', 'open', 0], ['talk_blink', 'open', 1]];
    if (hasHalf(doc)) states.push(['talk_half', 'half', 0], ['talk_half_blink', 'half', 1]);
    const its = [];
    const folders = new Set();
    for (const e of exprs) {
      const folder = uniqueFile(folders, slug(e.name, 'expression'), '');
      for (const [file, mouth, blink] of states) {
        its.push({ path: `${folder}/${file}.png`, pixels: compositeImage(doc, { overrides: avatarOverrides(doc, e.id, mouth, !!blink) }), meta: { type: 'avatar' } });
      }
    }
    finalize(doc, its, { ...o, crop: o.crop === 'each' ? 'common' : o.crop });
    const files = (await encodeItems(its)).map((f) => ({ name: f.name, data: f.data }));
    const readme = [
      'Images PNGtuber exportées par Pixel Atelier',
      '',
      'Un dossier par expression. Dans chaque dossier :',
      '  idle.png            repos (bouche fermée, yeux ouverts)',
      '  idle_blink.png      repos, yeux fermés (clignement)',
      '  talk.png            parle (bouche ouverte)',
      '  talk_blink.png      parle, yeux fermés',
      ...(hasHalf(doc) ? ['  talk_half.png       parle doucement (bouche entrouverte)', '  talk_half_blink.png parle doucement, yeux fermés'] : []),
      '',
      'veadotube mini : pour chaque état, glissez idle.png (« idle »), talk.png (« talking »),',
      '  et les versions _blink pour le clignement.',
      'PNGTuber Plus / autres logiciels : utilisez idle.png et talk.png comme images',
      '  « silence » et « parle » ; les versions _blink servent au clignement si le logiciel le gère.',
      '',
      'Toutes les images ont la même taille : elles se superposent parfaitement.',
    ].join('\n');
    files.push({ name: 'LISEZMOI.txt', data: readme });
    return { blob: makeZip(files), filename: `${base}_pngtuber_images.zip`, count: its.length };
  }

  let items = [];
  if (kind === 'layers') items = layerItems(doc, used);
  else if (kind === 'variants') items = variantItems(doc, used);
  else if (kind === 'expressions') items = expressionItems(doc, used);
  else if (kind === 'combos') items = comboItems(doc, used);
  else if (kind === 'pack') {
    items = [
      { path: uniqueFile(used, 'image_composee'), pixels: compositeImage(doc), meta: { type: 'composite' } },
      ...layerItems(doc, used, 'calques/'),
      ...variantItems(doc, used, 'variantes/'),
      ...expressionItems(doc, used, 'expressions/'),
      ...(opts.includeCombos ? comboItems(doc, used, 'combinaisons/') : []),
    ];
  }
  if (!items.length) throw new Error({
    variants: 'Aucun groupe de variantes dans ce projet.',
    expressions: 'Aucune expression enregistrée.',
    combos: 'Aucun groupe de variantes dans ce projet.',
  }[kind] || 'Rien à exporter.');
  finalize(doc, items, o);
  const files = await encodeItems(items);
  const manifest = buildManifest(doc, files, o);
  const zipFiles = files.map((f) => ({ name: f.name, data: f.data }));
  zipFiles.push({ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) });
  if (opts.includeProject) zipFiles.push({ name: `${base}.pxa.json`, data: await docToFileJSON(doc) });
  const suffix = { layers: 'calques', variants: 'variantes', expressions: 'expressions', combos: 'combinaisons', pack: 'pngtuber' }[kind];
  return { blob: makeZip(zipFiles), filename: `${base}_${suffix}.zip`, count: files.length };
}
