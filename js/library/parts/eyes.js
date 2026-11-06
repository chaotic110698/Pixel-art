// Yeux : chaque style a les états ouverts / fermés / contents / surpris.
// Motif d'un œil gauche ; l'œil droit est placé symétriquement autour de x = 31,5.
// flip=false : le reflet reste du même côté sur les deux yeux.

import { pair, Z } from '../builder.js';

const STYLES = [
  {
    id: 'dots', name: 'Points', x: 24, y: 23, flip: false,
    states: {
      open: ['.pp.', 'plpp', 'pppp', '.pp.'],
      closed: ['....', '....', 'pppp', '....'],
      happy: ['....', '.pp.', 'p..p', '....'],
      surprised: ['.pp.', 'p..p', 'p..p', '.pp.'],
    },
  },
  {
    id: 'big', name: 'Grands', x: 23, y: 22, flip: false,
    states: {
      open: ['.pppp.', 'pEEEEp', 'pElEep', 'pEEeep', 'peeeep', '.pppp.'],
      closed: ['......', '......', '......', 'p....p', '.pppp.', '......'],
      happy: ['......', '.pppp.', 'p....p', '......', '......', '......'],
      surprised: ['.pppp.', 'pwwwwp', 'pwEEwp', 'pwElwp', 'pwwwwp', '.pppp.'],
    },
  },
  {
    id: 'almond', name: 'Amande', x: 23, y: 23, flip: true,
    states: {
      open: ['.ppppp', 'pwEEwp', 'pwElw.', '.ppp..'],
      closed: ['......', '......', 'pppppp', '......'],
      happy: ['......', '.pppp.', 'p....p', '......'],
      surprised: ['.pppp.', 'pwwwwp', 'pwEEwp', '.pppp.'],
    },
  },
  {
    id: 'cute', name: 'Mignons', x: 24, y: 22, flip: false,
    states: {
      open: ['.ppp.', 'pllpp', 'plppp', 'ppppp', 'ppplp', '.ppp.'],
      closed: ['.....', '.....', '.....', 'p...p', '.ppp.', '.....'],
      happy: ['.....', '.ppp.', 'p...p', '.....', '.....', '.....'],
      surprised: ['.ppp.', 'pwwwp', 'pwppw', 'pwppw', 'pwwwp', '.ppp.'],
    },
  },
  {
    id: 'lashes', name: 'Cils', x: 22, y: 22, flip: true,
    states: {
      open: ['p.....', '.pppp.', 'pwEEwp', 'pwElwp', '.pppp.'],
      closed: ['......', '......', '......', 'pppppp', 'p.p.p.'],
      happy: ['p.....', '.pppp.', 'p....p', '......', '......'],
      surprised: ['p.pppp', '.pwwwp', 'pwEEwp', 'pwwwwp', '.pppp.'],
    },
  },
  {
    id: 'sleepy', name: 'Endormis', x: 23, y: 23, flip: true,
    states: {
      open: ['......', 'pppppp', 'pwEEwp', '.pppp.'],
      closed: ['......', '......', 'pppppp', '......'],
      happy: ['......', '.pppp.', 'p....p', '......'],
      surprised: ['.pppp.', 'pwwwwp', 'pwEEwp', '.pppp.'],
    },
  },
];

export const EYE_STATES = [
  ['open', 'ouverts'],
  ['closed', 'fermés'],
  ['happy', 'contents'],
  ['surprised', 'surpris'],
];

export default STYLES.map((s) => ({
  id: `eyes-${s.id}`,
  name: s.name,
  category: 'eyes',
  build: () => [{
    name: 'Yeux',
    z: Z.eyes,
    role: 'eyes',
    variants: EYE_STATES.map(([state, label]) => ({ name: label, state, grid: pair(s.states[state], s.x, s.y, { flip: s.flip }) })),
  }],
}));
