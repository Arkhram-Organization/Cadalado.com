import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, rank, tanto, handWinner, waitingFor, viewFor, nextHand, actionsFor, closeShow, isPie } from '../public/truco/js/engine.js';
import { botAction } from '../public/truco/js/bot.js';

// RNG con semilla para que los tests sean reproducibles.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Arma una mano a mano con cartas fijas (asiento 0 = mano porque reparte el 1).
function fixed(cards, opts = {}) {
  const g = newGame({ mode: opts.mode || '1v1', dealer: opts.dealer ?? 1, target: opts.target || 30 });
  g.h.cards = cards.map((c) => c.slice());
  g.h.inHand = cards.map((c) => c.slice());
  if (opts.score) g.score = opts.score.slice();
  return g;
}
const ok = (r) => assert.ok(r.ok, r.error);

// Termina la mano yéndose al mazo todo un equipo (para probar lo que se anota al final).
const mazoAll = (g, t) => {
  for (let s = 0; s < g.n; s++) if (s % 2 === t && !g.h.mazo[s] && g.h.phase === 'play') ok(act(g, s, { t: 'mazo' }));
};

// Envido querido entre 0 (canta) y 1 (son buenas).
function envidoQuerido(g, value) {
  ok(act(g, 1, { t: 'envido', kind: 'envido' }));
  ok(act(g, 0, { t: 'quiero' }));
  ok(act(g, 0, value === undefined ? { t: 'cantar' } : { t: 'cantar', value }));
  ok(act(g, 1, { t: 'buenas' }));
}

test('jerarquía de cartas', () => {
  const order = ['1E', '1B', '7E', '7O', '3C', '2O', '1C', '12B', '11E', '10O', '7C', '6E', '5B', '4O'];
  for (let i = 1; i < order.length; i++) assert.ok(rank(order[i - 1]) > rank(order[i]), order[i - 1] + ' > ' + order[i]);
  assert.equal(rank('1C'), rank('1O'));
  assert.equal(rank('7C'), rank('7B'));
});

test('tantos', () => {
  assert.equal(tanto(['7E', '6E', '1B']).value, 33);
  assert.equal(tanto(['12E', '11E', '4B']).value, 20);
  assert.equal(tanto(['7E', '6O', '5B']).value, 7);
  assert.equal(tanto(['12E', '11O', '10B']).value, 0);
  assert.equal(tanto(['7E', '6E', '5E']).value, 33);
  assert.equal(tanto(['1C', '12C', '4E']).value, 21);
});

test('quién gana la mano con pardas', () => {
  const R = (...xs) => xs.map((result) => ({ result }));
  assert.equal(handWinner(R(0, 0), 1), 0);
  assert.equal(handWinner(R(0, 1), 1), null);
  assert.equal(handWinner(R(0, 1, 1), 0), 1);
  assert.equal(handWinner(R('parda', 1), 0), 1);
  assert.equal(handWinner(R(1, 'parda'), 0), 1);
  assert.equal(handWinner(R('parda', 'parda'), 0), null);
  assert.equal(handWinner(R('parda', 'parda', 'parda'), 1), 1);
  assert.equal(handWinner(R(0, 1, 'parda'), 1), 0);
});

test('truco querido vale 2, no querido 1', () => {
  let g = fixed([['1E', '1B', '4C'], ['4O', '5O', '6B']]);
  ok(act(g, 0, { t: 'truco' }));
  assert.equal(waitingFor(g).kind, 'truco');
  ok(act(g, 1, { t: 'noquiero' }));
  assert.deepEqual(g.score, [1, 0]);

  g = fixed([['1E', '1B', '4C'], ['4O', '5O', '6B']]);
  ok(act(g, 0, { t: 'truco' }));
  ok(act(g, 1, { t: 'quiero' }));
  ok(act(g, 0, { t: 'play', card: '1E' }));
  ok(act(g, 1, { t: 'play', card: '4O' }));
  ok(act(g, 0, { t: 'play', card: '1B' }));
  ok(act(g, 1, { t: 'play', card: '5O' }));
  assert.deepEqual(g.score, [2, 0]);
  assert.equal(g.h.phase, 'ended');
});

test('solo sube el que tiene el quiero', () => {
  const g = fixed([['1E', '1B', '4C'], ['4O', '5O', '6B']]);
  ok(act(g, 0, { t: 'truco' }));
  ok(act(g, 1, { t: 'quiero' }));
  assert.ok(act(g, 0, { t: 'truco' }).error);
  ok(act(g, 1, { t: 'truco' })); // retruco
  ok(act(g, 0, { t: 'truco' })); // vale cuatro
  ok(act(g, 1, { t: 'noquiero' }));
  assert.deepEqual(g.score, [3, 0]);
});

test('envido querido: se anota al final y hay que mostrar', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  envidoQuerido(g);
  assert.equal(g.h.envido.state, 'done');
  assert.deepEqual(g.score, [0, 0]); // todavía no se anota
  mazoAll(g, 1);
  assert.equal(g.h.phase, 'show');
  assert.ok(actionsFor(g, 0).mostrar);
  assert.ok(actionsFor(g, 1).reclamar);
  ok(act(g, 0, { t: 'mostrar' }));
  assert.equal(g.h.phase, 'ended');
  assert.deepEqual(g.score, [3, 0]); // 2 de envido + 1 del truco sin cantar
});

test('si no muestra y le reclaman, pierde envido y truco', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  envidoQuerido(g);
  mazoAll(g, 1);
  ok(act(g, 1, { t: 'reclamar' }));
  assert.equal(g.h.result.penalty, 'no-mostro');
  assert.deepEqual(g.score, [0, 3]);
});

test('si nadie reclama, los tantos valen aunque no muestre', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  envidoQuerido(g);
  mazoAll(g, 1);
  closeShow(g);
  assert.deepEqual(g.score, [3, 0]);
});

test('mentir los tantos: si muestra, lo cazan', () => {
  const g = fixed([['7E', '4C', '12O'], ['5O', '4O', '12B']]);
  ok(act(g, 1, { t: 'envido', kind: 'envido' }));
  ok(act(g, 0, { t: 'quiero' }));
  assert.ok(act(g, 0, { t: 'cantar', value: 8 }).error); // número que no existe
  ok(act(g, 0, { t: 'cantar', value: 33 })); // tiene 7
  assert.ok(act(g, 1, { t: 'cantar', value: 30 }).error); // tiene que superar 33
  ok(act(g, 1, { t: 'buenas' }));
  mazoAll(g, 1);
  ok(act(g, 0, { t: 'mostrar' }));
  assert.equal(g.h.result.penalty, 'mal-cantado');
  assert.deepEqual(g.score, [0, 3]);
});

test('el que se fue al mazo no puede mostrar', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  envidoQuerido(g);
  mazoAll(g, 0);
  assert.equal(g.h.phase, 'show');
  assert.ok(act(g, 0, { t: 'mostrar' }).error);
  ok(act(g, 1, { t: 'reclamar' }));
  assert.deepEqual(g.score, [0, 3]); // los 2 del envido y el 1 del truco pasan al rival
});

test('envido envido real envido no querido = 4', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  ok(act(g, 0, { t: 'envido', kind: 'envido' }));
  ok(act(g, 1, { t: 'envido', kind: 'envido' }));
  ok(act(g, 0, { t: 'envido', kind: 'real' }));
  ok(act(g, 1, { t: 'noquiero' }));
  mazoAll(g, 1);
  assert.equal(g.h.phase, 'ended'); // no querido: no hay que mostrar
  assert.deepEqual(g.score, [5, 0]);
});

test('falta envido gana el partido si lo gana el que va ganando', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']], { score: [20, 10] });
  ok(act(g, 1, { t: 'envido', kind: 'falta' }));
  ok(act(g, 0, { t: 'quiero' }));
  ok(act(g, 0, { t: 'cantar' }));
  ok(act(g, 1, { t: 'buenas' }));
  mazoAll(g, 1);
  ok(act(g, 0, { t: 'mostrar' }));
  assert.equal(g.status, 'ended');
  assert.equal(g.winner, 0);
});

test('el envido está primero', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  ok(act(g, 0, { t: 'truco' }));
  ok(act(g, 1, { t: 'envido', kind: 'envido' }));
  assert.equal(waitingFor(g).kind, 'envido');
  ok(act(g, 0, { t: 'quiero' }));
  ok(act(g, 0, { t: 'cantar' }));
  ok(act(g, 1, { t: 'buenas' }));
  assert.equal(waitingFor(g).kind, 'truco'); // vuelve el truco pendiente
  ok(act(g, 1, { t: 'quiero' }));
  assert.equal(g.h.truco.level, 2);
});

test('no se puede cantar envido después de jugar', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  ok(act(g, 0, { t: 'play', card: '4C' }));
  assert.ok(act(g, 0, { t: 'envido', kind: 'envido' }).error);
  ok(act(g, 1, { t: 'envido', kind: 'envido' }));
});

test('en 2 vs 2 el envido lo canta y lo contesta el pie', () => {
  // reparte el 1: mano 2, pies = 1 (el que reparte) y 0 (el que corta)
  const g = newGame({ mode: '2v2', dealer: 1 });
  assert.equal(g.h.mano, 2);
  assert.ok(isPie(g, 1) && isPie(g, 0) && !isPie(g, 2) && !isPie(g, 3));
  assert.ok(act(g, 2, { t: 'envido', kind: 'envido' }).error);
  assert.deepEqual(actionsFor(g, 2).envido, []);
  ok(act(g, 0, { t: 'envido', kind: 'envido' }));
  assert.deepEqual(waitingFor(g).seats, [1]); // contesta el pie del otro equipo
  assert.ok(act(g, 3, { t: 'quiero' }).error);
  ok(act(g, 1, { t: 'quiero' }));
});

test('en 3 vs 3 los pies son el que reparte y el que corta', () => {
  const g = newGame({ mode: '3v3', dealer: 4 });
  assert.equal(g.h.mano, 5);
  assert.deepEqual([0, 1, 2, 3, 4, 5].filter((s) => isPie(g, s)), [3, 4]);
});

test('regla de la mesa: en equipos el truco se canta desde segunda', () => {
  const g = newGame({ mode: '2v2', dealer: 1, trucoDesdeSegunda: true });
  assert.equal(actionsFor(g, 2).truco, null);
  assert.ok(act(g, 2, { t: 'truco' }).error);
  const h = g.h;
  for (let k = 0; k < 4; k++) ok(act(g, h.turn, { t: 'play', card: h.inHand[h.turn][0] }));
  if (g.h.phase === 'play') assert.ok(actionsFor(g, g.h.turn).truco);
});

test('al mazo en primera sin envido: 1 + 1', () => {
  const g = fixed([['7E', '6E', '4C'], ['5O', '4O', '12B']]);
  ok(act(g, 0, { t: 'mazo' }));
  assert.deepEqual(g.score, [0, 2]);
});

test('tirar dos encimadas: la de abajo juega ahora, la de arriba en la siguiente', () => {
  const g = fixed([['1E', '4E', '5C'], ['3O', '6O', '12B']]);
  // el 0 tira el 4 abajo y el ancho arriba: el rival ve el ancho pero juega el 4
  ok(act(g, 0, { t: 'play2', bottom: '4E', top: '1E' }));
  const v = viewFor(g, 1);
  assert.equal(v.h.table[0][0].c, null); // la de abajo no se ve
  assert.equal(v.h.table[0][1].c, '1E');
  ok(act(g, 1, { t: 'play', card: '3O' })); // gana primera el 1 (3 > 4)
  assert.equal(g.h.rounds[0].result, 1);
  ok(act(g, 1, { t: 'play', card: '6O' }));
  // el ancho se jugó solo en segunda
  assert.equal(g.h.rounds[1].result, 0);
  assert.equal(g.h.r, 2);
  ok(act(g, 0, { t: 'play', card: '5C' }));
  ok(act(g, 1, { t: 'play', card: '12B' }));
  assert.equal(g.h.phase, 'ended');
  assert.deepEqual(g.score, [0, 1]); // el 1 ganó primera y tercera
});

test('denunciar el tiro doble', () => {
  const g = fixed([['1E', '4E', '5C'], ['3O', '6O', '12B']]);
  ok(act(g, 0, { t: 'play2', bottom: '4E', top: '1E' }));
  ok(act(g, 1, { t: 'denuncia', target: 0 }));
  assert.equal(g.h.phase, 'ended');
  assert.deepEqual(g.score, [0, 1]);
});

test('denuncia falsa le da un punto al rival', () => {
  const g = fixed([['3E', '4E', '5C'], ['4O', '3O', '12B']]);
  ok(act(g, 1, { t: 'denuncia', target: 0 }));
  assert.ok(act(g, 1, { t: 'denuncia', target: 0 }).error);
  mazoAll(g, 1);
  assert.deepEqual(g.score, [3, 0]); // 1 denuncia + 1 envido + 1 truco
});

test('carta tapada no vale en primera y pierde la ronda', () => {
  const g = fixed([['3E', '4E', '5C'], ['4O', '3O', '12B']]);
  assert.ok(act(g, 0, { t: 'play', card: '3E', mode: 'down' }).error);
  ok(act(g, 0, { t: 'play', card: '3E' }));
  ok(act(g, 1, { t: 'play', card: '4O' }));
  ok(act(g, 0, { t: 'play', card: '5C', mode: 'down' }));
  ok(act(g, 1, { t: 'play', card: '12B' }));
  assert.equal(g.h.rounds[1].result, 1);
  // el rival no ve la carta tapada
  assert.equal(viewFor(g, 1).h.table[0][1].c, null);
  assert.equal(viewFor(g, 0).h.table[0][1].c, '5C');
});

test('la vista no filtra cartas ajenas', () => {
  const g = newGame({ mode: '2v2' }, seeded(3));
  const v = viewFor(g, 2);
  assert.equal(v.h.myCards.length, 3);
  assert.equal(JSON.stringify(v).includes(JSON.stringify(g.h.inHand[1])), false);
});

for (const mode of ['1v1', '2v2', '3v3']) {
  test(`partidas completas entre bots (${mode})`, () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = seeded(seed * 7 + mode.length);
      const g = newGame({ mode, target: seed % 2 ? 15 : 30 }, rng);
      let steps = 0;
      while (g.status === 'playing') {
        assert.ok(steps++ < 20000, 'la partida no termina');
        if (g.h.phase === 'ended') {
          nextHand(g, rng);
          continue;
        }
        const w = waitingFor(g);
        if (w.kind === 'show') {
          const a = botAction(g, w.seats[0], rng);
          if (!a) closeShow(g);
          else if (rng() < 0.1) ok(act(g, (w.seats[0] + 1) % g.n, { t: 'reclamar' }));
          else ok(act(g, w.seats[0], a));
          continue;
        }
        const seat = w.seats[Math.floor(rng() * w.seats.length)];
        const a = botAction(g, seat, rng);
        assert.ok(a, `bot sin acción en ${w.kind}`);
        const r = act(g, seat, a, rng);
        assert.ok(r.ok, `${mode} seed ${seed}: ${JSON.stringify(a)} -> ${r.error}`);
        // invariantes
        const inPlay = g.h.inHand.flat().length + g.h.table.flat().length;
        assert.ok(inPlay <= g.n * 3);
        assert.ok(g.score[0] >= 0 && g.score[1] >= 0);
      }
      assert.ok(g.score[g.winner] === g.target);
    }
  });
}
