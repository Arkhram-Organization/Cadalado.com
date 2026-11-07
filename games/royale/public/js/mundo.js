// Mundo de "Último en pie": isla generada con una semilla (todos ven la misma), botín, armas y la zona.
// Unidades: píxeles del juego (1 baldosa = 16 px). El mapa mide TAM x TAM baldosas.
export const BALDOSA = 16;
export const TAM = 96;
export const LADO = TAM * BALDOSA; // 1536 px
export const T = { AGUA: 0, ARENA: 1, PASTO: 2, PISO: 3, PARED: 4, CAMINO: 5 };
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
  pistola: { nombre: 'Pistola', dano: 17, cadencia: 0.32, cargador: 12, recarga: 1.1, vel: 520, dispersion: 0.05, alcance: 330, perdigones: 1, color: '#c9c9c9' },
  subfusil: { nombre: 'Subfusil', dano: 10, cadencia: 0.09, cargador: 30, recarga: 1.6, vel: 560, dispersion: 0.12, alcance: 300, perdigones: 1, color: '#7aa2ff' },
  escopeta: { nombre: 'Escopeta', dano: 9, cadencia: 0.85, cargador: 5, recarga: 2.0, vel: 480, dispersion: 0.28, alcance: 170, perdigones: 7, color: '#ff7a45' },
  rifle: { nombre: 'Rifle', dano: 42, cadencia: 1.05, cargador: 5, recarga: 2.2, vel: 820, dispersion: 0.012, alcance: 620, perdigones: 1, color: '#c084fc' },
};
export const VIDA = 100;
export const ESCUDO_MAX = 50;

// Arma el mapa: baldosas, árboles, rocas, casas y botín. Siempre igual para la misma semilla.
const cache = new Map();
export function generarMapa(semilla) {
  if (cache.has(semilla)) return cache.get(semilla);
  const r = rng(semilla ^ 0x15a1a);
  const n1 = ruido(r, 6);
  const n2 = ruido(r, 14);
  const t = new Uint8Array(TAM * TAM);
  const idx = (x, y) => y * TAM + x;
  // costa: distancia al centro + ruido
  for (let y = 0; y < TAM; y++) for (let x = 0; x < TAM; x++) {
    const dx = x / TAM - 0.5;
    const dy = y / TAM - 0.5;
    const d = Math.hypot(dx, dy) * 2 + (n1(x / TAM, y / TAM) - 0.5) * 0.35 + (n2(x / TAM, y / TAM) - 0.5) * 0.12;
    t[idx(x, y)] = d > 0.92 ? T.AGUA : d > 0.84 ? T.ARENA : T.PASTO;
  }
  // un lago adentro
  const lx = 0.3 + r() * 0.4;
  const ly = 0.3 + r() * 0.4;
  for (let y = 0; y < TAM; y++) for (let x = 0; x < TAM; x++) {
    const d = Math.hypot(x / TAM - lx, (y / TAM - ly) * 1.3) + (n2(x / TAM, y / TAM) - 0.5) * 0.04;
    if (d < 0.05) t[idx(x, y)] = T.AGUA;
    else if (d < 0.065 && t[idx(x, y)] === T.PASTO) t[idx(x, y)] = T.ARENA;
  }
  const libre = (x, y, w, h) => {
    for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) {
      if (i < 0 || j < 0 || i >= TAM || j >= TAM || t[idx(i, j)] !== T.PASTO) return false;
    }
    return true;
  };
  // casas: rectángulo de paredes con una o dos puertas, piso adentro
  const casas = [];
  for (let k = 0; k < 140 && casas.length < 14; k++) {
    const w = 6 + Math.floor(r() * 5);
    const h = 5 + Math.floor(r() * 4);
    const x = 4 + Math.floor(r() * (TAM - w - 8));
    const y = 4 + Math.floor(r() * (TAM - h - 8));
    if (!libre(x, y, w, h) || casas.some((c) => x < c.x + c.w + 4 && c.x < x + w + 4 && y < c.y + c.h + 4 && c.y < y + h + 4)) continue;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const borde = i === x || j === y || i === x + w - 1 || j === y + h - 1;
      t[idx(i, j)] = borde ? T.PARED : T.PISO;
    }
    // puertas
    const puertas = [[x + 1 + Math.floor(r() * (w - 2)), y + h - 1], [x + 1 + Math.floor(r() * (w - 2)), y]];
    puertas.slice(0, r() < 0.5 ? 1 : 2).forEach(([i, j]) => (t[idx(i, j)] = T.PISO));
    // una pared interna con hueco a veces
    if (w >= 9 && r() < 0.6) {
      const ix = x + Math.floor(w / 2);
      const hueco = y + 1 + Math.floor(r() * (h - 2));
      for (let j = y + 1; j < y + h - 1; j++) if (j !== hueco) t[idx(ix, j)] = T.PARED;
    }
    casas.push({ x, y, w, h, color: ['#b5654a', '#8a5a44', '#6a7fa0', '#a07a50', '#7a8a5a'][Math.floor(r() * 5)] });
  }
  // caminos de tierra entre casas
  for (let k = 1; k < casas.length; k++) {
    const a = casas[k - 1];
    const b = casas[k];
    let x = Math.floor(a.x + a.w / 2);
    let y = a.y + a.h + 1;
    const bx = Math.floor(b.x + b.w / 2);
    const by = b.y - 2;
    for (let pasos = 0; pasos < 400 && (x !== bx || y !== by); pasos++) {
      if (x >= 0 && y >= 0 && x < TAM && y < TAM && t[idx(x, y)] === T.PASTO) t[idx(x, y)] = T.CAMINO;
      if (r() < 0.5 && x !== bx) x += Math.sign(bx - x);
      else if (y !== by) y += Math.sign(by - y);
      else x += Math.sign(bx - x);
    }
  }
  // árboles y rocas (obstáculos redondos) sobre pasto
  const obstaculos = [];
  for (let k = 0; k < 900 && obstaculos.length < 230; k++) {
    const x = Math.floor(r() * TAM);
    const y = Math.floor(r() * TAM);
    if (t[idx(x, y)] !== T.PASTO) continue;
    const px = (x + 0.5) * BALDOSA + (r() - 0.5) * 6;
    const py = (y + 0.5) * BALDOSA + (r() - 0.5) * 6;
    if (obstaculos.some((o) => Math.hypot(o.x - px, o.y - py) < 26)) continue;
    const roca = r() < 0.22;
    obstaculos.push({ x: px, y: py, r: roca ? 7 + r() * 3 : 6, tipo: roca ? 'roca' : 'arbol', copa: 12 + r() * 5, tono: r() });
  }
  // botín: en cada casa varias cosas, y algunas sueltas
  const botin = [];
  const tipos = ['pistola', 'subfusil', 'escopeta', 'rifle', 'botiquin', 'botiquin', 'escudo', 'escudo'];
  for (const c of casas) {
    const nItems = 2 + Math.floor(r() * 3);
    for (let k = 0; k < nItems; k++) {
      const x = (c.x + 1.5 + r() * (c.w - 3)) * BALDOSA;
      const y = (c.y + 1.5 + r() * (c.h - 3)) * BALDOSA;
      if (SOLIDO(t[idx(Math.floor(x / BALDOSA), Math.floor(y / BALDOSA))])) continue;
      botin.push({ id: botin.length, x, y, tipo: tipos[Math.floor(r() * tipos.length)] });
    }
  }
  for (let k = 0; k < 400 && botin.length < 90; k++) {
    const x = Math.floor(r() * TAM);
    const y = Math.floor(r() * TAM);
    if (t[idx(x, y)] !== T.PASTO && t[idx(x, y)] !== T.CAMINO) continue;
    botin.push({ id: botin.length, x: (x + 0.5) * BALDOSA, y: (y + 0.5) * BALDOSA, tipo: tipos[Math.floor(r() * tipos.length)] });
  }
  // lugares para aparecer: pasto, lejos entre sí
  const salidas = [];
  for (let k = 0; k < 2000 && salidas.length < 24; k++) {
    const x = 6 + Math.floor(r() * (TAM - 12));
    const y = 6 + Math.floor(r() * (TAM - 12));
    if (t[idx(x, y)] !== T.PASTO) continue;
    const px = (x + 0.5) * BALDOSA;
    const py = (y + 0.5) * BALDOSA;
    if (obstaculos.some((o) => Math.hypot(o.x - px, o.y - py) < o.r + 10)) continue;
    if (salidas.some((s) => Math.hypot(s.x - px, s.y - py) < 180)) continue;
    salidas.push({ x: px, y: py });
  }
  const m = { semilla, t, casas, obstaculos, botin, salidas };
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
  return { x: nx, y: ny };
}

// ¿Una bala que va de (x0,y0) a (x1,y1) choca con algo del mapa? Devuelve la fracción (0..1) o null.
export function choqueBala(m, x0, y0, x1, y1) {
  const largo = Math.hypot(x1 - x0, y1 - y0);
  const pasos = Math.max(1, Math.ceil(largo / 4));
  for (let k = 1; k <= pasos; k++) {
    const f = k / pasos;
    const x = x0 + (x1 - x0) * f;
    const y = y0 + (y1 - y0) * f;
    if (SOLIDO(tipoEn(m, x, y))) return f;
  }
  for (const o of m.obstaculos) {
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
