// Motor de Empujón: todos contra todos arriba de una plataforma flotando sobre la ciudad. Puro (sin navegador):
// lo corre la compu en el modo local o el anfitrión online, 60 veces por segundo, y lo usan los tests.
// El piso es el plano x-z (y es la altura). Te movés, empujás (mantener = más fuerte), agarrás y revoleás, y saltás.
// Tirar a alguien da un punto y te hace crecer; el que va primero lleva la corona (tirarlo vale doble).
// Caer no te saca: volvés a entrar. Al final la plataforma se achica.
// Modos: 'todos' (cada uno para sí) o 'equipos' (rojo contra azul, de 1v1 a 4v4: a los compañeros no se los
// empuja ni se los agarra, y cada uno que tirás suma para tu equipo).
export const PASO = 1 / 60;
export const MAPAS = {
  terraza: { nombre: 'La Terraza', forma: 'rect', ancho: 22, largo: 14 },
  plato: { nombre: 'El Plato', forma: 'circulo', radio: 9 },
  puente: { nombre: 'El Puente', forma: 'rect', ancho: 30, largo: 7.5 },
};
export const OBJETOS = ['guante', 'banana', 'bomba'];
export const ESTADOS = ['quieto', 'corre', 'carga', 'empuja', 'agarra', 'agarrado', 'aturdido', 'salta', 'cae', 'fuera', 'festeja', 'triste', 'resbala'];
export const BOTONES = ['empujar', 'agarrar', 'salto'];
// Nivel de los bots: qué tan rápido reaccionan, cuánto cuidan el borde, cuánto apuntan para tirarte afuera y cuánto agarran.
export const NIVELES = [
  { nombre: 'Fácil', reaccion: .45, borde: .4, apunte: .4, agarra: .05, carga: .2, esquiva: 0, vel: .82 },
  { nombre: 'Normal', reaccion: .25, borde: .7, apunte: .7, agarra: .12, carga: .45, esquiva: .15, vel: .93 },
  { nombre: 'Difícil', reaccion: .13, borde: .9, apunte: .88, agarra: .2, carga: .7, esquiva: .35, vel: 1 },
  { nombre: 'Leyenda', reaccion: .06, borde: 1, apunte: 1, agarra: .28, carga: .9, esquiva: .55, vel: 1.06 },
];
const G = 22, ESCALA_MAX = 1.8;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function angDif(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

// jugadores: [{ id, bot }]; humanos: lista de ids que maneja una persona
export function nuevaPartida({ mapa = 'terraza', jugadores = [], minutos = 3, dificultad = 1, modo = 'todos', r = Math.random } = {}) {
  const M = MAPAS[mapa] || MAPAS.terraza;
  const m = { t: 0, mapa, M, dificultad, modo: modo === 'equipos' ? 'equipos' : 'todos', marcador: [0, 0], ganadorEq: null, fase: 'cuenta', faseT: 0, duracion: minutos * 60, tiempo: minutos * 60, area: 1, jug: [], objetos: [], trampas: [], bombas: [], ev: [], evN: 0, oN: 0, proxObjeto: 6, ranking: [], r };
  for (const j of jugadores) agregarJugador(m, j);
  return m;
}
export const buscar = (m, id) => m.jug.find((j) => j.id === id);
function evento(m, e) { m.evN += 1; m.ev.push({ ...e, n: m.evN, t: m.t }); }

// ¿está adentro de la plataforma? (margen > 0: lejos del borde)
export function dentro(m, x, z, margen = 0) {
  const M = m.M, a = m.area;
  if (M.forma === 'circulo') return Math.hypot(x, z) <= M.radio * a - margen;
  return Math.abs(x) <= M.ancho / 2 * a - margen && Math.abs(z) <= M.largo / 2 * a - margen;
}
// cuánto falta para el borde (negativo: afuera) y para dónde queda "afuera" desde ese punto
export function borde(m, x, z) {
  const M = m.M, a = m.area;
  if (M.forma === 'circulo') { const d = Math.hypot(x, z) || 1e-6; return { falta: M.radio * a - d, ox: x / d, oz: z / d }; }
  const fx = M.ancho / 2 * a - Math.abs(x), fz = M.largo / 2 * a - Math.abs(z);
  return fx < fz ? { falta: fx, ox: Math.sign(x) || 1, oz: 0 } : { falta: fz, ox: 0, oz: Math.sign(z) || 1 };
}
function lugarLibre(m, margen = 2) {
  for (let k = 0; k < 40; k++) {
    const M = m.M;
    const x = M.forma === 'circulo' ? (m.r() - .5) * M.radio * 1.4 * m.area : (m.r() - .5) * M.ancho * m.area * .8;
    const z = M.forma === 'circulo' ? (m.r() - .5) * M.radio * 1.4 * m.area : (m.r() - .5) * M.largo * m.area * .8;
    if (dentro(m, x, z, margen) && m.jug.every((o) => o.est === 'fuera' || Math.hypot(o.x - x, o.z - z) > 1.6)) return { x, z };
  }
  return { x: 0, z: 0 };
}

export function agregarJugador(m, { id, bot = false, eq = null }) {
  if (buscar(m, id)) return buscar(m, id);
  const l = lugarLibre(m);
  const j = { id, bot, eq: m.modo === 'equipos' ? (eq === 1 ? 1 : 0) : null, x: l.x, z: l.z, y: 0, vx: 0, vz: 0, vy: 0, ang: m.r() * Math.PI * 2, est: 'quieto', t: 0, escala: 1, puntos: 0, caidas: 0, racha: 0, carga: 0, cd: 0, invul: 1.5, aturdido: 0, agarra: null, agarradoPor: null, forcejeo: 0, guante: 0, ultimoToque: null, respawn: 0, prev: {}, ia: null };
  m.jug.push(j);
  return j;
}
export function quitarJugador(m, id) {
  const j = buscar(m, id);
  if (!j) return;
  soltarAgarre(m, j);
  for (const o of m.jug) if (o.agarra === id) soltarAgarre(m, o);
  m.jug = m.jug.filter((o) => o !== j);
}

// el que va ganando (para la corona)
export function lider(m) {
  let mejor = null;
  for (const j of m.jug) if (j.puntos > 0 && (!mejor || j.puntos > mejor.puntos)) mejor = j;
  return mejor;
}
// ¿son del mismo equipo? (en todos contra todos, nunca)
export const companeros = (m, a, b) => m.modo === 'equipos' && a.eq === b.eq;
export function ordenar(m) {
  return [...m.jug].sort((a, b) => b.puntos - a.puntos || a.caidas - b.caidas).map((j) => ({ id: j.id, puntos: j.puntos, caidas: j.caidas }));
}

// ---------------------------------------------------------------- un paso de 1/60 s
export function paso(m, entradas = new Map()) {
  m.t += PASO; m.faseT += PASO;
  if (m.ev.length && m.t - m.ev[0].t > 1) m.ev = m.ev.filter((e) => m.t - e.t <= 1);
  if (m.fase === 'cuenta' && m.faseT >= 3) { m.fase = 'juego'; m.faseT = 0; evento(m, { k: 'arranca' }); }
  if (m.fase === 'juego') {
    m.tiempo -= PASO;
    // el último minuto la plataforma se achica
    const finalT = Math.min(60, m.duracion * .5);
    const area = 1 - .45 * clamp((finalT - m.tiempo) / finalT, 0, 1);
    if (area < m.area - .001 && m.area === 1) evento(m, { k: 'achica' });
    m.area = area;
    if (m.tiempo <= 0) {
      m.tiempo = 0; m.fase = 'fin'; m.faseT = 0; m.ranking = ordenar(m);
      if (m.modo === 'equipos') m.ganadorEq = m.marcador[0] === m.marcador[1] ? null : m.marcador[0] > m.marcador[1] ? 0 : 1;
      evento(m, { k: 'fin', ranking: m.ranking.slice(0, 3), ganadorEq: m.ganadorEq, marcador: [...m.marcador] });
      for (const j of m.jug) soltarAgarre(m, j);
    }
  }
  const lid = lider(m);
  for (const j of m.jug) {
    j.t += PASO;
    if (j.cd > 0) j.cd -= PASO;
    if (j.invul > 0) j.invul -= PASO;
    if (j.guante > 0) j.guante -= PASO;
    j.corona = j === lid;
    let inp = entradas.get(j.id) || { x: 0, z: 0 };
    if (j.bot) inp = pensarBot(m, j);
    if (m.fase === 'cuenta') inp = { x: 0, z: 0 };
    if (m.fase === 'fin') { inp = { x: 0, z: 0 }; festejo(m, j); }
    controlar(m, j, inp);
  }
  separar(m);
  objetos(m);
  if (m.fase === 'juego') { m.proxObjeto -= PASO; if (m.proxObjeto <= 0 && m.objetos.length < 3) { m.proxObjeto = 8 + m.r() * 6; const l = lugarLibre(m, 2.5); m.oN++; m.objetos.push({ id: m.oN, tipo: OBJETOS[Math.floor(m.r() * OBJETOS.length)], x: l.x, z: l.z }); } }
}

function festejo(m, j) {
  if (m.faseT < .5 || ['festeja', 'triste', 'cae', 'fuera'].includes(j.est)) return;
  const puesto = m.ranking.findIndex((x) => x.id === j.id);
  const gano = m.modo === 'equipos' ? (m.ganadorEq === null ? puesto < 3 : j.eq === m.ganadorEq) : puesto >= 0 && puesto < 3;
  j.est = gano ? 'festeja' : 'triste'; j.t = 0;
}

function controlar(m, j, inp) {
  const prev = j.prev; j.prev = { ...inp };
  const apreto = (k) => inp[k] && !prev[k];
  const solto = (k) => !inp[k] && prev[k];
  // afuera esperando volver
  if (j.est === 'fuera') {
    j.respawn -= PASO;
    if (j.respawn <= 0 && m.fase !== 'fin') { const l = lugarLibre(m); Object.assign(j, { x: l.x, z: l.z, y: 3, vx: 0, vz: 0, vy: 0, est: 'salta', t: 0, invul: 1.6 }); evento(m, { k: 'vuelve', a: j.id }); }
    return;
  }
  // cayendo al vacío
  if (j.est === 'cae') {
    j.vy -= G * PASO; j.x += j.vx * PASO; j.z += j.vz * PASO; j.y += j.vy * PASO;
    if (j.y < -9) caer(m, j);
    return;
  }
  // agarrado: va donde lo lleva el otro; apretando botones se suelta
  if (j.est === 'agarrado') {
    const h = buscar(m, j.agarradoPor);
    if (!h || h.agarra !== j.id || h.est === 'cae' || h.est === 'fuera') { liberar(m, j); }
    else {
      if (apreto('empujar') || apreto('agarrar') || apreto('salto')) j.forcejeo -= 1;
      if (j.forcejeo <= 0) { soltarAgarre(m, h); j.aturdido = 0; j.est = 'quieto'; evento(m, { k: 'zafa', a: j.id }); }
      else { j.x = h.x + Math.cos(h.ang) * .95 * h.escala; j.z = h.z + Math.sin(h.ang) * .95 * h.escala; j.y = .35; j.vx = h.vx; j.vz = h.vz; j.ang = h.ang + Math.PI; }
      return;
    }
  }
  const enPiso = j.y <= 0.001;
  // salto / volviendo de arriba
  if (!enPiso || j.vy > 0) {
    j.vy -= G * PASO; j.y += j.vy * PASO;
    if (j.y <= 0) { j.y = 0; j.vy = 0; if (j.est === 'salta') j.est = 'quieto'; }
  }
  // fuera de la plataforma y en el piso: se cae
  if (j.y <= .05 && !dentro(m, j.x, j.z, -.2)) { soltarAgarre(m, j); j.est = 'cae'; j.t = 0; j.vy = 0; evento(m, { k: 'borde', a: j.id }); return; }
  // aturdido / resbalando: sin control, se desliza
  if (j.aturdido > 0) {
    j.aturdido -= PASO;
    j.x += j.vx * PASO; j.z += j.vz * PASO;
    const roce = j.est === 'resbala' ? .985 : .95;
    j.vx *= roce; j.vz *= roce;
    if (j.est === 'resbala') j.ang += PASO * 12;
    if (j.aturdido <= 0 && ['aturdido', 'resbala', 'empuja'].includes(j.est)) j.est = 'quieto';
    return;
  }
  if (m.fase === 'fin') { j.vx *= .9; j.vz *= .9; j.x += j.vx * PASO; j.z += j.vz * PASO; return; }
  // moverse (más grande = más pesado y un poco más lento; llevando a alguien, más lento)
  let dx = inp.x || 0, dz = inp.z || 0;
  const l = Math.hypot(dx, dz); if (l > 1) { dx /= l; dz /= l; }
  const vmax = 5.6 / (1 + (j.escala - 1) * .45) * (j.agarra ? .62 : 1) * (j.est === 'carga' ? .55 : 1) * (j.bot ? NIVELES[m.dificultad].vel : 1);
  const k = Math.min(1, PASO * (enPiso ? 10 : 3));
  // si viene volando por un empujón, el control tarda en volver
  const rapido = Math.hypot(j.vx, j.vz) > vmax * 1.3;
  const kk = rapido ? k * .25 : k;
  j.vx += (dx * vmax - j.vx) * kk; j.vz += (dz * vmax - j.vz) * kk;
  j.x += j.vx * PASO; j.z += j.vz * PASO;
  if (l > .2) j.ang += angDif(j.ang, Math.atan2(dz, dx)) * Math.min(1, PASO * 14);
  // salto
  if (apreto('salto') && enPiso && !j.agarra) { j.vy = 6.8; j.y = .01; j.est = 'salta'; j.t = 0; evento(m, { k: 'salto', a: j.id }); }
  // agarrar: mantener para no soltar; al soltar, lo revoleás para adelante
  if (apreto('agarrar') && !j.agarra && j.cd <= 0) agarrar(m, j);
  if (j.agarra) {
    if (solto('agarrar') || j.t > 2.6) revolear(m, j);
    else { j.est = 'agarra'; return; }
  }
  // empujar: mantener carga, soltar empuja (un toque = empujón rápido)
  if (inp.empujar && j.cd <= 0 && !j.agarra) { j.carga = Math.min(1, j.carga + PASO / .8); j.est = 'carga'; }
  if (solto('empujar') && j.est === 'carga') empujon(m, j, j.carga);
  if (j.est === 'carga' && !inp.empujar) j.est = 'quieto';
  if (!['carga', 'salta', 'agarra'].includes(j.est)) j.est = Math.hypot(j.vx, j.vz) > .6 ? 'corre' : 'quieto';
}

// ---------------------------------------------------------------- empujar, agarrar, revolear
function frente(m, j, alcance, cono = 1.05) {
  let mejor = null, md = Infinity;
  for (const o of m.jug) {
    if (o === j || ['cae', 'fuera', 'agarrado'].includes(o.est) || o.invul > 0 || companeros(m, j, o)) continue;
    const d = dist(j, o);
    if (d > alcance + .35 * o.escala) continue;
    if (Math.abs(angDif(j.ang, Math.atan2(o.z - j.z, o.x - j.x))) > cono) continue;
    if (Math.abs(o.y - j.y) > 1.4) continue;
    if (d < md) { md = d; mejor = o; }
  }
  return mejor;
}
function golpear(m, a, o, fuerza, aturde) {
  const ang = Math.atan2(o.z - a.z, o.x - a.x);
  const f = fuerza * (1 + (a.escala - 1) * .8) / (1 + (o.escala - 1) * .9);
  o.vx = Math.cos(ang) * f; o.vz = Math.sin(ang) * f;
  o.aturdido = aturde; o.est = 'aturdido'; o.t = 0;
  o.ultimoToque = { id: a.id, t: m.t };
  o.carga = 0;
  if (o.agarra) soltarAgarre(m, o);
}
export function empujon(m, j, carga = 0) {
  j.est = 'empuja'; j.t = 0; j.cd = .42 + carga * .25;
  const ang = j.ang;
  // se tira un pasito para adelante
  j.vx += Math.cos(ang) * (3 + carga * 3); j.vz += Math.sin(ang) * (3 + carga * 3);
  const o = frente(m, j, (1.25 + carga * .45) * j.escala);
  const guante = j.guante > 0;
  if (o) {
    golpear(m, j, o, (8.5 + carga * 9) * (guante ? 1.8 : 1), .3 + carga * .35);
    evento(m, { k: 'empujon', a: j.id, b: o.id, fuerte: carga > .6 || guante, guante });
  } else evento(m, { k: 'aire', a: j.id });
  j.aturdido = .18; // el empujón te deja un toque quieto (no se puede spamear)
  j.carga = 0;
}
function agarrar(m, j) {
  const o = frente(m, j, 1.15 * j.escala, .9);
  j.cd = .35;
  if (!o || o.agarra) { evento(m, { k: 'aire', a: j.id }); return; }
  soltarAgarre(m, o);
  j.agarra = o.id; j.t = 0; j.est = 'agarra';
  o.agarradoPor = j.id; o.est = 'agarrado'; o.t = 0; o.forcejeo = 5 + Math.round(j.escala * 2); o.carga = 0;
  o.ultimoToque = { id: j.id, t: m.t };
  evento(m, { k: 'agarra', a: j.id, b: o.id });
}
function revolear(m, j) {
  const o = buscar(m, j.agarra);
  j.agarra = null; j.cd = .5; j.est = 'empuja'; j.t = 0;
  if (!o) return;
  o.agarradoPor = null;
  const f = 12 * (1 + (j.escala - 1) * .6) / (1 + (o.escala - 1) * .7);
  o.vx = Math.cos(j.ang) * f; o.vz = Math.sin(j.ang) * f; o.vy = 4; o.y = .4;
  o.aturdido = .6; o.est = 'aturdido'; o.t = 0;
  o.ultimoToque = { id: j.id, t: m.t };
  evento(m, { k: 'revolea', a: j.id, b: o.id });
}
function soltarAgarre(m, j) {
  if (j.agarra) { const o = buscar(m, j.agarra); if (o && o.agarradoPor === j.id) liberar(m, o); j.agarra = null; }
  if (j.agarradoPor) { const h = buscar(m, j.agarradoPor); if (h && h.agarra === j.id) h.agarra = null; j.agarradoPor = null; if (j.est === 'agarrado') j.est = 'quieto'; }
}
function liberar(m, o) { o.agarradoPor = null; if (o.est === 'agarrado') { o.est = 'aturdido'; o.aturdido = .2; } o.y = 0; }

// se cayó del todo: punto para el último que lo tocó (si fue hace poco) y vuelve a entrar
function caer(m, j) {
  j.caidas++;
  let quien = j.ultimoToque && m.t - j.ultimoToque.t < 5 && j.ultimoToque.id !== j.id ? buscar(m, j.ultimoToque.id) : null;
  if (quien && companeros(m, quien, j)) quien = null;
  const eraCorona = j.corona;
  if (quien && m.fase === 'juego') {
    quien.puntos += eraCorona ? 2 : 1; quien.racha++;
    if (m.modo === 'equipos') m.marcador[quien.eq] += eraCorona ? 2 : 1;
    quien.escala = Math.min(ESCALA_MAX, quien.escala + .08);
    evento(m, { k: 'tirada', a: quien.id, b: j.id, corona: eraCorona, racha: quien.racha });
  } else evento(m, { k: 'cayo', b: j.id });
  // el que cae pierde la mitad de lo que había crecido
  j.escala = 1 + (j.escala - 1) * .5; j.racha = 0; j.guante = 0;
  Object.assign(j, { est: 'fuera', respawn: 1.6, vx: 0, vz: 0, vy: 0, y: -9, ultimoToque: null, aturdido: 0, carga: 0 });
}

// nadie atraviesa a nadie: el más pesado empuja al más liviano
function separar(m) {
  const js = m.jug.filter((j) => !['cae', 'fuera', 'agarrado'].includes(j.est));
  for (let i = 0; i < js.length; i++) for (let k = i + 1; k < js.length; k++) {
    const a = js[i], b = js[k];
    if (Math.abs(a.y - b.y) > 1.2) continue;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = .42 * (a.escala + b.escala);
    if (d >= min || d === 0) continue;
    const e = min - d, nx = dx / d, nz = dz / d, pa = b.escala / (a.escala + b.escala);
    a.x -= nx * e * pa; a.z -= nz * e * pa; b.x += nx * e * (1 - pa); b.z += nz * e * (1 - pa);
  }
}

// ---------------------------------------------------------------- objetos: guante, cáscara de banana y bomba
function objetos(m) {
  for (const o of [...m.objetos]) {
    const j = m.jug.find((x) => !['cae', 'fuera', 'agarrado'].includes(x.est) && x.y < .5 && Math.hypot(x.x - o.x, x.z - o.z) < .8 * x.escala);
    if (!j) continue;
    m.objetos = m.objetos.filter((x) => x !== o);
    if (o.tipo === 'guante') j.guante = 8;
    if (o.tipo === 'banana') m.trampas.push({ x: j.x - Math.cos(j.ang) * 1.2, z: j.z - Math.sin(j.ang) * 1.2, de: j.id, t: 14 });
    if (o.tipo === 'bomba') m.bombas.push({ x: j.x + Math.cos(j.ang) * 3, z: j.z + Math.sin(j.ang) * 3, de: j.id, t: 1.5 });
    evento(m, { k: 'objeto', a: j.id, tipo: o.tipo });
  }
  // cáscaras: el que la pisa resbala y sale disparado
  for (const tr of [...m.trampas]) {
    tr.t -= PASO;
    const dueno = buscar(m, tr.de);
    const j = m.jug.find((x) => x.id !== tr.de && !(dueno && companeros(m, dueno, x)) && !['cae', 'fuera', 'agarrado', 'resbala'].includes(x.est) && x.y < .2 && Math.hypot(x.x - tr.x, x.z - tr.z) < .6);
    if (j) {
      const v = Math.max(4, Math.hypot(j.vx, j.vz)) * 1.7, ang = Math.atan2(j.vz, j.vx) || j.ang;
      j.vx = Math.cos(ang) * v; j.vz = Math.sin(ang) * v; j.est = 'resbala'; j.aturdido = 1; j.t = 0; j.ultimoToque = { id: tr.de, t: m.t };
      if (j.agarra) soltarAgarre(m, j);
      evento(m, { k: 'resbala', a: j.id, de: tr.de }); tr.t = 0;
    }
    if (tr.t <= 0) m.trampas = m.trampas.filter((x) => x !== tr);
  }
  // bombas: explotan y revolean a los de alrededor
  for (const b of [...m.bombas]) {
    b.t -= PASO;
    if (b.t > 0) continue;
    m.bombas = m.bombas.filter((x) => x !== b);
    for (const j of m.jug) {
      if (['cae', 'fuera'].includes(j.est) || j.invul > 0) continue;
      const duenio = buscar(m, b.de);
      if (duenio && duenio !== j && companeros(m, duenio, j)) continue;
      const d = Math.hypot(j.x - b.x, j.z - b.z);
      if (d > 3.4) continue;
      const ang = Math.atan2(j.z - b.z, j.x - b.x) || 0, f = 6 + 12 * (1 - d / 3.4);
      if (j.agarradoPor || j.agarra) soltarAgarre(m, j);
      j.vx = Math.cos(ang) * f; j.vz = Math.sin(ang) * f; j.vy = 5; j.y = Math.max(j.y, .05); j.aturdido = .7; j.est = 'aturdido'; j.t = 0;
      if (j.id !== b.de) j.ultimoToque = { id: b.de, t: m.t };
    }
    evento(m, { k: 'boom', x: b.x, z: b.z, de: b.de });
  }
}

// ---------------------------------------------------------------- bots
// Buscan a alguien (mejor si está cerca del borde o lleva la corona), se ponen del lado de adentro para
// empujarlo hacia afuera, a veces lo agarran y lo revolean, cuidan su propio borde y van a buscar objetos.
export function pensarBot(m, j) {
  const N = NIVELES[m.dificultad] || NIVELES[1];
  const ia = (j.ia ??= { prox: 0, inp: { x: 0, z: 0 }, objetivo: null, hasta: 0, modo: 'buscar' });
  if (['cae', 'fuera', 'agarrado'].includes(j.est)) return j.est === 'agarrado' && m.r() < .12 * (1 + m.dificultad) ? { x: 0, z: 0, empujar: !j.prev.empujar } : { x: 0, z: 0 };
  // revoleando: lleva al agarrado hacia el borde más cercano y lo suelta
  if (j.agarra) {
    const o = buscar(m, j.agarra);
    const b = borde(m, j.x, j.z);
    if (!o || b.falta < 1.6 + (1 - N.apunte) || j.t > 1.6) return { x: b.ox, z: b.oz, agarrar: false };
    return { x: b.ox, z: b.oz, agarrar: true };
  }
  // cargando: sigue apretando hasta el momento y suelta
  if (ia.modo === 'carga') {
    if (m.t < ia.hasta) { const o = buscar(m, ia.objetivo); return o ? { x: (o.x - j.x) * .3, z: (o.z - j.z) * .3, empujar: true } : { x: 0, z: 0, empujar: true }; }
    ia.modo = 'buscar'; ia.prox = m.t + N.reaccion * .5;
    return { x: 0, z: 0, empujar: false };
  }
  if (m.t < ia.prox) return ia.inp;
  ia.prox = m.t + N.reaccion * (.7 + m.r() * .6);
  // primero, no caerse: si está cerca del borde, va para el medio
  const b = borde(m, j.x, j.z);
  if (b.falta < 1.2 + N.borde * .9) { ia.inp = { x: -b.ox - j.x * .05, z: -b.oz - j.z * .05 }; return ia.inp; }
  // esquivar: si alguien está cargando un empujón cerca y le apunta, salta o se corre
  const amenaza = m.jug.find((o) => o !== j && !companeros(m, j, o) && o.est === 'carga' && dist(o, j) < 2.5 && Math.abs(angDif(o.ang, Math.atan2(j.z - o.z, j.x - o.x))) < .6);
  if (amenaza && m.r() < N.esquiva) { const a = Math.atan2(j.z - amenaza.z, j.x - amenaza.x) + Math.PI / 2; ia.inp = { x: Math.cos(a), z: Math.sin(a), salto: m.r() < .4 }; return ia.inp; }
  // objetos cerca y nadie encima
  const obj = m.objetos.find((o) => Math.hypot(o.x - j.x, o.z - j.z) < 4.5);
  if (obj && m.r() < .6) { ia.inp = { x: obj.x - j.x, z: obj.z - j.z }; return ia.inp; }
  // elegir a quién ir a buscar
  let mejor = null, puntaje = -Infinity;
  for (const o of m.jug) {
    if (o === j || ['cae', 'fuera'].includes(o.est) || o.invul > 0 || companeros(m, j, o)) continue;
    const d = dist(j, o), bo = borde(m, o.x, o.z);
    const pts = -d * .6 + (4 - Math.min(4, bo.falta)) * 1.2 + (o.corona ? 3 : 0) + (o.bot ? 0 : .8) + (o.id === ia.objetivo ? 1 : 0);
    if (pts > puntaje) { puntaje = pts; mejor = o; }
  }
  if (!mejor) { ia.inp = { x: -j.x * .2, z: -j.z * .2 }; return ia.inp; }
  ia.objetivo = mejor.id;
  // ponerse del lado de adentro (así el empujón lo manda para afuera)
  const bo = borde(m, mejor.x, mejor.z);
  const errA = (1 - N.apunte) * (m.r() - .5) * 2;
  const ox = bo.ox + errA, oz = bo.oz - errA;
  const px = mejor.x - ox * 1.15 * j.escala, pz = mejor.z - oz * 1.15 * j.escala;
  const d = dist(j, mejor), dp = Math.hypot(px - j.x, pz - j.z);
  if (d < 1.5 * j.escala && j.cd <= 0) {
    // de frente: empujón (cargado según nivel) o agarrar
    j.ang += angDif(j.ang, Math.atan2(mejor.z - j.z, mejor.x - j.x)) * .7;
    if (m.r() < N.agarra) return { x: mejor.x - j.x, z: mejor.z - j.z, agarrar: true };
    const carga = m.r() < N.carga ? .3 + m.r() * .6 : 0;
    if (carga > 0) { ia.modo = 'carga'; ia.hasta = m.t + carga * .8; return { x: 0, z: 0, empujar: true }; }
    ia.modo = 'buscar';
    ia.inp = { x: 0, z: 0 };
    return { x: mejor.x - j.x, z: mejor.z - j.z, empujar: true, _suelta: true };
  }
  ia.inp = dp > .4 ? { x: px - j.x, z: pz - j.z } : { x: mejor.x - j.x, z: mejor.z - j.z };
  return ia.inp;
}

// ---------------------------------------------------------------- red: el anfitrión manda esto a los demás
const FASES = ['cuenta', 'juego', 'fin'];
const r2 = (v) => Math.round(v * 100) / 100, r1 = (v) => Math.round(v * 10) / 10;
export function codificar(m) {
  return 'M' + JSON.stringify([
    FASES.indexOf(m.fase), r2(m.faseT), r2(m.tiempo), r2(m.area),
    m.jug.map((j) => [j.id, r2(j.x), r2(j.z), r1(j.y), r1(j.ang), ESTADOS.indexOf(j.est), r2(j.escala), j.puntos, j.caidas, (j.corona ? 1 : 0) | (j.guante > 0 ? 2 : 0) | (j.invul > 0 ? 4 : 0), r1(j.carga), j.agarra || 0, r1(j.t), j.eq ?? -1]),
    m.objetos.map((o) => [o.id, OBJETOS.indexOf(o.tipo), r2(o.x), r2(o.z)]),
    m.trampas.map((t) => [r2(t.x), r2(t.z)]),
    m.bombas.map((b) => [r2(b.x), r2(b.z), r2(b.t)]),
    m.ev.slice(-8).map((e) => ({ ...e, t: undefined })),
    m.fase === 'fin' ? m.ranking.slice(0, 20) : 0, m.modo === 'equipos' ? [m.marcador, m.ganadorEq] : 0,
  ]);
}
export function decodificar(s, base) {
  try {
    const d = JSON.parse(s.slice(1));
    return {
      mapa: base.mapa, M: base.M, fase: FASES[d[0]], faseT: d[1], tiempo: d[2], area: d[3],
      jug: d[4].map((f) => ({ id: f[0], x: f[1], z: f[2], y: f[3], ang: f[4], est: ESTADOS[f[5]] || 'quieto', escala: f[6], puntos: f[7], caidas: f[8], corona: !!(f[9] & 1), guante: f[9] & 2 ? 1 : 0, invul: f[9] & 4 ? 1 : 0, carga: f[10], agarra: f[11] || null, t: f[12], eq: f[13] >= 0 ? f[13] : null })),
      objetos: d[5].map((o) => ({ id: o[0], tipo: OBJETOS[o[1]], x: o[2], z: o[3] })),
      trampas: d[6].map((t) => ({ x: t[0], z: t[1] })),
      bombas: d[7].map((b) => ({ x: b[0], z: b[1], t: b[2] })),
      ev: d[8] || [], ranking: d[9] || [],
      modo: d[10] ? 'equipos' : 'todos', marcador: d[10] ? d[10][0] : [0, 0], ganadorEq: d[10] ? d[10][1] : null,
    };
  } catch {
    return null;
  }
}
export function codificarEntrada(e) {
  let b = 0;
  BOTONES.forEach((k, i) => { if (e[k]) b |= 1 << i; });
  return `I${Math.round((e.x || 0) * 10) / 10},${Math.round((e.z || 0) * 10) / 10},${b}`;
}
export function decodificarEntrada(s) {
  const [x, z, b] = s.slice(1).split(',').map(Number);
  const e = { x: clamp(x || 0, -1, 1), z: clamp(z || 0, -1, 1) };
  BOTONES.forEach((k, i) => { if (b & (1 << i)) e[k] = true; });
  return e;
}
