// Tests de Empujón: el motor (empujar, agarrar, revolear, caídas, corona, equipos, objetos, achique), la red y la sala.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaPartida, paso, PASO, buscar, empujon as empujar, agregarJugador, dentro, codificar, decodificar, codificarEntrada, decodificarEntrada } from '../public/js/motor.js';
import { empujon } from '../lib/empujon.js';

const correr = (m, seg, ent = new Map()) => { for (let t = 0; t < seg; t += PASO) paso(m, ent); };
function partida(extra = {}) {
  const m = nuevaPartida({ mapa: 'terraza', jugadores: [{ id: 'a' }, { id: 'b' }], minutos: 3, ...extra });
  correr(m, 3.1); // pasa la cuenta regresiva
  for (const j of m.jug) j.invul = 0;
  return m;
}
const poner = (j, x, z, ang = 0) => Object.assign(j, { x, z, y: 0, vx: 0, vz: 0, vy: 0, ang, est: 'quieto', t: 0, aturdido: 0, cd: 0, invul: 0 });

test('arranca con cuenta regresiva y después se juega', () => {
  const m = nuevaPartida({ jugadores: [{ id: 'a' }] });
  assert.equal(m.fase, 'cuenta');
  correr(m, 3.1);
  assert.equal(m.fase, 'juego');
});

test('el empujón tira para atrás al de enfrente; cargado, mucho más', () => {
  const m = partida();
  const a = buscar(m, 'a'), b = buscar(m, 'b');
  poner(a, 0, 0, 0); poner(b, 1, 0);
  empujar(m, a, 0);
  const suave = Math.hypot(b.vx, b.vz);
  assert.ok(suave > 5, 'lo empujó');
  poner(a, 0, 0, 0); poner(b, 1, 0);
  empujar(m, a, 1);
  assert.ok(Math.hypot(b.vx, b.vz) > suave * 1.6, 'cargado sale más fuerte');
});

test('tirarlo afuera da un punto, te hace crecer, y el otro vuelve a entrar', () => {
  const m = partida();
  const a = buscar(m, 'a'), b = buscar(m, 'b');
  poner(a, 8.5, 0, 0); poner(b, 9.6, 0);
  empujar(m, a, 1);
  correr(m, 2.5);
  assert.equal(a.puntos, 1);
  assert.ok(a.escala > 1, 'creció');
  assert.equal(b.caidas, 1);
  correr(m, 2);
  assert.notEqual(b.est, 'fuera', 'volvió a entrar');
  assert.ok(dentro(m, b.x, b.z));
});

test('agarrar y revolear: con el agarrado en el borde, se cae', () => {
  const m = partida();
  const a = buscar(m, 'a'), b = buscar(m, 'b');
  poner(a, 6, 0, 0); poner(b, 7, 0);
  paso(m, new Map([['a', { x: 0, z: 0, agarrar: true }]]));
  assert.equal(b.est, 'agarrado');
  correr(m, .6, new Map([['a', { x: 1, z: 0, agarrar: true }]]));
  paso(m, new Map([['a', { x: 1, z: 0, agarrar: false }]]));
  correr(m, 2.5);
  assert.ok(a.puntos >= 1, 'lo revoleó afuera');
});

test('el agarrado se zafa apretando botones', () => {
  const m = partida();
  const a = buscar(m, 'a'), b = buscar(m, 'b');
  poner(a, 0, 0, 0); poner(b, 1, 0);
  paso(m, new Map([['a', { x: 0, z: 0, agarrar: true }]]));
  for (let i = 0; i < 12 && b.est === 'agarrado'; i++) {
    paso(m, new Map([['a', { x: 0, z: 0, agarrar: true }], ['b', { x: 0, z: 0, empujar: true }]]));
    paso(m, new Map([['a', { x: 0, z: 0, agarrar: true }], ['b', { x: 0, z: 0 }]]));
  }
  assert.notEqual(b.est, 'agarrado');
  assert.equal(a.agarra, null);
});

test('la corona: el que va primero vale doble', () => {
  const m = partida();
  const a = buscar(m, 'a'), b = buscar(m, 'b');
  b.puntos = 3; paso(m);
  assert.ok(b.corona);
  poner(a, 8.5, 0, 0); poner(b, 9.6, 0);
  empujar(m, a, 1); correr(m, 2.5);
  assert.equal(a.puntos, 2, 'tirar al de la corona vale 2');
});

test('por equipos: a los compañeros no se los empuja y los puntos van al equipo', () => {
  const m = nuevaPartida({ modo: 'equipos', jugadores: [{ id: 'a', eq: 0 }, { id: 'c', eq: 0 }, { id: 'b', eq: 1 }] });
  correr(m, 3.1); for (const j of m.jug) j.invul = 0;
  const a = buscar(m, 'a'), c = buscar(m, 'c'), b = buscar(m, 'b');
  poner(a, 0, 0, 0); poner(c, 1, 0); poner(b, -5, 4);
  empujar(m, a, 1);
  assert.ok(Math.hypot(c.vx, c.vz) < 1, 'al compañero no lo empuja');
  poner(a, 8.5, 0, 0); poner(b, 9.6, 0); poner(c, -5, 4);
  empujar(m, a, 1); correr(m, 2.5);
  assert.deepEqual(m.marcador, [1, 0]);
});

test('el último tramo la plataforma se achica', () => {
  const m = partida({ minutos: 2 });
  correr(m, 100);
  assert.ok(m.area < .8, `se achicó (${m.area.toFixed(2)})`);
  correr(m, 25);
  assert.equal(m.fase, 'fin');
  assert.ok(m.ranking.length === 2);
});

test('objetos: la cáscara hace resbalar y la bomba revolea', () => {
  const m = partida();
  const a = buscar(m, 'a'), b = buscar(m, 'b');
  poner(a, -3, 0, 0); poner(b, 3, 3);
  m.trampas.push({ x: 0, z: 0, de: 'b', t: 10 });
  correr(m, 1, new Map([['a', { x: 1, z: 0 }]]));
  assert.ok(m.ev.some((e) => e.k === 'resbala' && e.a === 'a'), 'resbaló');
  poner(a, 0, 0); poner(b, 1.5, 0);
  m.bombas.push({ x: .7, z: 0, de: 'z', t: .05 });
  correr(m, .1);
  assert.ok(Math.hypot(a.vx, a.vz) > 3 && Math.hypot(b.vx, b.vz) > 3, 'los revoleó');
});

test('rondas enteras de bots (todos contra todos con 20 y 4v4): no se rompe y hay tiradas', () => {
  for (const [modo, n] of [['todos', 20], ['equipos', 8]]) {
    const m = nuevaPartida({ mapa: 'plato', modo, minutos: 2, jugadores: Array.from({ length: n }, (_, i) => ({ id: 'b' + i, bot: true, eq: i % 2 })) });
    let tiradas = 0, visto = 0;
    while (m.fase !== 'fin') {
      paso(m);
      for (const e of m.ev) if (e.n > visto) { visto = e.n; if (e.k === 'tirada') tiradas++; }
      for (const j of m.jug) assert.ok(Number.isFinite(j.x) && Number.isFinite(j.y));
    }
    assert.ok(tiradas > 20, `${modo}: hubo tiradas (${tiradas})`);
    assert.ok(codificar(m).length < 2400, 'entra en el plan B');
  }
});

test('la red: la ronda y las entradas viajan', () => {
  const m = partida();
  agregarJugador(m, { id: 'c', bot: true });
  correr(m, 2);
  const v = decodificar(codificar(m), m);
  assert.equal(v.jug.length, 3);
  assert.ok(Math.abs(v.jug[0].x - m.jug[0].x) < .01);
  assert.deepEqual(decodificarEntrada(codificarEntrada({ x: 1, z: -.5, empujar: true, salto: true })), { x: 1, z: -.5, empujar: true, salto: true });
});

// ---------------------------------------------------------------- sala del servidor
async function req(metodo, ruta, body) {
  const r = await empujon.handle(new Request('http://x/api/empujon' + ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));
  return r.json();
}
test('sala: bots que completan, y el que llega con la ronda empezada entra al toque', async () => {
  const A = 'pidEmpujonHost001', B = 'pidEmpujonInv0002';
  const { code } = await req('POST', '/crear', { pid: A, nombre: 'Ana', opciones: {} });
  const accion = (pid, msg) => req('POST', `/salas/${code}`, { pid, ping: 1, msg });
  const ver = async (pid) => (await req('GET', `/salas/${code}?pid=${pid}&ping=1`)).estado;
  await accion(A, { t: 'join', nombre: 'Ana' });
  await accion(A, { t: 'config', bots: 7, mapa: 'puente' });
  await accion(A, { t: 'empezar' });
  let e = await ver(A);
  assert.equal(e.fase, 'juego');
  assert.equal(e.botList.length, 7);
  await accion(B, { t: 'join', nombre: 'Beto' });
  e = await ver(B);
  assert.ok(e.participantes.includes(e.yo), 'entró en mitad de la ronda');
  await accion(A, { t: 'resultado', n: e.partidaN, ranking: [{ id: e.yo, puntos: 5, puesto: 1 }], titulo: '¡Ganó Beto!', top: [{ nombre: 'Beto', puntos: 5 }] });
  e = await ver(A);
  assert.equal(e.fase, 'fin');
  assert.equal(e.resultado.titulo, '¡Ganó Beto!');
});

test('sala por equipos 4v4: los bots completan cada equipo y el que llega le saca el lugar a un bot', async () => {
  const A = 'pidEquiposHost001', B = 'pidEquiposInv0002';
  const { code } = await req('POST', '/crear', { pid: A, nombre: 'Ana', opciones: { modo: 'equipos', tamEq: 4 } });
  const accion = (pid, msg) => req('POST', `/salas/${code}`, { pid, ping: 1, msg });
  const ver = async (pid) => (await req('GET', `/salas/${code}?pid=${pid}&ping=1`)).estado;
  await accion(A, { t: 'join', nombre: 'Ana' });
  await accion(A, { t: 'empezar' });
  let e = await ver(A);
  assert.equal(e.botList.length, 7, '4v4 con una persona: 7 bots');
  await accion(B, { t: 'join', nombre: 'Beto' });
  e = await ver(A);
  assert.equal(e.participantes.length + e.botList.length, 8, 'sigue siendo 4 contra 4');
});
