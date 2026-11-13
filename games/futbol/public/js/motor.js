// Motor de La Canchita (fútbol 5 a fútbol 8 en 3D). Puro, sin navegador: lo corre la compu en el modo
// local o el anfitrión online, 60 veces por segundo, y lo usan los tests.
// La cancha va en x (largo, los arcos en x = ±L/2) y z (ancho); y es la altura. El equipo 0 (rojo) ataca hacia +x.
// Cancha cerrada (como las de fútbol 5): la pelota rebota en las paredes y en la red del techo.
export const PASO = 1 / 60;
export const FORMATOS = {
  5: { L: 40, A: 22, arco: 3.4, altoArco: 2.0 },
  6: { L: 46, A: 25, arco: 3.8, altoArco: 2.1 },
  7: { L: 52, A: 29, arco: 4.4, altoArco: 2.2 },
  8: { L: 58, A: 33, arco: 5.0, altoArco: 2.3 },
};
// posiciones de cada uno (sin el arquero): x = 0 en el arco propio, 1 en la mitad de cancha; z de -1 a 1
const FORMACIONES = {
  5: [[.55, -.5], [.55, .5], [1.15, -.38], [1.15, .38]],
  6: [[.5, -.55], [.5, .55], [.9, 0], [1.3, -.42], [1.3, .42]],
  7: [[.45, -.62], [.42, 0], [.45, .62], [.92, -.42], [.92, .42], [1.38, 0]],
  8: [[.42, -.66], [.4, 0], [.42, .66], [.88, -.5], [.88, .5], [1.3, -.3], [1.3, .3]],
};
export const R_PEL = .11, R_JUG = .36, G = 20;
export const ESTADOS = ['quieto', 'corre', 'patea', 'pase', 'barrida', 'caido', 'levanta', 'vuela', 'ataja', 'festeja', 'triste', 'cabezazo'];
export const BOTONES = ['pase', 'tiro', 'barrida', 'cambiar', 'sprint'];
const NADA = { x: 0, z: 0 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function angDif(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

// jugadores: [{ id, eq, npc }] (el primero de cada equipo es el arquero); humanos: [{ hid, eq, pid, cambia }]
export function nuevoPartido({ formato = 5, jugadores, humanos = [], minutos = 4, golesMax = 0, dificultad = 1 }) {
  const F = FORMATOS[formato] || FORMATOS[5];
  const m = {
    t: 0, formato, ...F, dificultad,
    jug: [], pel: { x: 0, y: R_PEL, z: 0, vx: 0, vy: 0, vz: 0, duenio: null, ultimo: null, penultimo: null, libreDe: null, libreT: 0 },
    marcador: [0, 0], fase: 'saque', faseT: 0, saca: Math.random() < .5 ? 0 : 1,
    tiempo: minutos ? minutos * 60 : Infinity, golesMax, ganador: null,
    ev: [], evN: 0, mando: {}, cambia: {}, goles: [],
  };
  const cuenta = [0, 0];
  for (const j of jugadores) {
    const k = cuenta[j.eq]++;
    m.jug.push({ id: j.id, eq: j.eq, s: j.eq ? -1 : 1, slot: k - 1, arquero: k === 0, x: 0, z: 0, vx: 0, vz: 0, ang: j.eq ? Math.PI : 0, est: 'quieto', t: 0, carga: 0, cargando: false, energia: 1, cd: 0, prev: {}, ia: null, goles: 0 });
  }
  for (const h of humanos) { m.mando[h.hid] = h.pid; m.cambia[h.hid] = !!h.cambia; }
  acomodar(m);
  return m;
}

export const buscar = (m, id) => m.jug.find((j) => j.id === id);
function evento(m, e) { m.evN += 1; m.ev.push({ ...e, n: m.evN, t: m.t }); }

// dónde va cada uno según su puesto, corrido según dónde está la pelota
export function puesto(m, j) {
  const p = m.pel;
  if (j.arquero) return { x: -j.s * (m.L / 2 - 1), z: 0 };
  const [fx, fz] = FORMACIONES[m.formato][j.slot % FORMACIONES[m.formato].length];
  const avance = clamp(p.x * j.s / (m.L / 2), -1, 1); // cuánto avanzó mi equipo
  const x = j.s * (-m.L / 2 + fx * (m.L / 2) * (1 + avance * .55)) + p.x * .22;
  const z = fz * (m.A / 2) * .78 + p.z * .28;
  return { x: clamp(x, -m.L / 2 + 1.5, m.L / 2 - 1.5), z: clamp(z, -m.A / 2 + 1, m.A / 2 - 1) };
}

// saque del medio: cada uno a su mitad, la pelota al centro
function acomodar(m) {
  const p = m.pel;
  Object.assign(p, { x: 0, y: R_PEL, z: 0, vx: 0, vy: 0, vz: 0, duenio: null, ultimo: null, libreDe: null, libreT: 0 });
  for (const j of m.jug) {
    const q = puesto(m, j);
    j.x = j.arquero ? q.x : clamp(q.x * .9, j.s > 0 ? -m.L / 2 + 1 : 2.2, j.s > 0 ? -2.2 : m.L / 2 - 1);
    j.z = q.z; j.vx = j.vz = 0; j.ang = j.s > 0 ? 0 : Math.PI; j.est = 'quieto'; j.t = 0; j.carga = 0; j.cargando = false; j.cd = 0; j.ia = null;
  }
  // el que saca se para al lado de la pelota
  const sacador = m.jug.filter((j) => j.eq === m.saca && !j.arquero).sort((a, b) => Math.abs(a.x) + Math.abs(a.z) - Math.abs(b.x) - Math.abs(b.z))[0];
  if (sacador) { sacador.x = -sacador.s * .55; sacador.z = 0; }
}

// ---------------------------------------------------------------- un paso de 1/60 s
export function paso(m, entradas = new Map()) {
  m.t += PASO;
  if (m.ev.length && m.t - m.ev[0].t > 1) m.ev = m.ev.filter((e) => m.t - e.t <= 1);
  m.faseT += PASO;
  if (m.fase === 'saque' && m.faseT > 1.4) { m.fase = 'juego'; m.faseT = 0; evento(m, { k: 'pitazo' }); }
  if (m.fase === 'gol' && m.faseT > 3.2) {
    if (m.golesMax && Math.max(...m.marcador) >= m.golesMax) return terminar(m);
    m.fase = 'saque'; m.faseT = 0; acomodar(m);
  }
  if (m.fase === 'fin') { for (const j of m.jug) { festejar(m, j); integrar(m, j, 0, 0, false); } return; }
  if (m.fase === 'juego') {
    m.tiempo -= PASO;
    if (m.tiempo <= 0) { m.tiempo = 0; return terminar(m); }
  }
  // quién maneja a quién (los humanos pueden ir cambiando de jugador)
  const manejado = new Map();
  for (const [hid, pid] of Object.entries(m.mando)) {
    const inp = entradas.get(hid) || NADA;
    const j = buscar(m, pid);
    if (!j) continue;
    if (m.cambia[hid] && inp.cambiar && !j.prevCambiar && m.fase === 'juego') cambiarJugador(m, hid, true);
    j.prevCambiar = !!inp.cambiar;
    if (m.cambia[hid]) cambioAutomatico(m, hid);
    manejado.set(m.mando[hid], inp);
  }
  for (const j of m.jug) {
    j.humano = manejado.has(j.id); // el que maneja una persona patea con su puntería, no con la de un bot
    j.t += PASO;
    if (j.cd > 0) j.cd -= PASO;
    let inp;
    if (manejado.has(j.id)) inp = manejado.get(j.id);
    else if (j.arquero) inp = pensarArquero(m, j);
    else inp = pensarBot(m, j);
    controlar(m, j, m.fase === 'juego' ? inp : quietoEnSaque(m, j));
  }
  separar(m);
  pelota(m);
}

function terminar(m) {
  m.fase = 'fin'; m.faseT = 0;
  m.ganador = m.marcador[0] === m.marcador[1] ? null : m.marcador[0] > m.marcador[1] ? 0 : 1;
  m.pel.duenio = null;
  evento(m, { k: 'final', ganador: m.ganador });
}
function festejar(m, j) {
  if (m.faseT < .6 || ['festeja', 'triste'].includes(j.est)) return;
  if (m.ganador === null) return;
  j.est = j.eq === m.ganador ? 'festeja' : 'triste'; j.t = 0;
}

// en el saque cada uno vuelve a su lugar (sin pasar a la otra mitad)
function quietoEnSaque(m, j) {
  if (m.fase === 'gol') {
    const ultimo = m.goles[m.goles.length - 1];
    if (ultimo && j.eq === ultimo.eq && j.id === ultimo.autor && !ultimo.contra) return { x: 0, z: 0, festeja: true };
    return { x: 0, z: 0 };
  }
  return { x: 0, z: 0 };
}

function controlar(m, j, inp) {
  const p = m.pel;
  const tengo = p.duenio === j.id;
  const prev = j.prev; j.prev = { ...inp };
  const apreto = (k) => inp[k] && !prev[k];
  const solto = (k) => !inp[k] && prev[k];
  // estados que no se controlan
  if (j.est === 'caido') { integrar(m, j, 0, 0, false, 6); if (j.t > .9) { j.est = 'levanta'; j.t = 0; } return; }
  if (j.est === 'levanta') { integrar(m, j, 0, 0, false, 8); if (j.t > .45) { j.est = 'quieto'; j.t = 0; } return; }
  if (j.est === 'barrida') {
    const v = 8.5 * Math.max(0, 1 - j.t / .55);
    j.vx = Math.cos(j.ang) * v; j.vz = Math.sin(j.ang) * v;
    j.x += j.vx * PASO; j.z += j.vz * PASO; limitar(m, j);
    barrer(m, j);
    if (j.t > .62) { j.est = 'levanta'; j.t = 0; }
    return;
  }
  if (j.est === 'vuela') { // estirada del arquero
    j.x += j.vx * PASO; j.z += j.vz * PASO; j.vx *= .97; j.vz *= .97; limitar(m, j);
    if (j.t > .75) { j.est = 'levanta'; j.t = 0; j.vx = j.vz = 0; }
    return;
  }
  if (['patea', 'pase', 'cabezazo'].includes(j.est) && j.t < .28) { integrar(m, j, 0, 0, false, 5); return; }
  if (j.est === 'ataja') { integrar(m, j, 0, 0, false, 10); if (j.t > .5) { j.est = 'quieto'; j.t = 0; } }
  if (inp.festeja) { j.est = 'festeja'; integrar(m, j, 0, 0, false); return; }
  if (['patea', 'pase', 'cabezazo', 'festeja', 'triste'].includes(j.est)) { j.est = 'quieto'; j.t = 0; }

  // moverse
  let dx = inp.x || 0, dz = inp.z || 0;
  const l = Math.hypot(dx, dz);
  if (l > 1) { dx /= l; dz /= l; }
  integrar(m, j, dx, dz, !!inp.sprint);

  // patear: mantener para cargar, soltar para rematar
  if (tengo) {
    if (inp.tiro) { j.cargando = true; j.carga = Math.min(1, j.carga + PASO / .85); }
    if ((solto('tiro') || (j.cargando && j.carga >= 1 && inp.tiro && j.carga === 1 && j.cargaLlena > .35)) && j.cargando) rematar(m, j, Math.max(.15, j.carga), dx, dz);
    if (j.carga === 1) j.cargaLlena = (j.cargaLlena || 0) + PASO; else j.cargaLlena = 0;
    if (apreto('pase')) pasar(m, j, dx, dz, false);
    else if (apreto('barrida')) pasar(m, j, dx, dz, true); // con la pelota, la barrida es un pase largo por arriba
  } else {
    j.cargando = false; j.carga = 0;
    if (apreto('pase')) quitar(m, j);
    if (apreto('tiro')) volea(m, j);
    if (apreto('barrida') && j.cd <= 0 && !j.arquero) { j.est = 'barrida'; j.t = 0; j.cd = 1.2; j.barrio = false; evento(m, { k: 'barrida', a: j.id }); }
  }
}

function integrar(m, j, dx, dz, sprint, freno = 9) {
  const tengo = m.pel.duenio === j.id;
  const corre = sprint && j.energia > .05 && (dx || dz);
  const vmax = (j.arquero ? 5.4 : 5.8) * (corre ? 1.38 : 1) * (tengo ? .9 : 1) * (j.cargando ? .7 : 1) * (.92 + m.dificultad * .04 * (j.humano ? 0 : 1));
  const k = Math.min(1, PASO * (dx || dz ? 7 : freno));
  j.vx += (dx * vmax - j.vx) * k; j.vz += (dz * vmax - j.vz) * k;
  j.x += j.vx * PASO; j.z += j.vz * PASO;
  j.energia = clamp(j.energia + (corre ? -PASO * .22 : PASO * .1), 0, 1);
  const v = Math.hypot(j.vx, j.vz);
  if (v > .4) j.ang += angDif(j.ang, Math.atan2(j.vz, j.vx)) * Math.min(1, PASO * (tengo ? 9 : 13));
  if (!['caido', 'levanta', 'ataja', 'festeja', 'triste'].includes(j.est)) j.est = v > .6 ? 'corre' : 'quieto';
  j.velocidad = v;
  limitar(m, j);
}
function limitar(m, j) {
  const mx = m.L / 2 - R_JUG + (j.arquero ? .4 : 0), mz = m.A / 2 - R_JUG;
  j.x = clamp(j.x, -mx, mx); j.z = clamp(j.z, -mz, mz);
}

function separar(m) {
  const js = m.jug.filter((j) => !['caido', 'vuela'].includes(j.est));
  for (let i = 0; i < js.length; i++) for (let k = i + 1; k < js.length; k++) {
    const a = js[i], b = js[k];
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = R_JUG * 2;
    if (d >= min || d === 0) continue;
    const e = (min - d) / 2, nx = dx / d, nz = dz / d;
    a.x -= nx * e; a.z -= nz * e; b.x += nx * e; b.z += nz * e;
  }
}

// ---------------------------------------------------------------- acciones con la pelota
const OTRO_ARCO = (m, j) => ({ x: j.s * m.L / 2, z: 0 });

function soltar(m, j) {
  const p = m.pel;
  p.duenio = null; p.penultimo = p.ultimo; p.ultimo = j.id; p.libreDe = j.id; p.libreT = .3;
}

function rematar(m, j, carga, dx, dz) {
  const p = m.pel;
  const arco = OTRO_ARCO(m, j);
  const haciaArco = Math.atan2(arco.z - j.z, arco.x - j.x);
  // apunta al arco si está más o menos de frente; si no, sale para donde mira
  let ang = Math.abs(angDif(j.ang, haciaArco)) < 1.6 ? haciaArco : j.ang;
  if (Math.abs(angDif(j.ang, haciaArco)) < 1.6) {
    // a qué palo: según para dónde apretás (y un poco de error)
    const lado = Math.abs(dz) > .3 ? Math.sign(dz) : (Math.random() < .5 ? -1 : 1);
    // el humano apunta adentro de los palos (con poco error); los bots erran más según la dificultad
    const err = (Math.random() - .5) * (j.humano ? .28 : 1.25 - m.dificultad * .3) * m.arco;
    const objetivoZ = clamp(lado * m.arco * (j.humano ? .32 : .41) + err, -m.arco, m.arco);
    ang = Math.atan2(objetivoZ - j.z, arco.x - j.x);
  }
  const vel = 12 + 17 * carga;
  soltar(m, j);
  p.vx = Math.cos(ang) * vel; p.vz = Math.sin(ang) * vel;
  p.vy = 1 + carga * 4.2 + (carga > .9 ? Math.random() * 2.2 : 0);
  p.x = j.x + Math.cos(j.ang) * .55; p.z = j.z + Math.sin(j.ang) * .55;
  j.est = 'patea'; j.t = 0; j.cargando = false; j.carga = 0;
  evento(m, { k: 'remate', a: j.id, fuerza: carga });
}

// pase al compañero que mejor quede para donde apretás (o para donde mira)
function pasar(m, j, dx, dz, alto) {
  const p = m.pel;
  const dir = Math.hypot(dx, dz) > .3 ? Math.atan2(dz, dx) : j.ang;
  let mejor = null, puntaje = -Infinity;
  for (const o of m.jug) {
    if (o.eq !== j.eq || o.id === j.id || o.est === 'caido') continue;
    const d = dist(j, o);
    if (d < 2 || d > 34) continue;
    const a = Math.abs(angDif(dir, Math.atan2(o.z - j.z, o.x - j.x)));
    if (a > 1.2) continue;
    const libre = Math.min(6, ...m.jug.filter((e) => e.eq !== j.eq).map((e) => dist(e, o)));
    const pts = -a * 9 - Math.abs(d - 11) * .25 + libre * .7 + (o.x - j.x) * j.s * .12 - (o.arquero ? 6 : 0);
    if (pts > puntaje) { puntaje = pts; mejor = o; }
  }
  let tx, tz;
  if (mejor) {
    const d = dist(j, mejor), adelanto = d / 14;
    tx = mejor.x + mejor.vx * adelanto * .8; tz = mejor.z + mejor.vz * adelanto * .8;
  } else { tx = j.x + Math.cos(dir) * 10; tz = j.z + Math.sin(dir) * 10; }
  const d = Math.hypot(tx - j.x, tz - j.z), ang = Math.atan2(tz - j.z, tx - j.x);
  soltar(m, j);
  if (alto || d > 20) {
    // globo: llega cayendo
    const tVuelo = clamp(d / 15, .7, 1.7);
    const v = d / tVuelo / .9;
    p.vx = Math.cos(ang) * v; p.vz = Math.sin(ang) * v; p.vy = G * tVuelo / 2;
  } else {
    const v = clamp(d * 1.25 + 4.5, 8, 21);
    p.vx = Math.cos(ang) * v; p.vz = Math.sin(ang) * v; p.vy = .4;
  }
  p.x = j.x + Math.cos(j.ang) * .5; p.z = j.z + Math.sin(j.ang) * .5;
  j.est = 'pase'; j.t = 0; j.ang = ang;
  if (mejor) mejor.esperaPase = .9;
  evento(m, { k: 'pase', a: j.id, b: mejor?.id || null, alto: !!(alto || d > 20) });
}

// sin la pelota: intentar sacársela al rival que la tiene cerca
function quitar(m, j) {
  if (j.cd > 0) return;
  j.cd = .55;
  const p = m.pel;
  const rival = p.duenio && buscar(m, p.duenio);
  if (!rival || rival.eq === j.eq || dist(j, rival) > 1.25) return;
  const prob = .42 + (j.humano ? .1 : m.dificultad * .07) - (rival.arquero ? .3 : 0);
  if (Math.random() < prob) {
    soltar(m, rival); p.libreDe = rival.id; p.libreT = .5;
    const a = Math.atan2(rival.z - j.z, rival.x - j.x);
    p.vx = Math.cos(a) * 3 + j.vx * .3; p.vz = Math.sin(a) * 3 + j.vz * .3; p.vy = .5;
    evento(m, { k: 'quite', a: j.id, b: rival.id });
  }
}

// la pelota viene por el aire cerca: cabezazo o volea al arco
function volea(m, j) {
  const p = m.pel;
  if (p.duenio || j.cd > 0) return;
  const d = dist(j, p);
  if (d > 1.3 || p.y > 2.3) return;
  const arco = OTRO_ARCO(m, j);
  const ang = Math.atan2(clamp((Math.random() - .5) * m.arco, -m.arco / 2, m.arco / 2) - j.z, arco.x - j.x);
  const cabeza = p.y > 1.2;
  const v = cabeza ? 14 : 20;
  soltar(m, j);
  p.vx = Math.cos(ang) * v; p.vz = Math.sin(ang) * v; p.vy = cabeza ? -1 : 2.5;
  j.est = cabeza ? 'cabezazo' : 'patea'; j.t = 0; j.cd = .5; j.ang = ang;
  evento(m, { k: cabeza ? 'cabezazo' : 'volea', a: j.id });
}

// durante la barrida: si toca la pelota se la lleva; si se la saca a uno, lo tira
function barrer(m, j) {
  const p = m.pel;
  if (j.barrio || dist(j, p) > .85 || p.y > .6) return;
  j.barrio = true;
  const rival = p.duenio && buscar(m, p.duenio);
  if (rival && rival.eq === j.eq) return;
  if (rival) { rival.est = 'caido'; rival.t = 0; rival.vx = rival.vz = 0; evento(m, { k: 'cae', a: rival.id, por: j.id }); }
  soltar(m, j);
  p.vx = Math.cos(j.ang) * 6 + (Math.random() - .5) * 2; p.vz = Math.sin(j.ang) * 6 + (Math.random() - .5) * 2; p.vy = .8;
  evento(m, { k: 'barre', a: j.id });
}

// ---------------------------------------------------------------- la pelota
function pelota(m) {
  const p = m.pel;
  if (p.libreT > 0) p.libreT -= PASO;
  if (m.fase === 'saque') return;
  if (p.duenio) {
    const j = buscar(m, p.duenio);
    if (!j || ['caido', 'barrida'].includes(j.est)) { p.duenio = null; return; }
    // la pelota pegada al pie, adelante
    if (j.est === 'ataja' || (j.arquero && j.agarrada)) {
      p.x = j.x + Math.cos(j.ang) * .3; p.z = j.z + Math.sin(j.ang) * .3; p.y = 1.1;
    } else {
      const lejos = .48 + Math.min(.25, j.velocidad * .03);
      const tx = j.x + Math.cos(j.ang) * lejos, tz = j.z + Math.sin(j.ang) * lejos;
      p.x += (tx - p.x) * Math.min(1, PASO * 22); p.z += (tz - p.z) * Math.min(1, PASO * 22); p.y = R_PEL;
    }
    // pegado a la pared la pelota no atraviesa el tablero
    p.z = clamp(p.z, -m.A / 2 + R_PEL, m.A / 2 - R_PEL);
    if (Math.abs(p.z) > m.arco / 2) p.x = clamp(p.x, -m.L / 2 + R_PEL, m.L / 2 - R_PEL);
    p.vx = j.vx; p.vz = j.vz; p.vy = 0;
    return;
  }
  // vuelo y rebotes
  p.vy -= G * PASO;
  p.x += p.vx * PASO; p.y += p.vy * PASO; p.z += p.vz * PASO;
  if (p.y < R_PEL) {
    p.y = R_PEL;
    if (p.vy < -2) { p.vy = -p.vy * .5; evento(m, { k: 'pique', x: p.x, z: p.z, fuerza: -p.vy }); } else p.vy = 0;
    const roce = 1 - PASO * 1.1;
    p.vx *= roce; p.vz *= roce;
  } else { p.vx *= 1 - PASO * .1; p.vz *= 1 - PASO * .1; }
  if (p.y > 8) { p.y = 8; p.vy = -Math.abs(p.vy) * .5; } // la red del techo
  // paredes de los costados
  const mz = m.A / 2 - R_PEL;
  if (Math.abs(p.z) > mz) { p.z = Math.sign(p.z) * mz; p.vz = -p.vz * .7; evento(m, { k: 'pared', x: p.x, z: p.z, fuerza: Math.abs(p.vz) }); }
  // fondo: arco o pared
  const lx = m.L / 2;
  const enBoca = Math.abs(p.z) < m.arco / 2 - R_PEL && p.y < m.altoArco - R_PEL;
  if (Math.abs(p.x) > lx - R_PEL && !enBoca && Math.abs(p.x) < lx + .2) {
    // palos y travesaño
    const palo = Math.abs(Math.abs(p.z) - m.arco / 2) < .2 && p.y < m.altoArco + .1;
    const trave = Math.abs(p.z) < m.arco / 2 && Math.abs(p.y - m.altoArco) < .2;
    p.x = Math.sign(p.x) * (lx - R_PEL); p.vx = -p.vx * (palo || trave ? .85 : .65);
    if (trave) p.vy = -Math.abs(p.vy) * .5;
    evento(m, { k: palo || trave ? 'palo' : 'pared', x: p.x, z: p.z, fuerza: Math.abs(p.vx) });
  }
  // gol: la pelota entra entera
  if (Math.abs(p.x) > lx + R_PEL && m.fase === 'juego') {
    const eq = p.x > 0 ? 0 : 1; // al arco de la derecha mete el rojo
    gol(m, eq);
  }
  if (Math.abs(p.x) > lx + 1.1) { p.x = Math.sign(p.x) * (lx + 1.1); p.vx = -p.vx * .15; } // la red de atrás
  if (Math.abs(p.x) > lx && Math.abs(p.z) > m.arco / 2 - R_PEL) { p.z = Math.sign(p.z) * (m.arco / 2 - R_PEL); p.vz *= -.3; }
  if (Math.abs(p.x) > lx && p.y > m.altoArco - R_PEL) { p.y = m.altoArco - R_PEL; p.vy = -Math.abs(p.vy) * .2; }
  if (m.fase !== 'juego') return;
  // ¿alguien la controla?
  let mejor = null, md = Infinity;
  for (const j of m.jug) {
    if (['caido', 'levanta', 'festeja', 'triste'].includes(j.est)) continue;
    if (p.libreDe === j.id && p.libreT > 0) continue;
    const d = dist(j, p);
    const arq = j.arquero && enArea(m, j, p);
    const alcance = arq ? (j.est === 'vuela' ? 1.05 : .72) : .62;
    const alto = arq ? (j.est === 'vuela' ? 2.1 : 2.3) : .75;
    if (d < alcance && p.y < alto && d < md) {
      const rel = Math.hypot(p.vx - j.vx, p.vz - j.vz);
      if (j.est === 'vuela' || rel < 24 || (j.arquero && enArea(m, j, p))) { md = d; mejor = j; }
    }
  }
  if (mejor) {
    const rel = Math.hypot(p.vx - mejor.vx, p.vz - mejor.vz);
    if (mejor.arquero && enArea(m, mejor, p)) {
      // atajada: si viene muy fuerte o es una estirada, a veces la da rebote
      const ataja = Math.random() < clamp(.88 - rel * .036 - (mejor.est === 'vuela' ? .1 : 0) + m.dificultad * .05, .1, .9);
      if (rel > 9 && (mejor.est === 'vuela' || rel > 14)) evento(m, { k: 'atajada', a: mejor.id, rebote: !ataja });
      if (ataja || rel < 9) {
        p.duenio = mejor.id; mejor.agarrada = rel > 6; mejor.est = mejor.agarrada ? 'ataja' : mejor.est; mejor.t = 0; mejor.paraSacar = .9;
      } else {
        p.vx = -p.vx * .35 + (Math.random() - .5) * 4; p.vz = p.vz * .4 + (Math.random() - .5) * 8; p.vy = 2 + Math.random() * 3;
        p.libreDe = mejor.id; p.libreT = .35; p.ultimo = mejor.id;
      }
    } else if (rel < 15 || mejor.esperaPase > 0) {
      const antes = p.ultimo && buscar(m, p.ultimo);
      p.duenio = mejor.id; p.penultimo = p.ultimo; p.ultimo = mejor.id;
      if (antes && antes.eq !== mejor.eq) evento(m, { k: 'recupera', a: mejor.id });
      evento(m, { k: 'control', a: mejor.id });
    } else {
      // le rebota
      p.vx = -p.vx * .3 + mejor.vx; p.vz = -p.vz * .3 + mejor.vz; p.vy = 1.5; p.libreDe = mejor.id; p.libreT = .2; p.ultimo = mejor.id;
    }
  }
  for (const j of m.jug) if (j.esperaPase > 0) j.esperaPase -= PASO;
}

const enArea = (m, j, p) => Math.abs(p.x - (-j.s * m.L / 2)) < 6.5 && Math.abs(p.z) < m.arco / 2 + 4.5;

function gol(m, eq) {
  const p = m.pel;
  m.marcador[eq] += 1;
  const autorJ = p.ultimo && buscar(m, p.ultimo);
  const contra = !!autorJ && autorJ.eq !== eq;
  const asist = !contra && p.penultimo && buscar(m, p.penultimo);
  if (autorJ && !contra) autorJ.goles += 1;
  const g = { eq, autor: autorJ?.id || null, contra, asistencia: asist && asist.eq === eq && asist.id !== autorJ?.id ? asist.id : null, t: m.t, marcador: [...m.marcador] };
  m.goles.push(g);
  m.fase = 'gol'; m.faseT = 0; m.saca = 1 - eq;
  for (const j of m.jug) { j.cargando = false; j.carga = 0; }
  evento(m, { k: 'gol', ...g });
}

// ---------------------------------------------------------------- cambio de jugador (humanos)
function cambiarJugador(m, hid, aMano) {
  const actual = buscar(m, m.mando[hid]);
  if (!actual) return;
  const tomados = new Set(Object.values(m.mando));
  const cand = m.jug.filter((j) => j.eq === actual.eq && !j.arquero && j.id !== actual.id && !tomados.has(j.id));
  if (!cand.length) return;
  const p = m.pel;
  cand.sort((a, b) => dist(a, p) - dist(b, p));
  m.mando[hid] = cand[0].id;
  cand[0].humano = true; actual.humano = false;
  actual.cargando = false; actual.carga = 0;
  m.cambioT = m.t;
  evento(m, { k: 'cambio', hid, a: cand[0].id, mano: aMano });
}
function cambioAutomatico(m, hid) {
  const actual = buscar(m, m.mando[hid]);
  const p = m.pel;
  if (!actual || m.fase !== 'juego') return;
  actual.humano = true;
  const duenio = p.duenio && buscar(m, p.duenio);
  // si un compañero (bot) agarró la pelota, paso a manejarlo a él
  if (duenio && duenio.eq === actual.eq && duenio.id !== actual.id && !duenio.arquero && !Object.values(m.mando).includes(duenio.id)) {
    m.mando[hid] = duenio.id; duenio.humano = true; actual.humano = false;
    evento(m, { k: 'cambio', hid, a: duenio.id }); return;
  }
  if (duenio && duenio.eq === actual.eq) return;
  if (m.t - (m.cambioT || 0) < .8) return;
  // defendiendo o pelota suelta: si hay uno mucho más cerca, cambio
  const tomados = new Set(Object.values(m.mando));
  const mio = dist(actual, p);
  let mejor = null;
  for (const j of m.jug) if (j.eq === actual.eq && !j.arquero && !tomados.has(j.id) && dist(j, p) < mio - 4 && (!mejor || dist(j, p) < dist(mejor, p))) mejor = j;
  if (mejor && (!duenio || duenio.eq !== actual.eq)) { m.mando[hid] = mejor.id; mejor.humano = true; actual.humano = false; m.cambioT = m.t; evento(m, { k: 'cambio', hid, a: mejor.id }); }
}

// ---------------------------------------------------------------- arqueros
function pensarArquero(m, j) {
  const p = m.pel;
  const gx = -j.s * m.L / 2;
  // con la pelota en la mano: espera un toque y la pasa (o la revienta)
  if (p.duenio === j.id) {
    j.paraSacar = (j.paraSacar ?? .8) - PASO;
    if (j.paraSacar > 0) return { x: 0, z: 0 };
    j.agarrada = false; j.paraSacar = undefined;
    const libres = m.jug.filter((o) => o.eq === j.eq && !o.arquero).sort((a, b) => Math.min(...m.jug.filter((e) => e.eq !== j.eq).map((e) => dist(e, b))) - Math.min(...m.jug.filter((e) => e.eq !== j.eq).map((e) => dist(e, a))));
    const o = libres[0];
    if (o) return { x: (o.x - j.x), z: (o.z - j.z), pase: true, ...(dist(o, j) > 18 ? { barrida: true, pase: false } : {}) };
    return { x: j.s, z: 0, tiro: false };
  }
  // ¿viene un remate? se estira
  const haciaMi = p.vx * -j.s;
  if (!p.duenio && haciaMi > 7 && j.est !== 'vuela' && j.cd <= 0) {
    const tLlega = (Math.abs(p.x - gx)) / Math.abs(p.vx);
    const zLlega = p.z + p.vz * tLlega;
    if (tLlega < .48 && Math.abs(zLlega) < m.arco / 2 + .6) {
      const dz = zLlega - j.z;
      if (Math.abs(dz) > .7) {
        j.est = 'vuela'; j.t = 0; j.cd = 1.2;
        const reflejo = (.5 + m.dificultad * .1) * (.8 + Math.random() * .4);
        j.vz = clamp(dz / Math.max(.18, tLlega), -8.5, 8.5) * reflejo; j.vx = 0;
        j.ang = j.s > 0 ? 0 : Math.PI;
        evento(m, { k: 'estirada', a: j.id, lado: Math.sign(dz) });
        return { x: 0, z: 0 };
      }
    }
  }
  // pelota suelta cerca del arco y nadie del otro equipo más cerca: salir a buscarla
  const enemigoCerca = Math.min(...m.jug.filter((e) => e.eq !== j.eq).map((e) => dist(e, p)));
  if (!p.duenio && enArea(m, j, p) && dist(j, p) < enemigoCerca + .5 && p.y < 2) return { x: p.x - j.x, z: p.z - j.z, sprint: true };
  // si no, pararse entre la pelota y el centro del arco
  const dg = Math.hypot(p.x - gx, p.z);
  const sale = clamp(dg * .1, .4, 2.6);
  const ang = Math.atan2(p.z, p.x - gx);
  const tx = gx + Math.cos(ang) * sale, tz = clamp(Math.sin(ang) * sale + p.z * .08, -m.arco / 2 - .3, m.arco / 2 + .3);
  const dx = tx - j.x, dz = tz - j.z;
  const l = Math.hypot(dx, dz);
  if (l < .15) { j.ang += angDif(j.ang, Math.atan2(p.z - j.z, p.x - j.x)) * .2; return { x: 0, z: 0 }; }
  return { x: dx / Math.max(l, .6), z: dz / Math.max(l, .6) };
}

// ---------------------------------------------------------------- bots de campo
export function pensarBot(m, j) {
  const p = m.pel;
  const ia = (j.ia ??= { prox: 0, inp: { x: 0, z: 0 }, cargaHasta: 0 });
  const dif = m.dificultad;
  const arco = OTRO_ARCO(m, j);
  const tengo = p.duenio === j.id;
  // cargando un remate: sigue apretando hasta el momento y suelta
  if (ia.cargaHasta) {
    if (m.t < ia.cargaHasta && tengo) return { ...ia.inp, tiro: true };
    ia.cargaHasta = 0;
    return { ...ia.inp, tiro: false };
  }
  if (m.t < ia.prox) return { x: ia.inp.x, z: ia.inp.z, sprint: ia.inp.sprint };
  ia.prox = m.t + [.26, .17, .1][dif] + Math.random() * .08;
  const enemigos = m.jug.filter((e) => e.eq !== j.eq);
  const cercano = (q) => Math.min(...enemigos.map((e) => dist(e, q)));
  if (tengo) {
    const dArco = dist(j, arco);
    const presion = cercano(j);
    const deFrente = Math.abs(angDif(j.ang, Math.atan2(arco.z - j.z, arco.x - j.x))) < 1.3;
    if (dArco < 15 + dif * 2.5 && deFrente && Math.random() < .68 + dif * .1) {
      ia.cargaHasta = m.t + .25 + Math.random() * (.35 + .15 * (dArco > 10)) ;
      ia.inp = { x: Math.sign(arco.x - j.x) * .3, z: Math.random() < .5 ? -1 : 1 };
      return { ...ia.inp, tiro: true };
    }
    if (presion < 2.3 && Math.random() < .55) {
      // pase al compañero más libre hacia adelante
      const comp = m.jug.filter((o) => o.eq === j.eq && o.id !== j.id && !o.arquero).sort((a, b) => (cercano(b) * 1.2 + (b.x - j.x) * j.s * .25) - (cercano(a) * 1.2 + (a.x - j.x) * j.s * .25))[0];
      if (comp) { ia.inp = { x: 0, z: 0 }; return { x: comp.x - j.x, z: comp.z - j.z, pase: true }; }
    }
    // gambeta hacia el arco esquivando al que viene
    let dx = arco.x - j.x, dz = arco.z * .5 - j.z;
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const e = enemigos.length ? enemigos.reduce((a, b) => (dist(a, j) < dist(b, j) ? a : b)) : null;
    if (e && dist(e, j) < 3.5) { const lado = Math.sign((e.z - j.z) || 1); dz -= lado * .9; }
    ia.inp = { x: dx, z: dz, sprint: presion > 4 && j.energia > .4 };
    return ia.inp;
  }
  const duenio = p.duenio && buscar(m, p.duenio);
  const nuestra = duenio && duenio.eq === j.eq;
  // el más cercano de mi equipo va a buscarla (si no es nuestra)
  const mios = m.jug.filter((o) => o.eq === j.eq && !o.arquero && !['caido'].includes(o.est));
  // si la pelota viene hacia mí (o es un pase para mí), voy a su encuentro; si se aleja, voy a donde va a estar
  const viene = (p.vx * (j.x - p.x) + p.vz * (j.z - p.z)) > 0;
  if (j.esperaPase > 0 && !p.duenio) { const dx = p.x - j.x, dz = p.z - j.z, l = Math.hypot(dx, dz) || 1; ia.inp = { x: dx / l, z: dz / l }; ia.prox = m.t + .05; return ia.inp; }
  const futura = viene ? { x: p.x, z: p.z } : { x: p.x + p.vx * .35, z: p.z + p.vz * .35 };
  const cazador = mios.length ? mios.reduce((a, b) => (dist(a, futura) < dist(b, futura) ? a : b)) : j;
  if (!nuestra && cazador === j) {
    const dx = futura.x - j.x, dz = futura.z - j.z;
    ia.inp = { x: dx, z: dz, sprint: j.energia > .25 };
    if (duenio && dist(j, duenio) < 1.15) {
      const r = Math.random();
      if (r < .3 + dif * .08) return { ...ia.inp, pase: true }; // quite
      if (r < .36 + dif * .03 && j.cd <= 0) { j.ang = Math.atan2(dz, dx); return { ...ia.inp, barrida: true }; }
    }
    if (!duenio && p.y > .8 && dist(j, p) < 1.2) return { ...ia.inp, tiro: true }; // volea / cabezazo
    return ia.inp;
  }
  // el resto: a su puesto (si atacamos, un poco más adelante y abiertos)
  const q = puesto(m, j);
  let tx = q.x + (nuestra ? j.s * 3 : 0), tz = q.z;
  if (!nuestra) {
    // marcar al rival más cercano a mi puesto
    const libres = enemigos.filter((e) => !e.arquero);
    const marca = libres.length ? libres.reduce((a, b) => (Math.hypot(a.x - q.x, a.z - q.z) < Math.hypot(b.x - q.x, b.z - q.z) ? a : b)) : null;
    if (marca && Math.hypot(marca.x - q.x, marca.z - q.z) < 7) { tx = (q.x + marca.x - j.s * 1.2) / 2 + (marca.x - j.s * 1.2) / 4; tz = (q.z + marca.z) / 2; }
  }
  const dx = tx - j.x, dz = tz - j.z, l = Math.hypot(dx, dz);
  ia.inp = l < .6 ? { x: 0, z: 0 } : { x: dx / Math.max(l, 2), z: dz / Math.max(l, 2), sprint: l > 8 };
  return ia.inp;
}

// ---------------------------------------------------------------- red: el anfitrión manda esto a los demás
const FASES = ['saque', 'juego', 'gol', 'fin'];
const r2 = (v) => Math.round(v * 100) / 100;
export function codificar(m) {
  const p = m.pel;
  return 'M' + JSON.stringify([
    FASES.indexOf(m.fase), r2(m.faseT), m.marcador, Number.isFinite(m.tiempo) ? r2(m.tiempo) : -1,
    m.jug.map((j) => [r2(j.x), r2(j.z), r2(j.ang), ESTADOS.indexOf(j.est), r2(j.t), r2(j.vx), r2(j.vz), r2(j.carga), r2(j.energia)]),
    [r2(p.x), r2(p.y), r2(p.z), r2(p.vx), r2(p.vy), r2(p.vz), p.duenio ? m.jug.findIndex((j) => j.id === p.duenio) : -1],
    m.ev.slice(-8).map((e) => ({ ...e, t: undefined })), m.mando, m.ganador,
  ]);
}
// arma una vista dibujable a partir de lo recibido (los ids salen del partido local armado igual)
export function decodificar(s, base) {
  try {
    const d = JSON.parse(s.slice(1));
    const v = { fase: FASES[d[0]], faseT: d[1], marcador: d[2], tiempo: d[3] < 0 ? Infinity : d[3], ev: d[6] || [], mando: d[7] || {}, ganador: d[8], formato: base.formato, L: base.L, A: base.A, arco: base.arco, altoArco: base.altoArco, goles: base.goles };
    v.jug = base.jug.map((j, i) => { const f = d[4][i] || []; return { ...j, x: f[0], z: f[1], ang: f[2], est: ESTADOS[f[3]] || 'quieto', t: f[4], vx: f[5], vz: f[6], carga: f[7], energia: f[8], velocidad: Math.hypot(f[5], f[6]) }; });
    const b = d[5];
    v.pel = { x: b[0], y: b[1], z: b[2], vx: b[3], vy: b[4], vz: b[5], duenio: b[6] >= 0 ? base.jug[b[6]]?.id : null };
    return v;
  } catch {
    return null;
  }
}
export const BITS = ['pase', 'tiro', 'barrida', 'cambiar', 'sprint'];
export function codificarEntrada(e) {
  let b = 0;
  BITS.forEach((k, i) => { if (e[k]) b |= 1 << i; });
  return `I${Math.round((e.x || 0) * 10) / 10},${Math.round((e.z || 0) * 10) / 10},${b}`;
}
export function decodificarEntrada(s) {
  const [x, z, b] = s.slice(1).split(',').map(Number);
  const e = { x: clamp(x || 0, -1, 1), z: clamp(z || 0, -1, 1) };
  BITS.forEach((k, i) => { if (b & (1 << i)) e[k] = true; });
  return e;
}
