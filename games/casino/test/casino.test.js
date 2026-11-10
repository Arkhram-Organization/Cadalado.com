import { test } from 'node:test';
import assert from 'node:assert/strict';
import { casino, casillero, puntaje, premios, ROJOS } from '../lib/casino.js';
import { getStore } from '../../../shared/store.js';

const rnd = () => Math.random().toString(36).slice(2, 8);
async function req(metodo, ruta, body) {
  const res = await casino.handle(new Request('http://x/api/casino' + ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));
  return { status: res.status, data: await res.json() };
}
const accion = (code, pid, msg) => req('POST', `/salas/${code}`, { pid, ping: 1, msg });
const ver = async (code, pid) => (await req('GET', `/salas/${code}?pid=${pid}&ping=1`)).data;
// adelanta el reloj de una mesa (sin esperar de verdad)
async function adelantar(code) {
  const k = `sala:casino:${code}`;
  const r = JSON.parse(await getStore().get(k));
  r.fin = Date.now() - 1;
  await getStore().set(k, JSON.stringify(r), 3600);
}

test('casilleros y cuentas básicas', () => {
  assert.deepEqual(casillero('n17'), { nums: [17], paga: 35 });
  assert.equal(casillero('rojo').nums.length, 18);
  assert.ok(casillero('rojo').nums.every((n) => ROJOS.has(n)));
  assert.equal(casillero('d2').nums[0], 13);
  assert.equal(casillero('c3').nums.at(-1), 36);
  assert.equal(casillero('n37'), undefined);
  assert.deepEqual(puntaje(['AP', 'KC']), { total: 21, blanda: true });
  assert.equal(puntaje(['AP', 'AC', '9D']).total, 21);
  assert.equal(puntaje(['10P', '9C', '5D']).total, 24);
  const p = premios([['uva', 'siete', 'bar'], ['uva', 'siete', 'bar'], ['uva', 'siete', 'bar']], 100);
  assert.equal(p.jackpot, true);
  assert.deepEqual(p.lineas.sort(), [0, 1, 2]);
});

test('ruleta: varios apuestan a la vez, se paga bien y el saldo cuadra', async () => {
  const code = 'RUL' + rnd().toUpperCase().slice(0, 5);
  await req('POST', '/crear', { pid: 'pidRuletaAA', nombre: 'Ana', opciones: { tipo: 'ruleta' } }).then((r) => r.data);
  const { data } = await req('POST', '/crear', { pid: 'pidRuletaAA', nombre: 'Ana', opciones: { tipo: 'ruleta' } });
  const mesa = data.code;
  const A = 'pidRuleta' + rnd();
  const B = 'pidRuleta' + rnd();
  await accion(mesa, A, { t: 'join', nombre: 'Ana' });
  await accion(mesa, B, { t: 'join', nombre: 'Beto' });
  const inicial = (await ver(mesa, A)).saldo;
  assert.equal(inicial, 8000);
  // apuestas simultáneas
  await Promise.all([
    accion(mesa, A, { t: 'apostar', casillero: 'rojo', monto: 1000 }),
    accion(mesa, A, { t: 'apostar', casillero: 'n7', monto: 100 }),
    accion(mesa, B, { t: 'apostar', casillero: 'negro', monto: 500 }),
    accion(mesa, B, { t: 'apostar', casillero: 'd1', monto: 50 }),
  ]);
  assert.equal((await ver(mesa, A)).saldo, inicial - 1100);
  let r = await accion(mesa, B, { t: 'apostar', casillero: 'rojo', monto: 5000 });
  r = await accion(mesa, B, { t: 'apostar', casillero: 'rojo', monto: 5000 });
  assert.equal(r.data.error, 'No te alcanzan las fichas');
  assert.equal((await ver(mesa, B)).saldo, 8000 - 550 - 5000);
  await accion(mesa, B, { t: 'deshacer' });
  assert.equal((await ver(mesa, B)).saldo, 8000 - 550);
  // gira
  await adelantar(mesa);
  let v = await ver(mesa, A);
  assert.equal(v.estado.fase, 'girando');
  const n = v.estado.resultado;
  assert.equal((await accion(mesa, A, { t: 'apostar', casillero: 'rojo', monto: 10 })).data.error, 'No va más: esperá la próxima');
  await adelantar(mesa);
  v = await ver(mesa, A);
  assert.equal(v.estado.fase, 'pago');
  const esperadoA = inicial - 1100 + (ROJOS.has(n) ? 2000 : 0) + (n === 7 ? 3600 : 0);
  assert.equal(v.saldo, esperadoA, `salió ${n}`);
  const esperadoB = 8000 - 550 + (n !== 0 && !ROJOS.has(n) ? 1000 : 0) + (n >= 1 && n <= 12 ? 150 : 0);
  assert.equal((await ver(mesa, B)).saldo, esperadoB);
  assert.equal(v.estado.historial[0], n);
  // repetir la apuesta en la ronda siguiente
  await adelantar(mesa);
  await ver(mesa, A);
  await accion(mesa, A, { t: 'repetir' });
  assert.equal((await ver(mesa, A)).saldo, esperadoA - 1100);
});

test('blackjack: sentarse, apostar, jugar la mano y cobrar', async () => {
  const { data } = await req('POST', '/crear', { pid: 'pidBJhostAA', nombre: 'Ana', opciones: { tipo: 'blackjack' } });
  const mesa = data.code;
  const A = 'pidBJ' + rnd() + 'xx';
  await accion(mesa, A, { t: 'join', nombre: 'Ana' });
  await accion(mesa, A, { t: 'sentarse', asiento: 2 });
  await accion(mesa, A, { t: 'apostar', monto: 500 });
  await accion(mesa, A, { t: 'apostar', monto: 100 });
  let v = await ver(mesa, A);
  assert.equal(v.estado.asientos[2].apuesta, 600);
  assert.equal(v.saldo, 8000 - 600);
  await adelantar(mesa);
  v = await ver(mesa, A);
  assert.ok(['jugando', 'pago', 'banca'].includes(v.estado.fase), v.estado.fase);
  if (v.estado.fase === 'jugando') {
    assert.equal(v.estado.banca[1], 'X', 'la segunda carta de la banca está tapada');
    assert.equal(v.estado.asientos[2].cartas.length, 2);
    while (v.estado.fase === 'jugando' && v.estado.turno === 2 && v.estado.asientos[2].total < 17) v = (await accion(mesa, A, { t: 'pedir' })).data;
    if (v.estado.fase === 'jugando') v = (await accion(mesa, A, { t: 'plantarse' })).data;
  }
  for (let i = 0; i < 12 && v.estado.fase !== 'pago'; i++) {
    await adelantar(mesa);
    v = await ver(mesa, A);
  }
  assert.equal(v.estado.fase, 'pago');
  const a = v.estado.asientos[2];
  assert.ok(['gana', 'pierde', 'empate', 'blackjack'].includes(a.res));
  assert.equal(v.saldo, 8000 - 600 + a.cobra);
  if (a.res === 'gana') assert.equal(a.cobra, 1200);
  if (a.res === 'empate') assert.equal(a.cobra, 600);
});

test('tragamonedas: tirada, pozo compartido y saldo', async () => {
  const { data } = await req('POST', '/crear', { pid: 'pidSlotsAAA', nombre: 'Ana', opciones: { tipo: 'slots' } });
  const mesa = data.code;
  const A = 'pidSlot' + rnd() + 'x';
  await accion(mesa, A, { t: 'join', nombre: 'Ana' });
  let v = await ver(mesa, A);
  const pozo0 = v.estado.pozo;
  let saldo = v.saldo;
  for (let i = 0; i < 20; i++) {
    const r = (await accion(mesa, A, { t: 'tirar', apuesta: 100 })).data;
    const u = r.estado.ultima;
    assert.equal(u.rod.length, 3);
    saldo = saldo - 100 + u.gana;
    assert.equal(r.saldo, saldo);
  }
  v = await ver(mesa, A);
  assert.ok(v.estado.pozo >= pozo0 + 20 * 3 || v.estado.feed.some((f) => f.pozo));
  assert.equal((await accion(mesa, A, { t: 'tirar', apuesta: 7 })).data.error, 'Apuesta inválida');
});

test('mesas públicas existen solas y aparecen en el lobby', async () => {
  const v = await ver('RULETA', 'pidPublicoA1');
  assert.equal(v.estado.tipo, 'ruleta');
  await accion('SLOTS', 'pidPublicoA1', { t: 'join', nombre: 'Ana' });
  const { salas } = (await req('GET', '/lobby')).data;
  assert.ok(salas.some((s) => s.code === 'SLOTS'));
});

test('desafío entre jugadores: se acepta, el que más gana se lleva el pozo; si nadie acepta, se devuelve', async () => {
  const { data } = await req('POST', '/crear', { pid: 'pidDesafioAA', nombre: 'Ana', opciones: { tipo: 'ruleta' } });
  const mesa = data.code;
  const A = 'pidDesafio' + rnd();
  const B = 'pidDesafio' + rnd();
  const C = 'pidDesafio' + rnd();
  for (const [p, n] of [[A, 'Ana'], [B, 'Beto'], [C, 'Caro']]) await accion(mesa, p, { t: 'join', nombre: n });
  // nadie acepta: vuelve
  await accion(mesa, A, { t: 'desafiar', monto: 1000 });
  assert.equal((await ver(mesa, A)).saldo, 7000);
  assert.equal((await accion(mesa, B, { t: 'desafiar', monto: 500 })).data.error, 'Ya hay un desafío en la mesa');
  await adelantar(mesa);
  let v = await ver(mesa, A);
  assert.equal(v.estado.desafio, null);
  assert.equal(v.saldo, 8000);
  await adelantar(mesa);
  await ver(mesa, A);
  await adelantar(mesa);
  v = await ver(mesa, A);
  assert.equal(v.estado.fase, 'apuestas');
  // Ana desafía, Beto y Caro aceptan; Ana apuesta a todo el paño (siempre recupera algo), los otros no apuestan
  await accion(mesa, A, { t: 'desafiar', monto: 1000 });
  await accion(mesa, B, { t: 'aceptar' });
  await accion(mesa, C, { t: 'aceptar' });
  assert.equal((await accion(mesa, A, { t: 'aceptar' })).data.error, undefined);
  v = await ver(mesa, B);
  assert.equal(v.estado.desafio.aceptan.length, 2);
  assert.equal(v.saldo, 7000);
  for (let k = 0; k <= 36; k++) await accion(mesa, B, { t: 'apostar', casillero: 'n' + k, monto: 10 }); // Beto: neto +360 - 370 = -10
  await accion(mesa, C, { t: 'apostar', casillero: 'n0', monto: 10 }); // Caro: casi seguro pierde 10
  await adelantar(mesa);
  await ver(mesa, A);
  await adelantar(mesa);
  v = await ver(mesa, A);
  assert.equal(v.estado.fase, 'pago');
  const n = v.estado.resultado;
  // Ana no apostó: neto 0, es la mejor salvo que Caro acierte el 0
  if (n !== 0) {
    assert.deepEqual(v.estado.desafioRes.nombres, ['Ana']);
    assert.equal(v.saldo, 7000 + 3000);
  }
  assert.equal(v.estado.desafio, null);
});

test('bots: apuestan en la ruleta, juegan solos al blackjack y hablan en el chat', async () => {
  // ruleta
  const { data } = await req('POST', '/crear', { pid: 'pidBotsRulAA', nombre: 'Ana', opciones: { tipo: 'ruleta' } });
  const A = 'pidBots' + rnd();
  await accion(data.code, A, { t: 'join', nombre: 'Ana' });
  await accion(data.code, A, { t: 'bot-agregar' });
  await accion(data.code, A, { t: 'bot-agregar' });
  let v = await ver(data.code, A);
  assert.equal(v.estado.bots.length, 2);
  assert.equal(v.estado.apuestas.length, 2, 'los bots ya apostaron');
  assert.ok(v.eventos.some((e) => e.k === 'chat' && e.bot), 'saludan en el chat');
  assert.equal(v.saldo, 8000, 'los bots no tocan mis fichas');
  // blackjack: Ana se sienta, sienta un bot y juegan una mano entera
  const bj = (await req('POST', '/crear', { pid: 'pidBotsBJAA', nombre: 'Ana', opciones: { tipo: 'blackjack' } })).data.code;
  await accion(bj, A, { t: 'join', nombre: 'Ana' });
  await accion(bj, A, { t: 'sentarse', asiento: 0 });
  await accion(bj, A, { t: 'bot-sentar', asiento: 2 });
  v = await ver(bj, A);
  assert.ok(v.estado.asientos[2].bot);
  assert.ok(v.estado.asientos[2].apuesta > 0);
  await accion(bj, A, { t: 'apostar', monto: 100 });
  for (let i = 0; i < 40 && v.estado.fase !== 'pago'; i++) {
    await adelantar(bj);
    v = await ver(bj, A);
    if (v.estado.fase === 'jugando' && v.estado.turno === 0) v = (await accion(bj, A, { t: 'plantarse' })).data;
  }
  assert.equal(v.estado.fase, 'pago');
  assert.ok(v.estado.asientos[2].res, 'el bot terminó su mano');
});
