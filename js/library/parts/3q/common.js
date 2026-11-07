// Vue de 3/4 tournée vers la droite : géométrie commune du gabarit 64×64.
// Le crâne est décalé vers la gauche (on voit l'oreille gauche), la face est à
// droite (x ≈ 46), le nez dépasse du profil. Style « adulte » : petits yeux,
// mâchoire marquée, contours bruns, cheveux texturés.

export const Q = {
  cx: 32, // centre du crâne
  faceX: 46, // bord avant du visage
  earX: 25.5, earY: 28.5, // oreille visible (côté gauche)
  eyeNear: 34, eyeFar: 43, eyeY: 25, // yeux : proche (gauche) / lointain (droite)
  noseY: 27,
  mouthX: 38, mouthY: 34,
};

/** Bruit déterministe (texture des cheveux, barbe…). */
export function hash(x, y, seed = 1) {
  let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Texture : quelques pixels d'un rôle deviennent plus sombres / plus clairs. */
export function texture(g, base, dark, light, { density = 0.18, seed = 3 } = {}) {
  const b = base.charCodeAt(0);
  g.each((x, y) => {
    if (g.a[y * g.w + x] !== b) return;
    const r = hash(x, y, seed);
    if (r < density) g.set(x, y, dark);
    else if (light && r > 1 - density * 0.6 && y < 22) g.set(x, y, light);
  });
  return g;
}

/** Ombre « vue de 3/4 » : côté arrière (gauche) et dessous. */
export function shade3q(g, base, shadow, depth = 2) {
  g.shade(base, shadow, -1, 0, depth);
  g.shade(base, shadow, 0, 1, 1);
  return g;
}

