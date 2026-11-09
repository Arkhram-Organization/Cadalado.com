// Física del haxball: discos que chocan (jugadores y pelota), paredes, arcos con postes, patadas y goles.
// Pura (sin navegador): la usa el anfitrión para simular, y los tests. Paso fijo de 1/60 s.

export const CANCHA = { ancho: 760, alto: 360, arco: 140, fondo: 34, borde: 46 };
export const R_JUG = 16;
export const R_PEL = 10;
const ACEL = 0.11, ACEL_PATEANDO = 0.075, FRENO_JUG = 0.96, FRENO_PEL = 0.99;
const FUERZA_PATADA = 5.6, REBOTE_PARED = 0.5, REBOTE_DISCO = 0.5;
const M = { jug: 1, pel: 1 / 0.6 }; // inversa de la masa: la pelota es más liviana

const W = CANCHA.ancho / 2, H = CANCHA.alto / 2, A = CANCHA.arco / 2;
export const POSTES = [[-W, -A], [-W, A], [W, -A], [W, A]];

// Mundo: { pelota: {x,y,vx,vy}, jug: Map(id → {x,y,vx,vy,equipo,patea,pateo}) }
export function nuevoMundo() {
  return { pelota: { x: 0, y: 0, vx: 0, vy: 0 }, jug: new Map(), pausa: 0 };
}

// Formación de salida: cada equipo en su mitad, repartidos en dos líneas.
export function acomodar(mundo, saca = 'rojo') {
  const por = { rojo: [], azul: [] };
  for (const [id, j] of mundo.jug) if (por[j.equipo]) por[j.equipo].push(id);
  for (const eq of ['rojo', 'azul']) {
    const lado = eq === 'rojo' ? -1 : 1;
    por[eq].sort().forEach((id, i, l) => {
      const j = mundo.jug.get(id);
      const fila = i % 2, n = l.length;
      j.x = lado * (fila ? 260 : 120 + (eq === saca ? 0 : 30));
      j.y = n === 1 ? 0 : (i - (n - 1) / 2) * (H * 1.5 / Math.max(1, n - 1));
      j.vx = j.vy = 0;
    });
  }
  Object.assign(mundo.pelota, { x: 0, y: 0, vx: 0, vy: 0 });
}

function chocarDiscos(a, ra, ma, b, rb, mb) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = ra + rb;
  if (d >= min || d === 0) return;
  const nx = dx / d, ny = dy / d, solap = min - d, mt = ma + mb;
  a.x -= nx * solap * (ma / mt); a.y -= ny * solap * (ma / mt);
  b.x += nx * solap * (mb / mt); b.y += ny * solap * (mb / mt);
  const vrel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vrel > 0) return;
  const j = -(1 + REBOTE_DISCO) * vrel / mt;
  a.vx -= j * ma * nx; a.vy -= j * ma * ny;
  b.vx += j * mb * nx; b.vy += j * mb * ny;
}

// Pelota contra los bordes de la cancha (con la boca de los arcos abierta) y contra el fondo de los arcos.
function paredesPelota(p) {
  const enBoca = Math.abs(p.y) < A - 2;
  if (!enBoca || Math.abs(p.x) < W) {
    if (p.y - R_PEL < -H) { p.y = -H + R_PEL; p.vy = -p.vy * REBOTE_PARED; }
    if (p.y + R_PEL > H) { p.y = H - R_PEL; p.vy = -p.vy * REBOTE_PARED; }
  }
  if (!enBoca) {
    if (p.x - R_PEL < -W) { p.x = -W + R_PEL; p.vx = -p.vx * REBOTE_PARED; }
    if (p.x + R_PEL > W) { p.x = W - R_PEL; p.vx = -p.vx * REBOTE_PARED; }
  } else {
    // adentro del arco: techo, piso y fondo de la red
    const fondo = W + CANCHA.fondo;
    if (Math.abs(p.x) > W) {
      if (p.y - R_PEL < -A) { p.y = -A + R_PEL; p.vy = -p.vy * .3; }
      if (p.y + R_PEL > A) { p.y = A - R_PEL; p.vy = -p.vy * .3; }
    }
    if (Math.abs(p.x) + R_PEL > fondo) { p.x = Math.sign(p.x) * (fondo - R_PEL); p.vx = -p.vx * .2; }
  }
}

function paredesJugador(j) {
  const mx = W + CANCHA.borde - R_JUG, my = H + CANCHA.borde - R_JUG;
  if (j.x < -mx) { j.x = -mx; j.vx = 0; } if (j.x > mx) { j.x = mx; j.vx = 0; }
  if (j.y < -my) { j.y = -my; j.vy = 0; } if (j.y > my) { j.y = my; j.vy = 0; }
}

// entradas: Map(id → { x, y, patea }) con x,y en -1..1. Devuelve 'rojo' | 'azul' si alguien hizo un gol.
export function paso(mundo, entradas) {
  const p = mundo.pelota;
  if (mundo.pausa > 0) { mundo.pausa--; return null; }
  for (const [id, j] of mundo.jug) {
    const e = entradas.get(id) || { x: 0, y: 0, patea: false };
    let ix = e.x || 0, iy = e.y || 0;
    const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
    const ac = e.patea ? ACEL_PATEANDO : ACEL;
    j.vx = (j.vx + ix * ac) * FRENO_JUG; j.vy = (j.vy + iy * ac) * FRENO_JUG;
    j.x += j.vx; j.y += j.vy;
    j.patea = !!e.patea;
    // patada: una por apretada, si la pelota está pegada
    if (e.patea && !j.pateo) {
      const dx = p.x - j.x, dy = p.y - j.y, d = Math.hypot(dx, dy);
      if (d < R_JUG + R_PEL + 4) { p.vx += (dx / d) * FUERZA_PATADA; p.vy += (dy / d) * FUERZA_PATADA; j.pateo = true; j.ultimaPatada = Date.now(); mundo.ultimoToque = id; }
    }
    if (!e.patea) j.pateo = false;
  }
  p.vx *= FRENO_PEL; p.vy *= FRENO_PEL; p.x += p.vx; p.y += p.vy;
  // choques
  const js = [...mundo.jug.entries()];
  for (let i = 0; i < js.length; i++) {
    for (let k = i + 1; k < js.length; k++) chocarDiscos(js[i][1], R_JUG, M.jug, js[k][1], R_JUG, M.jug);
    const antes = Math.hypot(p.x - js[i][1].x, p.y - js[i][1].y);
    chocarDiscos(js[i][1], R_JUG, M.jug, p, R_PEL, M.pel);
    if (antes < R_JUG + R_PEL + 0.5) mundo.ultimoToque = js[i][0];
  }
  for (const [px, py] of POSTES) {
    const poste = { x: px, y: py, vx: 0, vy: 0 };
    chocarDiscos(poste, 6, 0, p, R_PEL, 1);
    for (const [, j] of js) chocarDiscos({ x: px, y: py, vx: 0, vy: 0 }, 6, 0, j, R_JUG, 1);
  }
  paredesPelota(p);
  for (const [, j] of js) paredesJugador(j);
  // gol: la pelota cruzó entera la línea, entre los postes
  if (Math.abs(p.y) < A && Math.abs(p.x) > W + R_PEL) return p.x < 0 ? 'azul' : 'rojo';
  return null;
}

// Bot simple: el más cercano de su equipo va a la pelota y patea hacia el arco rival; el resto se para atrás.
export function pensarBot(mundo, id, t = 0) {
  const j = mundo.jug.get(id), p = mundo.pelota;
  if (!j) return { x: 0, y: 0, patea: false };
  const ataque = j.equipo === 'rojo' ? 1 : -1;
  const arcoRival = { x: ataque * (W + 10), y: 0 }, arcoPropio = { x: -ataque * W, y: 0 };
  const compas = [...mundo.jug.entries()].filter(([, o]) => o.equipo === j.equipo);
  const dist = (o) => Math.hypot(o.x - p.x, o.y - p.y);
  const yoVoy = compas.sort((a, b) => dist(a[1]) - dist(b[1]))[0]?.[0] === id;
  let tx, ty, patea = false;
  if (yoVoy) {
    // ponerse detrás de la pelota mirando al arco rival
    const ax = arcoRival.x - p.x, ay = arcoRival.y - p.y, al = Math.hypot(ax, ay) || 1;
    const bx = p.x - (ax / al) * (R_JUG + R_PEL + 6), by = p.y - (ay / al) * (R_JUG + R_PEL + 6);
    const detras = ((j.x - p.x) * ax + (j.y - p.y) * ay) / al < 0;
    if (detras) { tx = p.x; ty = p.y; } else { tx = bx; ty = by + (j.y < p.y ? -24 : 24); }
    const d = dist(j);
    patea = d < R_JUG + R_PEL + 3 && detras && (al < 330 || Math.sin(t * 7 + id.length) > .6);
  } else {
    // defensa: entre la pelota y el arco propio
    tx = arcoPropio.x * .55 + p.x * .45; ty = p.y * .6;
  }
  const dx = tx - j.x, dy = ty - j.y, d = Math.hypot(dx, dy);
  return d < 3 ? { x: 0, y: 0, patea } : { x: dx / d, y: dy / d, patea };
}

// Estado compacto para mandar por la red: pelota y cada jugador (enteros por décimas).
const n1 = (v) => Math.round(v * 10);
export function codificar(mundo, extra = '') {
  const p = mundo.pelota;
  return `M${extra}|${n1(p.x)},${n1(p.y)},${n1(p.vx)},${n1(p.vy)}|` + [...mundo.jug.entries()].map(([id, j]) => `${id}:${n1(j.x)},${n1(j.y)},${n1(j.vx)},${n1(j.vy)},${j.patea ? 1 : 0},${j.equipo[0]}`).join(';');
}
export function decodificar(s) {
  if (!s || s[0] !== 'M') return null;
  const [cab, pel, jugs] = s.split('|');
  const [x, y, vx, vy] = pel.split(',').map((v) => v / 10);
  const jug = new Map();
  for (const t of (jugs || '').split(';')) {
    if (!t) continue;
    const i = t.lastIndexOf(':');
    const [jx, jy, jvx, jvy, k, e] = t.slice(i + 1).split(',');
    jug.set(t.slice(0, i), { x: jx / 10, y: jy / 10, vx: jvx / 10, vy: jvy / 10, patea: k === '1', equipo: e === 'r' ? 'rojo' : 'azul' });
  }
  return { extra: cab.slice(1), pelota: { x, y, vx, vy }, jug };
}
