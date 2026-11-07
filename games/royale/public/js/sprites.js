// Sprites en pixel art, dibujados con código (sin imágenes): personas según su "look", botín y el mapa.
import { BALDOSA, TAM, LADO, T, rng } from './mundo.js';
import { ARMAS } from './mundo.js';

const lienzo = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const oscuro = (hex, k = 0.7) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

// Persona de 14x20 px vista de frente (o de espaldas), con 3 cuadros de caminar.
// Devuelve { frente: [c0,c1,c2], espalda: [c0,c1,c2] }
export const SP_W = 14;
export const SP_H = 20;
export function spritesPersona(look = {}) {
  const L = { piel: '#e8c4a8', pelo: { estilo: 'corto', color: '#2b1d14' }, ojos: '#3a2a1c', cuerpo: 'normal', ropa: { remera: '#7aa2ff', pantalon: '#3a4256' }, ...look };
  const remera = L.smoking ? '#141418' : L.robot ? '#8a96a3' : L.ropa?.remera || '#7aa2ff';
  const pant = L.smoking ? '#141418' : L.robot ? '#5d6773' : L.ropa?.pantalon || '#3a4256';
  const piel = L.piel;
  const pelo = L.pelo?.color || '#222';
  const est = L.pelo?.estilo || 'corto';
  const gordo = L.cuerpo === 'gordito';
  const hacer = (espalda, paso) => {
    const c = lienzo(SP_W, SP_H);
    const g = c.getContext('2d');
    const px = (x, y, col, w = 1, h = 1) => {
      g.fillStyle = col;
      g.fillRect(x, y, w, h);
    };
    // capa (atrás)
    if (L.capa) px(2, 9, L.capa, 10, 8);
    // piernas (se mueven al caminar)
    const pi = paso === 1 ? 1 : 0;
    const pd = paso === 2 ? 1 : 0;
    px(4, 15 - pi, pant, 2, 3 + pi);
    px(8, 15 - pd, pant, 2, 3 + pd);
    px(4, 18, L.smoking ? '#0b0b0b' : '#4a2c1a', 2, 2);
    px(8, 18, L.smoking ? '#0b0b0b' : '#4a2c1a', 2, 2);
    // cuerpo
    const ancho = gordo ? 10 : 8;
    const x0 = (SP_W - ancho) / 2;
    px(x0, 9, remera, ancho, 6);
    px(x0, 14, oscuro(pant, 0.9), ancho, 1);
    if (!espalda && L.smoking) {
      px(6, 9, '#f6f4ee', 2, 4);
      px(6, 9, '#0b0b0b', 2, 1);
    }
    if (!espalda && L.ropa?.franja && !L.smoking) px(x0, 11, L.ropa.franja, ancho, 1);
    if (!L.robot && !L.smoking) px(x0, 13, '#4a2c1a', ancho, 1); // cinturón
    // brazos
    px(x0 - 2, 9 + (paso === 2 ? 1 : 0), remera, 2, 3);
    px(x0 + ancho, 9 + (paso === 1 ? 1 : 0), remera, 2, 3);
    px(x0 - 2, 12 + (paso === 2 ? 1 : 0), L.smoking ? '#f6f4ee' : piel, 2, 2);
    px(x0 + ancho, 12 + (paso === 1 ? 1 : 0), L.smoking ? '#f6f4ee' : piel, 2, 2);
    // cabeza 8x8
    px(3, 1, piel, 8, 8);
    px(2, 3, piel, 1, 4);
    px(11, 3, piel, 1, 4);
    if (L.robot) {
      px(3, 1, '#b9c2cc', 8, 8);
      px(6, -1, '#8a96a3', 1, 2);
      px(6, 0, '#ff6b5b');
    }
    // pelo
    if (est === 'corto' || est === 'largo') {
      px(3, 0, pelo, 8, 2);
      px(2, 1, pelo, 1, 3);
      px(11, 1, pelo, 1, 3);
      if (espalda) px(3, 2, pelo, 8, est === 'largo' ? 7 : 4);
      if (est === 'largo') {
        px(2, 4, pelo, 1, 6);
        px(11, 4, pelo, 1, 6);
      }
    } else if (est === 'rulos') {
      px(2, 0, pelo, 10, 3);
      for (const x of [2, 5, 8, 11]) px(x, -0 + 0, pelo);
      if (espalda) px(2, 3, pelo, 10, 4);
    } else if (est === 'rulosPoco') {
      for (const [x, y] of [[3, 1], [6, 0], [9, 1], [2, 3], [11, 3]]) px(x, y, pelo, 2, 2);
    } else if (est === 'poco') {
      px(2, 3, pelo, 1, 3);
      px(11, 3, pelo, 1, 3);
      if (espalda) px(3, 5, pelo, 8, 2);
    }
    if (!espalda && !L.robot) {
      // cara: ojos con blanco y pupila, boca
      px(4, 4, '#ffffff', 2, 2);
      px(8, 4, '#ffffff', 2, 2);
      px(5, 4, L.ojos, 1, 2);
      px(8, 4, L.ojos, 1, 2);
      px(6, 7, '#b9675e', 2, 1);
      if (L.barba) {
        px(3, 6, L.barba, 8, 3);
        px(6, 7, '#b9675e', 2, 1);
      }
      if (L.lentes) {
        px(3, 4, L.lentes, 3, 1);
        px(8, 4, L.lentes, 3, 1);
        px(6, 4, L.lentes, 2, 1);
      }
      if (L.antifaz) px(3, 4, L.antifaz, 8, 2);
    }
    if (!espalda && L.robot) {
      px(4, 4, '#38d9e6', 2, 2);
      px(8, 4, '#38d9e6', 2, 2);
    }
    if (L.kipa) px(5, 0, L.kipa, 4, 1);
    if (L.sombrero) {
      px(1, 1, L.sombrero, 12, 1);
      px(4, -1, L.sombrero, 6, 2);
    }
    if (L.auriculares) {
      px(2, 0, L.auriculares, 10, 1);
      px(1, 3, L.auriculares, 2, 3);
      px(11, 3, L.auriculares, 2, 3);
    }
    return c;
  };
  return { frente: [0, 1, 2].map((p) => hacer(false, p)), espalda: [0, 1, 2].map((p) => hacer(true, p)) };
}

// Íconos de botín (12x12)
export function spritesBotin() {
  const out = {};
  const icono = (dibujo) => {
    const c = lienzo(12, 12);
    dibujo(c.getContext('2d'));
    return c;
  };
  const arma = (col, largo, culata) => icono((g) => {
    g.fillStyle = '#1b1b1b';
    g.fillRect(1, 5, largo, 3);
    g.fillStyle = col;
    g.fillRect(1, 5, largo - 1, 2);
    g.fillStyle = '#3a2a1c';
    g.fillRect(2, 7, 2, culata);
  });
  out.pistola = arma(ARMAS.pistola.color, 7, 3);
  out.subfusil = arma(ARMAS.subfusil.color, 9, 4);
  out.escopeta = arma(ARMAS.escopeta.color, 11, 3);
  out.rifle = arma(ARMAS.rifle.color, 11, 2);
  out.botiquin = icono((g) => {
    g.fillStyle = '#f4f1ea';
    g.fillRect(1, 2, 10, 8);
    g.fillStyle = '#e2213b';
    g.fillRect(5, 3, 2, 6);
    g.fillRect(3, 5, 6, 2);
  });
  out.escudo = icono((g) => {
    g.fillStyle = '#2f6fd6';
    g.fillRect(2, 1, 8, 7);
    g.fillRect(3, 8, 6, 2);
    g.fillRect(5, 10, 2, 1);
    g.fillStyle = '#9fd0ff';
    g.fillRect(3, 2, 2, 5);
  });
  return out;
}

// El mapa entero pintado una sola vez (pasto con pastitos, arena, agua, piso de madera, paredes, caminos, rocas y troncos).
export function pintarMapa(m) {
  const c = lienzo(LADO, LADO);
  const g = c.getContext('2d');
  const r = rng(m.semilla ^ 0x9a1);
  const colores = {
    [T.AGUA]: ['#2f8fd8', '#3a9be2', '#2a82c8'],
    [T.ARENA]: ['#e9d29a', '#e2c886', '#f0dcae'],
    [T.PASTO]: ['#5fae4a', '#58a444', '#68b852'],
    [T.PISO]: ['#b98a5a', '#ad7f50', '#c49664'],
    [T.PARED]: ['#6b5a4e', '#5e4f44', '#7a685a'],
    [T.CAMINO]: ['#b08a5c', '#a68052', '#bc966a'],
  };
  for (let y = 0; y < TAM; y++) for (let x = 0; x < TAM; x++) {
    const tipo = m.t[y * TAM + x];
    const [base, osc, cla] = colores[tipo];
    const X = x * BALDOSA;
    const Y = y * BALDOSA;
    g.fillStyle = base;
    g.fillRect(X, Y, BALDOSA, BALDOSA);
    // textura de pixeles
    for (let k = 0; k < 10; k++) {
      g.fillStyle = r() < 0.5 ? osc : cla;
      g.fillRect(X + Math.floor(r() * 16), Y + Math.floor(r() * 16), 1 + (tipo === T.AGUA ? 2 : 0), 1);
    }
    if (tipo === T.PASTO && r() < 0.18) {
      g.fillStyle = ['#ffd166', '#ff8ab3', '#ffffff'][Math.floor(r() * 3)];
      g.fillRect(X + 3 + Math.floor(r() * 10), Y + 3 + Math.floor(r() * 10), 1, 1);
    }
    if (tipo === T.PISO) {
      g.fillStyle = osc;
      for (let k = 0; k < 4; k++) g.fillRect(X, Y + k * 4 + 3, BALDOSA, 1);
    }
    if (tipo === T.PARED) {
      g.fillStyle = '#8f7b6a';
      g.fillRect(X, Y, BALDOSA, 3);
      g.fillStyle = '#3e332b';
      g.fillRect(X, Y + BALDOSA - 2, BALDOSA, 2);
    }
    if (tipo === T.AGUA && r() < 0.15) {
      g.fillStyle = '#bfe6ff';
      g.fillRect(X + Math.floor(r() * 12), Y + Math.floor(r() * 14), 3, 1);
    }
  }
  // sombra de las paredes sobre el piso
  for (const casa of m.casas) {
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.fillRect((casa.x + 1) * BALDOSA, (casa.y + 1) * BALDOSA, (casa.w - 2) * BALDOSA, 4);
  }
  // rocas y troncos (las copas de los árboles se dibujan encima de la gente)
  for (const o of m.obstaculos) {
    if (o.tipo === 'roca') {
      g.fillStyle = '#7d828a';
      g.beginPath();
      g.ellipse(o.x, o.y, o.r + 1, o.r, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#a3a8b0';
      g.fillRect(Math.round(o.x - o.r / 2), Math.round(o.y - o.r / 2), Math.round(o.r / 1.5), 2);
      g.fillStyle = '#5c6068';
      g.fillRect(Math.round(o.x - o.r), Math.round(o.y + o.r - 2), Math.round(o.r * 2), 2);
    } else {
      g.fillStyle = 'rgba(0,0,0,.22)';
      g.beginPath();
      g.ellipse(o.x + 3, o.y + 5, o.copa * 0.9, o.copa * 0.5, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#6b4226';
      g.fillRect(Math.round(o.x - 2), Math.round(o.y - 3), 4, 8);
    }
  }
  return c;
}

// Copa de árbol en pixel art (se dibuja encima de las personas).
const cacheCopas = new Map();
export function copa(o) {
  const k = Math.round(o.copa) + ':' + Math.round(o.tono * 3);
  if (cacheCopas.has(k)) return cacheCopas.get(k);
  const R = Math.round(o.copa);
  const c = lienzo(R * 2 + 2, R * 2 + 2);
  const g = c.getContext('2d');
  const r = rng(R * 97 + Math.round(o.tono * 3));
  const verdes = [['#2f7d32', '#3f9a3e', '#256a28'], ['#3b8a2e', '#4fa63a', '#2c6e22'], ['#2a7a4a', '#3a9a5c', '#215f3a'], ['#3f8f3a', '#56ad4a', '#2d6f2a']][Math.round(o.tono * 3)];
  for (let y = 0; y < R * 2; y++) for (let x = 0; x < R * 2; x++) {
    const d = Math.hypot(x - R, y - R);
    if (d > R - (r() < 0.3 ? 1 : 0)) continue;
    g.fillStyle = d > R - 2 ? verdes[2] : x + y < R * 1.4 ? verdes[1] : r() < 0.15 ? verdes[2] : verdes[0];
    g.fillRect(x + 1, y + 1, 1, 1);
  }
  cacheCopas.set(k, c);
  return c;
}

// Mapa chiquito para el minimapa
export function miniMapa(m, tam = 120) {
  const c = lienzo(TAM, TAM);
  const g = c.getContext('2d');
  const col = { [T.AGUA]: '#2f8fd8', [T.ARENA]: '#e9d29a', [T.PASTO]: '#5fae4a', [T.PISO]: '#b98a5a', [T.PARED]: '#4a3f37', [T.CAMINO]: '#b08a5c' };
  for (let y = 0; y < TAM; y++) for (let x = 0; x < TAM; x++) {
    g.fillStyle = col[m.t[y * TAM + x]];
    g.fillRect(x, y, 1, 1);
  }
  return c;
}
