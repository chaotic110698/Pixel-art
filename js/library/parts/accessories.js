// Accessoires : lunettes, chapeaux, oreilles d'animaux, boucles d'oreilles, détails du visage.

import { G, Z, pair, place } from '../builder.js';

const CX = 31.5;

function ring(g, cx, cy, rx, ry, role) {
  const inner = G().ell(cx, cy, rx - 1, ry - 1, 'x');
  const outer = G().ell(cx, cy, rx, ry, role).subtract(inner);
  return g.stamp(outer, 0, 0);
}

const ITEMS = [
  // ----- lunettes -----
  {
    id: 'glasses-round', name: 'Lunettes rondes', sub: 'glasses', z: Z.glasses,
    draw: () => {
      const g = G();
      g.ell(26.5, 25.5, 4, 4, 'g');
      g.ell(37.5, 25.5, 4, 4, 'g');
      ring(g, 26.5, 25.5, 4, 4, 'p');
      ring(g, 37.5, 25.5, 4, 4, 'p');
      g.line(30, 24, 33, 24, 'p');
      g.line(18, 24, 22, 24, 'p');
      g.line(41, 24, 45, 24, 'p');
      return g;
    },
  },
  {
    id: 'glasses-square', name: 'Lunettes carrées', sub: 'glasses', z: Z.glasses,
    draw: () => {
      const g = G();
      g.rect(22, 22, 29, 28, 'p').rect(34, 22, 41, 28, 'p');
      g.rect(23, 23, 28, 27, 'g').rect(35, 23, 40, 27, 'g');
      g.line(30, 23, 33, 23, 'p');
      g.line(18, 23, 21, 23, 'p').line(42, 23, 45, 23, 'p');
      return g;
    },
  },
  {
    id: 'sunglasses', name: 'Lunettes de soleil', sub: 'glasses', z: Z.glasses,
    draw: () => {
      const g = G();
      g.rect(21, 22, 29, 23, 'p').rect(34, 22, 42, 23, 'p');
      g.ell(25.5, 24.5, 4.5, 3.5, 'p').ell(38.5, 24.5, 4.5, 3.5, 'p');
      g.clear((x, y) => y < 22);
      g.line(30, 23, 33, 23, 'p');
      g.line(18, 23, 21, 23, 'p').line(42, 23, 45, 23, 'p');
      g.px(23, 24, 'l').px(24, 24, 'l').px(36, 24, 'l').px(37, 24, 'l');
      return g;
    },
  },
  // ----- chapeaux -----
  {
    id: 'beanie', name: 'Bonnet', sub: 'hat', z: Z.hat,
    draw: () => {
      const g = G();
      g.ell(CX, 17, 15, 11, 'a').clear((x, y) => y > 17);
      g.rect(16, 14, 47, 19, 'A');
      for (let x = 17; x <= 46; x += 2) g.line(x, 15, x, 18, 'a');
      g.ell(CX, 4.5, 3.5, 3, 'a');
      g.shade('a', 'A', 1, 1, 1);
      g.outline('y');
      return g;
    },
  },
  {
    id: 'cap', name: 'Casquette', sub: 'hat', z: Z.hat,
    draw: () => {
      const g = G();
      g.ell(CX, 16, 14, 10, 'a').clear((x, y) => y > 16);
      g.poly([[30, 14], [55, 15], [55, 18], [30, 18]], 'A');
      g.px(CX, 6, 'A');
      g.line(31, 7, 31, 15, 'A');
      g.shade('a', 'A', 1, 1, 1);
      g.outline('y');
      return g;
    },
  },
  {
    id: 'witch', name: 'Chapeau pointu', sub: 'hat', z: Z.hat,
    draw: () => {
      const g = G();
      g.poly([[19, 15], [44, 15], [36, 0], [41, -2]], 'a');
      g.ell(CX, 15.5, 20, 3, 'a');
      g.rect(20, 12, 43, 14, 'c');
      g.shade('a', 'A', 1, 1, 1);
      g.outline('y');
      return g;
    },
  },
  {
    id: 'tophat', name: 'Haut-de-forme', sub: 'hat', z: Z.hat,
    draw: () => {
      const g = G();
      g.rect(22, 0, 41, 13, 'p');
      g.rect(22, 10, 41, 12, 'a');
      g.ell(CX, 14.5, 17, 2.5, 'p');
      g.outline('y');
      return g;
    },
  },
  {
    id: 'crown', name: 'Couronne', sub: 'hat', z: Z.hat,
    draw: () => {
      const g = G();
      g.rect(22, 7, 41, 12, 'a');
      for (const x of [22, 27, 31.5, 36, 41]) g.poly([[x - 2.5, 8], [x + 2.5, 8], [x, 1.5]], 'a');
      g.px(26, 9, 'e').px(31, 9, 'r').px(32, 9, 'r').px(37, 9, 'e');
      g.shade('a', 'A', 1, 1, 1);
      g.outline('y');
      return g;
    },
  },
  {
    id: 'bow', name: 'Nœud', sub: 'hat', z: Z.hat,
    draw: () => {
      const g = G();
      g.poly([[36, 8], [43, 3], [44, 13]], 'a');
      g.poly([[36, 8], [29, 3], [28, 13]], 'a');
      g.ell(36, 8, 2, 2, 'A');
      g.outline('y');
      return g;
    },
  },
  {
    id: 'headband', name: 'Bandeau', sub: 'hat', z: Z.hat,
    draw: () => {
      const g = G();
      g.ell(CX, 21, 14.5, 12.5, 'a');
      g.clear((x, y) => y < 12 || y > 13);
      g.outline('y');
      return g;
    },
  },
  // ----- oreilles -----
  {
    id: 'ears-cat', name: 'Oreilles de chat', sub: 'animalEars', z: Z.animalEars,
    draw: () => {
      const g = G();
      g.poly([[18, 15], [20, 1], [30, 9]], 'h');
      g.poly([[21, 12], [21.5, 5], [26, 10]], 'r');
      g.mirror();
      g.outline('q');
      return g;
    },
  },
  {
    id: 'ears-fox', name: 'Oreilles de renard', sub: 'animalEars', z: Z.animalEars,
    draw: () => {
      const g = G();
      g.poly([[16, 16], [15, -1], [29, 9]], 'h');
      g.poly([[18, 12], [17.5, 4], [24, 10]], 'w');
      g.mirror();
      g.outline('q');
      return g;
    },
  },
  {
    id: 'ears-bunny', name: 'Oreilles de lapin', sub: 'animalEars', z: Z.animalEars,
    draw: () => {
      const g = G();
      g.ell(25, 3, 3.5, 10, 'h');
      g.ell(25, 4, 1.5, 7, 'r');
      g.clear((x, y) => y > 11);
      g.mirror();
      g.outline('q');
      return g;
    },
  },
  {
    id: 'ears-bear', name: 'Oreilles d\'ours', sub: 'animalEars', z: Z.animalEars,
    draw: () => {
      const g = G();
      g.ell(20.5, 10.5, 5, 5, 'h');
      g.ell(20.5, 10.5, 2.5, 2.5, 'H');
      g.mirror();
      g.outline('q');
      return g;
    },
  },
  {
    id: 'horns', name: 'Petites cornes', sub: 'animalEars', z: Z.animalEars,
    draw: () => {
      const g = G();
      g.poly([[21, 13], [26, 11], [19, 2]], 'a');
      g.mirror();
      g.shade('a', 'A', 1, 0, 1);
      g.outline('y');
      return g;
    },
  },
  // ----- boucles d'oreilles -----
  {
    id: 'earrings-hoop', name: 'Anneaux', sub: 'earrings', z: Z.earrings,
    draw: () => {
      const g = G();
      ring(g, 19.5, 32.5, 2.5, 2.5, 'a');
      ring(g, 44.5, 32.5, 2.5, 2.5, 'a');
      return g;
    },
  },
  {
    id: 'earrings-pearl', name: 'Perles', sub: 'earrings', z: Z.earrings,
    draw: () => {
      const g = G();
      g.rect(18, 30, 19, 31, 'w').rect(44, 30, 45, 31, 'w');
      g.px(18, 30, 'l').px(44, 30, 'l');
      g.outline('y');
      return g;
    },
  },
  {
    id: 'earrings-star', name: 'Étoiles', sub: 'earrings', z: Z.earrings,
    draw: () => {
      const star = ['.a.', 'aaa', '.a.'];
      const g = G();
      g.stamp(place(star, 18, 31), 0, 0).stamp(place(star, 43, 31), 0, 0);
      g.line(19, 30, 19, 30, 'y').line(44, 30, 44, 30, 'y');
      return g;
    },
  },
  // ----- barbes et moustaches (couleur des cheveux) -----
  {
    id: 'mustache', name: 'Moustache', sub: 'beard', z: Z.beard,
    draw: () => {
      const g = G();
      g.poly([[26, 31.5], [31.5, 30], [37.5, 31.5], [37, 33], [31.5, 32], [26.5, 33]], 'h');
      g.shade('h', 'H', 0, 1, 1);
      g.outline('q');
      return g;
    },
  },
  {
    id: 'mustache-curly', name: 'Moustache en guidon', sub: 'beard', z: Z.beard,
    draw: () => {
      const g = G();
      g.rect(27, 31, 36, 32, 'h');
      g.px(26, 31, 'h').px(25, 30, 'h').px(25, 29, 'h').px(37, 31, 'h').px(38, 30, 'h').px(38, 29, 'h');
      g.outline('q');
      return g;
    },
  },
  {
    id: 'goatee', name: 'Bouc', sub: 'beard', z: Z.beard,
    draw: () => {
      const g = G();
      g.ell(31.5, 37, 3.5, 3, 'h');
      g.rect(28, 31, 35, 31, 'h');
      g.shade('h', 'H', 1, 1, 1);
      g.outline('q');
      return g;
    },
  },
  {
    id: 'beard-short', name: 'Barbe courte', sub: 'beard', z: Z.beard,
    draw: () => {
      const g = G();
      g.ell(31.5, 31, 12.5, 7.5, 'h');
      g.clear((x, y) => y < 28);
      g.ell(31.5, 33.5, 5.5, 2.6, 'x'); // espace pour la bouche
      g.clear((x, y) => g.get(x, y) === 'x'.charCodeAt(0));
      g.clear((x, y) => (x + y) % 2 === 0 && y < 31); // bord tramé vers les joues
      g.recolor('h', 'H', (x, y) => y > 36);
      g.outline('q', { skipBottom: false });
      return g;
    },
  },
  {
    id: 'beard-full', name: 'Barbe fournie', sub: 'beard', z: Z.beard,
    draw: () => {
      const g = G();
      g.ell(31.5, 32, 13.5, 10, 'h');
      g.clear((x, y) => y < 26);
      g.ell(31.5, 33.5, 5.5, 2.6, 'x');
      g.clear((x, y) => g.get(x, y) === 'x'.charCodeAt(0));
      g.rect(26, 30, 37, 31, 'h');
      g.shade('h', 'H', 1, 1, 1);
      g.outline('q');
      return g;
    },
  },
  // ----- maquillage -----
  {
    id: 'eyeliner', name: 'Eye-liner', sub: 'makeup', z: Z.eyeliner,
    draw: () => pair(['p.....', '.p....'], 21, 22, { flip: true }),
  },
  {
    id: 'eyeshadow', name: 'Fard à paupières', sub: 'makeup', z: Z.makeup,
    draw: () => pair(['.aaaa.', 'aAAAAa'], 23, 20, { flip: true }),
  },
  {
    id: 'sparkles', name: 'Paillettes', sub: 'makeup', z: Z.makeup,
    draw: () => pair(['.l.', 'l.l', '.l.'], 20, 28, { flip: true }),
  },
  {
    id: 'cheek-hearts', name: 'Cœurs sur les joues', sub: 'makeup', z: Z.makeup,
    draw: () => pair(['r.r', 'rrr', '.r.'], 22, 29, { flip: true }),
  },
  // ----- détails du visage -----
  {
    id: 'scar', name: 'Cicatrice', sub: 'blush', z: Z.blush,
    draw: () => {
      const g = G();
      g.line(37, 26, 41, 31, 'k');
      g.px(38, 28, 'S').px(40, 29, 'S').px(37, 29, 'S').px(41, 28, 'S');
      return g;
    },
  },
  {
    id: 'tattoo-star', name: 'Tatouage étoile', sub: 'blush', z: Z.blush,
    draw: () => place(['.a.', 'aaa', '.a.'], 39, 29),
  },
  {
    id: 'tattoo-tear', name: 'Larme tatouée', sub: 'blush', z: Z.blush,
    draw: () => place(['.p', 'pp', 'pp'], 25, 29),
  },
  {
    id: 'blush', name: 'Joues roses', sub: 'blush', z: Z.blush,
    draw: () => pair(['rrr'], 23, 29, { flip: true }),
  },
  {
    id: 'freckles', name: 'Taches de rousseur', sub: 'blush', z: Z.blush,
    draw: () => pair(['S.S', '.S.'], 23, 29, { flip: true }),
  },
  {
    id: 'mole', name: 'Grain de beauté', sub: 'blush', z: Z.blush,
    draw: () => place(['k'], 37, 33),
  },
  {
    id: 'bandaid', name: 'Pansement', sub: 'blush', z: Z.blush,
    draw: () => place(['.ww', 'wSw', 'ww.'], 36, 29),
  },
];

export const ACCESSORY_SUBS = {
  beard: 'Barbes et moustaches',
  makeup: 'Maquillage',
  glasses: 'Lunettes',
  hat: 'Chapeaux',
  animalEars: 'Oreilles',
  headset: 'Casques audio',
  earrings: 'Boucles d\'oreilles',
  neck: 'Colliers',
  blush: 'Détails du visage',
};

export default ITEMS.map((it) => ({
  id: `acc-${it.id}`,
  name: it.name,
  category: 'accessory',
  sub: it.sub,
  exclusiveKey: it.sub === 'blush' || it.sub === 'makeup' ? null : it.sub,
  build: () => [{ name: it.name, z: it.z, grid: it.draw() }],
}));
