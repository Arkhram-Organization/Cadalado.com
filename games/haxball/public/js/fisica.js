// Física del haxball, igual a la del HaxBall original: discos (jugadores y pelota) con masa y rebote,
// estadios con planos, segmentos (redes curvas), postes, y el saque con barrera en el medio.
// Pura (sin navegador): la usa el anfitrión para simular, y los tests. Paso fijo de 1/60 s.

export const JUG = { radio: 15, rebote: 0.5, invMasa: 0.5, freno: 0.96, acel: 0.1, acelPateando: 0.07, frenoPateando: 0.96, patada: 5 };
export const PEL = { radio: 10, rebote: 0.5, invMasa: 1, freno: 0.99 };
export const R_JUG = JUG.radio;
export const R_PEL = PEL.radio;
export const COLOR = { rojo: '#E56E56', azul: '#5689E5' };

export const ESTADIOS = [
  { id: 'classic', nombre: 'Classic', ancho: 420, alto: 200, campoW: 370, campoH: 170, arco: 64, saque: 75, esquina: 0 },
  { id: 'easy', nombre: 'Easy', ancho: 420, alto: 200, campoW: 370, campoH: 170, arco: 90, saque: 75, esquina: 0 },
  { id: 'small', nombre: 'Small', ancho: 420, alto: 200, campoW: 320, campoH: 130, arco: 55, saque: 70, esquina: 0 },
  { id: 'big', nombre: 'Big', ancho: 600, alto: 270, campoW: 550, campoH: 240, arco: 80, saque: 80, esquina: 0 },
  { id: 'rounded', nombre: 'Rounded', ancho: 420, alto: 200, campoW: 370, campoH: 170, arco: 64, saque: 75, esquina: 75 },
  { id: 'bigEasy', nombre: 'Big Easy', ancho: 600, alto: 270, campoW: 550, campoH: 240, arco: 95, saque: 80, esquina: 0 },
  { id: 'bigRounded', nombre: 'Big Rounded', ancho: 600, alto: 270, campoW: 550, campoH: 240, arco: 80, saque: 75, esquina: 100 },
  { id: 'huge', nombre: 'Huge', ancho: 750, alto: 350, campoW: 700, campoH: 320, arco: 100, saque: 80, esquina: 0 },
];

// Un arco de círculo se aproxima con tramos rectos (suficiente para chocar y para dibujar).
function arcoTramos(x0, y0, x1, y1, grados, n = 10) {
  const a = (grados * Math.PI) / 180;
  const f = 1 / Math.tan(a / 2);
  const tx = (x1 - x0) / 2, ty = (y1 - y0) / 2;
  const cx = x0 + tx - ty * f, cy = y0 + ty + tx * f;
  const r = Math.hypot(x0 - cx, y0 - cy);
  let a0 = Math.atan2(y0 - cy, x0 - cx), a1 = Math.atan2(y1 - cy, x1 - cx);
  let d = a1 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = a0 + (d * i) / n; pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
  return pts;
}

const cache = new Map();
export function estadio(id) {
  const e = ESTADIOS.find((x) => x.id === id) || ESTADIOS[0];
  if (cache.has(e.id)) return cache.get(e.id);
  const { ancho, alto, campoW: W, campoH: H, arco: A, esquina: C } = e;
  const est = { ...e, segPelota: [], redes: [], postes: [], dibujo: [], salida: Math.min(0.75 * W, 400) };
  const seg = (pts, lista, vis = true) => { for (let i = 0; i < pts.length - 1; i++) lista.push({ x0: pts[i][0], y0: pts[i][1], x1: pts[i + 1][0], y1: pts[i + 1][1] }); if (vis) est.dibujo.push(pts); };
  // redes de los dos arcos (como HaxBall: curva, fondo recto, curva)
  for (const [x, t, color] of [[W, 1, '#CCCCFF'], [-W, -1, '#FFCCCC']]) {
    const a = [x + 8 * t, -A], s = [x + 8 * t, A], c = [x + 30 * t, -A + 22], f = [x + 30 * t, A - 22];
    seg([...arcoTramos(a[0], a[1], c[0], c[1], 90 * t)], est.redes);
    seg([f, c], est.redes, false); est.dibujo.push([f, c]);
    seg([...arcoTramos(f[0], f[1], s[0], s[1], 90 * t)], est.redes);
    est.postes.push({ x, y: -A, r: 8, color }, { x, y: A, r: 8, color });
  }
  // la pelota no sale de la cancha (salvo por la boca de los arcos)
  seg([[W, -H], [W, -A]], est.segPelota, false); seg([[W, A], [W, H]], est.segPelota, false);
  seg([[-W, H], [-W, A]], est.segPelota, false); seg([[-W, -A], [-W, -H]], est.segPelota, false);
  if (C > 0) {
    seg(arcoTramos(-W + C, -H, -W, -H + C, -90), est.segPelota, false);
    seg(arcoTramos(-W + C, H, -W, H - C, 90), est.segPelota, false);
    seg(arcoTramos(W - C, H, W, H - C, -90), est.segPelota, false);
    seg(arcoTramos(W - C, -H, W, -H + C, 90), est.segPelota, false);
  }
  est.limiteJug = { x: ancho, y: alto };
  cache.set(e.id, est);
  return est;
}

// Mundo: { est, pelota, jug: Map(id → {x,y,vx,vy,equipo,patea,pateo}), saque: 'rojo'|'azul'|null, pausa }
export function nuevoMundo(idEstadio = 'classic') {
  return { est: estadio(idEstadio), pelota: { x: 0, y: 0, vx: 0, vy: 0 }, jug: new Map(), saque: 'rojo', pausa: 0, gol: null };
}

// Salida como HaxBall: cada equipo en su mitad, uno al medio y los demás alternando arriba y abajo.
export function acomodar(mundo, saca = 'rojo') {
  const n = { rojo: 0, azul: 0 };
  const ids = [...mundo.jug.keys()].sort();
  const porColumna = Math.max(1, Math.floor((mundo.est.campoH - R_JUG - 4) / 55)) * 2 + 1;
  for (const id of ids) {
    const j = mundo.jug.get(id);
    const k = n[j.equipo]++;
    // con equipos grandes se arman más columnas hacia atrás (antes los de más quedaban afuera de la cancha)
    const kk = k % porColumna, columna = Math.floor(k / porColumna);
    let r = (kk + 1) >> 1; if (!(kk & 1)) r = -r;
    j.x = Math.min(mundo.est.campoW - R_JUG, mundo.est.salida + columna * 46) * (j.equipo === 'rojo' ? -1 : 1);
    j.y = 55 * r;
    j.vx = j.vy = 0;
  }
  Object.assign(mundo.pelota, { x: 0, y: 0, vx: 0, vy: 0 });
  mundo.saque = saca;
}

// choque disco-disco (HaxBall): reparte la separación por masa y rebota con el producto de los coeficientes
function discos(a, b, ra, rb, ia, ib, ba, bb) {
  const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy, r = ra + rb;
  if (!(d2 > 0 && d2 <= r * r)) return false;
  const im = ia + ib;
  if (im === 0) return false;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ka = ia / im;
  let sol = r - d;
  const fa = sol * ka;
  a.x += nx * fa; a.y += ny * fa; sol -= fa; b.x -= nx * sol; b.y -= ny * sol;
  let p = nx * (a.vx - b.vx) + ny * (a.vy - b.vy);
  if (p < 0) {
    p *= ba * bb + 1;
    const pa = ka * p;
    a.vx -= nx * pa; a.vy -= ny * pa;
    const pb = p - pa;
    b.vx += nx * pb; b.vy += ny * pb;
  }
  return true;
}
// disco contra un tramo fijo (de los dos lados; las puntas son vértices)
function tramo(d, r, s, rebote) {
  const ex = s.x1 - s.x0, ey = s.y1 - s.y0, l2 = ex * ex + ey * ey;
  let t = l2 ? ((d.x - s.x0) * ex + (d.y - s.y0) * ey) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = s.x0 + ex * t, py = s.y0 + ey * t, dx = d.x - px, dy = d.y - py, dist = Math.hypot(dx, dy);
  if (dist >= r || dist === 0) return;
  const nx = dx / dist, ny = dy / dist;
  d.x += nx * (r - dist); d.y += ny * (r - dist);
  const v = d.vx * nx + d.vy * ny;
  if (v < 0) { d.vx -= nx * v * (1 + rebote); d.vy -= ny * v * (1 + rebote); }
}
function planos(d, r, lx, ly, rebote) {
  if (d.x - r < -lx) { d.x = -lx + r; if (d.vx < 0) d.vx = -d.vx * rebote; }
  if (d.x + r > lx) { d.x = lx - r; if (d.vx > 0) d.vx = -d.vx * rebote; }
  if (d.y - r < -ly) { d.y = -ly + r; if (d.vy < 0) d.vy = -d.vy * rebote; }
  if (d.y + r > ly) { d.y = ly - r; if (d.vy > 0) d.vy = -d.vy * rebote; }
}

// entradas: Map(id → { x, y, patea }) con x,y en -1..1. Devuelve 'rojo' | 'azul' si alguien hizo un gol.
export function paso(mundo, entradas) {
  const p = mundo.pelota, est = mundo.est;
  const js = [...mundo.jug.entries()];
  for (const [id, j] of js) {
    const e = entradas.get(id) || { x: 0, y: 0, patea: false };
    let ix = Math.sign(e.x || 0) * Math.min(1, Math.abs(e.x || 0)), iy = Math.sign(e.y || 0) * Math.min(1, Math.abs(e.y || 0));
    const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
    const ac = e.patea ? JUG.acelPateando : JUG.acel;
    j.vx += ix * ac; j.vy += iy * ac;
    j.patea = !!e.patea;
    // patada: una por apretada, si la pelota está a menos de 4 del borde
    if (e.patea && !j.pateo) {
      const dx = p.x - j.x, dy = p.y - j.y, d = Math.hypot(dx, dy);
      if (d - R_JUG - R_PEL < 4) {
        p.vx += (dx / d) * JUG.patada * PEL.invMasa; p.vy += (dy / d) * JUG.patada * PEL.invMasa;
        j.pateo = true; mundo.ultimoToque = id;
        if (mundo.saque) mundo.saque = null;
      }
    }
    if (!e.patea) j.pateo = false;
  }
  // mover y frenar
  for (const [, j] of js) { j.x += j.vx; j.y += j.vy; const f = j.patea ? JUG.frenoPateando : JUG.freno; j.vx *= f; j.vy *= f; }
  p.x += p.vx; p.y += p.vy; p.vx *= PEL.freno; p.vy *= PEL.freno;
  // choques entre discos
  for (let i = 0; i < js.length; i++) {
    for (let k = i + 1; k < js.length; k++) discos(js[i][1], js[k][1], R_JUG, R_JUG, JUG.invMasa, JUG.invMasa, JUG.rebote, JUG.rebote);
    if (discos(js[i][1], p, R_JUG, R_PEL, JUG.invMasa, PEL.invMasa, JUG.rebote, PEL.rebote)) { mundo.ultimoToque = js[i][0]; if (mundo.saque) mundo.saque = null; }
  }
  // postes (masa infinita)
  for (const q of est.postes) {
    const poste = { x: q.x, y: q.y, vx: 0, vy: 0 };
    discos(p, poste, R_PEL, q.r, PEL.invMasa, 0, PEL.rebote, 0.5);
    for (const [, j] of js) discos(j, { x: q.x, y: q.y, vx: 0, vy: 0 }, R_JUG, q.r, JUG.invMasa, 0, JUG.rebote, 0.5);
  }
  // redes (solo la pelota) y bordes de la cancha para la pelota
  for (const s of est.redes) tramo(p, R_PEL, s, PEL.rebote * 0.1);
  for (const s of est.segPelota) tramo(p, R_PEL, s, PEL.rebote * 1);
  // planos de arriba y abajo para la pelota (rebote como las paredes de HaxBall)
  if (p.y - R_PEL < -est.campoH) { p.y = -est.campoH + R_PEL; if (p.vy < 0) p.vy = -p.vy * PEL.rebote; }
  if (p.y + R_PEL > est.campoH) { p.y = est.campoH - R_PEL; if (p.vy > 0) p.vy = -p.vy * PEL.rebote; }
  planos(p, R_PEL, est.ancho, est.alto, 0);
  for (const [, j] of js) {
    planos(j, R_JUG, est.ancho, est.alto, 0);
    // saque: nadie pasa a la otra mitad; el que no saca tampoco entra al círculo
    if (mundo.saque) {
      const lado = j.equipo === 'rojo' ? -1 : 1;
      const dentro = Math.hypot(j.x, j.y) < est.saque + R_JUG;
      if (j.equipo !== mundo.saque) {
        if (dentro) { const d = Math.hypot(j.x, j.y) || 1; j.x = (j.x / d) * (est.saque + R_JUG); j.y = (j.y / d) * (est.saque + R_JUG); }
        if (j.x * lado < R_JUG) { j.x = lado * R_JUG; if (j.vx * lado < 0) j.vx = 0; }
      } else if (!(Math.hypot(j.x, j.y) < est.saque) && j.x * lado < R_JUG) { j.x = lado * R_JUG; if (j.vx * lado < 0) j.vx = 0; }
    }
  }
  // gol: la pelota cruza la línea entre los postes
  if (!mundo.gol && Math.abs(p.y) < est.arco && Math.abs(p.x) > est.campoW) { mundo.gol = p.x < 0 ? 'azul' : 'rojo'; return mundo.gol; }
  return null;
}

// Bot: el más cercano de su equipo va a la pelota y patea hacia el arco rival; el resto se para atrás.
export function pensarBot(mundo, id, t = 0) {
  const j = mundo.jug.get(id), p = mundo.pelota, est = mundo.est;
  if (!j) return { x: 0, y: 0, patea: false };
  const ataque = j.equipo === 'rojo' ? 1 : -1;
  const arcoRival = { x: ataque * (est.campoW + 10), y: 0 }, arcoPropio = { x: -ataque * est.campoW, y: 0 };
  const compas = [...mundo.jug.entries()].filter(([, o]) => o.equipo === j.equipo);
  const dist = (o) => Math.hypot(o.x - p.x, o.y - p.y);
  const yoVoy = compas.sort((a, b) => dist(a[1]) - dist(b[1]))[0]?.[0] === id;
  // en el saque, el que no saca espera
  if (mundo.saque && mundo.saque !== j.equipo) return { x: 0, y: 0, patea: false };
  let tx, ty, patea = false;
  if (yoVoy) {
    const ax = arcoRival.x - p.x, ay = arcoRival.y - p.y, al = Math.hypot(ax, ay) || 1;
    const bx = p.x - (ax / al) * (R_JUG + R_PEL + 6), by = p.y - (ay / al) * (R_JUG + R_PEL + 6);
    const detras = ((j.x - p.x) * ax + (j.y - p.y) * ay) / al < 0;
    if (detras) { tx = p.x; ty = p.y; } else { tx = bx; ty = by + (j.y < p.y ? -24 : 24); }
    patea = dist(j) < R_JUG + R_PEL + 3 && detras && (al < est.campoW * 0.9 || Math.sin(t * 7 + id.length) > 0.6);
  } else {
    // Los demás no se amontonan: cada uno cubre su zona (arquero, defensa, medio, ataque) y acompaña la jugada.
    const resto = compas.map(([cid]) => cid).filter((cid) => cid !== compas[0]?.[0] && cid.startsWith('bot')).sort();
    const k = Math.max(0, resto.indexOf(id)), m = resto.length;
    if (m <= 1) { tx = arcoPropio.x * 0.55 + p.x * 0.45; ty = p.y * 0.6; }
    else if (k === 0) {
      // arquero: se mueve sobre la línea, siguiendo la pelota
      tx = -ataque * (est.campoW - 26); ty = Math.max(-est.arco, Math.min(est.arco, p.y * 0.7));
    } else {
      const filas = Math.ceil((m - 1) / 3), fila = Math.floor((k - 1) / 3), enFila = Math.min(3, m - 1 - fila * 3), col = (k - 1) % 3;
      // de la defensa (cerca del arco propio) al ataque (campo rival)
      const fondo = filas > 1 ? fila / (filas - 1) : 0.4;
      const baseX = -ataque * est.campoW * (0.62 - fondo * 0.95);
      const baseY = enFila === 1 ? 0 : (col / (enFila - 1) - 0.5) * est.campoH * 1.25;
      tx = baseX + (p.x - baseX) * 0.28; ty = baseY + (p.y - baseY) * 0.32;
      // el que queda cerca de la pelota en su zona también la va a buscar
      if (dist(j) < 70 && !mundo.saque) { tx = p.x - ataque * 14; ty = p.y; patea = dist(j) < R_JUG + R_PEL + 3 && (j.x - p.x) * ataque < 0; }
    }
  }
  const dx = tx - j.x, dy = ty - j.y, d = Math.hypot(dx, dy);
  return d < 3 ? { x: 0, y: 0, patea } : { x: dx / d, y: dy / d, patea };
}

// Estado compacto para la red (enteros por décimas). extra: datos sueltos (saque, gol…).
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
