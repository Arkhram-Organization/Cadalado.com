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

// ---------------------------------------------------------------- puestos, trucos y aprendizaje
import { armarEquipo, TRUCOS } from '../public/js/motor.js';

test('armarEquipo respeta los puestos pedidos y el resto sale al azar', () => {
  const personas = [{ id: 'a', npc: 'julo', rol: 'arquero' }, { id: 'b', npc: 'faur', rol: 'delantero' }, { id: 'c', npc: 'mati', rol: 'delantero' }];
  const lista = armarEquipo(5, 0, personas, ['olcho', 'dobro']);
  assert.equal(lista.length, 5);
  assert.equal(lista.find((j) => j.arquero).id, 'a', 'el que pidió arco ataja');
  assert.equal(lista.find((j) => j.id === 'b').rol, 'delantero');
  assert.equal(lista.find((j) => j.id === 'c').rol, 'delantero');
  assert.deepEqual(new Set(lista.filter((j) => !j.arquero).map((j) => j.slot)).size, 4, 'cada uno en un lugar distinto');
  // sin nadie al arco, ataja un bot
  const otra = armarEquipo(6, 1, [{ id: 'x', npc: 'julo', rol: 'aleatorio' }], ['a', 'b', 'c', 'd', 'e']);
  assert.ok(otra.find((j) => j.arquero).bot);
  assert.equal(otra.length, 6);
});

test('el arquero manejado por una persona se estira con la barrida', () => {
  const lista = [...armarEquipo(5, 0, [{ id: 'yo', npc: 'julo', rol: 'arquero' }], ['a', 'b', 'c', 'd']), ...armarEquipo(5, 1, [], ['e', 'f', 'g', 'h', 'i'])];
  const m = nuevoPartido({ formato: 5, jugadores: lista, humanos: [{ hid: 'h', eq: 0, pid: 'yo', cambia: true }] });
  correr(m, 1.6);
  assert.equal(m.cambia.h, false, 'el arquero no cambia de jugador');
  paso(m, new Map([['h', { x: 0, z: 1, barrida: true }]]));
  assert.equal(buscar(m, 'yo').est, 'vuela');
});

test('hay 8 trucos y el caño pasa la pelota entre las piernas', () => {
  assert.equal(TRUCOS.length, 8);
  const m = partido();
  const yo = buscar(m, '0-1'), rival = buscar(m, '1-1');
  despejar(m, ['0-1', '1-1']);
  Object.assign(rival, { x: 1.3, z: 0, est: 'quieto', t: 0, vx: 0, vz: 0, ia: { prox: 1e9, inp: { x: 0, z: 0 } } });
  Object.assign(yo, { x: 0, z: 0, ang: 0, vx: 0, vz: 0 }); m.pel.duenio = yo.id;
  paso(m, new Map([['yo', { x: 0, z: 0, truco: 3 }]]));
  assert.ok(m.ev.some((e) => e.k === 'truco' && e.truco === 'cano' && e.exito));
  let recupero = false;
  for (let t = 0; t < 1.5 && !recupero; t += PASO) { paso(m, new Map([['yo', { x: 1, z: 0 }]])); recupero = m.pel.duenio === yo.id; }
  assert.ok(recupero, 'la volvió a agarrar del otro lado');
  assert.ok(yo.x > rival.x, 'pasó al rival');
});

test('la ruleta esquiva el quite', () => {
  const m = partido();
  const yo = buscar(m, '0-1'), rival = buscar(m, '1-1');
  despejar(m, ['0-1', '1-1']);
  Object.assign(yo, { x: 0, z: 0, ang: 0 }); m.pel.duenio = yo.id;
  Object.assign(rival, { x: 1, z: 0, est: 'quieto', t: 0, cd: 0, ia: { prox: 1e9, inp: { x: 0, z: 0 } } });
  paso(m, new Map([['yo', { x: 0, z: 0, truco: 5 }]]));
  assert.equal(yo.est, 'ruleta');
  for (let i = 0; i < 20; i++) { rival.cd = 0; paso(m, new Map([['yo', { x: 0, z: 0, truco: 5 }]])); }
  assert.equal(m.pel.duenio, yo.id);
});

test('los bots aprenden a qué palo pateás y avisan que te leyeron', () => {
  const m = partido();
  const yo = buscar(m, '0-1');
  for (let i = 0; i < 7; i++) {
    despejar(m, ['0-1']);
    m.fase = 'juego';
    Object.assign(yo, { x: m.L / 2 - 9, z: 0, ang: 0, est: 'quieto', t: 0 }); m.pel.duenio = yo.id;
    paso(m, new Map([['yo', { x: 0, z: 1, tiro: true }]]));
    correr(m, .3, new Map([['yo', { x: 0, z: 1, tiro: true }]]));
    paso(m, new Map([['yo', { x: 0, z: 1 }]]));
    correr(m, .1);
  }
  const lee = m.lee.yo;
  assert.ok(lee.palo[1] >= 5, 'anotó el palo');
  assert.ok(lee.avisos.palo, 'avisó que lo leyeron');
  // el arquero se corre para ese palo cuando lo vuelve a tener cerca
  despejar(m, ['0-1', '1-0']);
  m.fase = 'juego';
  const arq = buscar(m, '1-0');
  Object.assign(arq, { est: 'quieto', t: 0, x: m.L / 2 - 1, z: 0 });
  Object.assign(yo, { x: m.L / 2 - 10, z: 0, ang: 0 }); m.pel.duenio = yo.id;
  correr(m, 1.5, new Map([['yo', { x: 0, z: 0 }]]));
  assert.ok(Math.abs(arq.z) > .2, 'el arquero se corrió');
});

test('la entrada con truco viaja por la red', () => {
  assert.deepEqual(decodificarEntrada(codificarEntrada({ x: 1, z: 0, truco: 4 })), { x: 1, z: 0, truco: 4 });
});

test('sala online: cada uno elige su puesto y no puede haber dos al arco', async () => {
  const A = 'pidRolesHost00001', B = 'pidRolesInv000002';
  const { code } = await req('POST', '/crear', { pid: A, nombre: 'Ana', opciones: { formato: 5 } });
  const accion = (pid, msg) => req('POST', `/salas/${code}`, { pid, ping: 1, msg });
  const ver = async (pid) => (await req('GET', `/salas/${code}?pid=${pid}&ping=1`)).estado;
  await accion(A, { t: 'join', nombre: 'Ana' });
  await accion(B, { t: 'join', nombre: 'Beto' });
  await accion(B, { t: 'equipo', e: 'rojo' });
  await accion(A, { t: 'rol', rol: 'arquero' });
  assert.ok((await accion(B, { t: 'rol', rol: 'arquero' })).error, 'el segundo arquero del mismo equipo no puede');
  await accion(B, { t: 'rol', rol: 'delantero' });
  const e = await ver(A);
  assert.equal(e.rol[e.yo], 'arquero');
  assert.ok(Object.values(e.rol).includes('delantero'));
  assert.ok((await accion(A, { t: 'rol', rol: 'tribuna' })).error);
});
