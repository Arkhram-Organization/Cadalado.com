import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carrera } from '../lib/carrera.js';
import { Jugador } from '../public/js/fisica.js';
import { rutaBot, posBot, moviles, puertas, META_Z } from '../public/js/pista.js';
import { getStore } from '../../../shared/store.js';

async function req(metodo, ruta, body) {
  const res = await carrera.handle(new Request('http://x/api/carrera' + ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));
  return { status: res.status, data: await res.json() };
}
const accion = (code, pid, msg) => req('POST', `/salas/${code}`, { pid, ping: 1, msg });
const ver = async (code, pid) => (await req('GET', `/salas/${code}?pid=${pid}&ping=1`)).data;
async function tocar(code, cambios) {
  const k = `sala:carrera:${code}`;
  const r = JSON.parse(await getStore().get(k));
  Object.assign(r, typeof cambios === 'function' ? cambios(r) : cambios);
  await getStore().set(k, JSON.stringify(r), 3600);
}

test('la pista es igual para todos y los bots llegan en tiempos razonables', () => {
  assert.deepEqual(moviles(12.3, 99), moviles(12.3, 99));
  assert.equal(puertas(5).filter((p) => p.abierta).length, 2);
  for (let i = 0; i < 12; i++) {
    const r = rutaBot(4242, i);
    assert.ok(r.fin > 20 && r.fin < 60, `bot ${i}: ${r.fin}`);
    assert.ok(posBot(r, r.fin + 1, 4242).z <= META_Z);
  }
});

test('física: corre, salta, cae al agua y vuelve al último punto', () => {
  const j = new Jugador(7);
  j.ubicar(0, 0, -3);
  for (let i = 0; i < 60; i++) j.paso(1 / 60, i / 60, { x: 0, z: 1 }, 0);
  assert.ok(j.z < -9 && j.enSuelo, `avanzó a ${j.z}`);
  const ev = j.paso(1 / 60, 1, { x: 0, z: 0, salto: true }, 0);
  assert.ok(ev.includes('salto') && j.vy > 0);
  j.ubicar(0, 0, -50); // sobre el vacío (fila de plataformas que se mueve)
  j.x = 20;
  let cayo = false;
  for (let i = 0; i < 200 && !cayo; i++) cayo = j.paso(1 / 60, 3, { x: 0, z: 0 }, 0).includes('caida');
  assert.ok(cayo);
  assert.equal(j.z, -2);
  // una pared de puerta falsa frena
  const p = puertas(7).find((x) => !x.abierta);
  j.ubicar(p.x, 0, -102.5);
  for (let i = 0; i < 60; i++) j.paso(1 / 60, 5, { x: 0, z: 1 }, 0);
  assert.ok(j.z > -104, 'no atraviesa la puerta maciza');
});

test('sala: largada, señales WebRTC solo al destinatario, llegada y podio con bots', async () => {
  const A = 'pidCarreraAA1';
  const B = 'pidCarreraBB2';
  const C = 'pidCarreraCC3';
  const { code } = (await req('POST', '/crear', { pid: A, nombre: 'Ana', opciones: { bots: 3, publica: true } })).data;
  await accion(code, A, { t: 'join', nombre: 'Ana' });
  await accion(code, B, { t: 'join', nombre: 'Beto' });
  await accion(code, C, { t: 'join', nombre: 'Caro' });
  let v = await ver(code, A);
  const idB = v.estado.jugadores.find((j) => j.nombre === 'Beto').id;
  // señalización: la oferta de Ana le llega solo a Beto
  await accion(code, A, { t: 'senal', para: idB, data: { tipo: 'oferta', sdp: { type: 'offer', sdp: 'x' } } });
  const deB = (await ver(code, B)).eventos.filter((e) => e.k === 'senal');
  const deC = (await ver(code, C)).eventos.filter((e) => e.k === 'senal');
  assert.equal(deB.length, 1);
  assert.equal(deC.length, 0);
  assert.equal(deB[0].de, v.estado.yo);
  // largada
  assert.equal((await accion(code, B, { t: 'empezar' })).data.error, 'Larga la carrera quien armó la sala');
  v = (await accion(code, A, { t: 'empezar' })).data;
  assert.equal(v.estado.fase, 'cuenta');
  assert.equal(v.estado.participantes.length, 3);
  assert.equal(v.estado.botsCarrera, 3);
  await tocar(code, { inicio: Date.now() - 25_000 });
  v = await ver(code, A);
  assert.equal(v.estado.fase, 'carrera');
  // llegada demasiado rápida: no vale
  await tocar(code, { inicio: Date.now() - 5000 });
  assert.equal((await accion(code, A, { t: 'meta' })).data.error, 'Llegada inválida');
  await tocar(code, { inicio: Date.now() - 24_000 });
  await accion(code, A, { t: 'meta' });
  await accion(code, B, { t: 'meta' });
  await accion(code, C, { t: 'meta' });
  // todos llegaron: termina en 3,5 s
  await tocar(code, { fin: Date.now() - 1 });
  v = await ver(code, A);
  assert.equal(v.estado.fase, 'podio');
  assert.equal(v.estado.resultados.length, 6);
  assert.ok(v.estado.resultados.some((x) => x.bot));
  const tiempos = v.estado.resultados.map((x) => x.tiempo ?? Infinity);
  assert.deepEqual(tiempos, [...tiempos].sort((a, b) => a - b));
  assert.equal(JSON.stringify(v.estado).includes('pidCarrera'), false, 'no se filtran identificadores');
  // relevo de posiciones (plan B)
  await req('POST', '/pos', { pid: A, code, s: '1,2,3,0,corre,10' });
  const pos = (await req('GET', `/pos?code=${code}`)).data.pos;
  assert.equal(Object.values(pos)[0], '1,2,3,0,corre,10');
});
