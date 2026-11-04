// Motor de reglas del truco argentino (sin flor, sin muestra).
// Es JavaScript puro: lo usan el servidor (Durable Object) y los tests. No importa nada.
// Asientos 0..n-1 en orden de juego ("hacia la derecha"). Equipo = asiento % 2.
//
// Reparto: reparte `dealer`, corta el de su izquierda (dealer - 1), se reparte hacia la derecha
// empezando por la mano (dealer + 1). En la mano siguiente reparte el que fue mano: el mazo va
// pasando hacia la derecha.
// En parejas y tríos el envido lo canta (y lo contesta) el pie de cada equipo: el que reparte
// y el que corta.
// Los puntos se anotan al terminar la mano. El que gana el envido tiene que mostrar las cartas;
// si no las muestra y se lo reclaman, pierde los puntos del envido y los del truco.

export const SUITS = ['E', 'B', 'O', 'C'];
export const NUMS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
export const SUIT_NAME = { E: 'espada', B: 'basto', O: 'oro', C: 'copa' };
export const MODES = { '1v1': 2, '2v2': 4, '3v3': 6 };
export const TRUCO_NAMES = { 2: 'Truco', 3: 'Retruco', 4: 'Vale cuatro' };
export const ENVIDO_NAMES = { envido: 'Envido', real: 'Real envido', falta: 'Falta envido' };

export const team = (seat) => seat % 2;
export const otherTeam = (t) => 1 - t;
export const cardNum = (c) => parseInt(c, 10);
export const cardSuit = (c) => c[c.length - 1];

export function cardName(c) {
  const n = cardNum(c);
  const s = SUIT_NAME[cardSuit(c)];
  if (n === 1 && (s === 'espada' || s === 'basto')) return `ancho de ${s}`;
  return `${n} de ${s}`;
}

export function newDeck() {
  const d = [];
  for (const s of SUITS) for (const n of NUMS) d.push(`${n}${s}`);
  return d;
}

// Jerarquía del truco: 14 = ancho de espadas ... 1 = los 4.
export function rank(c) {
  switch (c) {
    case '1E': return 14;
    case '1B': return 13;
    case '7E': return 12;
    case '7O': return 11;
  }
  const n = cardNum(c);
  return { 3: 10, 2: 9, 1: 8, 12: 7, 11: 6, 10: 5, 7: 4, 6: 3, 5: 2, 4: 1 }[n];
}

const envVal = (c) => (cardNum(c) <= 7 ? cardNum(c) : 0);

// Tantos de una mano de 3 cartas y las cartas que los forman.
export function tanto(cards) {
  let best = { value: -1, cards: [] };
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cardSuit(cards[i]) === cardSuit(cards[j])) {
        const v = 20 + envVal(cards[i]) + envVal(cards[j]);
        if (v > best.value) best = { value: v, cards: [cards[i], cards[j]] };
      }
    }
  }
  if (best.value < 0) {
    for (const c of cards) if (envVal(c) > best.value) best = { value: envVal(c), cards: [c] };
  }
  return best;
}

export const validTanto = (v) => Number.isInteger(v) && ((v >= 0 && v <= 7) || (v >= 20 && v <= 33));

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Asientos "pie" (los últimos de cada equipo): el que reparte y el que corta (su izquierda).
export function pies(g) {
  if (g.n === 2) return [0, 1];
  return [g.dealer, (g.dealer - 1 + g.n) % g.n];
}
export const isPie = (g, seat) => pies(g).includes(seat);
export const cutter = (g) => (g.dealer - 1 + g.n) % g.n;

// ---------------------------------------------------------------- partida

// trucoDesdeSegunda: en equipos, el truco recién se puede cantar desde la segunda ronda (regla de la mesa).
export function newGame({ mode = '1v1', target = 30, ayudas = false, dealer = 0, trucoDesdeSegunda = false } = {}, rng = Math.random) {
  const n = MODES[mode] || 2;
  const g = {
    mode,
    n,
    target: target === 15 ? 15 : 30,
    ayudas: !!ayudas,
    trucoDesdeSegunda: !!trucoDesdeSegunda && n > 2,
    score: [0, 0],
    dealer: dealer % n,
    handNo: 0,
    status: 'playing',
    winner: null,
    ev: [],
    evId: 0,
    h: null,
  };
  deal(g, rng);
  return g;
}

function event(g, e) {
  g.evId++;
  g.ev.push({ id: g.evId, ...e });
  if (g.ev.length > 40) g.ev.splice(0, g.ev.length - 40);
}

export function deal(g, rng = Math.random) {
  const n = g.n;
  const d = shuffle(newDeck(), rng);
  const cards = Array.from({ length: n }, () => []);
  const mano = (g.dealer + 1) % n;
  for (let r = 0; r < 3; r++) for (let k = 0; k < n; k++) cards[(mano + k) % n].push(d.pop());
  g.handNo++;
  g.h = {
    cards,
    inHand: cards.map((c) => c.slice()),
    mano,
    table: Array.from({ length: n }, () => []),
    rounds: [{ plays: [], result: null, starter: mano }],
    r: 0,
    turn: mano,
    mazo: Array(n).fill(false),
    pre: Array(n).fill(null), // carta de arriba de un "tiro doble", se juega sola en la ronda siguiente
    stacked: Array(n).fill(false),
    falseAccuse: Array(n).fill(false),
    envido: { calls: [], by: null, bySeat: null, state: 'none', declare: null, winner: null, winnerSeat: null, points: 0, needsShow: false, shown: false },
    truco: { level: 1, pending: null, holder: null },
    pending: [], // puntos que se anotan al terminar la mano: { team, pts, why }
    phase: 'play',
    show: null,
    result: null,
  };
  event(g, { type: 'deal', seat: g.dealer, cutter: cutter(g), mano, hand: g.handNo });
}

// El que reparte la mano siguiente es el que fue mano (el mazo pasa a la derecha).
export function nextHand(g, rng = Math.random) {
  if (g.status !== 'playing') return false;
  if (!g.h || g.h.phase !== 'ended') return false;
  g.dealer = (g.dealer + 1) % g.n;
  deal(g, rng);
  return true;
}

export function rematch(g, rng = Math.random) {
  const ng = newGame({ mode: g.mode, target: g.target, ayudas: g.ayudas, trucoDesdeSegunda: g.trucoDesdeSegunda, dealer: (g.dealer + 1) % g.n }, rng);
  ng.evId = g.evId;
  Object.assign(g, ng);
  return true;
}

// ---------------------------------------------------------------- consultas

const played = (h, seat) => h.rounds[h.r].plays.some((p) => p.seat === seat);
const active = (h, seat) => !h.mazo[seat];
const teamSeats = (g, t) => Array.from({ length: g.n }, (_, i) => i).filter((i) => team(i) === t);

// Quién de un equipo puede cantar/contestar el envido: el pie (o, si se fue al mazo, el que quede).
function envidoVoices(g, t) {
  const h = g.h;
  const seats = teamSeats(g, t).filter((s) => active(h, s));
  if (g.n === 2) return seats;
  const pie = seats.filter((s) => isPie(g, s));
  return pie.length ? pie : seats;
}

export function envidoOpenFor(g, seat) {
  const h = g.h;
  if (!h || h.phase !== 'play' || h.r !== 0 || h.envido.state !== 'none') return false;
  if (!active(h, seat) || played(h, seat)) return false;
  if (!envidoVoices(g, team(seat)).includes(seat)) return false;
  const p = h.truco.pending;
  if (h.truco.level > 1) return false;
  if (p) return p.level === 2 && team(seat) !== p.byTeam; // "el envido está primero"
  return true;
}

function envidoNextOptions(calls) {
  if (!calls.length) return ['envido', 'real', 'falta'];
  const last = calls[calls.length - 1];
  if (last === 'envido') return calls.filter((c) => c === 'envido').length < 2 ? ['envido', 'real', 'falta'] : ['real', 'falta'];
  if (last === 'real') return ['falta'];
  return [];
}

function faltaPoints(g, winnerTeam) {
  const leader = g.score[0] >= g.score[1] ? 0 : 1;
  if (g.score[0] === g.score[1] || winnerTeam === leader) return g.target - g.score[winnerTeam];
  return g.target - g.score[leader];
}

function envidoAcceptedPoints(g, calls, winnerTeam) {
  if (calls.includes('falta')) return faltaPoints(g, winnerTeam);
  return calls.reduce((s, c) => s + (c === 'envido' ? 2 : 3), 0);
}

function envidoDeclinedPoints(g, calls, winnerTeam) {
  if (calls.length <= 1) return 1;
  return envidoAcceptedPoints(g, calls.slice(0, -1), winnerTeam);
}

// Quién tiene que actuar ahora: { kind, seats }.
export function waitingFor(g) {
  const h = g.h;
  if (!h || g.status !== 'playing') return { kind: 'none', seats: [] };
  if (h.phase === 'ended') return { kind: 'next-hand', seats: [] };
  if (h.phase === 'show') return { kind: 'show', seats: [h.show.seat] };
  const e = h.envido;
  if (e.state === 'declaring') return { kind: 'declare', seats: [e.declare.seat] };
  if (e.state === 'pending') return { kind: 'envido', seats: envidoVoices(g, otherTeam(e.by)) };
  const p = h.truco.pending;
  if (p) return { kind: 'truco', seats: teamSeats(g, otherTeam(p.byTeam)).filter((s) => active(h, s)) };
  return { kind: 'play', seats: [h.turn] };
}

// Acciones que puede hacer un asiento (para armar los botones del cliente).
export function actionsFor(g, seat) {
  const h = g.h;
  const out = {
    play: false, canDouble: false, canDown: false, truco: null, envido: [], quiero: false, noquiero: false,
    cantar: false, buenas: false, mazo: false, denunciar: [], mostrar: false, reclamar: false,
  };
  if (!h || g.status !== 'playing' || seat == null) return out;
  const w = waitingFor(g);
  if (h.phase === 'show') {
    const s = h.show;
    if (seat === s.seat && !h.mazo[seat]) out.mostrar = true;
    if (team(seat) !== team(s.seat)) out.reclamar = true;
    return out;
  }
  if (h.phase !== 'play' || !active(h, seat)) return out;
  const mine = w.seats.includes(seat);
  const e = h.envido;
  const t = h.truco;
  if (w.kind === 'declare' && mine) {
    const best = e.declare.best;
    out.cantar = true; // puede cantar lo que quiera (si miente y lo cazan, pierde)
    out.buenas = !!best;
    out.minTanto = best ? best.value + 1 : 0;
    return out;
  }
  if (w.kind === 'envido') {
    if (mine) {
      out.quiero = out.noquiero = true;
      out.envido = envidoNextOptions(e.calls);
    }
    return out;
  }
  if (w.kind === 'truco') {
    if (mine) {
      out.quiero = out.noquiero = true;
      if (t.pending.level < 4) out.truco = TRUCO_NAMES[t.pending.level + 1];
      if (envidoOpenFor(g, seat)) out.envido = ['envido', 'real', 'falta'];
      out.mazo = true;
    }
    return out;
  }
  // fase de juego normal
  out.mazo = true;
  const trucoOk = !(g.trucoDesdeSegunda && h.r === 0);
  if (trucoOk && t.level < 4 && (t.holder === null || t.holder === team(seat))) out.truco = TRUCO_NAMES[t.level + 1];
  if (envidoOpenFor(g, seat)) out.envido = ['envido', 'real', 'falta'];
  if (h.turn === seat) {
    out.play = true;
    out.canDouble = h.inHand[seat].length >= 2 && h.r <= 1;
    out.canDown = h.r > 0;
  }
  for (let s = 0; s < g.n; s++) {
    if (team(s) !== team(seat) && !h.falseAccuse[seat]) out.denunciar.push(s);
  }
  return out;
}

// ---------------------------------------------------------------- acciones

export function act(g, seat, a, rng = Math.random) {
  const h = g.h;
  if (g.status !== 'playing') return { error: 'La partida terminó' };
  if (!h) return { error: 'Esperá la próxima mano' };
  if (seat == null || seat < 0 || seat >= g.n) return { error: 'No estás sentado' };
  if (h.phase === 'show') return actShow(g, seat, a);
  if (h.phase !== 'play') return { error: 'Esperá la próxima mano' };
  if (!active(h, seat)) return { error: 'Te fuiste al mazo' };
  const w = waitingFor(g);
  const mine = w.seats.includes(seat);
  const T = team(seat);
  const e = h.envido;
  const tr = h.truco;

  switch (a?.t) {
    case 'play': {
      if (w.kind !== 'play') return { error: 'Hay que responder primero' };
      if (h.turn !== seat) return { error: 'No es tu turno' };
      const idx = h.inHand[seat].indexOf(a.card);
      if (idx < 0) return { error: 'No tenés esa carta' };
      const faceDown = a.mode === 'down';
      if (faceDown && h.r === 0) return { error: 'En primera no se puede tirar tapada' };
      h.inHand[seat].splice(idx, 1);
      h.table[seat].push({ c: a.card, faceDown, round: h.r });
      h.rounds[h.r].plays.push({ seat, c: a.card, faceDown });
      event(g, { type: 'play', seat, c: faceDown ? null : a.card, faceDown, round: h.r });
      advanceTurn(g);
      return { ok: true };
    }

    // Tirar dos cartas juntas, una encima de la otra. Según el reglamento cuentan en el orden en
    // que quedan: la de abajo es la de esta ronda y la de arriba la de la siguiente. La de arriba
    // es la que se ve: sirve para hacer creer que jugaste otra carta.
    case 'play2': {
      if (w.kind !== 'play') return { error: 'Hay que responder primero' };
      if (h.turn !== seat) return { error: 'No es tu turno' };
      if (h.r > 1) return { error: 'En tercera no hay ronda siguiente' };
      const { bottom, top } = a;
      if (bottom === top) return { error: 'Elegí dos cartas distintas' };
      const hand = h.inHand[seat];
      if (!hand.includes(bottom) || !hand.includes(top)) return { error: 'No tenés esas cartas' };
      h.inHand[seat] = hand.filter((c) => c !== bottom && c !== top);
      h.table[seat].push({ c: bottom, faceDown: false, round: h.r, under: true });
      h.table[seat].push({ c: top, faceDown: false, round: h.r + 1, over: true });
      h.rounds[h.r].plays.push({ seat, c: bottom, faceDown: false });
      h.pre[seat] = top;
      h.stacked[seat] = true;
      event(g, { type: 'play', seat, c: top, double: true, round: h.r });
      advanceTurn(g);
      return { ok: true };
    }

    case 'envido': {
      const kind = a.kind;
      if (!ENVIDO_NAMES[kind]) return { error: 'Canto inválido' };
      if (w.kind === 'envido') {
        if (!mine) return { error: g.n > 2 ? 'El envido lo contesta el pie' : 'No te toca' };
        if (!envidoNextOptions(e.calls).includes(kind)) return { error: 'No se puede subir así' };
        e.calls.push(kind);
        e.by = T;
        e.bySeat = seat;
      } else {
        if (!envidoOpenFor(g, seat)) {
          if (g.n > 2 && !isPie(g, seat) && h.r === 0 && e.state === 'none') return { error: 'En equipo el envido lo canta el pie' };
          return { error: 'Ya no se puede cantar envido' };
        }
        e.calls = [kind];
        e.by = T;
        e.bySeat = seat;
        e.state = 'pending';
      }
      event(g, { type: 'call', seat, text: ENVIDO_NAMES[kind], kind: 'envido' });
      return { ok: true };
    }

    case 'truco': {
      if (w.kind === 'truco') {
        if (!mine) return { error: 'No te toca' };
        if (tr.pending.level >= 4) return { error: 'No se puede subir más' };
        tr.level = tr.pending.level; // subir implica querer lo anterior
        tr.pending = { level: tr.pending.level + 1, byTeam: T, bySeat: seat };
        tr.holder = null;
      } else if (w.kind === 'play') {
        if (g.trucoDesdeSegunda && h.r === 0) return { error: 'En esta mesa el truco se canta desde segunda' };
        if (tr.level >= 4) return { error: 'Ya está en vale cuatro' };
        if (tr.holder !== null && tr.holder !== T) return { error: 'El quiero lo tiene el otro equipo' };
        tr.pending = { level: tr.level + 1, byTeam: T, bySeat: seat };
      } else return { error: 'Hay que responder primero' };
      event(g, { type: 'call', seat, text: TRUCO_NAMES[tr.pending.level], kind: 'truco' });
      return { ok: true };
    }

    case 'quiero': {
      if (!mine) return { error: 'No te toca' };
      if (w.kind === 'envido') {
        event(g, { type: 'call', seat, text: 'Quiero', kind: 'quiero' });
        startDeclare(g);
        return { ok: true };
      }
      if (w.kind === 'truco') {
        tr.level = tr.pending.level;
        tr.holder = T;
        tr.pending = null;
        event(g, { type: 'call', seat, text: 'Quiero', kind: 'quiero' });
        return { ok: true };
      }
      return { error: 'No hay nada que querer' };
    }

    case 'noquiero': {
      if (!mine) return { error: 'No te toca' };
      if (w.kind === 'envido') {
        const pts = envidoDeclinedPoints(g, e.calls, e.by);
        e.state = 'done';
        e.winner = e.by;
        e.points = pts;
        event(g, { type: 'call', seat, text: 'No quiero', kind: 'noquiero' });
        h.pending.push({ team: e.by, pts, why: 'envido' });
        return { ok: true };
      }
      if (w.kind === 'truco') {
        const p = tr.pending;
        event(g, { type: 'call', seat, text: 'No quiero', kind: 'noquiero' });
        tr.pending = null;
        endHand(g, p.byTeam, p.level - 1, 'noquiero');
        return { ok: true };
      }
      return { error: 'No hay nada que rechazar' };
    }

    case 'cantar':
    case 'buenas': {
      if (w.kind !== 'declare' || !mine) return { error: 'No te toca cantar los tantos' };
      const d = e.declare;
      if (a.t === 'cantar') {
        const real = tanto(h.cards[seat]).value;
        const v = a.value === undefined || a.value === null ? real : Number(a.value);
        if (!validTanto(v)) return { error: 'Ese número no existe en el envido' };
        if (d.best && v <= d.best.value) return { error: `Tenés que cantar más de ${d.best.value}` };
        d.best = { seat, value: v, team: T };
        d.said.push({ seat, value: v });
        event(g, { type: 'tanto', seat, value: v });
      } else {
        if (!d.best) return { error: 'El primero tiene que cantar' };
        d.said.push({ seat, value: null });
        event(g, { type: 'tanto', seat, value: null });
      }
      d.idx++;
      advanceDeclare(g);
      return { ok: true };
    }

    case 'mazo': {
      if (w.kind === 'envido' || w.kind === 'declare') return { error: 'Primero resolvé el envido' };
      h.mazo[seat] = true;
      h.inHand[seat] = [];
      h.pre[seat] = null;
      event(g, { type: 'mazo', seat });
      const left = teamSeats(g, T).filter((s) => active(h, s));
      if (!left.length) {
        const win = otherTeam(T);
        let pts = tr.pending && tr.pending.byTeam === win ? tr.pending.level - 1 : tr.level;
        if (h.r === 0 && e.state === 'none') h.pending.push({ team: win, pts: 1, why: 'envido-mazo' });
        tr.pending = null;
        endHand(g, win, pts, 'mazo');
      } else if (h.turn === seat && w.kind === 'play') {
        advanceTurn(g);
      }
      return { ok: true };
    }

    case 'denuncia': {
      const target = a.target;
      if (typeof target !== 'number' || team(target) === T || target < 0 || target >= g.n) return { error: 'Denuncia inválida' };
      if (h.falseAccuse[seat]) return { error: 'Ya denunciaste mal en esta mano' };
      if (w.kind !== 'play') return { error: 'Esperá a que respondan' };
      if (h.stacked[target]) {
        event(g, { type: 'denuncia', seat, target, ok: true });
        const pts = Math.max(tr.level, tr.pending ? tr.pending.level : 1);
        tr.pending = null;
        endHand(g, T, pts, 'trampa', target);
      } else {
        h.falseAccuse[seat] = true;
        event(g, { type: 'denuncia', seat, target, ok: false });
        h.pending.push({ team: otherTeam(T), pts: 1, why: 'denuncia-falsa' });
      }
      return { ok: true };
    }
  }
  return { error: 'Acción desconocida' };
}

// Después de la mano: mostrar los tantos o reclamar que no se mostraron.
function actShow(g, seat, a) {
  const h = g.h;
  const s = h.show;
  if (a?.t === 'mostrar') {
    if (seat !== s.seat) return { error: 'Tiene que mostrar el que ganó el envido' };
    if (h.mazo[seat]) return { error: 'Tus cartas ya están en el mazo' };
    const real = tanto(h.cards[seat]);
    h.envido.shown = true;
    const ok = real.value === s.value;
    event(g, { type: 'show', seat, value: real.value, said: s.value, cards: real.cards, ok });
    finishHand(g, ok ? null : 'mal-cantado');
    return { ok: true };
  }
  if (a?.t === 'reclamar') {
    if (team(seat) === team(s.seat)) return { error: 'No te podés reclamar a vos mismo' };
    event(g, { type: 'reclamo', seat, target: s.seat });
    finishHand(g, 'no-mostro');
    return { ok: true };
  }
  return { error: 'Ahora se muestran los tantos' };
}

// Si pasa el tiempo y nadie reclamó, los tantos valen igual (lo usa el servidor).
export function closeShow(g) {
  if (g.h?.phase !== 'show') return false;
  event(g, { type: 'show-timeout', seat: g.h.show.seat });
  finishHand(g, null);
  return true;
}

function addPoints(g, t, pts, why) {
  if (pts <= 0 || g.status !== 'playing') return;
  g.score[t] = Math.min(g.target, g.score[t] + pts);
  event(g, { type: 'points', team: t, pts, why });
  if (g.score[t] >= g.target) {
    g.status = 'ended';
    g.winner = t;
    event(g, { type: 'game-end', team: t });
  }
}

function startDeclare(g) {
  const h = g.h;
  const order = [];
  for (let k = 0; k < g.n; k++) {
    const s = (h.mano + k) % g.n;
    if (active(h, s)) order.push(s);
  }
  h.envido.state = 'declaring';
  h.envido.declare = { order, idx: 0, seat: null, best: null, said: [] };
  advanceDeclare(g);
}

function advanceDeclare(g) {
  const h = g.h;
  const e = h.envido;
  const d = e.declare;
  while (d.idx < d.order.length) {
    const s = d.order[d.idx];
    if (d.best && team(s) === d.best.team) {
      d.idx++;
      continue;
    }
    d.seat = s;
    return;
  }
  d.seat = null;
  e.state = 'done';
  e.winner = d.best.team;
  e.winnerSeat = d.best.seat;
  e.saidValue = d.best.value;
  e.points = envidoAcceptedPoints(g, e.calls, e.winner);
  e.needsShow = true;
  h.pending.push({ team: e.winner, pts: e.points, why: 'envido' });
  event(g, { type: 'envido-done', seat: d.best.seat, value: d.best.value, team: e.winner, said: d.said, points: e.points });
}

function advanceTurn(g) {
  const h = g.h;
  const plays = h.rounds[h.r].plays;
  for (let k = 1; k <= g.n; k++) {
    const s = (h.turn + k) % g.n;
    if (active(h, s) && !plays.some((p) => p.seat === s)) {
      h.turn = s;
      autoPre(g);
      return;
    }
  }
  resolveRound(g);
}

// La carta de arriba de un tiro doble ya está en la mesa: se juega sola cuando le toca.
function autoPre(g) {
  const h = g.h;
  if (h.phase !== 'play') return;
  const s = h.turn;
  const c = h.pre[s];
  if (!c || h.rounds[h.r].plays.some((p) => p.seat === s)) return;
  h.pre[s] = null;
  h.rounds[h.r].plays.push({ seat: s, c, faceDown: false });
  advanceTurn(g);
}

function resolveRound(g) {
  const h = g.h;
  const R = h.rounds[h.r];
  let top = -1;
  for (const p of R.plays) top = Math.max(top, p.faceDown ? 0 : rank(p.c));
  const tops = R.plays.filter((p) => (p.faceDown ? 0 : rank(p.c)) === top);
  const teams = new Set(tops.map((p) => team(p.seat)));
  if (teams.size === 1) {
    R.result = team(tops[0].seat);
    R.winnerSeat = tops[0].seat;
  } else {
    R.result = 'parda';
    R.winnerSeat = null;
  }
  event(g, { type: 'round', round: h.r, result: R.result, seat: R.winnerSeat });

  const winner = handWinner(h.rounds, team(h.mano));
  if (winner !== null) {
    endHand(g, winner, h.truco.level, 'cartas');
    return;
  }
  h.r++;
  let starter = R.winnerSeat;
  if (starter == null || !active(h, starter)) {
    starter = h.mano;
    for (let k = 0; k < g.n && !active(h, starter); k++) starter = (h.mano + k) % g.n;
  }
  h.rounds.push({ plays: [], result: null, starter });
  h.turn = starter;
  autoPre(g);
}

// Devuelve el equipo ganador de la mano o null si hay que seguir.
export function handWinner(rounds, manoTeam) {
  const res = rounds.map((r) => r.result).filter((r) => r !== null && r !== undefined);
  const [a, b, c] = res;
  if (res.length < 2) return null;
  if (res.length === 2) {
    if (a !== 'parda' && b === a) return a;
    if (a !== 'parda' && b === 'parda') return a;
    if (a === 'parda' && b !== 'parda') return b;
    return null;
  }
  if (c !== 'parda') return c;
  if (a !== 'parda') return a;
  return manoTeam;
}

// Termina la parte de cartas. Si hay un envido cantado, el ganador tiene que mostrar.
function endHand(g, winnerTeam, pts, reason, cheater = null) {
  const h = g.h;
  if (h.phase !== 'play') return;
  h.truco.pending = null;
  h.trucoResult = { team: winnerTeam, pts, reason, cheater };
  event(g, { type: 'hand-end', team: winnerTeam, pts, reason });
  const e = h.envido;
  if (e.needsShow && !e.shown) {
    h.phase = 'show';
    h.show = { seat: e.winnerSeat, value: e.saidValue, since: Date.now() };
    return;
  }
  finishHand(g, null);
}

// Anota todo lo de la mano. penalty: el que ganó el envido no mostró o cantó mal.
function finishHand(g, penalty) {
  const h = g.h;
  const e = h.envido;
  const tr = h.trucoResult;
  const cheatTeam = penalty ? e.winner : null;
  const entries = [];
  for (const p of h.pending) {
    if (penalty && p.why === 'envido') entries.push({ ...p, team: otherTeam(p.team), why: 'envido-' + penalty });
    else entries.push(p);
  }
  let trucoTeam = tr.team;
  if (penalty && trucoTeam === cheatTeam) trucoTeam = otherTeam(cheatTeam);
  entries.push({ team: trucoTeam, pts: tr.pts, why: penalty && tr.team === cheatTeam ? 'truco-' + penalty : 'truco' });
  h.phase = 'ended';
  h.result = {
    winner: trucoTeam,
    pts: tr.pts,
    reason: tr.reason,
    cheater: tr.cheater,
    penalty,
    envido: e.winner !== null ? { team: e.winner, seat: e.winnerSeat, points: e.points, said: e.saidValue ?? null, shown: e.shown } : null,
    envidoShow: e.shown ? { seat: e.winnerSeat, value: tanto(h.cards[e.winnerSeat]).value, cards: tanto(h.cards[e.winnerSeat]).cards } : null,
  };
  // primero el envido y las demás, después el truco
  for (const p of entries) addPoints(g, p.team, p.pts, p.why);
}

// ---------------------------------------------------------------- vista por jugador

// Lo que puede ver un asiento (o un espectador con seat = null): oculta las cartas ajenas.
export function viewFor(g, seat) {
  const h = g.h;
  const done = h && h.phase === 'ended';
  const vh = h && {
    mano: h.mano,
    r: h.r,
    turn: h.turn,
    phase: h.phase,
    mazo: h.mazo,
    pies: pies(g),
    cutter: cutter(g),
    handCounts: h.inHand.map((c) => c.length),
    myCards: seat != null ? h.inHand[seat] : [],
    myTanto: seat != null ? tanto(h.cards[seat]).value : null,
    table: h.table.map((list, s) =>
      list.map((p) => {
        // la tapada y la de abajo de un tiro doble no se ven hasta que termina la mano
        const hidden = s !== seat && !done && (p.faceDown || p.under);
        return { ...p, c: hidden ? null : p.c, hidden };
      })
    ),
    rounds: h.rounds.map((r) => ({ result: g.ayudas || done ? r.result : undefined, starter: r.starter })),
    envido: {
      calls: h.envido.calls,
      by: h.envido.by,
      bySeat: h.envido.bySeat,
      state: h.envido.state,
      winner: h.envido.winner,
      points: h.envido.points,
      declare: h.envido.declare && { seat: h.envido.declare.seat, best: h.envido.declare.best, said: h.envido.declare.said },
    },
    truco: h.truco,
    show: h.show,
    result: h.result,
  };
  return {
    mode: g.mode,
    n: g.n,
    target: g.target,
    ayudas: g.ayudas,
    trucoDesdeSegunda: g.trucoDesdeSegunda,
    score: g.score,
    dealer: g.dealer,
    handNo: g.handNo,
    status: g.status,
    winner: g.winner,
    h: vh,
    waiting: waitingFor(g),
    actions: actionsFor(g, seat),
    ev: g.ev,
  };
}
