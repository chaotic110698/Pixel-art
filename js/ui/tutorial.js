// Tutoriel du premier lancement (étapes avec mise en évidence de l'interface).

import { h } from '../util/dom.js';
import { openDialog } from './dialogs.js';

const STEPS = [
  { emoji: '👋', title: 'Bienvenue dans Pixel Atelier !', text: 'Un éditeur de pixel art complet, gratuit et hors ligne. Tout reste sur votre appareil : rien n\'est envoyé sur internet.' },
  { emoji: '✏️', title: 'Les outils', sel: '#toolbar', text: 'Crayon, gomme, remplissage, formes, sélections… Sur ordinateur, chaque outil a une touche (B, E, G, I…). Appuyez sur ? pour voir tous les raccourcis.' },
  { emoji: '🖐️', title: 'Naviguer', sel: '#stage', text: 'Sur téléphone : 1 doigt dessine, 2 doigts zooment et déplacent, une tape à 2 doigts annule. Sur ordinateur : molette pour zoomer, espace + glisser pour déplacer.' },
  { emoji: '🎨', title: 'Couleurs et calques', sel: '#sidebar', mobileSel: '#mobilenav', text: 'Choisissez vos couleurs dans la palette (clic = couleur A, clic droit ou appui long = couleur B). Organisez votre dessin en calques, groupes et variantes.' },
  { emoji: '🧑‍🎤', title: 'Créer un PNGtuber', sel: '#btn-library', mobileSel: '#mobilenav', text: '« Nouveau personnage » (menu ☰) crée une base avec yeux et bouche déjà organisés en variantes. La bibliothèque (bouton « Pièces » sur téléphone) ajoute coiffures, accessoires, vêtements… Tout reste modifiable pixel par pixel.' },
  { emoji: '📺', title: 'Tester et exporter', sel: '#btn-pngtuber', mobileSel: '#mobilenav', text: 'Le mode PNGtuber anime la bouche avec votre micro (traité localement) et fait cligner les yeux. Exportez ensuite en PNG : image, calque par calque, variantes, expressions… avec un fichier manifest.json.' },
  { emoji: '💾', title: 'Sauvegarde automatique', sel: '#btn-menu', text: 'Vos projets sont enregistrés automatiquement dans le navigateur. Le menu ☰ donne accès à vos projets, à l\'export et à l\'aide.' },
  { emoji: '📖', title: 'Guide complet', sel: '.tb-help button', mobileSel: '#btn-menu', text: 'Pour tout savoir sur chaque outil, la navigation et toutes les fonctionnalités, ouvrez le Guide : bouton livre au-dessus des couleurs, touche F1 (aide sur l\'outil actif), bouton « ? » de la barre d\'options ou menu ☰ > Guide complet. Bon dessin !' },
];

export function startTutorial(app) {
  let i = 0;
  let ring = null;
  const body = h('div', { class: 'tuto-step' });
  const d = openDialog({
    title: 'Découverte',
    body,
    buttons: [
      { label: 'Passer', value: 'skip' },
      { label: 'Précédent', action: () => { if (i > 0) { i--; show(); } return false; } },
      { label: 'Suivant', primary: true, action: () => { if (i < STEPS.length - 1) { i++; show(); return false; } return true; }, value: 'done' },
    ],
    onClose: () => {
      ring?.remove();
      app.setState({ tutorialDone: true });
    },
  });
  const nextBtn = d.el.querySelector('.dlg-foot .btn.primary');
  function show() {
    const s = STEPS[i];
    body.replaceChildren(
      h('div', { class: 'big' }, s.emoji),
      h('h3', { style: { fontSize: '17px', textTransform: 'none', letterSpacing: 0, color: 'var(--text)', justifyContent: 'center' } }, s.title),
      h('p', {}, s.text),
      h('div', { class: 'tuto-dots' }, STEPS.map((_, k) => h('i', { class: k === i ? 'on' : '' }))));
    nextBtn.textContent = i === STEPS.length - 1 ? 'Commencer' : 'Suivant';
    ring?.remove();
    ring = null;
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    const target = document.querySelector((mobile && s.mobileSel) || s.sel || '__none__');
    if (target) {
      const r = target.getBoundingClientRect();
      if (r.width && r.height) {
        ring = h('div', { class: 'highlight-ring', style: { left: r.left - 4 + 'px', top: r.top - 4 + 'px', width: r.width + 8 + 'px', height: r.height + 8 + 'px' } });
        document.body.append(ring);
      }
    }
  }
  show();
}
