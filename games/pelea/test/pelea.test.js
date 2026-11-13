// Tests de Piña Final: el motor de pelea, las rondas, la red y la sala del servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuevoMundo, paso, pensarBot, sortearPoderes, ELEMENTOS, ARMAS, PASO } from '../public/js/motor.js';
import { crearCombate, pasoCombate, codificar, decodificar, codificarEntrada, decodificarEntrada } from '../public/js/combate.js';
import { pelea } from '../lib/pelea.js';

const dos = [{ id: 'a', eq: 0 }, { id: 'b', eq: 1 }];
const poderes = { a: { elem: 'fuego', arma: 'katana' }, b: { elem: 'hielo', arma: 'hacha' } };
function mundo(extra = {}) {
  const m = nuevoMundo(dos, poderes, extra);
  m.fase = 'pelea';
  return m;
}
const quien = (m, id) => m.luch.find((f) => f.id === id);
// aprieta un botón un paso y lo suelta; después deja correr `seg` segundos
function apretar(m, id, entrada, seg = .6, otro = {}) {
  paso(m, new Map([[id, entrada], ...Object.entries(otro)]));
  for (let t = 0; t < seg; t += PASO) paso(m, new Map(Object.entries(otro)));
}
function juntar(m, d = 1) { quien(m, 'a').x = -d / 2; quien(m, 'b').x = d / 2; }

test('la piña pega de cerca y no de lejos', () => {
  const m = mundo(); juntar(m, 1);
  apretar(m, 'a', { x: 0, y: 0, pina: true });
  assert.ok(quien(m, 'b').vida < 100, 'de cerca pega');
  const m2 = mundo(); juntar(m2, 4);
  apretar(m2, 'a', { x: 0, y: 0, pina: true });
  assert.equal(quien(m2, 'b').vida, 100, 'de lejos no llega');
});

test('cubrirse saca casi todo el daño; la barrida solo se cubre agachado', () => {
  const m = mundo(); juntar(m, 1);
  apretar(m, 'a', { x: 0, y: 0, patada: true }, .6, { b: { x: 0, y: 0, guardia: true } });
  assert.ok(quien(m, 'b').vida > 98, 'cubierto: casi nada');
  const m2 = mundo(); juntar(m2, 1);
  apretar(m2, 'a', { x: 0, y: 1, patada: true }, .3, { b: { x: 0, y: 0, guardia: true } });
  assert.equal(quien(m2, 'b').est, 'caido', 'la barrida tira aunque se cubra parado');
  const m3 = mundo(); juntar(m3, 1);
  apretar(m3, 'a', { x: 0, y: 1, patada: true }, .3, { b: { x: 0, y: 1, guardia: true } });
  assert.notEqual(quien(m3, 'b').est, 'caido', 'agachado se la banca');
});

test('agachado, la piña alta pasa por arriba', () => {
  const m = mundo(); juntar(m, 1);
  apretar(m, 'a', { x: 0, y: 0, pina: true }, .4, { b: { x: 0, y: 1 } });
  assert.equal(quien(m, 'b').vida, 100);
});

test('el gancho levanta y el rival cae al piso', () => {
  const m = mundo(); juntar(m, 1);
  paso(m, new Map([['a', { x: 0, y: 1, pina: true }]]));
  let voló = false;
  for (let t = 0; t < 1.2; t += PASO) { paso(m, new Map()); if (quien(m, 'b').y > .5) voló = true; }
  assert.ok(voló, 'sale volando');
  assert.ok(['caido', 'levanta', 'quieto'].includes(quien(m, 'b').est));
});

test('combo de tres piñas encadenadas', () => {
  const m = mundo(); juntar(m, 1);
  const vistos = new Set();
  for (let i = 0; i < 3; i++) {
    paso(m, new Map([['a', { x: 0, y: 0, pina: true }]]));
    for (let t = 0; t < .14; t += PASO) { paso(m, new Map()); if (quien(m, 'a').atk) vistos.add(quien(m, 'a').atk); }
  }
  assert.deepEqual([...vistos].sort(), ['pina1', 'pina2', 'pina3']);
});

test('el poder viaja, pega de lejos y aplica su elemento', () => {
  const m = mundo(); juntar(m, 5);
  apretar(m, 'a', { x: 0, y: 0, poder: true }, 1.2);
  const b = quien(m, 'b');
  assert.ok(b.vida < 100, 'pegó');
  assert.ok(b.quema > 0 || b.vida < 100 - ELEMENTOS.fuego.dmg, 'la bola de fuego quema');
  assert.equal(m.proy.length, 0, 'el poder desaparece al pegar');
});

test('dos poderes que se cruzan se anulan', () => {
  const m = mundo(); juntar(m, 8);
  paso(m, new Map([['a', { x: 0, y: 0, poder: true }], ['b', { x: 0, y: 0, poder: true }]]));
  for (let t = 0; t < 1.5; t += PASO) paso(m, new Map());
  assert.equal(quien(m, 'a').vida, 100);
  assert.equal(quien(m, 'b').vida, 100);
  assert.ok(m.ev.some((e) => e.k === 'choque') || m.evN > 0);
});

test('el súper necesita la barra llena', () => {
  const m = mundo(); juntar(m, 3);
  apretar(m, 'a', { x: 0, y: 0, super: true }, .1);
  assert.notEqual(quien(m, 'a').atk, 'super');
  quien(m, 'a').ene = 100;
  paso(m, new Map([['a', { x: 0, y: 0, super: true }]]));
  assert.equal(quien(m, 'a').atk, 'super');
  assert.equal(quien(m, 'a').ene, 0);
});

test('en la ronda decisiva el que pierde queda mareado y se lo puede rematar', () => {
  const m = mundo({ decisivo: [true, true] }); juntar(m, 1);
  quien(m, 'b').vida = 3;
  apretar(m, 'a', { x: 0, y: 0, patada: true }, .5);
  assert.equal(m.fase, 'remate');
  assert.equal(quien(m, 'b').est, 'mareado');
  apretar(m, 'a', { x: 0, y: 0, super: true }, 4);
  assert.equal(m.fase, 'fin');
  assert.equal(m.ganador, 0);
  assert.equal(m.remate?.elem, 'fuego');
});

test('sin remate a tiempo, el mareado se cae solo', () => {
  const m = mundo({ decisivo: [true, true] }); juntar(m, 1);
  quien(m, 'b').vida = 3;
  apretar(m, 'a', { x: 0, y: 0, patada: true }, 7);
  assert.equal(m.fase, 'fin');
  assert.equal(m.remate, null);
});

test('se termina el tiempo: gana el que tiene más vida', () => {
  const m = mundo({ tiempo: 1 }); juntar(m, 1);
  apretar(m, 'a', { x: 0, y: 0, pina: true }, 1.2);
  assert.equal(m.fase, 'fin');
  assert.equal(m.ganador, 0);
  assert.ok(m.porTiempo);
});

test('los poderes se sortean y no se repiten en el mismo equipo', () => {
  const ls = [{ id: '1', eq: 0 }, { id: '2', eq: 0 }, { id: '3', eq: 1 }, { id: '4', eq: 1 }];
  for (let i = 0; i < 50; i++) {
    const p = sortearPoderes(ls);
    assert.notEqual(p['1'].elem, p['2'].elem);
    assert.notEqual(p['3'].elem, p['4'].elem);
    for (const x of Object.values(p)) { assert.ok(ELEMENTOS[x.elem]); assert.ok(ARMAS[x.arma]); }
  }
});

test('pelea completa de bots (1v1 y 2v2) con rondas y campeón', () => {
  for (const n of [1, 2]) {
    const ls = [];
    for (let eq = 0; eq < 2; eq++) for (let k = 0; k < n; k++) ls.push({ id: `${eq}${k}`, eq, nombre: `B${eq}${k}` });
    let r = 7;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const c = crearCombate({ luchadores: ls, mejorDe: 3, tiempo: 60, r: rnd });
    let pasos = 0;
    const textos = new Set();
    while (c.fase !== 'fin' && pasos < 60 * 60 * 10) {
      const e = new Map(c.m.luch.map((f) => [f.id, pensarBot(c.m, f, 2, rnd)]));
      pasoCombate(c, e); pasos++;
      if (c.anuncio) textos.add(c.anuncio.tipo);
    }
    assert.equal(c.fase, 'fin', `${n}v${n} termina`);
    assert.ok(c.ganador === null || Math.max(...c.victorias) === 2);
    assert.ok(textos.has('ronda') && textos.has('peleen') && textos.has('campeon'));
  }
});

test('la red: estado y entradas se codifican y vuelven igual', () => {
  const ls = [{ id: 'x', eq: 0, nombre: 'X' }, { id: 'y', eq: 1, nombre: 'Y' }, { id: 'bot0', eq: 0, nombre: 'B' }, { id: 'bot1', eq: 1, nombre: 'C' }];
  const c = crearCombate({ luchadores: ls });
  for (let i = 0; i < 400; i++) pasoCombate(c, new Map(c.m.luch.map((f) => [f.id, pensarBot(c.m, f, 1)])));
  const s = codificar(c);
  assert.ok(s.length < 2400, 'entra en el plan B del servidor');
  const d = decodificar(s);
  assert.equal(d.luch.length, 4);
  assert.equal(d.ronda, c.ronda);
  for (const f of c.m.luch) {
    const g = d.luch.find((x) => x.id === f.id);
    assert.equal(g.est, f.est); assert.equal(g.elem, f.elem); assert.equal(g.arma, f.arma);
    assert.ok(Math.abs(g.x - f.x) < .01);
  }
  const e = decodificarEntrada(codificarEntrada({ x: -1, y: 1, pina: true, super: true }));
  assert.deepEqual(e, { x: -1, y: 1, pina: true, super: true });
  assert.equal(decodificar('Mbasura'), null);
});

// ---------------------------------------------------------------- sala del servidor
async function req(metodo, ruta, body) {
  const r = await pelea.handle(new Request('http://x/api/pelea' + ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));
  return r.json();
}

test('sala online: equipos, luchador, bots que completan y resultado', async () => {
  const A = 'pidAnfitrion00001', B = 'pidInvitado000002';
  const { code } = await req('POST', '/crear', { pid: A, nombre: 'Ana', opciones: { luchador: 'julo', modo: '2v2' } });
  assert.ok(code);
  const accion = (pid, msg) => req('POST', `/salas/${code}`, { pid, ping: 1, msg });
  const ver = async (pid) => (await req('GET', `/salas/${code}?pid=${pid}&ping=1`)).estado;
  await accion(A, { t: 'join', nombre: 'Ana' });
  await accion(B, { t: 'join', nombre: 'Beto' });
  let e = await ver(A);
  assert.equal(e.modo, '2v2');
  assert.equal(e.luchador[e.yo], 'julo');
  e = await ver(B);
  const idB = e.yo;
  assert.ok(['a', 'b'].includes(e.equipos[idB]));
  await accion(B, { t: 'luchador', id: 'trosman' });
  assert.equal((await ver(B)).luchador[idB], 'trosman');
  assert.ok((await accion(B, { t: 'luchador', id: 'no-existe' })).error);
  assert.ok((await accion(B, { t: 'empezar' })).error, 'solo arranca el anfitrión');
  await accion(A, { t: 'empezar' });
  e = await ver(A);
  assert.equal(e.fase, 'pelea');
  assert.equal(e.participantes.length + e.botNpc.length, 4, 'dos por lado entre personas y bots');
  await accion(A, { t: 'resultado', n: e.peleaN, ganador: 1, victorias: [1, 2] });
  e = await ver(A);
  assert.equal(e.fase, 'fin');
  assert.equal(e.ganador, 1);
  assert.deepEqual(e.victorias, [1, 2]);
  await accion(A, { t: 'config', modo: '1v1' });
  assert.equal((await ver(A)).modo, '1v1', 'antes de la revancha se puede cambiar el modo');
});

test('los bots aprenden: al que tira poderes de lejos lo leen y se lo avisan', () => {
  const ls = [{ id: 'yo', eq: 0 }, { id: 'bot', eq: 1, bot: true }];
  const m = nuevoMundo(ls, { yo: { elem: 'fuego', arma: 'katana' }, bot: { elem: 'hielo', arma: 'hacha' } });
  m.fase = 'pelea';
  const yo = m.luch[0], bot = m.luch[1];
  for (let i = 0; i < 14; i++) {
    yo.x = -5; bot.x = 5; bot.vida = 100; yo.cdPoder = 0; yo.est = 'quieto'; yo.atk = null; bot.est = 'quieto'; bot.atk = null; bot.stun = 0;
    paso(m, new Map([['yo', { x: 0, y: 0, poder: true }]]));
    for (let t = 0; t < .6; t += PASO) paso(m, new Map([['yo', { x: 0, y: 0 }]]));
  }
  assert.ok(m.lee.yo.zonas.lejos.poder >= 10, 'anotó los poderes de lejos');
  assert.ok(m.lee.yo.avisos.poder, 'avisó que lo leyó');
  // ahora, de lejos, el bot salta para meterse (en vez de quedarse tirando)
  let salto = 0;
  for (let i = 0; i < 400; i++) { yo.x = -5; bot.x = 4.5; bot.y = 0; bot.est = 'quieto'; bot.atk = null; bot.ia = null; const e = pensarBot(m, bot, 2); if (e.y < 0) salto++; }
  assert.ok(salto > 100, `salta para meterse (${salto})`);
});
