// Jugador automático. Mira el estado completo del motor (solo corre en el servidor)
// pero decide usando únicamente sus propias cartas y lo que está sobre la mesa.
import { rank, tanto, team, actionsFor, waitingFor, envidoOpenFor } from './engine.js';

const pick = (rng, p) => rng() < p;

function tableBest(h, seat) {
  const plays = h.rounds[h.r].plays;
  let mine = -1;
  let theirs = -1;
  for (const p of plays) {
    const v = p.faceDown ? 0 : rank(p.c);
    if (team(p.seat) === team(seat)) mine = Math.max(mine, v);
    else theirs = Math.max(theirs, v);
  }
  return { mine, theirs, count: plays.length };
}

function roundsWon(h, seat) {
  let won = 0;
  let lost = 0;
  for (const r of h.rounds) {
    if (r.result === null || r.result === undefined || r.result === 'parda') continue;
    if (r.result === team(seat)) won++;
    else lost++;
  }
  return { won, lost };
}

// 0..1: qué tan buena es la mano para el truco ahora mismo.
function power(g, seat) {
  const h = g.h;
  const cards = h.inHand[seat].map(rank).sort((a, b) => b - a);
  const { won, lost } = roundsWon(h, seat);
  let p = 0;
  if (cards[0]) p += cards[0] / 14 * 0.55;
  if (cards[1]) p += cards[1] / 14 * 0.25;
  p += won * 0.3 - lost * 0.3;
  const tb = tableBest(h, seat);
  if (tb.count && tb.mine > tb.theirs) p += 0.1;
  return Math.max(0, Math.min(1, p));
}

function chooseCard(g, seat, rng) {
  const h = g.h;
  const hand = h.inHand[seat].slice().sort((a, b) => rank(a) - rank(b));
  const tb = tableBest(h, seat);
  const lowest = hand[0];
  const highest = hand[hand.length - 1];
  let card;
  if (tb.count === 0) {
    // abre la ronda
    if (h.r === 0 && hand.length === 3) card = hand[1];
    else card = roundsWon(h, seat).won > 0 ? highest : hand[Math.floor(hand.length / 2)];
  } else if (tb.mine > tb.theirs) {
    card = lowest; // ya gana mi compañero
  } else {
    const beat = hand.find((c) => rank(c) > tb.theirs);
    const tie = hand.find((c) => rank(c) === tb.theirs);
    if (beat) card = beat;
    else if (tie && h.r === 0) card = tie; // ir a la parda
    else card = lowest;
  }
  let mode = 'normal';
  const a = actionsFor(g, seat);
  if (a.canDown && tb.count && !hand.some((c) => rank(c) > tb.theirs) && pick(rng, 0.25)) mode = 'down';
  else if (a.canStack && pick(rng, 0.06)) mode = 'stack';
  return { t: 'play', card, mode };
}

export function botAction(g, seat, rng = Math.random) {
  const h = g.h;
  if (!h || h.phase !== 'play' || g.status !== 'playing') return null;
  const w = waitingFor(g);
  if (!w.seats.includes(seat)) return null;
  const a = actionsFor(g, seat);
  const t = tanto(h.cards[seat]).value;

  if (w.kind === 'declare') return a.cantar ? { t: 'cantar' } : { t: 'buenas' };

  if (w.kind === 'envido') {
    const calls = h.envido.calls;
    const falta = calls.includes('falta');
    if (a.envido.includes('real') && t >= 31 && pick(rng, 0.6)) return { t: 'envido', kind: 'real' };
    if (a.envido.includes('falta') && t >= 32 && pick(rng, 0.5)) return { t: 'envido', kind: 'falta' };
    if (a.envido.includes('envido') && t >= 29 && pick(rng, 0.4)) return { t: 'envido', kind: 'envido' };
    if (falta) return t >= 30 ? { t: 'quiero' } : { t: 'noquiero' };
    if (t >= 27 || (t >= 25 && pick(rng, 0.5)) || (t >= 23 && pick(rng, 0.15))) return { t: 'quiero' };
    if (a.envido.includes('real') && pick(rng, 0.04)) return { t: 'envido', kind: 'real' }; // farol
    return { t: 'noquiero' };
  }

  if (w.kind === 'truco') {
    if (a.envido.length && t >= 27 && pick(rng, 0.8)) return { t: 'envido', kind: t >= 31 ? 'real' : 'envido' };
    const p = power(g, seat);
    if (a.truco && p > 0.8 && pick(rng, 0.6)) return { t: 'truco' };
    if (p > 0.45 || pick(rng, 0.12)) return { t: 'quiero' };
    return { t: 'noquiero' };
  }

  if (w.kind === 'play') {
    if (envidoOpenFor(g, seat) && !h.envido.calls.length) {
      if (t >= 30 && pick(rng, 0.7)) return { t: 'envido', kind: t >= 32 && pick(rng, 0.4) ? 'real' : 'envido' };
      if (t >= 27 && pick(rng, 0.5)) return { t: 'envido', kind: 'envido' };
      if (pick(rng, 0.07)) return { t: 'envido', kind: 'envido' }; // farol
    }
    if (a.truco && !h.truco.pending) {
      const p = power(g, seat);
      const lvl = h.truco.level;
      if (lvl === 1 && (p > 0.62 || pick(rng, 0.08))) return { t: 'truco' };
      if (lvl > 1 && p > 0.85 && pick(rng, 0.5)) return { t: 'truco' };
    }
    return chooseCard(g, seat, rng);
  }
  return null;
}

// Seña que haría un bot para su compañero al principio de la mano.
export function botSena(g, seat) {
  const h = g.h;
  const cards = h.inHand[seat];
  const has = (c) => cards.includes(c);
  if (has('1E')) return 'ancho_espada';
  if (has('1B')) return 'ancho_basto';
  if (has('7E')) return 'siete_espada';
  if (has('7O')) return 'siete_oro';
  if (cards.some((c) => parseInt(c, 10) === 3)) return 'tres';
  if (tanto(h.cards[seat]).value >= 30) return 'envido_alto';
  if (cards.some((c) => parseInt(c, 10) === 2)) return 'dos';
  return 'ciego';
}
