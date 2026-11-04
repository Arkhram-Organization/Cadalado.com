import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { createCore, findTimeControl } from '../public/js/core.js';

const core = createCore(Chess);
const players = { w: { name: 'A' }, b: { name: 'B' } };
const play = (g, chess, list, t0 = 0, step = 1000) => {
  list.forEach(([f, to, p], i) => {
    const color = core.turn(g);
    const r = core.applyMove(g, chess, color, { from: f, to, promotion: p }, t0 + i * step);
    assert.ok(r.ok, `${f}${to}: ${r.error}`);
  });
};

test('mate pastor termina la partida', () => {
  const g = core.newState({ id: 'x', tc: findTimeControl('5+0'), players });
  const c = new Chess();
  play(g, c, [['e2', 'e4'], ['e7', 'e5'], ['f1', 'c4'], ['b8', 'c6'], ['d1', 'h5'], ['g8', 'f6'], ['h5', 'f7']]);
  assert.equal(g.status, 'ended');
  assert.deepEqual(g.result, { winner: 'w', reason: 'checkmate' });
  assert.equal(g.sans.at(-1), 'Qxf7#');
});

test('rechaza jugadas ilegales y fuera de turno', () => {
  const g = core.newState({ id: 'x', tc: findTimeControl('5+0'), players });
  const c = new Chess();
  assert.ok(core.applyMove(g, c, 'b', { from: 'e7', to: 'e5' }, 0).error);
  assert.ok(core.applyMove(g, c, 'w', { from: 'e2', to: 'e5' }, 0).error);
  assert.equal(g.moves.length, 0);
});

test('el reloj arranca tras la primera jugada de cada bando y suma incremento', () => {
  const g = core.newState({ id: 'x', tc: findTimeControl('3+2'), players });
  const c = new Chess();
  core.applyMove(g, c, 'w', { from: 'e2', to: 'e4' }, 0);
  core.applyMove(g, c, 'b', { from: 'e7', to: 'e5' }, 50_000); // aún no corre
  assert.equal(g.clock.w, 180_000);
  assert.equal(g.clock.b, 180_000);
  core.applyMove(g, c, 'w', { from: 'g1', to: 'f3' }, 60_000); // blancas usaron 10s, +2
  assert.equal(g.clock.w, 172_000);
  assert.equal(core.remaining(g, 'b', 65_000), 175_000);
});

test('caída de bandera da la victoria (o tablas si no hay material)', () => {
  const g = core.newState({ id: 'x', tc: findTimeControl('1+0'), players });
  const c = new Chess();
  play(g, c, [['e2', 'e4'], ['e7', 'e5']]);
  assert.equal(core.checkFlag(g, c, 1000 + 59_000), false);
  assert.equal(core.checkFlag(g, c, 1000 + 60_001), true);
  assert.deepEqual(g.result, { winner: 'b', reason: 'timeout' });

  const g2 = core.newState({ id: 'y', tc: findTimeControl('1+0'), players });
  g2.status = 'playing';
  const c2 = new Chess('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1');
  g2.moves = ['e1d1', 'e5d5']; // simula que el reloj ya corre
  g2.clock.lastTs = 0;
  assert.equal(core.checkFlag(g2, c2, 61_000), true);
  assert.deepEqual(g2.result, { winner: null, reason: 'timeout-insufficient' });
});

test('tablas por acuerdo, abandono y abortar', () => {
  const g = core.newState({ id: 'x', tc: findTimeControl('10+0'), players });
  const c = new Chess();
  assert.ok(core.abort(g, 0).ok);
  assert.equal(g.result.reason, 'aborted');

  const g2 = core.newState({ id: 'y', tc: findTimeControl('10+0'), players });
  const c2 = new Chess();
  play(g2, c2, [['e2', 'e4'], ['e7', 'e5']]);
  assert.ok(core.abort(g2, 0).error);
  core.offerDraw(g2, 'w');
  assert.equal(g2.drawOffer, 'w');
  play(g2, c2, [['g1', 'f3']], 5000); // mover no retira tu propia oferta
  assert.equal(g2.drawOffer, 'w');
  assert.ok(core.acceptDraw(g2, 'b', 6000).ok);
  assert.deepEqual(g2.result, { winner: null, reason: 'agreement' });
  assert.ok(core.resign(g2, 'w', 7000).error);
});

test('revancha invierte colores', () => {
  const g = core.newState({ id: 'x', tc: findTimeControl('5+0'), players });
  const c = new Chess();
  play(g, c, [['e2', 'e4'], ['e7', 'e5']]);
  core.resign(g, 'b', 3000);
  assert.ok(!core.requestRematch(g, 'w').next);
  const { next } = core.requestRematch(g, 'b');
  assert.equal(next.players.w.name, 'B');
  assert.equal(next.players.b.name, 'A');
  assert.equal(next.gameNo, 2);
  assert.equal(next.status, 'playing');
});

test('rebuild reproduce la posición con coronación', () => {
  const g = core.newState({ id: 'x', tc: findTimeControl('0+0'), players });
  const c = new Chess();
  play(g, c, [['a2', 'a4'], ['b7', 'b5'], ['a4', 'b5'], ['a7', 'a6'], ['b5', 'a6'], ['c8', 'b7'], ['a6', 'b7'], ['h7', 'h6'], ['b7', 'a8', 'n']]);
  assert.equal(g.moves.at(-1), 'b7a8n');
  assert.equal(core.rebuild(g).fen(), g.fen);
});
