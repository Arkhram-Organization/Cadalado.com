// Prueba la sala de truco portada a Redis/consultas: crear, sentarse, arrancar con bots
// y jugar una partida entera haciendo "tick" con un reloj simulado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sala from '../lib/sala.js';
import { botAction } from '../public/js/bot.js';
import { waitingFor } from '../public/js/engine.js';
import { historial } from '../../../shared/cuenta.js';

const A = 'pidAAAAAAAA';
const B = 'pidBBBBBBBB';

test('dos personas se sientan, chatean, se miran y se hacen señas', async () => {
  const code = await sala.crearSala({ mode: '2v2', pid: A, name: 'Ana', isPublic: true });
  const act = (pid, msg) => sala.mutar(code, (r, ctx) => sala.accion(r, msg, { pid, ...ctx }));
  await sala.tocarPresencia(code, B);
  let res = await act(B, { t: 'join', name: 'Beto' });
  assert.deepEqual(res.r.seats.map((s) => s?.name ?? null).filter(Boolean).sort(), ['Ana', 'Beto']);
  assert.equal(sala.seatOf(res.r, A), 0);

  await act(A, { t: 'chat', text: 'buenas' });
  const seatB = sala.seatOf(res.r, B);
  await act(A, { t: 'look', target: seatB });
  res = await act(B, { t: 'start', fillBots: true });
  assert.equal(res.r.status, 'lobby'); // solo el anfitrión arranca
  res = await act(A, { t: 'start', fillBots: true });
  assert.equal(res.r.status, 'playing');
  assert.equal(res.r.seats.filter((s) => s.bot).length, 2);

  const pres = await sala.presencia(code);
  const vistaB = sala.mensajes(res.r, B, pres, { cursor: 0 });
  assert.ok(vistaB.msgs.some((m) => m.t === 'chat' && m.msg.text === 'buenas'));
  assert.ok(vistaB.msgs.some((m) => m.t === 'state' && m.you === seatB));
  // la seña de A solo la ve B si lo está mirando… y B no mira a A
  await act(A, { t: 'sena', sena: 'tres' });
  let r = await sala.cargar(code);
  assert.equal(sala.mensajes(r, B, pres, { cursor: vistaB.cursor }).msgs.some((m) => m.t === 'sena'), false);
  await act(B, { t: 'look', target: 0 });
  const cur = (await sala.cargar(code)).evSeq;
  await act(A, { t: 'sena', sena: 'dos' });
  r = await sala.cargar(code);
  assert.ok(sala.mensajes(r, B, pres, { cursor: cur }).msgs.some((m) => m.t === 'sena' && m.sena === 'dos'));
  // si el estado no cambió, no se vuelve a mandar
  const v1 = sala.mensajes(r, B, pres, { cursor: r.evSeq });
  const v2 = sala.mensajes(r, B, pres, { cursor: r.evSeq, h: v1.h });
  assert.equal(v2.msgs.some((m) => m.t === 'state'), false);
});

test('partida completa contra un bot, con tick y reloj simulado', async () => {
  const realNow = Date.now;
  let reloj = realNow();
  Date.now = () => reloj;
  try {
    const uid = 'usuarioDePrueba' + Math.random().toString(36).slice(2, 6);
    const code = await sala.crearSala({ mode: '1v1', target: 15, pid: A, name: 'Ana', uid });
    const mutar = (fn) => sala.mutar(code, fn);
    await mutar((r, ctx) => sala.accion(r, { t: 'start', fillBots: true }, { pid: A, ...ctx }));
    let r = await sala.cargar(code);
    let pasos = 0;
    while (r.status === 'playing' && pasos++ < 4000) {
      reloj += 1500;
      await sala.tocarPresencia(code, A);
      const pres = await sala.presencia(code);
      const g = r.game;
      // la persona juega lo que diría un bot en su lugar
      if (g.h.phase === 'play' && reloj >= r.dealUntil && waitingFor(g).seats.includes(0)) {
        const a = botAction(g, 0, Math.random);
        if (a) await mutar((rm, ctx) => sala.accion(rm, { t: 'act', a }, { pid: A, ...ctx }));
      } else if (g.h.phase === 'show' && g.h.show.seat === 0) {
        await mutar((rm, ctx) => sala.accion(rm, { t: 'act', a: { t: 'mostrar' } }, { pid: A, ...ctx }));
      }
      r = await sala.cargar(code);
      if (reloj >= sala.proximoTick(r, reloj, pres)) await mutar((rm, ctx) => sala.tick(rm, reloj, ctx.pres));
      r = await sala.cargar(code);
    }
    assert.equal(r.status, 'ended', `quedó en ${r.status} tras ${pasos} pasos`);
    assert.ok(Math.max(...r.game.score) >= 15);
    const h = await historial(uid);
    assert.equal(h[0].juego, 'truco');
    assert.ok(['victoria', 'derrota'].includes(h[0].resultado));
  } finally {
    Date.now = realNow;
  }
});

test('lobby: sala pública aparece y partida rápida la encuentra', async () => {
  const code = await sala.crearSala({ mode: '3v3', pid: B, name: 'Beto', isPublic: true });
  const { open } = await sala.listarLobby();
  assert.ok(open.some((x) => x.code === code));
  assert.equal(await sala.buscarRapida('3v3'), code);
});
