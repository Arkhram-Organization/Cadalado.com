import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haxball } from '../lib/haxball.js';
import { nuevoMundo, acomodar, paso, pensarBot, codificar, decodificar, estadio, ESTADIOS, R_JUG, R_PEL } from '../public/js/fisica.js';
import { getStore } from '../../../shared/store.js';

async function req(metodo, ruta, body) {
  const res = await haxball.handle(new Request('http://x/api/haxball' + ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));
  return { status: res.status, data: await res.json() };
}
const accion = (code, pid, msg) => req('POST', `/salas/${code}`, { pid, ping: 1, msg });
const ver = async (code, pid) => (await req('GET', `/salas/${code}?pid=${pid}&ping=1`)).data.estado;
async function tocar(code, cambios) {
  const k = `sala:haxball:${code}`;
  const r = JSON.parse(await getStore().get(k));
  Object.assign(r, cambios);
  await getStore().set(k, JSON.stringify(r), 3600);
}

test('física: la pelota pateada entra al arco y es gol', () => {
  const m = nuevoMundo('classic'); m.saque = null;
  m.jug.set('a', { x: 370 - 60, y: 0, vx: 0, vy: 0, equipo: 'rojo' });
  m.pelota.x = 370 - 60 + R_JUG + R_PEL + 2;
  let gol = null;
  for (let i = 0; i < 200 && !gol; i++) gol = paso(m, new Map([['a', { x: 1, y: 0, patea: i === 0 }]]));
  assert.equal(gol, 'rojo');
});

test('física: la pelota rebota en el borde y no sale de la cancha', () => {
  const m = nuevoMundo('classic');
  m.pelota.vy = 8; m.pelota.x = 100;
  for (let i = 0; i < 300; i++) assert.equal(paso(m, new Map()), null);
  assert.ok(Math.abs(m.pelota.y) <= 170);
  // contra la red: la pelota que entra al arco no se escapa por atrás
  const n = nuevoMundo('classic'); n.pelota.x = 300; n.pelota.vx = 9;
  let g = null; for (let i = 0; i < 200; i++) g = g || paso(n, new Map());
  assert.equal(g, 'rojo'); assert.ok(n.pelota.x < 370 + 30, 'queda adentro de la red');
});

test('física: estadios de HaxBall y saque (el que no saca no entra al círculo)', () => {
  assert.equal(ESTADIOS.length, 8);
  assert.equal(estadio('huge').campoW, 700);
  const m = nuevoMundo('classic');
  m.jug.set('a', { x: 0, y: 0, vx: 0, vy: 0, equipo: 'rojo' });
  m.jug.set('b', { x: 0, y: 0, vx: 0, vy: 0, equipo: 'azul' });
  acomodar(m, 'rojo');
  for (let i = 0; i < 200; i++) paso(m, new Map([['b', { x: -1, y: 0 }]]));
  assert.ok(Math.hypot(m.jug.get('b').x, m.jug.get('b').y) >= 75, 'el azul queda afuera del círculo');
});

test('bots: un bot solo termina haciendo un gol', () => {
  const m = nuevoMundo('classic');
  m.jug.set('bot0', { x: 0, y: 0, vx: 0, vy: 0, equipo: 'azul' });
  acomodar(m, 'azul');
  m.pelota.x = -20;
  let gol = null;
  for (let i = 0; i < 60 * 40 && !gol; i++) gol = paso(m, new Map([['bot0', pensarBot(m, 'bot0', i / 60)]]));
  assert.equal(gol, 'azul');
});

test('red: codificar y decodificar el mundo', () => {
  const m = nuevoMundo();
  m.jug.set('abc', { x: 12.34, y: -5, vx: 1, vy: 0, equipo: 'azul', patea: true });
  const d = decodificar(codificar(m, '7'));
  assert.equal(d.extra, '7');
  assert.equal(d.jug.get('abc').equipo, 'azul');
  assert.equal(d.jug.get('abc').patea, true);
  assert.ok(Math.abs(d.jug.get('abc').x - 12.3) < 0.01);
});

test('sala: equipos, partido con bots, goles del anfitrión y fin al llegar a los goles', async () => {
  const { data } = await req('POST', '/crear', { pid: 'hostHAX0001', nombre: 'Ana', opciones: { bots: 1, goles: 3, minutos: 3 } });
  const code = data.code;
  await accion(code, 'hostHAX0001', { t: 'join', nombre: 'Ana' });
  await accion(code, 'pibeHAX0002', { t: 'join', nombre: 'Beto' });
  let e = await ver(code, 'hostHAX0001');
  const eqs = Object.values(e.equipos);
  assert.ok(eqs.includes('rojo') && eqs.includes('azul'), 'se reparten en los dos equipos');
  assert.equal((await accion(code, 'pibeHAX0002', { t: 'empezar' })).data.error, 'Arranca quien armó la sala');
  await accion(code, 'hostHAX0001', { t: 'empezar' });
  await tocar(code, { inicio: Date.now() - 10 });
  e = await ver(code, 'hostHAX0001');
  assert.equal(e.fase, 'partida');
  assert.equal(e.botEquipo.length, 1);
  for (let n = 0; n < 3; n++) await accion(code, 'hostHAX0001', { t: 'gol', e: 'rojo', autor: e.yo, n });
  await accion(code, 'hostHAX0001', { t: 'gol', e: 'rojo', autor: e.yo, n: 1 }); // repetido: no cuenta
  e = await ver(code, 'hostHAX0001');
  assert.equal(e.marcador.rojo, 3);
  assert.equal(e.fase, 'fin');
  assert.equal(e.ganador, 'rojo');
});
