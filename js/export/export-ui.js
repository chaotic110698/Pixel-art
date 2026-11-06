// Fenêtre d'export.

import { h, downloadBlob } from '../util/dom.js';
import { openDialog, confirmDialog } from '../ui/dialogs.js';
import { EXPORT_KINDS, runExport } from './exporter.js';
import { countCombinations } from './render.js';

const COMBO_WARN = 64;

export function openExportDialog(app, preset = null) {
  const doc = app.doc;
  const st = app.state;
  let kind = preset || st.lastExportKind || 'png';
  const nVariants = doc.variantGroups().reduce((s, g) => s + g.children.length, 0);
  const nCombos = countCombinations(doc);
  const nLayers = doc.allLayers().filter((l) => !l.reference).length;

  const count = (id) => ({
    layers: `${nLayers} fichier(s)`,
    variants: `${nVariants} fichier(s)`,
    expressions: `${doc.expressions.length} fichier(s)`,
    combos: doc.variantGroups().length ? `${nCombos} fichier(s)` : '—',
    gif: `${doc.frames.length} image(s)`,
    sheet: `${doc.frames.length} image(s)`,
    frames: `${doc.frames.length} fichier(s)`,
  }[id] || '');

  const list = h('div', { style: { display: 'grid', gap: '6px' } });
  const renderList = () => {
    list.replaceChildren(...EXPORT_KINDS.map((k) => h('label', {
      class: 'card', style: { flexDirection: 'row', alignItems: 'flex-start', textAlign: 'left', cursor: 'pointer', borderColor: k.id === kind ? 'var(--accent)' : '' },
    },
    h('input', { type: 'radio', name: 'exp-kind', checked: k.id === kind, onchange: () => { kind = k.id; renderList(); renderOpts(); }, style: { marginTop: '3px', accentColor: 'var(--accent)' } }),
    h('div', { class: 'grow' }, h('div', { class: 't', style: { fontSize: '14px' } }, k.name), h('div', { class: 's' }, k.desc)),
    h('span', { class: 'small muted' }, count(k.id)))));
  };

  // options
  const scaleSel = h('select', { class: 'input' }, [1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((s) => h('option', { value: s, selected: s === st.exportScale }, `×${s}`)), h('option', { value: 'custom' }, 'Personnalisée…'));
  const scaleCustom = h('input', { type: 'number', class: 'input num', min: 1, max: 64, value: st.exportScale, hidden: true });
  scaleSel.addEventListener('change', () => { scaleCustom.hidden = scaleSel.value !== 'custom'; updateSize(); });
  scaleCustom.addEventListener('input', updateSize);
  const sizeLbl = h('span', { class: 'small muted' });
  const cropSel = h('select', { class: 'input' },
    h('option', { value: 'none' }, 'Conserver la taille du canevas'),
    h('option', { value: 'common' }, 'Recadrer autour du contenu (boîte commune, alignement conservé)'),
    h('option', { value: 'each' }, 'Recadrer chaque image séparément'));
  cropSel.value = st.exportCrop || 'none';
  const projChk = h('input', { type: 'checkbox', checked: !!st.exportIncludeProject });
  const comboChk = h('input', { type: 'checkbox', checked: false });
  const colsIn = h('input', { type: 'number', class: 'input num', min: 1, max: 256, value: Math.min(doc.frames.length, 8) });
  const spIn = h('input', { type: 'number', class: 'input num', min: 0, max: 64, value: 0 });
  const jsonChk = h('input', { type: 'checkbox', checked: false });
  const perTagChk = h('input', { type: 'checkbox', checked: false });
  const opts = h('div');

  function scale() {
    return scaleSel.value === 'custom' ? Math.max(1, Math.min(64, parseInt(scaleCustom.value, 10) || 1)) : parseInt(scaleSel.value, 10);
  }
  function updateSize() {
    const s = scale();
    sizeLbl.textContent = `${doc.width * s} × ${doc.height * s} px`;
  }
  function renderOpts() {
    const zipKind = EXPORT_KINDS.find((k) => k.id === kind).zip;
    const anim = ['gif', 'sheet', 'frames'].includes(kind);
    opts.replaceChildren(...[
      h('div', { class: 'row' }, h('span', {}, 'Échelle'), scaleSel, scaleCustom, sizeLbl),
      h('p', { class: 'hint' }, 'Agrandissement au plus proche voisin : jamais de flou. La transparence est toujours conservée.'),
      h('label', { class: 'field' }, h('span', {}, 'Recadrage'), cropSel),
      kind === 'pack' ? h('label', { class: 'chk' }, comboChk, `Inclure toutes les combinaisons (${nCombos})`) : null,
      zipKind ? h('label', { class: 'chk' }, projChk, 'Inclure le fichier projet (.pxa.json) dans le ZIP') : null,
      anim && doc.tags.length ? h('label', { class: 'chk' }, perTagChk, `Une animation par balise (${doc.tags.length})`) : null,
      kind === 'sheet' ? h('div', { class: 'row' }, h('span', {}, 'Colonnes'), colsIn, h('span', {}, 'Espacement (px)'), spIn, h('label', { class: 'chk' }, jsonChk, 'Avec fichier JSON')) : null,
      anim && doc.frames.length < 2 ? h('p', { class: 'hint' }, 'Astuce : ajoutez des images dans la timeline (menu ☰ > Animation).') : null,
      zipKind ? h('p', { class: 'hint' }, 'Le ZIP contient un manifest.json décrivant calques, groupes, variantes et expressions.') : null,
    ].filter(Boolean));
    updateSize();
  }
  renderList();
  renderOpts();

  const status = h('p', { class: 'small muted', style: { minHeight: '18px' } });
  const d = openDialog({
    title: 'Exporter',
    wide: true,
    body: h('div', { class: 'fields export-grid' },
      h('div', {}, list), h('div', {}, h('h3', { style: { marginTop: 0 } }, 'Options'), opts, status)),
    buttons: [
      { label: 'Fermer', value: null },
      {
        label: 'Exporter', primary: true, action: async () => {
          if (kind === 'combos' || (kind === 'pack' && comboChk.checked)) {
            if (nCombos > COMBO_WARN && !(await confirmDialog(`Cela va générer ${nCombos} images. Continuer ?`, { ok: 'Générer' }))) return false;
          }
          const o = { scale: scale(), crop: cropSel.value, includeProject: projChk.checked, includeCombos: comboChk.checked, sheetCols: parseInt(colsIn.value, 10), spacing: parseInt(spIn.value, 10), sheetJson: jsonChk.checked, perTag: perTagChk.checked };
          app.setState({ exportScale: o.scale, exportCrop: o.crop, exportIncludeProject: o.includeProject, lastExportKind: kind });
          status.textContent = 'Export en cours…';
          try {
            const r = await runExport(app, kind, o);
            downloadBlob(r.blob, r.filename);
            status.textContent = `✔ ${r.filename} (${r.count} image${r.count > 1 ? 's' : ''})`;
            app.toast('Export terminé');
          } catch (err) {
            console.error(err);
            status.textContent = '✖ ' + (err.message || err);
          }
          return false;
        },
      },
    ],
  });
  return d;
}
