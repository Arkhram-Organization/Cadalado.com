// Mundo de Battle Shmitz: geografía fija, botín y zona por semilla.
// Unidades: píxeles del juego (1 baldosa = 16 px). El mapa mide TAM x TAM baldosas.
export const BALDOSA = 16;
export const TAM = 160;
export const LADO = TAM * BALDOSA; // 2560 px
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
  pistola: { nombre: 'Pistola', dano: 24, cadencia: .4, cargador: 12, recarga: 1.4, vel: 520, dispersion: .05, alcance: 340, perdigones: 1, municion: 'livianas', color: '#c9c9c9' },
  subfusil: { nombre: 'Subfusil', dano: 14, cadencia: 1 / 7, cargador: 30, recarga: 1.9, vel: 560, dispersion: .12, alcance: 320, perdigones: 1, municion: 'livianas', color: '#7aa2ff' },
  escopeta: { nombre: 'Escopeta', dano: 11, cadencia: 1.1, cargador: 5, recarga: 2.2, vel: 480, dispersion: .28, alcance: 170, perdigones: 8, municion: 'cartuchos', color: '#ff7a45' },
  rifle: { nombre: 'Rifle de asalto', dano: 30, cadencia: .25, cargador: 30, recarga: 2.1, vel: 820, dispersion: .025, alcance: 620, perdigones: 1, municion: 'medianas', color: '#c084fc' },
  francotirador: { nombre: 'Francotirador', dano: 100, cadencia: 2.8, cargador: 1, recarga: 2.8, vel: 1500, dispersion: .003, alcance: 1000, perdigones: 1, municion: 'pesadas', color: '#9d8af2' },
  rpg: { nombre: 'Lanzacohetes', dano: 70, cadencia: 3, cargador: 1, recarga: 3, vel: 210, dispersion: .012, alcance: 520, perdigones: 1, municion: 'cohetes', color: '#e5ab55' },
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

// Los rectángulos no se pisan. Coordenadas en baldosas; la geografía no depende de la semilla.
export const LUGARES = Object.freeze([
  { id: 'queque', nombre: 'El reino del Queque', corto: 'Queque', x: 65, y: 64, w: 30, h: 30, estilo: 'ciudad', botin: 5 },
  { id: 'asman', nombre: 'El despacho de Asman', corto: 'Asman', x: 107, y: 43, w: 22, h: 22, estilo: 'oficinas', botin: 3 },
  { id: 'angeles', nombre: 'Ángeles angieados', corto: 'Ángeles', x: 27, y: 43, w: 27, h: 24, estilo: 'barrio', botin: 3 },
  { id: 'kiwi', nombre: 'Kiwi', corto: 'Kiwi', x: 33, y: 109, w: 27, h: 24, estilo: 'granja', botin: 2 },
  { id: 'fondeana', nombre: 'Ciudad Fondeana', corto: 'Fondeana', x: 112, y: 105, w: 28, h: 23, estilo: 'puerto', botin: 3 },
  { id: 'templo', nombre: 'El templo', corto: 'Templo', x: 68, y: 24, w: 24, h: 22, estilo: 'templo', botin: 3 },
  { id: 'macabies', nombre: 'Macabíes macabros', corto: 'Macabíes', x: 73, y: 116, w: 29, h: 25, estilo: 'estadio', botin: 3 },
  { id: 'vasquito', nombre: 'El Vasquito', corto: 'Vasquito', x: 17, y: 80, w: 23, h: 20, estilo: 'ruta', botin: 2 },
]);
export function lugarEn(px, py) {
  const x = px / BALDOSA, y = py / BALDOSA;
  return LUGARES.find(l => x >= l.x && y >= l.y && x < l.x + l.w && y < l.y + l.h) || null;
}

const cache = new Map();
export function generarMapa(semilla) {
  if (cache.has(semilla)) return cache.get(semilla);
  const terreno = rng(0x5b17cafe);
  const botines = rng(semilla ^ 0x15a1a);
  const costa = ruido(terreno, 12);
  const t = new Uint8Array(TAM * TAM);
  const idx = (x, y) => y * TAM + x;
  for (let y = 0; y < TAM; y++) for (let x = 0; x < TAM; x++) {
    const ang = Math.atan2(y - 80, x - 80);
    const radio = 71 + 4 * Math.sin(5 * ang) + 2 * Math.cos(9 * ang) + (costa(x / TAM, y / TAM) - .5) * 5;
    const d = Math.hypot(x - 80, y - 80);
    t[idx(x, y)] = d > radio ? T.AGUA : d > radio - 4 ? T.ARENA : T.PASTO;
  }
  // Caminos anchos desde la ciudad central. Se dibujan antes de las construcciones.
  const pintarCamino = (ax, ay, bx, by) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
    for (let k = 0; k <= n; k++) {
      const x = Math.round(ax + (bx - ax) * k / n), y = Math.round(ay + (by - ay) * k / n);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const xx = x + i, yy = y + j;
        if (xx >= 0 && yy >= 0 && xx < TAM && yy < TAM && t[idx(xx, yy)] === T.PASTO) t[idx(xx, yy)] = T.CAMINO;
      }
    }
  };
  for (const l of LUGARES.slice(1)) pintarCamino(80, 79, l.x + l.w / 2, l.y + l.h / 2);
  pintarCamino(20, 90, 135, 114);
  const casas = [];
  const alturas = new Uint8Array(TAM * TAM);
  const casa = (l, x, y, w, h, color, altura = 1) => {
    if (x < 2 || y < 2 || x + w >= TAM - 2 || y + h >= TAM - 2) return;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const borde = i === x || j === y || i === x + w - 1 || j === y + h - 1;
      t[idx(i, j)] = borde ? T.PARED : T.PISO;
      alturas[idx(i, j)] = altura;
    }
    // Dos puertas enfrentadas mantienen comunicados los interiores y el resto de la isla.
    const puerta = x + Math.floor(w / 2);
    t[idx(puerta, y)] = T.PISO;
    t[idx(puerta, y + h - 1)] = T.PISO;
    casas.push({ x, y, w, h, color, altura, lugar: l.id });
  };
  for (const l of LUGARES) {
    for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++) {
      if (t[idx(x, y)] === T.PASTO) t[idx(x, y)] = l.estilo === 'templo' || l.estilo === 'ciudad' || l.estilo === 'oficinas' ? T.PISO : T.CAMINO;
    }
    if (l.id === 'templo') {
      casa(l, l.x + 5, l.y + 5, 14, 10, '#d6c5a3', 2);
    } else if (l.id === 'macabies') {
      casa(l, l.x + 4, l.y + 5, 21, 13, '#665965', 2);
      for (let yy = l.y + 6; yy < l.y + 17; yy++) for (let xx = l.x + 5; xx < l.x + 24; xx++) if (t[idx(xx,yy)] === T.PISO) t[idx(xx,yy)] = T.PASTO;
    } else if (l.id === 'vasquito') {
      casa(l, l.x + 6, l.y + 5, 10, 8, '#ab7051');
    } else {
      const paso = l.id === 'queque' ? 9 : l.id === 'kiwi' ? 12 : 10;
      const ancho = l.id === 'kiwi' ? 9 : l.id === 'queque' ? 7 : 7;
      const alto = l.id === 'kiwi' ? 7 : 6;
      for (let y = l.y + 2; y + alto < l.y + l.h - 1; y += paso)
        for (let x = l.x + 2; x + ancho < l.x + l.w - 1; x += paso) {
          const colores = { ciudad: '#9b8170', oficinas: '#708ba0', barrio: '#b57b62', granja: '#aa8655', puerto: '#7f9192' };
          casa(l, x, y, ancho, alto, colores[l.estilo], l.id === 'queque' ? 2 + (casas.length % 3) : l.id === 'asman' ? 3 : 1);
        }
    }
  }
  // El puerto tiene muelles que llegan al mar; la huerta y el templo tienen siluetas propias.
  for (let x = 137; x <= 153; x++) for (const y of [111, 119]) t[idx(x,y)] = T.CAMINO;
  const decoraciones = [];
  const templo = LUGARES.find(l => l.id === 'templo');
  for (const x of [templo.x + 2, templo.x + 21]) for (let y = templo.y + 3; y < templo.y + 19; y += 4) decoraciones.push({tipo:'columna',x:(x+.5)*BALDOSA,y:(y+.5)*BALDOSA});
  const kiwi = LUGARES.find(l => l.id === 'kiwi');
  for (let y = kiwi.y + 4; y < kiwi.y + 20; y += 4) for (let x = kiwi.x + 3; x < kiwi.x + 23; x += 3) if (t[idx(x,y)] !== T.PARED) decoraciones.push({tipo:'cultivo',x:(x+.5)*BALDOSA,y:(y+.5)*BALDOSA});
  const obstaculos = [];
  for (let k = 0; k < 1800 && obstaculos.length < 370; k++) {
    const x = 5 + Math.floor(terreno() * (TAM - 10));
    const y = 5 + Math.floor(terreno() * (TAM - 10));
    if (t[idx(x, y)] !== T.PASTO || LUGARES.some(l => x >= l.x - 2 && x < l.x + l.w + 2 && y >= l.y - 2 && y < l.y + l.h + 2)) continue;
    const px = (x + .5) * BALDOSA, py = (y + .5) * BALDOSA;
    if (obstaculos.some(o => Math.hypot(o.x - px, o.y - py) < 30)) continue;
    const roca = terreno() < .23;
    obstaculos.push({ id: 'o' + obstaculos.length, x: px, y: py, r: roca ? 7 + terreno() * 3 : 6, tipo: roca ? 'roca' : 'arbol', material: roca ? 'piedra' : 'madera', vida: roca ? 110 : 80, copa: 12 + terreno() * 5, tono: terreno() });
  }
  for (let k = 0; k < 20; k++) {
    const x = 15 + Math.floor(terreno() * 130), y = 15 + Math.floor(terreno() * 130);
    if (t[idx(x, y)] !== T.CAMINO) continue;
    obstaculos.push({ id: 'o' + obstaculos.length, x: (x + .5) * BALDOSA, y: (y + .5) * BALDOSA, r: 9, tipo: 'auto', material: 'metal', vida: 160, tono: terreno() });
  }
  const botin = [];
  const tipos = ['pistola', 'subfusil', 'escopeta', 'rifle', 'francotirador', 'botiquin', 'venda', 'mini', 'escudo', 'granada'];
  const rarezaAleatoria = (mejor = false) => {
    const n = botines();
    if (mejor) return n < .08 ? 'legendaria' : n < .38 ? 'epica' : n < .78 ? 'rara' : 'poco_comun';
    return n < .5 ? 'comun' : n < .78 ? 'poco_comun' : n < .93 ? 'rara' : n < .985 ? 'epica' : 'legendaria';
  };
  const agregarBotin = (x, y, tipo, cofre = null, mejor = false) => {
    const rareza = tipo === 'rpg' ? (botines() < .22 ? 'legendaria' : 'epica') : ARMAS[tipo] ? rarezaAleatoria(mejor) : 'comun';
    const b = { id: botin.length, x, y, tipo, rareza };
    if (cofre !== null) b.cofre = cofre;
    botin.push(b);
    return b;
  };
  for (const c of casas) {
    const l = LUGARES.find(l => l.id === c.lugar);
    const n = l.botin + Math.floor(botines() * 2);
    for (let k = 0; k < n; k++) {
      const x = (c.x + 1.5 + botines() * (c.w - 3)) * BALDOSA;
      const y = (c.y + 1.5 + botines() * (c.h - 3)) * BALDOSA;
      agregarBotin(x, y, tipos[Math.floor(botines() * tipos.length)]);
    }
  }
  for (let k = 0; k < 450 && botin.length < 190; k++) {
    const x = Math.floor(botines() * TAM), y = Math.floor(botines() * TAM);
    if (t[idx(x, y)] !== T.PASTO && t[idx(x, y)] !== T.CAMINO) continue;
    agregarBotin((x + .5) * BALDOSA, (y + .5) * BALDOSA, tipos[Math.floor(botines() * tipos.length)]);
  }
  const salidas = [];
  for (let k = 0; k < 5000 && salidas.length < 24; k++) {
    const x = 6 + Math.floor(terreno() * (TAM - 12));
    const y = 6 + Math.floor(terreno() * (TAM - 12));
    if (t[idx(x, y)] !== T.PASTO && t[idx(x, y)] !== T.CAMINO) continue;
    const px = (x + .5) * BALDOSA, py = (y + .5) * BALDOSA;
    if (obstaculos.some(o => Math.hypot(o.x - px, o.y - py) < o.r + 10)) continue;
    if (salidas.some(s => Math.hypot(s.x - px, s.y - py) < 170)) continue;
    salidas.push({ x: px, y: py });
  }
  for (const s of salidas) for (let i = 0; i < 3; i++) {
    const x = s.x + Math.cos(i * 2.1) * 22, y = s.y + Math.sin(i * 2.1) * 22;
    const tx = Math.floor(x / BALDOSA), ty = Math.floor(y / BALDOSA);
    if (t[idx(tx, ty)] !== T.PASTO && t[idx(tx, ty)] !== T.CAMINO) continue;
    if (obstaculos.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 6)) continue;
    agregarBotin(x, y, ['mini', 'venda', 'granada'][i]);
  }
  // Los cofres y su contenido ya tienen ids fijos; el contenido se ve al abrirlos.
  for (const l of LUGARES) for (let i = 0; i < (l.id === 'queque' ? 7 : 2); i++) {
    const libres = [];
    for (let yy = l.y + 2; yy < l.y + l.h - 2; yy++) for (let xx = l.x + 2; xx < l.x + l.w - 2; xx++) if (!SOLIDO(t[idx(xx, yy)])) libres.push([xx, yy]);
    const [tx, ty] = libres[Math.floor((i + .5) * libres.length / (l.id === 'queque' ? 7 : 2))];
    const x = (tx + .5) * BALDOSA, y = (ty + .5) * BALDOSA;
    const cofre = agregarBotin(x, y, 'cofre');
    const arma = botines() < .1 ? 'rpg' : tipos[Math.floor(botines() * 5)];
    agregarBotin(x + 14, y, arma, cofre.id, true);
    agregarBotin(x - 12, y + 9, botines() < .5 ? 'botiquin' : 'escudo', cofre.id);
    const municion = ARMAS[arma].municion;
    agregarBotin(x, y - 15, 'balas-' + municion, cofre.id);
    agregarBotin(x + 12, y + 14, ['madera', 'piedra', 'metal'][i % 3], cofre.id);
  }
  for (let i = 0; i < 95; i++) {
    const x = 8 + Math.floor(botines() * (TAM - 16)), y = 8 + Math.floor(botines() * (TAM - 16));
    if (t[idx(x, y)] !== T.PASTO && t[idx(x, y)] !== T.CAMINO) continue;
    agregarBotin((x + .5) * BALDOSA, (y + .5) * BALDOSA, ['balas-livianas', 'balas-medianas', 'balas-cartuchos', 'balas-pesadas', 'balas-cohetes'][Math.floor(botines() * 5)]);
  }
  const m = { semilla, t, casas, alturas, obstaculos, decoraciones, botin, salidas, lugares: LUGARES };
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
