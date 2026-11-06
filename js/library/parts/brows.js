// Sourcils : états normaux / hauts / froncés / tristes.
// Motif du sourcil gauche (extérieur à gauche, intérieur à droite), miroir à droite.

import { pair, Z } from '../builder.js';

const STYLES = [
  {
    id: 'thin', name: 'Fins', x: 23, y: 18,
    states: {
      normal: ['......', '......', '.qqqqq', '......'],
      high: ['.qqqqq', '......', '......', '......'],
      angry: ['......', 'qqq...', '...qqq', '......'],
      sad: ['......', '...qqq', 'qqq...', '......'],
    },
  },
  {
    id: 'thick', name: 'Épais', x: 23, y: 17,
    states: {
      normal: ['......', '......', '.qqqqq', 'qqqqqq', '......'],
      high: ['.qqqqq', 'qqqqqq', '......', '......', '......'],
      angry: ['......', 'qqq...', 'qqqqq.', '..qqqq', '....qq'],
      sad: ['......', '...qqq', '.qqqqq', 'qqqq..', 'qq....'],
    },
  },
  {
    id: 'arched', name: 'Arrondis', x: 23, y: 18,
    states: {
      normal: ['......', '..qqq.', '.q...q', '......'],
      high: ['..qqq.', '.q...q', '......', '......'],
      angry: ['......', 'qq....', '..qq..', '....qq'],
      sad: ['....qq', '..qq..', 'qq....', '......'],
    },
  },
  {
    id: 'short', name: 'Courts', x: 24, y: 18,
    states: {
      normal: ['....', '....', '.qq.', '....'],
      high: ['.qq.', '....', '....', '....'],
      angry: ['....', '.q..', '..q.', '....'],
      sad: ['....', '..q.', '.q..', '....'],
    },
  },
];

export const BROW_STATES = [
  ['normal', 'normaux'],
  ['high', 'hauts'],
  ['angry', 'froncés'],
  ['sad', 'tristes'],
];

export default STYLES.map((s) => ({
  id: `brows-${s.id}`,
  name: s.name,
  category: 'brows',
  build: () => [{
    name: 'Sourcils',
    z: Z.brows,
    role: 'brows',
    variants: BROW_STATES.map(([state, label]) => ({ name: label, state, grid: pair(s.states[state], s.x, s.y, { flip: true }) })),
  }],
}));
