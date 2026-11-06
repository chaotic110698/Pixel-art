// Bouches : états fermée / ouverte / sourire / triste / surprise.
// Motifs de 10 pixels de large, placés en x = 27, centrés sur x = 31,5.

import { place, Z } from '../builder.js';

const STYLES = [
  {
    id: 'simple', name: 'Simple', y: 32,
    states: {
      closed: ['..........', '...pppp...', '..........', '..........'],
      half: ['...pppp...', '..pmmmmp..', '...pppp...', '..........'],
      open: ['...pppp...', '..pmmmmp..', '..pmttmp..', '...pppp...'],
      smile: ['..p....p..', '...pppp...', '..........', '..........'],
      sad: ['...pppp...', '..p....p..', '..........', '..........'],
      surprised: ['....pp....', '...pmmp...', '...pmmp...', '....pp....'],
    },
  },
  {
    id: 'wide', name: 'Large', y: 32,
    states: {
      closed: ['..........', '.pppppppp.', '..........', '..........'],
      half: ['.pppppppp.', 'pmmmmmmmmp', '.pppppppp.', '..........'],
      open: ['.pppppppp.', 'pTTTTTTTTp', 'pmmmttmmmp', '.pppppppp.'],
      smile: ['pppppppppp', '.pTTTTTTp.', '..pppppp..', '..........'],
      sad: ['..pppppp..', '.p......p.', 'p........p', '..........'],
      surprised: ['...pppp...', '..pmmmmp..', '..pmmmmp..', '...pppp...'],
    },
  },
  {
    id: 'cat', name: 'Chat (:3)', y: 32,
    states: {
      closed: ['.p..pp..p.', '..pp..pp..', '..........', '..........'],
      half: ['.p..pp..p.', '..pmmmmp..', '...pppp...', '..........'],
      open: ['.p..pp..p.', '..pmmmmp..', '..pmttmp..', '...pppp...'],
      smile: ['p...pp...p', '.ppp..ppp.', '..........', '..........'],
      sad: ['..........', '..pp..pp..', '.p..pp..p.', '..........'],
      surprised: ['....pp....', '...pmmp...', '...pttp...', '....pp....'],
    },
  },
  {
    id: 'fang', name: 'Petit croc', y: 32,
    states: {
      closed: ['..........', '..pppppp..', '...T......', '..........'],
      half: ['..pppppp..', '.pTmmmmmp.', '..pppppp..', '..........'],
      open: ['..pppppp..', '.pTmmmmmp.', '.pmmmttmp.', '..pppppp..'],
      smile: ['.p......p.', '..pppppp..', '...T......', '..........'],
      sad: ['...pppp...', '..pT...p..', '.p......p.', '..........'],
      surprised: ['...pppp...', '..pTmmmp..', '..pmmmmp..', '...pppp...'],
    },
  },
  {
    id: 'lips', name: 'Lèvres', y: 32,
    states: {
      closed: ['...rrrr...', '..rpppprr.', '...rrrr...', '..........'],
      half: ['..rrrrrr..', '.rpmmmmpr.', '..rrrrrr..', '..........'],
      open: ['..rrrrrr..', '.rpmmmmpr.', '.rpmttmpr.', '..rrrrrr..'],
      smile: ['.r......r.', '..rpppprr.', '...rrrr...', '..........'],
      sad: ['...rrrr...', '..rpppprr.', '.r......r.', '..........'],
      surprised: ['...rrrr...', '..rpmmpr..', '..rpmmpr..', '...rrrr...'],
    },
  },
];

export const MOUTH_STATES = [
  ['closed', 'fermée'],
  ['half', 'entrouverte'],
  ['open', 'ouverte'],
  ['smile', 'sourire'],
  ['sad', 'triste'],
  ['surprised', 'surprise'],
];

export default STYLES.map((s) => ({
  id: `mouth-${s.id}`,
  name: s.name,
  category: 'mouth',
  build: () => [{
    name: 'Bouche',
    z: Z.mouth,
    role: 'mouth',
    variants: MOUTH_STATES.map(([state, label]) => ({ name: label, state, grid: place(s.states[state], 27, s.y) })),
  }],
}));
