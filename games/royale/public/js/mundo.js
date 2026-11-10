// Mundo de Battle Shmitz: geografía fija, botín y zona por semilla.
// Unidades: píxeles del juego (1 baldosa = 16 px). El mapa mide TAM x TAM baldosas.
export const BALDOSA = 16;
export const TAM = 160;
export const LADO = TAM * BALDOSA; // 2560 px
export const T = { AGUA: 0, ARENA: 1, PASTO: 2, PISO: 3, PARED: 4, CAMINO: 5, TIERRA: 6, PLAZA: 7, MADERA: 8 };
export const SOLIDO = (t) => t === T.PARED;

export function rng(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ruido suave (value noise) para que la costa no sea un círculo perfecto.
function ruido(r, n = 8) {
  const g = Array.from({ length: n + 1 }, () => Array.from({ length: n + 1 }, () => r()));
  const suave = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x * n;
    const fy = y * n;
    const ix = Math.min(n - 1, Math.floor(fx));
    const iy = Math.min(n - 1, Math.floor(fy));
    const tx = suave(fx - ix);
    const ty = suave(fy - iy);
    const a = g[iy][ix] + (g[iy][ix + 1] - g[iy][ix]) * tx;
    const b = g[iy + 1][ix] + (g[iy + 1][ix + 1] - g[iy + 1][ix]) * tx;
    return a + (b - a) * ty;
  };
}

export const ARMAS = {
  pistola: { nombre: 'Pistola', dano: 24, cadencia: .4, cargador: 12, recarga: 1.4, vel: 374, dispersion: .05, alcance: 340, perdigones: 1, municion: 'livianas', color: '#c9c9c9' },
  subfusil: { nombre: 'Subfusil', dano: 14, cadencia: 1 / 7, cargador: 30, recarga: 1.9, vel: 403, dispersion: .12, alcance: 320, perdigones: 1, municion: 'livianas', color: '#7aa2ff' },
  escopeta: { nombre: 'Escopeta', dano: 11, cadencia: 1.1, cargador: 5, recarga: 2.2, vel: 346, dispersion: .28, alcance: 170, perdigones: 8, municion: 'cartuchos', color: '#ff7a45' },
  rifle: { nombre: 'Rifle de asalto', dano: 30, cadencia: .25, cargador: 30, recarga: 2.1, vel: 590, dispersion: .025, alcance: 620, perdigones: 1, municion: 'medianas', color: '#c084fc' },
  francotirador: { nombre: 'Francotirador', dano: 100, cadencia: 2.8, cargador: 1, recarga: 2.8, vel: 1080, dispersion: .003, alcance: 1000, perdigones: 1, municion: 'pesadas', color: '#9d8af2' },
  rpg: { nombre: 'Lanzacohetes', dano: 70, cadencia: 3, cargador: 1, recarga: 3, vel: 151, dispersion: .012, alcance: 520, perdigones: 1, municion: 'cohetes', color: '#e5ab55' },
};
export const RAREZAS = Object.freeze({
  comun: { nombre: 'Común', color: '#b9b9b9', dano: 1, recarga: 1 },
  poco_comun: { nombre: 'Poco común', color: '#77dc74', dano: 1.08, recarga: .95 },
  rara: { nombre: 'Rara', color: '#6aa7ff', dano: 1.16, recarga: .9 },
  epica: { nombre: 'Épica', color: '#c58aff', dano: 1.25, recarga: .85 },
  legendaria: { nombre: 'Legendaria', color: '#ffc75c', dano: 1.35, recarga: .8 },
});
export const danoRareza = (dano, rareza = 'comun') => dano * (RAREZAS[rareza]?.dano || 1);
export const danoArea = (dano, radio, distancia) => distancia >= radio ? 0 : dano * (1 - distancia / radio);
export const CAJAS = Object.freeze({
  'balas-livianas': { nombre: 'Balas livianas', municion: 'livianas', cantidad: 30 },
  'balas-medianas': { nombre: 'Balas medianas', municion: 'medianas', cantidad: 25 },
  'balas-pesadas': { nombre: 'Balas pesadas', municion: 'pesadas', cantidad: 6 },
  'balas-cartuchos': { nombre: 'Cartuchos', municion: 'cartuchos', cantidad: 12 },
  'balas-cohetes': { nombre: 'Cohetes', municion: 'cohetes', cantidad: 3 },
});
export const MATERIALES = Object.freeze({ madera: { nombre: 'Madera', color: '#b78357' }, piedra: { nombre: 'Piedra', color: '#aeb7af' }, metal: { nombre: 'Metal', color: '#91afbb' } });
export const VIDA = 100;
export const ESCUDO_MAX = 100;

// ---------------------------------------------------------------- la isla de Battle Shmitz
// Geografía fija (igual en todas las partidas); lo que cambia con la semilla es el botín y la zona.
// Coordenadas de los lugares en baldosas. Los rectángulos no se pisan.
export const LUGARES = Object.freeze([
  { id: 'queque', nombre: 'El reino del Queque', corto: 'Queque', x: 59, y: 59, w: 42, h: 40, estilo: 'ciudad', botin: 4 },
  { id: 'templo', nombre: 'El templo', corto: 'Templo', x: 66, y: 13, w: 28, h: 25, estilo: 'templo', botin: 3 },
  { id: 'asman', nombre: 'El despacho de Asman', corto: 'Asman', x: 109, y: 33, w: 27, h: 27, estilo: 'oficinas', botin: 3 },
  { id: 'angeles', nombre: 'Ángeles angieados', corto: 'Ángeles', x: 20, y: 32, w: 33, h: 28, estilo: 'barrio', botin: 3 },
  { id: 'vasquito', nombre: 'El Vasquito', corto: 'Vasquito', x: 11, y: 72, w: 27, h: 24, estilo: 'ruta', botin: 2 },
  { id: 'kiwi', nombre: 'Kiwi', corto: 'Kiwi', x: 24, y: 105, w: 35, h: 29, estilo: 'granja', botin: 2 },
  { id: 'macabies', nombre: 'Macabíes macabros', corto: 'Macabíes', x: 65, y: 107, w: 36, h: 34, estilo: 'estadio', botin: 3 },
  { id: 'fondeana', nombre: 'Ciudad Fondeana', corto: 'Fondeana', x: 110, y: 96, w: 38, h: 32, estilo: 'puerto', botin: 3 },
]);
export function lugarEn(px, py) {
  const x = px / BALDOSA, y = py / BALDOSA;
  return LUGARES.find((l) => x >= l.x && y >= l.y && x < l.x + l.w && y < l.y + l.h) || null;
}

// Colores de cada estilo de edificio (paredes, techo y piso de adentro)
const ESTILOS = {
  torre: { color: '#c9bba6', techo: '#6c5a4f', piso: '#b9a58c' },
  torre2: { color: '#e0d2b8', techo: '#8a4f3d', piso: '#c3ae93' },
  torre3: { color: '#a9b8c6', techo: '#4d5a6b', piso: '#b8bcc0' },
  pastel: { color: '#f2b5c4', techo: '#c45d7a', piso: '#e8d3b8' },
  pastel2: { color: '#ffd3a8', techo: '#d0704f', piso: '#e9d5b5' },
  pastel3: { color: '#c7e1f5', techo: '#5b86b8', piso: '#e3d7c0' },
  vidrio: { color: '#8fb4cc', techo: '#3f5466', piso: '#c9cfd3' },
  ladrillo: { color: '#b46a4c', techo: '#5b3a2e', piso: '#c9a27a' },
  granero: { color: '#c0392b', techo: '#f2e9dc', piso: '#b98d5a' },
  campo: { color: '#efe2c4', techo: '#7d5b3a', piso: '#c9a27a' },
  piedra: { color: '#ddd3bd', techo: '#b8a77f', piso: '#d8ccb2' },
  galpon: { color: '#8e9ba3', techo: '#5c6870', piso: '#a9a39a' },
  tribuna: { color: '#5e4f66', techo: '#3c3044', piso: '#6b7d4e' },
};
const CONTENEDORES = ['#d35400', '#2e86c1', '#27ae60', '#c0392b', '#8e44ad', '#f1c40f'];

const cache = new Map();
export function generarMapa(semilla) {
  if (cache.has(semilla)) return cache.get(semilla);
  const terreno = rng(0x5b17cafe);
  const botines = rng(semilla ^ 0x15a1a);
  const costa = ruido(terreno, 12);
  const bosque = ruido(terreno, 9);
  const t = new Uint8Array(TAM * TAM);
  const alturas = new Uint8Array(TAM * TAM);
  const rio = new Uint8Array(TAM * TAM);
  const idx = (x, y) => y * TAM + x;
  const dentro = (x, y) => x >= 0 && y >= 0 && x < TAM && y < TAM;
  const poner = (x, y, tipo) => { if (dentro(x, y)) t[idx(x, y)] = tipo; };
  const rect = (x, y, w, h, tipo) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) poner(i, j, tipo); };
  const lugar = (id) => LUGARES.find((l) => l.id === id);

  // 1) costa
  for (let y = 0; y < TAM; y++) for (let x = 0; x < TAM; x++) {
    const ang = Math.atan2(y - 80, x - 80);
    const radio = 73 + 3.5 * Math.sin(5 * ang + 1) + 2 * Math.cos(7 * ang) + (costa(x / TAM, y / TAM) - 0.5) * 6;
    const d = Math.hypot(x - 80, y - 80);
    t[idx(x, y)] = d > radio ? T.AGUA : d > radio - 3.5 ? T.ARENA : T.PASTO;
  }
  // los lugares siempre son tierra firme (menos el lado del mar del puerto)
  for (const l of LUGARES) if (l.id !== 'fondeana') for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++) if (t[idx(x, y)] === T.AGUA || t[idx(x, y)] === T.ARENA) t[idx(x, y)] = T.PASTO;

  // 2) río (del norte al este) y laguna
  const trazo = (puntos, fn) => {
    for (let k = 0; k < puntos.length - 1; k++) {
      const [ax, ay] = puntos[k], [bx, by] = puntos[k + 1];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let s = 0; s <= n; s++) fn(ax + (bx - ax) * s / n, ay + (by - ay) * s / n);
    }
  };
  trazo([[99, 2], [101, 16], [103, 30], [104, 44], [105, 58], [111, 70], [126, 79], [142, 85], [158, 88]], (x, y) => {
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      const xx = Math.round(x + i), yy = Math.round(y + j);
      if (!dentro(xx, yy) || Math.hypot(i, j) > 1.9) continue;
      if (LUGARES.some((l) => xx >= l.x && xx < l.x + l.w && yy >= l.y && yy < l.y + l.h)) continue;
      t[idx(xx, yy)] = T.AGUA; rio[idx(xx, yy)] = 1;
    }
  });
  for (let y = 64; y < 78; y++) for (let x = 40; x < 56; x++) {
    const d = Math.hypot((x - 47.5) / 6.5, (y - 70.5) / 5);
    if (d < 1) { t[idx(x, y)] = T.AGUA; rio[idx(x, y)] = 1; } else if (d < 1.35 && t[idx(x, y)] === T.PASTO) t[idx(x, y)] = T.ARENA;
  }
  // orillas del río con un poco de arena
  for (let y = 1; y < TAM - 1; y++) for (let x = 1; x < TAM - 1; x++) if (t[idx(x, y)] === T.PASTO && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => rio[idx(x + i, y + j)])) t[idx(x, y)] = T.ARENA;

  // 3) caminos: asfalto entre los lugares, tierra en los senderos; sobre el río, puentes de madera
  const camino = (puntos, ancho = 3, tipo = T.CAMINO) => trazo(puntos, (x, y) => {
    const r = (ancho - 1) / 2;
    for (let j = -Math.ceil(r); j <= Math.ceil(r); j++) for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) {
      if (Math.abs(i) > r + 0.01 || Math.abs(j) > r + 0.01) continue;
      const xx = Math.round(x + i), yy = Math.round(y + j);
      if (!dentro(xx, yy)) continue;
      const k = idx(xx, yy), actual = t[k];
      if (rio[k]) t[k] = T.MADERA;
      else if (actual === T.PASTO || actual === T.ARENA || actual === T.TIERRA || (actual === T.CAMINO && tipo === T.CAMINO)) t[k] = tipo;
    }
  });
  camino([[80, 59], [80, 38]]); // al templo
  camino([[100, 68], [106, 62], [113, 58], [122, 58]]); // a lo de Asman (puente)
  camino([[59, 79], [44, 81], [38, 84]]); // al Vasquito
  camino([[80, 98], [82, 107]]); // a Macabíes
  camino([[100, 92], [110, 100], [116, 104]]); // al puerto
  camino([[62, 61], [55, 54], [52, 47]]); // a Ángeles
  camino([[24, 96], [30, 104], [36, 106]], 2, T.TIERRA);
  camino([[58, 120], [65, 122]], 2, T.TIERRA);
  camino([[100, 124], [110, 120]], 2, T.TIERRA);
  camino([[30, 60], [26, 66], [24, 72]], 2, T.TIERRA);
  camino([[66, 26], [52, 30], [42, 33]], 2, T.TIERRA);
  camino([[94, 24], [104, 28], [112, 34]], 2, T.TIERRA); // puente norte

  // 4) edificios
  const casas = [];
  const obstaculos = [];
  const decoraciones = [];
  const edificio = (l, x, y, w, h, estilo, pisos = 1, { puertas = ['s', 'n'], tipo = 'casa', divisiones = [] } = {}) => {
    const e = ESTILOS[estilo];
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const borde = i === x || j === y || i === x + w - 1 || j === y + h - 1;
      t[idx(i, j)] = borde ? T.PARED : T.PISO;
      alturas[idx(i, j)] = pisos;
    }
    const abrir = (i, j) => { t[idx(i, j)] = T.PISO; };
    for (const p of puertas) {
      const [lado, off] = typeof p === 'string' ? [p, 0.5] : p;
      if (lado === 's' || lado === 'n') { const i = x + Math.max(1, Math.min(w - 3, Math.floor((w - 2) * off))); const j = lado === 'n' ? y : y + h - 1; abrir(i, j); abrir(i + 1, j); }
      else { const j = y + Math.max(1, Math.min(h - 3, Math.floor((h - 2) * off))); const i = lado === 'o' ? x : x + w - 1; abrir(i, j); abrir(i, j + 1); }
    }
    // paredes de adentro con su puerta
    for (const d of divisiones) {
      if (d.x !== undefined) { for (let j = y + 1; j < y + h - 1; j++) t[idx(x + d.x, j)] = T.PARED; const p = y + Math.floor(h * (d.puerta ?? 0.5)); abrir(x + d.x, p); abrir(x + d.x, p + 1); }
      else { for (let i = x + 1; i < x + w - 1; i++) t[idx(i, y + d.y)] = T.PARED; const p = x + Math.floor(w * (d.puerta ?? 0.5)); abrir(p, y + d.y); abrir(p + 1, y + d.y); }
    }
    const c = { x, y, w, h, color: e.color, techo: e.techo, piso: e.piso, altura: pisos, lugar: l?.id || null, tipo };
    casas.push(c);
    return c;
  };
  const bloque = (l, x, y, w, h, color) => { // contenedores y bloques macizos
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { t[idx(i, j)] = T.PARED; alturas[idx(i, j)] = 1; }
    casas.push({ x, y, w, h, color, techo: color, piso: color, altura: 1, lugar: l.id, tipo: 'contenedor' });
  };
  const obstaculo = (x, y, tipo, extra = {}) => {
    const base = { arbol: { r: 6, material: 'madera', vida: 80 }, roca: { r: 8, material: 'piedra', vida: 110 }, auto: { r: 9, material: 'metal', vida: 160 }, columna: { r: 4.5, material: 'piedra', vida: 200 }, silo: { r: 14, material: 'metal', vida: 400 }, surtidor: { r: 4, material: 'metal', vida: 90 }, monumento: { r: 21, material: 'piedra', vida: 99999 }, caja: { r: 6, material: 'madera', vida: 60 }, tractor: { r: 10, material: 'metal', vida: 220 } }[tipo];
    obstaculos.push({ id: 'o' + obstaculos.length, x, y, tipo, ...base, tono: terreno(), ...extra });
  };
  const deco = (tipo, x, y, extra = {}) => decoraciones.push({ tipo, x, y, ...extra });
  const px = (n) => (n + 0.5) * BALDOSA;

  // El reino del Queque: la gran ciudad del centro, con el monumento al Queque en la plaza
  {
    const l = lugar('queque');
    rect(l.x, l.y, l.w, l.h, T.PLAZA);
    rect(l.x, 77, l.w, 4, T.CAMINO); // avenida este-oeste
    rect(78, l.y, 4, l.h, T.CAMINO); // avenida norte-sur
    for (const [x, y] of [[61, 67], [84, 67], [61, 88], [84, 88]]) rect(x, y, 15, 2, T.CAMINO);
    rect(73, 72, 14, 14, T.PLAZA);
    obstaculo(px(79.5), px(78.5), 'monumento');
    for (const [x, y] of [[76.5, 75.5], [83, 75.5], [76.5, 82.5], [83, 82.5]]) deco('fuente', px(x), px(y));
    const cuadras = [[61, 61], [84, 61], [61, 82], [84, 82]];
    const estilos = ['torre', 'torre2', 'torre3', 'ladrillo'];
    cuadras.forEach(([cx, cy], q) => {
      const e = (k) => estilos[(q + k) % estilos.length];
      edificio(l, cx, cy, 7, 6, e(0), 2 + (q % 2), { puertas: ['s', 'e'] });
      edificio(l, cx + 9, cy, 6, 6, e(1), 3, { puertas: ['s', 'o'] });
      edificio(l, cx, cy + 8, 15, 6, e(2), 2 + ((q + 1) % 3), { puertas: ['n', 's', 'o'], divisiones: [{ x: 7, puerta: 0.4 }] });
    });
    for (let x = l.x + 2; x < l.x + l.w - 1; x += 5) for (const y of [76, 81]) deco('farola', px(x), px(y));
    for (let y = l.y + 2; y < l.y + l.h - 1; y += 5) for (const x of [77, 82]) deco('farola', px(x), px(y));
    for (const [x, y, rot] of [[64, 78, 0], [96, 79, 0], [79, 64, 1], [80, 95, 1], [88, 78, 0], [70, 79, 0]]) obstaculo(px(x), px(y), 'auto', { rot: rot * Math.PI / 2 });
    for (const [x, y] of [[75, 76], [84, 76], [75, 81], [84, 81]]) deco('banco', px(x), px(y));
  }
  // El templo: un templo de piedra con columnas en un patio
  {
    const l = lugar('templo');
    rect(l.x + 1, l.y + 1, l.w - 2, l.h - 2, T.PLAZA);
    edificio(l, 71, 16, 18, 13, 'piedra', 3, { puertas: ['s', 'n', 'o', 'e'], divisiones: [{ y: 6, puerta: 0.45 }] });
    for (let x = 69; x <= 91; x += 4) { obstaculo(px(x), px(31.5), 'columna'); obstaculo(px(x), px(14), 'columna'); }
    for (let y = 18; y <= 28; y += 5) { obstaculo(px(68), px(y), 'columna'); obstaculo(px(92), px(y), 'columna'); }
    rect(78, 29, 4, 7, T.PLAZA);
    for (let y = 31; y <= 35; y++) deco('escalon', px(79.5), px(y));
    for (const [x, y] of [[70, 34], [90, 34], [69, 17], [91, 17]]) deco('arbusto', px(x), px(y), { tam: 1.4 });
  }
  // El despacho de Asman: dos torres de oficinas y el estacionamiento
  {
    const l = lugar('asman');
    rect(l.x, l.y, l.w, l.h, T.PLAZA);
    edificio(l, 111, 35, 15, 13, 'vidrio', 4, { puertas: ['s', ['s', 0.85], 'o', ['e', 0.3]], divisiones: [{ x: 7, puerta: 0.3 }, { y: 7, puerta: 0.25 }] });
    edificio(l, 127, 35, 8, 9, 'torre3', 3, { puertas: ['s', 'o'] });
    rect(111, 50, 24, 9, T.CAMINO);
    for (let x = 112; x < 134; x += 3) { deco('raya', px(x), px(52.5), { w: 2, h: 40, color: '#e9e6dc' }); deco('raya', px(x), px(56.5), { w: 2, h: 40, color: '#e9e6dc' }); }
    for (const [x, y] of [[113.5, 53], [119.5, 53], [128.5, 57], [122.5, 57], [131.5, 53]]) obstaculo(px(x), px(y), 'auto', { rot: Math.PI / 2 });
    for (let x = 112; x < 135; x += 6) deco('farola', px(x), px(49));
    deco('cartel', px(126), px(46), { texto: 'ASMAN' });
  }
  // Ángeles angieados: un barrio de casitas pastel con jardín y pileta
  {
    const l = lugar('angeles');
    rect(l.x + 1, 45, l.w - 2, 3, T.CAMINO);
    rect(36, l.y + 1, 3, l.h - 2, T.PLAZA);
    const estilos = ['pastel', 'pastel2', 'pastel3'];
    let k = 0;
    for (const x of [22, 41]) for (const y of [34, 50]) {
      const ancho = x === 22 ? 12 : 10;
      edificio(l, x, y, ancho, 8, estilos[k % 3], 1 + (k % 2), { puertas: y === 34 ? ['s', 'n'] : ['n', 's'], divisiones: [{ x: Math.floor(ancho / 2), puerta: 0.5 }] });
      if (k % 2 === 0) rect(x + 2, 43, 4, 1, T.AGUA); // pileta en el patio
      k++;
    }
    for (let x = 21; x < 52; x += 2) { deco('cerca', px(x), px(32.6), { rot: 0 }); deco('cerca', px(x), px(59.4), { rot: 0 }); }
    for (const [x, y] of [[34, 38], [34, 54], [53, 38], [53, 54], [20.5, 44], [20.5, 50]]) deco('arbusto', px(x), px(y), { tam: 1.6 });
    for (let i = 0; i < 18; i++) deco('flores', px(22 + terreno() * 30), px(33 + terreno() * 26), { color: ['#ff7aa8', '#ffd166', '#c084fc', '#ff8a5b'][i % 4] });
    deco('cartel', px(37.5), px(44), { texto: 'ÁNGELES' });
  }
  // El Vasquito: el bar y almacén de ruta en el cruce
  {
    const l = lugar('vasquito');
    rect(l.x + 1, 84, l.w - 2, 3, T.CAMINO);
    rect(23, l.y + 1, 3, l.h - 2, T.CAMINO);
    edificio(l, 12, 74, 10, 8, 'ladrillo', 1, { puertas: ['s', 'e'], divisiones: [{ x: 5, puerta: 0.5 }] });
    edificio(l, 28, 74, 9, 8, 'campo', 1, { puertas: ['s', 'o'] });
    edificio(l, 28, 89, 8, 6, 'galpon', 1, { puertas: ['n'] });
    rect(13, 88, 8, 6, T.PLAZA);
    for (const [x, y] of [[15, 90.5], [18, 90.5]]) obstaculo(px(x), px(y), 'surtidor');
    deco('techito', px(16.5), px(90.5));
    obstaculo(px(31), px(86), 'auto', { rot: 0, grande: true });
    deco('cartel', px(24.5), px(82.5), { texto: 'EL VASQUITO' });
  }
  // Kiwi: la granja con granero, silo y la huerta de kiwis
  {
    const l = lugar('kiwi');
    rect(l.x + 1, l.y + 1, l.w - 2, 13, T.TIERRA);
    edificio(l, 26, 107, 12, 10, 'granero', 2, { puertas: ['s', 'e', 'n'] });
    edificio(l, 46, 107, 9, 7, 'campo', 1, { puertas: ['s', 'o'] });
    obstaculo(px(41.5), px(110), 'silo');
    obstaculo(px(48), px(118), 'tractor');
    for (let y = 121; y < 133; y += 2) { rect(26, y, 31, 1, T.TIERRA); for (let x = 27; x < 56; x += 3) deco('cultivo', px(x), px(y)); }
    for (let x = 25; x < 58; x += 2) deco('cerca', px(x), px(119.4), { rot: 0 });
    for (const [x, y] of [[30, 118], [52, 116]]) obstaculo(px(x), px(y), 'caja');
    deco('cartel', px(41.5), px(105.5), { texto: 'KIWI' });
  }
  // Macabíes macabros: el estadio abandonado, con tribunas y la cancha
  {
    const l = lugar('macabies');
    rect(l.x + 1, l.y + 1, l.w - 2, l.h - 2, T.TIERRA);
    const cx = 83, cy = 124, rx = 15, ry = 13;
    for (let y = l.y + 1; y < l.y + l.h - 1; y++) for (let x = l.x + 1; x < l.x + l.w - 1; x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (d < 0.78) t[idx(x, y)] = T.PASTO;
      else if (d < 1) { t[idx(x, y)] = T.PARED; alturas[idx(x, y)] = 2; }
    }
    // cuatro entradas
    for (const [x0, y0, w, h] of [[81, 109, 4, 5], [81, 133, 4, 6], [67, 122, 5, 4], [94, 122, 6, 4]]) rect(x0, y0, w, h, T.TIERRA);
    casas.push({ x: 68, y: 111, w: 31, h: 27, color: ESTILOS.tribuna.color, techo: ESTILOS.tribuna.techo, piso: ESTILOS.tribuna.piso, altura: 2, lugar: 'macabies', tipo: 'estadio', elipse: { cx, cy, rx, ry } });
    deco('raya', px(83), px(124), { w: 3, h: 300, color: '#f4f1ea', rot: Math.PI / 2 });
    deco('circulo', px(82.5), px(123.5), { r: 34 });
    deco('raya', px(83), px(116.5), { w: 120, h: 3, color: '#f4f1ea' });
    deco('raya', px(83), px(130.5), { w: 120, h: 3, color: '#f4f1ea' });
    for (const [x, y] of [[76, 119], [90, 128], [79, 129], [88, 118]]) obstaculo(px(x), px(y), 'caja');
    for (const [x, y] of [[68, 109], [99, 110], [68, 139], [99, 139], [70, 113], [97, 135]]) obstaculo(px(x), px(y), 'arbol', { forma: 'muerto', r: 5 });
  }
  // Ciudad Fondeana: el puerto, con galpones, contenedores, muelles y el faro
  {
    const l = lugar('fondeana');
    for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++) if (t[idx(x, y)] !== T.AGUA) t[idx(x, y)] = x < 132 ? T.PLAZA : t[idx(x, y)] === T.ARENA ? T.ARENA : T.PLAZA;
    edificio(l, 112, 98, 11, 8, 'galpon', 2, { puertas: ['s', 'o', 'e'] });
    edificio(l, 125, 98, 9, 7, 'ladrillo', 2, { puertas: ['s', 'o'] });
    edificio(l, 112, 117, 8, 7, 'pastel3', 1, { puertas: ['n', 'e'] });
    let c = 0;
    for (const y of [109, 113]) for (let x = 114; x < 132; x += 7) bloque(l, x, y, 5, 2, CONTENEDORES[c++ % CONTENEDORES.length]);
    // muelles que llegan al mar
    for (const y of [118, 123]) for (let x = 124; x < 152; x++) for (const yy of [y, y + 1]) { if (dentro(x, yy) && t[idx(x, yy)] !== T.PARED) t[idx(x, yy)] = T.MADERA; }
    for (let x = 126; x < 132; x++) for (let y = 118; y < 125; y++) if (t[idx(x, y)] === T.AGUA || t[idx(x, y)] === T.ARENA) t[idx(x, y)] = T.MADERA;
    for (const [x, y, r] of [[146, 121.5, 0], [140, 116, 0.3], [150, 126, -0.4]]) deco('bote', px(x), px(y), { rot: r });
    deco('faro', px(137), px(103));
    obstaculo(px(137), px(103), 'columna', { r: 7, faro: true });
    for (const [x, y] of [[122, 108], [133, 112], [121, 116]]) obstaculo(px(x), px(y), 'caja');
    deco('cartel', px(120), px(107.5), { texto: 'FONDEANA' });
  }

  // 5) árboles, rocas y arbustos afuera de los lugares
  const libreAfuera = (x, y, margen = 2) => !LUGARES.some((l) => x >= l.x - margen && x < l.x + l.w + margen && y >= l.y - margen && y < l.y + l.h + margen);
  for (let k = 0; k < 6000 && obstaculos.length < 520; k++) {
    const x = 4 + Math.floor(terreno() * (TAM - 8)), y = 4 + Math.floor(terreno() * (TAM - 8));
    const tipo = t[idx(x, y)];
    if ((tipo !== T.PASTO && tipo !== T.ARENA) || !libreAfuera(x, y)) continue;
    const densidad = bosque(x / TAM, y / TAM);
    const roca = terreno() < 0.12;
    if (!roca && tipo === T.PASTO && terreno() > densidad * 1.25 - 0.18) continue;
    const ox = (x + 0.2 + terreno() * 0.6) * BALDOSA, oy = (y + 0.2 + terreno() * 0.6) * BALDOSA;
    if (obstaculos.some((o) => Math.abs(o.x - ox) < 26 && Math.abs(o.y - oy) < 26 && Math.hypot(o.x - ox, o.y - oy) < (roca ? 30 : 22))) continue;
    if ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => [T.CAMINO, T.TIERRA, T.MADERA, T.AGUA].includes(t[idx(x + i, y + j)]))) continue;
    if (roca) obstaculo(ox, oy, 'roca', { r: 6 + terreno() * 5 });
    else {
      const forma = tipo === T.ARENA ? 'palmera' : y < 45 ? (terreno() < 0.7 ? 'pino' : 'redondo') : y > 100 && x > 60 && x < 105 ? 'muerto' : terreno() < 0.25 ? 'pino' : 'redondo';
      obstaculo(ox, oy, 'arbol', { forma, r: forma === 'palmera' ? 4 : 6, copa: 11 + terreno() * 6 });
    }
  }
  for (let k = 0; k < 2500 && decoraciones.filter((d) => d.tipo === 'arbusto').length < 140; k++) {
    const x = 4 + Math.floor(terreno() * (TAM - 8)), y = 4 + Math.floor(terreno() * (TAM - 8));
    if (t[idx(x, y)] !== T.PASTO || !libreAfuera(x, y, 0)) continue;
    deco(terreno() < 0.6 ? 'arbusto' : 'flores', px(x), px(y), { tam: 0.8 + terreno() * 0.8, color: ['#ffd166', '#ff7aa8', '#f4f1ea', '#c084fc'][Math.floor(terreno() * 4)] });
  }

  // 6) botín (cambia con la semilla). Los ids son la posición en la lista: el servidor los usa así.
  const botin = [];
  const tipos = ['pistola', 'subfusil', 'escopeta', 'rifle', 'francotirador', 'botiquin', 'venda', 'mini', 'escudo', 'granada'];
  const pesoArma = ['pistola', 'pistola', 'subfusil', 'subfusil', 'escopeta', 'escopeta', 'rifle', 'rifle', 'francotirador'];
  const pesoCura = ['venda', 'venda', 'mini', 'mini', 'escudo', 'botiquin', 'granada'];
  const rarezaAleatoria = (mejor = false) => {
    const n = botines();
    if (mejor) return n < 0.025 ? 'legendaria' : n < 0.16 ? 'epica' : n < 0.56 ? 'rara' : 'poco_comun';
    return n < 0.62 ? 'comun' : n < 0.89 ? 'poco_comun' : n < 0.975 ? 'rara' : n < 0.997 ? 'epica' : 'legendaria';
  };
  const agregarBotin = (x, y, tipo, cofre = null, mejor = false) => {
    // curaciones con la rareza de siempre: vendas gris, botiquín verde, minis y escudo grande azules
    const RAREZA_CURA = { venda: 'comun', botiquin: 'poco_comun', mini: 'rara', escudo: 'rara', granada: 'poco_comun' };
    const rareza = tipo === 'rpg' ? (botines() < 0.06 ? 'legendaria' : 'epica') : ARMAS[tipo] ? rarezaAleatoria(mejor) : RAREZA_CURA[tipo] || 'comun';
    const b = { id: botin.length, x: Math.round(x), y: Math.round(y), tipo, rareza };
    if (cofre !== null) b.cofre = cofre;
    botin.push(b);
    return b;
  };
  const algo = () => (botines() < 0.55 ? pesoArma[Math.floor(botines() * pesoArma.length)] : pesoCura[Math.floor(botines() * pesoCura.length)]);
  const pisoDe = (c) => {
    const lista = [];
    for (let j = c.y + 1; j < c.y + c.h - 1; j++) for (let i = c.x + 1; i < c.x + c.w - 1; i++) if (t[idx(i, j)] === T.PISO && t[idx(i + 1, j)] !== T.PARED && t[idx(i - 1, j)] !== T.PARED && t[idx(i, j + 1)] !== T.PARED && t[idx(i, j - 1)] !== T.PARED) lista.push([i, j]);
    return lista;
  };
  const ocupado = (x, y, d = 18) => botin.some((b) => Math.abs(b.x - x) < d && Math.abs(b.y - y) < d);
  const cofre = (x, y) => {
    const c = agregarBotin(x, y, 'cofre');
    const arma = botines() < 0.035 ? 'rpg' : pesoArma[Math.floor(botines() * pesoArma.length)];
    agregarBotin(x + 16, y + 4, arma, c.id, true);
    agregarBotin(x - 14, y + 8, pesoCura[Math.floor(botines() * pesoCura.length)], c.id);
    agregarBotin(x + 2, y - 15, 'balas-' + ARMAS[arma].municion, c.id);
    agregarBotin(x - 10, y - 10, ['madera', 'piedra', 'metal'][Math.floor(botines() * 3)], c.id);
    return c;
  };
  for (const c of casas) {
    if (c.tipo === 'contenedor' || c.tipo === 'estadio') continue;
    const l = LUGARES.find((x) => x.id === c.lugar);
    const libres = pisoDe(c);
    if (!libres.length) continue;
    const n = Math.min(libres.length, Math.round((l?.botin || 2) * (c.w * c.h) / 70) + 1 + Math.floor(botines() * 2));
    for (let k = 0; k < n; k++) {
      const [i, j] = libres[Math.floor(botines() * libres.length)];
      const x = px(i), y = px(j);
      if (!ocupado(x, y)) agregarBotin(x, y, algo());
    }
  }
  // cofres: muchos en el Queque, algunos en cada lugar (casi siempre adentro de un edificio)
  for (const l of LUGARES) {
    const cuantos = l.id === 'queque' ? 9 : l.id === 'kiwi' || l.id === 'vasquito' ? 3 : 4;
    const adentro = casas.filter((c) => c.lugar === l.id && c.tipo === 'casa').flatMap((c) => pisoDe(c));
    const afuera = [];
    for (let j = l.y + 2; j < l.y + l.h - 2; j++) for (let i = l.x + 2; i < l.x + l.w - 2; i++) if ([T.PLAZA, T.PASTO, T.TIERRA].includes(t[idx(i, j)]) && !obstaculos.some((o) => Math.hypot(o.x - px(i), o.y - px(j)) < o.r + 14)) afuera.push([i, j]);
    let puestos = 0;
    for (let k = 0; k < 80 && puestos < cuantos; k++) {
      const lista = adentro.length && k % 4 !== 3 ? adentro : afuera;
      if (!lista.length) continue;
      const [i, j] = lista[Math.floor(botines() * lista.length)];
      const x = px(i), y = px(j);
      if (botin.some((b) => b.tipo === 'cofre' && Math.hypot(b.x - x, b.y - y) < 90) || ocupado(x, y, 30)) continue;
      cofre(x, y); puestos++;
    }
  }
  // Fuera de las zonas pobladas hay caminos y cobertura, pero las provisiones se buscan en los lugares.
  for (const l of LUGARES) {
    let puestos = 0;
    for (let k = 0; k < 120 && puestos < 5 + l.botin * 2; k++) {
      const x = l.x + 2 + Math.floor(botines() * (l.w - 4));
      const y = l.y + 2 + Math.floor(botines() * (l.h - 4));
      if (![T.PASTO, T.CAMINO, T.TIERRA, T.PLAZA].includes(t[idx(x, y)])) continue;
      const bx = px(x), by = px(y);
      if (ocupado(bx, by, 32) || obstaculos.some((o) => Math.hypot(o.x - bx, o.y - by) < o.r + 9)) continue;
      agregarBotin(bx, by, botines() < 0.5 ? ['balas-livianas', 'balas-medianas', 'balas-cartuchos', 'balas-pesadas', 'balas-livianas', 'balas-medianas'][Math.floor(botines() * 6)] : algo());
      puestos++;
    }
  }
  // lugares de salida (para el principio y las pruebas)
  const salidas = [];
  for (let k = 0; k < 5000 && salidas.length < 24; k++) {
    const x = 6 + Math.floor(terreno() * (TAM - 12)), y = 6 + Math.floor(terreno() * (TAM - 12));
    if (t[idx(x, y)] !== T.PASTO && t[idx(x, y)] !== T.CAMINO) continue;
    const sx = px(x), sy = px(y);
    if (obstaculos.some((o) => Math.hypot(o.x - sx, o.y - sy) < o.r + 10)) continue;
    if (salidas.some((s) => Math.hypot(s.x - sx, s.y - sy) < 170)) continue;
    salidas.push({ x: sx, y: sy });
  }
  const m = { semilla, t, casas, alturas, obstaculos, decoraciones, botin, salidas, lugares: LUGARES, rio };
  cache.set(semilla, m);
  return m;
}

export const tipoEn = (m, px, py) => {
  const x = Math.floor(px / BALDOSA);
  const y = Math.floor(py / BALDOSA);
  if (x < 0 || y < 0 || x >= TAM || y >= TAM) return T.AGUA;
  return m.t[y * TAM + x];
};

// Mueve un círculo (x, y, radio) evitando paredes y obstáculos. Devuelve la posición nueva.
export function moverCirculo(m, x, y, dx, dy, radio) {
  let nx = Math.max(radio, Math.min(LADO - radio, x + dx));
  let ny = Math.max(radio, Math.min(LADO - radio, y + dy));
  // paredes (baldosas sólidas): se empuja afuera del rectángulo más cercano
  for (let pasada = 0; pasada < 2; pasada++) {
    const x0 = Math.floor((nx - radio) / BALDOSA);
    const x1 = Math.floor((nx + radio) / BALDOSA);
    const y0 = Math.floor((ny - radio) / BALDOSA);
    const y1 = Math.floor((ny + radio) / BALDOSA);
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      if (i < 0 || j < 0 || i >= TAM || j >= TAM || !SOLIDO(m.t[j * TAM + i])) continue;
      const cx = Math.max(i * BALDOSA, Math.min(nx, (i + 1) * BALDOSA));
      const cy = Math.max(j * BALDOSA, Math.min(ny, (j + 1) * BALDOSA));
      const ddx = nx - cx;
      const ddy = ny - cy;
      const d = Math.hypot(ddx, ddy);
      if (d < radio) {
        if (d < 1e-4) {
          ny += radio;
          continue;
        }
        nx = cx + (ddx / d) * radio;
        ny = cy + (ddy / d) * radio;
      }
    }
  }
  for (const o of m.obstaculos) {
    if (o.roto) continue;
    const ddx = nx - o.x;
    const ddy = ny - o.y;
    if (Math.abs(ddx) > 30 || Math.abs(ddy) > 30) continue;
    const d = Math.hypot(ddx, ddy);
    const min = o.r + radio;
    if (d < min && d > 1e-4) {
      nx = o.x + (ddx / d) * min;
      ny = o.y + (ddy / d) * min;
    }
  }
  for (const p of m.construcciones || []) {
    if (p.vida <= 0 || p.tipo !== 'pared') continue;
    const ancho = p.rotacion % 2 ? 3 : 16, alto = p.rotacion % 2 ? 16 : 3;
    const cx = Math.max(p.x - ancho, Math.min(nx, p.x + ancho));
    const cy = Math.max(p.y - alto, Math.min(ny, p.y + alto));
    const dx = nx - cx, dy = ny - cy, d = Math.hypot(dx, dy);
    if (d < radio) {
      if (d > 0.001) { nx = cx + dx / d * radio; ny = cy + dy / d * radio; }
      else ny += radio;
    }
  }
  return { x: nx, y: ny };
}

// ¿Una bala que va de (x0,y0) a (x1,y1) choca con algo del mapa? Devuelve la fracción (0..1) o null.
export function choqueBala(m, x0, y0, x1, y1, altura = 0) {
  const largo = Math.hypot(x1 - x0, y1 - y0);
  const pasos = Math.max(1, Math.ceil(largo / 4));
  for (let k = 1; k <= pasos; k++) {
    const f = k / pasos;
    const x = x0 + (x1 - x0) * f;
    const y = y0 + (y1 - y0) * f;
    if (SOLIDO(tipoEn(m, x, y))) return f;
    if (altura < 1 && (m.construcciones || []).some(p => p.vida > 0 && p.tipo === 'pared' && Math.abs(p.x - x) < (p.rotacion % 2 ? 4 : 17) && Math.abs(p.y - y) < (p.rotacion % 2 ? 17 : 4))) return f;
  }
  for (const o of m.obstaculos) {
    if (o.roto) continue;
    // distancia del centro del obstáculo al segmento
    const vx = x1 - x0;
    const vy = y1 - y0;
    const l2 = vx * vx + vy * vy || 1;
    const f = Math.max(0, Math.min(1, ((o.x - x0) * vx + (o.y - y0) * vy) / l2));
    if (Math.hypot(x0 + vx * f - o.x, y0 + vy * f - o.y) < o.r * (o.tipo === 'arbol' ? 0.9 : 1)) return f;
  }
  return null;
}

// ¿Se ven? (para los bots)
export const seVen = (m, a, b) => choqueBala(m, a.x, a.y, b.x, b.y) === null;

// La zona: un círculo que se achica por etapas. Afuera, el gas lastima.
// Devuelve { x, y, r, siguiente: {x,y,r}, dano, etapa, cierra (s hasta que empiece a cerrar o termine) }
const ETAPAS = [
  { espera: 50, cierre: 25, frac: 0.62, dano: 2 },
  { espera: 35, cierre: 20, frac: 0.55, dano: 4 },
  { espera: 30, cierre: 18, frac: 0.5, dano: 6 },
  { espera: 25, cierre: 15, frac: 0.45, dano: 9 },
  { espera: 20, cierre: 15, frac: 0.0, dano: 14 },
];
const cacheZ = new Map();
function circulos(semilla) {
  if (cacheZ.has(semilla)) return cacheZ.get(semilla);
  const r = rng(semilla ^ 0x2a4e);
  const lista = [{ x: LADO / 2, y: LADO / 2, r: LADO * 0.75 }];
  for (const e of ETAPAS) {
    const prev = lista[lista.length - 1];
    const nr = prev.r * e.frac;
    const ang = r() * Math.PI * 2;
    const mov = (prev.r - nr) * r() * 0.85;
    let x = prev.x + Math.cos(ang) * mov;
    let y = prev.y + Math.sin(ang) * mov;
    x = Math.max(LADO * 0.25, Math.min(LADO * 0.75, x));
    y = Math.max(LADO * 0.25, Math.min(LADO * 0.75, y));
    lista.push({ x, y, r: Math.max(nr, e.frac ? 30 : 0) });
  }
  cacheZ.set(semilla, lista);
  return lista;
}
export function zona(semilla, t) {
  const cs = circulos(semilla);
  let t0 = 0;
  for (let i = 0; i < ETAPAS.length; i++) {
    const e = ETAPAS[i];
    const a = cs[i];
    const b = cs[i + 1];
    if (t < t0 + e.espera) return { ...a, siguiente: b, dano: i === 0 ? 1 : ETAPAS[i - 1].dano, etapa: i, cerrando: false, falta: t0 + e.espera - t };
    if (t < t0 + e.espera + e.cierre) {
      const k = (t - t0 - e.espera) / e.cierre;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, r: a.r + (b.r - a.r) * k, siguiente: b, dano: e.dano, etapa: i, cerrando: true, falta: t0 + e.espera + e.cierre - t };
    }
    t0 += e.espera + e.cierre;
  }
  const f = cs[cs.length - 1];
  return { ...f, siguiente: f, dano: ETAPAS[ETAPAS.length - 1].dano + 6, etapa: ETAPAS.length, cerrando: false, falta: 0 };
}
export const DURACION_MAX = ETAPAS.reduce((a, e) => a + e.espera + e.cierre, 0) + 60;
