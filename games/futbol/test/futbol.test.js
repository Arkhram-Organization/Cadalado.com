// Tests de La Canchita: el motor (pelota, pases, remates, goles, arqueros, bots), la red y la sala del servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuevoPartido, paso, PASO, FORMATOS, codificar, decodificar, codificarEntrada, decodificarEntrada, buscar } from '../public/js/motor.js';
import { futbol } from '../lib/futbol.js';

function partido(formato = 5, extra = {}) {
  const jugadores = [];
  for (let eq = 0; eq < 2; eq++) for (let k = 0; k < formato; k++) jugadores.push({ id: `${eq}-${k}`, eq });
  const m = nuevoPartido({ formato, jugadores, humanos: [{ hid: 'yo', eq: 0, pid: '0-1', cambia: false }], minutos: 4, ...extra });
  for (let i = 0; i < 90; i++) paso(m); // pasa el saque
  return m;
}
const correr = (m, seg, ent = new Map()) => { for (let t = 0; t < seg; t += PASO) paso(m, ent); };
// deja a todos los demás lejos, para probar una jugada sola
function despejar(m, menos = []) { for (const j of m.jug) if (!menos.includes(j.id)) { j.x = -m.L / 2 + 2 + Math.random(); j.z = m.A / 2 - 1; j.est = 'caido'; j.t = -1000; } }

test('cada formato arma su cancha y su cantidad de jugadores', () => {
  for (const f of [5, 6, 7, 8]) {
    const m = partido(f);
    assert.equal(m.jug.length, f * 2);
    assert.equal(m.L, FORMATOS[f].L);
    assert.equal(m.jug.filter((j) => j.arquero).length, 2);
  }
});

test('el saque arranca con el pitazo y la pelota en el medio', () => {
  const jugadores = [{ id: 'a', eq: 0 }, { id: 'b', eq: 0 }, { id: 'c', eq: 1 }, { id: 'd', eq: 1 }];
  const m = nuevoPartido({ formato: 5, jugadores, minutos: 2 });
  assert.equal(m.fase, 'saque');
  correr(m, 1.6);
  assert.equal(m.fase, 'juego');
  assert.ok(m.ev.some((e) => e.k === 'pitazo'));
});

test('el que la tiene la lleva pegada al pie', () => {
  const m = partido();
  const yo = buscar(m, '0-1');
  despejar(m, ['0-1']);
  Object.assign(yo, { x: 0, z: 0, ang: 0 }); Object.assign(m.pel, { x: .4, z: 0, y: .11, vx: 0, vz: 0, duenio: null, libreT: 0 });
  correr(m, .1);
  assert.equal(m.pel.duenio, yo.id);
  correr(m, 1, new Map([['yo', { x: 1, z: 0 }]]));
  assert.ok(yo.x > 3, 'avanzó');
  assert.equal(m.pel.duenio, yo.id);
  assert.ok(Math.abs(m.pel.x - yo.x) < 1, 'la pelota va con él');
});

test('remate cargado al arco vacío es gol y se anota al que pateó', () => {
  const m = partido();
  const yo = buscar(m, '0-1');
  despejar(m, ['0-1']);
  const arq = m.jug.find((j) => j.arquero && j.eq === 1); arq.x = m.L / 2 - .5; arq.z = m.A / 2 - 1;
  Object.assign(yo, { x: m.L / 2 - 8, z: 0, ang: 0 }); m.pel.duenio = yo.id;
  paso(m, new Map([['yo', { x: 0, z: 0, tiro: true }]]));
  correr(m, .5, new Map([['yo', { x: 0, z: 0, tiro: true }]]));
  correr(m, 1.2, new Map([['yo', { x: 0, z: 0 }]]));
  assert.equal(m.marcador[0], 1);
  assert.equal(m.goles[0].autor, yo.id);
  assert.equal(m.fase, 'gol');
  correr(m, 3.5);
  assert.equal(m.fase, 'saque', 'después del gol se vuelve a sacar del medio');
  assert.equal(m.saca, 1, 'saca el que lo recibió');
});

test('el pase le llega al compañero', () => {
  const m = partido();
  const yo = buscar(m, '0-1'), comp = buscar(m, '0-2');
  despejar(m, ['0-1', '0-2']);
  Object.assign(yo, { x: -5, z: 0, ang: 0 }); Object.assign(comp, { x: 4, z: 0, vx: 0, vz: 0 }); m.pel.duenio = yo.id;
  paso(m, new Map([['yo', { x: 1, z: 0, pase: true }]]));
  let recibio = false;
  for (let t = 0; t < 1.6 && !recibio; t += PASO) { paso(m); recibio = m.pel.duenio === comp.id; }
  assert.ok(recibio, 'el compañero la controló');
});

test('la barrida le saca la pelota al rival y lo tira', () => {
  const m = partido();
  const yo = buscar(m, '0-1'), rival = buscar(m, '1-1');
  despejar(m, ['0-1', '1-1']);
  Object.assign(rival, { x: 2, z: 0, vx: 0, vz: 0, ang: Math.PI, ia: { prox: 1e9, inp: { x: 0, z: 0 } } }); m.pel.duenio = rival.id; m.pel.x = 1.5; m.pel.z = 0;
  Object.assign(yo, { x: .2, z: 0, ang: 0 });
  paso(m, new Map([['yo', { x: 1, z: 0, barrida: true }]]));
  correr(m, .5);
  assert.notEqual(m.pel.duenio, rival.id);
  assert.ok(['caido', 'levanta'].includes(rival.est));
});

test('las paredes devuelven la pelota (cancha cerrada)', () => {
  const m = partido();
  despejar(m, []);
  Object.assign(m.pel, { x: 0, z: 0, y: .11, vx: 0, vz: 14, vy: 0, duenio: null, libreT: 1 });
  correr(m, 1.2);
  assert.ok(m.pel.vz < 0 || Math.abs(m.pel.z) < m.A / 2, 'rebotó');
  assert.ok(Math.abs(m.pel.z) <= m.A / 2);
});

test('termina por tiempo y queda el ganador', () => {
  const m = partido(5, { minutos: 2 });
  let n = 0;
  while (m.fase !== 'fin' && n++ < 60 * 200) paso(m);
  assert.equal(m.fase, 'fin');
  const [a, b] = m.marcador;
  assert.equal(m.ganador, a === b ? null : a > b ? 0 : 1);
});

test('partido entero de bots: no se rompe y hay remates y atajadas', () => {
  for (const f of [5, 8]) {
    const m = partido(f, { minutos: 3, humanos: [] });
    const tipos = new Set();
    let visto = 0;
    while (m.fase !== 'fin') {
      paso(m);
      for (const e of m.ev) if (e.n > visto) { visto = e.n; tipos.add(e.k); }
      for (const j of m.jug) assert.ok(Number.isFinite(j.x) && Number.isFinite(j.z));
      assert.ok(Number.isFinite(m.pel.x) && Math.abs(m.pel.z) <= m.A / 2 + .01);
    }
    for (const k of ['pase', 'control']) assert.ok(tipos.has(k), `${f}: hubo ${k} (${[...tipos]})`);
  }
});

test('la red: el partido y las entradas se codifican y vuelven', () => {
  const m = partido(8);
  correr(m, 5);
  const s = codificar(m);
  assert.ok(s.length < 2400, 'entra en el plan B');
  const v = decodificar(s, m);
  assert.equal(v.jug.length, 16);
  assert.deepEqual(v.marcador, m.marcador);
  assert.ok(Math.abs(v.pel.x - m.pel.x) < .01);
  assert.deepEqual(decodificarEntrada(codificarEntrada({ x: -1, z: .5, tiro: true, sprint: true })), { x: -1, z: .5, tiro: true, sprint: true });
});

// ---------------------------------------------------------------- sala del servidor
async function req(metodo, ruta, body) {
  const r = await futbol.handle(new Request('http://x/api/futbol' + ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));
  return r.json();
}
test('sala online: equipos con cupo, personaje, bots que completan y resultado', async () => {
  const A = 'pidCanchaHost0001', B = 'pidCanchaInv00002';
  const { code } = await req('POST', '/crear', { pid: A, nombre: 'Ana', opciones: { personaje: 'julo', formato: 5 } });
  const accion = (pid, msg) => req('POST', `/salas/${code}`, { pid, ping: 1, msg });
  const ver = async (pid) => (await req('GET', `/salas/${code}?pid=${pid}&ping=1`)).estado;
  await accion(A, { t: 'join', nombre: 'Ana' });
  await accion(B, { t: 'join', nombre: 'Beto' });
  let e = await ver(A);
  assert.equal(e.personaje[e.yo], 'julo');
  assert.ok((await accion(B, { t: 'personaje', id: 'nadie' })).error);
  await accion(B, { t: 'equipo', e: 'azul' });
  await accion(A, { t: 'empezar' });
  e = await ver(A);
  assert.equal(e.fase, 'partido');
  // F5: cada equipo tiene 5 entre personas y bots (el arquero siempre es bot)
  for (const eq of ['rojo', 'azul']) assert.equal(e.participantes.filter((p) => e.equipos[p] === eq).length + e.bots[eq].length, 5);
  await accion(A, { t: 'resultado', n: e.partidoN, marcador: [3, 2], goles: [] });
  e = await ver(A);
  assert.equal(e.fase, 'fin');
  assert.equal(e.ganador, 0);
  assert.deepEqual(e.marcador, [3, 2]);
});
