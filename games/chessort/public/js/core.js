// Lógica de partida compartida entre el servidor (Durable Object) y el navegador (modo local).
// No importa nada: recibe la clase Chess (chess.js) por parámetro para funcionar en ambos lados.

export const TIME_CONTROLS = [
  { id: '1+0', label: '1 min', initial: 60, increment: 0, cat: 'bullet' },
  { id: '2+1', label: '2 | 1', initial: 120, increment: 1, cat: 'bullet' },
  { id: '3+0', label: '3 min', initial: 180, increment: 0, cat: 'blitz' },
  { id: '3+2', label: '3 | 2', initial: 180, increment: 2, cat: 'blitz' },
  { id: '5+0', label: '5 min', initial: 300, increment: 0, cat: 'blitz' },
  { id: '10+0', label: '10 min', initial: 600, increment: 0, cat: 'rapid' },
  { id: '15+10', label: '15 | 10', initial: 900, increment: 10, cat: 'rapid' },
  { id: '30+0', label: '30 min', initial: 1800, increment: 0, cat: 'rapid' },
  { id: '0+0', label: 'Sin reloj', initial: 0, increment: 0, cat: 'unlimited' },
];

export const REASON_TEXT = {
  checkmate: 'por jaque mate',
  resign: 'por abandono',
  timeout: 'por tiempo',
  stalemate: 'por rey ahogado',
  insufficient: 'por material insuficiente',
  repetition: 'por triple repetición',
  fifty: 'por la regla de 50 movimientos',
  agreement: 'por acuerdo mutuo',
  'timeout-insufficient': 'por tiempo vs. material insuficiente',
  aborted: 'Partida abortada',
};

export const other = (c) => (c === 'w' ? 'b' : 'w');

export function findTimeControl(id) {
  return TIME_CONTROLS.find((t) => t.id === id) || TIME_CONTROLS.find((t) => t.id === '10+0');
}

export function createCore(Chess) {
  function newState({ id, tc, players }) {
    const ms = tc.initial * 1000;
    const p = players || { w: null, b: null };
    return {
      id,
      tc: { id: tc.id, initial: tc.initial, increment: tc.increment },
      players: p,
      moves: [], // UCI: "e2e4", "e7e8q"
      sans: [],
      fen: new Chess().fen(),
      clock: { w: ms, b: ms, lastTs: null },
      status: p.w && p.b ? 'playing' : 'waiting',
      result: null, // { winner: 'w'|'b'|null, reason }
      drawOffer: null,
      rematch: { w: false, b: false },
      gameNo: 1,
      createdAt: Date.now(),
      endedAt: null,
    };
  }

  function rebuild(state) {
    const chess = new Chess();
    for (const uci of state.moves) {
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
    return chess;
  }

  const turn = (state) => (state.moves.length % 2 === 0 ? 'w' : 'b');
  const hasClock = (state) => state.tc.initial > 0;
  // El reloj empieza a correr cuando ambos bandos hicieron su primera jugada (como en las plataformas grandes).
  const ticking = (state) => state.status === 'playing' && hasClock(state) && state.moves.length >= 2;

  function remaining(state, color, now) {
    const base = state.clock[color];
    if (ticking(state) && turn(state) === color && state.clock.lastTs != null) {
      return base - (now - state.clock.lastTs);
    }
    return base;
  }

  // Si el bando ganador no puede dar mate, la caída de bandera es tablas.
  function cannotMate(chess, color) {
    const pieces = chess.board().flat().filter((p) => p && p.color === color && p.type !== 'k');
    if (pieces.length === 0) return true;
    if (pieces.length === 1 && (pieces[0].type === 'n' || pieces[0].type === 'b')) return true;
    return false;
  }

  function end(state, winner, reason, now) {
    if (hasClock(state)) {
      for (const c of ['w', 'b']) state.clock[c] = Math.max(0, remaining(state, c, now));
    }
    state.clock.lastTs = null;
    state.status = 'ended';
    state.result = { winner, reason };
    state.drawOffer = null;
    state.rematch = { w: false, b: false };
    state.endedAt = now;
  }

  function checkFlag(state, chess, now) {
    if (!ticking(state)) return false;
    const t = turn(state);
    if (remaining(state, t, now) > 0) return false;
    const winner = other(t);
    if (cannotMate(chess, winner)) end(state, null, 'timeout-insufficient', now);
    else end(state, winner, 'timeout', now);
    state.clock[t] = 0;
    return true;
  }

  function applyMove(state, chess, color, mv, now) {
    if (state.status !== 'playing') return { error: 'La partida no está en curso' };
    if (turn(state) !== color) return { error: 'No es tu turno' };
    if (checkFlag(state, chess, now)) return { error: 'Se acabó el tiempo', ended: true };

    let move;
    try {
      move = chess.move({ from: mv.from, to: mv.to, promotion: mv.promotion || undefined });
    } catch {
      return { error: 'Movimiento ilegal' };
    }

    if (ticking(state)) {
      state.clock[color] = remaining(state, color, now) + state.tc.increment * 1000;
    }
    state.moves.push(move.from + move.to + (move.promotion || ''));
    state.sans.push(move.san);
    state.fen = chess.fen();
    state.clock.lastTs = now;
    if (state.drawOffer && state.drawOffer !== color) state.drawOffer = null; // jugar = rechazar

    if (chess.isCheckmate()) end(state, color, 'checkmate', now);
    else if (chess.isStalemate()) end(state, null, 'stalemate', now);
    else if (chess.isInsufficientMaterial()) end(state, null, 'insufficient', now);
    else if (chess.isThreefoldRepetition()) end(state, null, 'repetition', now);
    else if (chess.isDrawByFiftyMoves()) end(state, null, 'fifty', now);

    return { ok: true, move };
  }

  function resign(state, color, now) {
    if (state.status !== 'playing') return { error: 'La partida no está en curso' };
    end(state, other(color), 'resign', now);
    return { ok: true };
  }

  function abort(state, now) {
    if (state.status !== 'playing' || state.moves.length >= 2) return { error: 'Ya no se puede abortar' };
    end(state, null, 'aborted', now);
    return { ok: true };
  }

  function offerDraw(state, color) {
    if (state.status !== 'playing') return { error: 'La partida no está en curso' };
    if (state.drawOffer === other(color)) return { accept: true };
    state.drawOffer = color;
    return { ok: true };
  }

  function acceptDraw(state, color, now) {
    if (state.status !== 'playing' || state.drawOffer !== other(color)) return { error: 'No hay oferta de tablas' };
    end(state, null, 'agreement', now);
    return { ok: true };
  }

  function declineDraw(state, color) {
    if (state.drawOffer === other(color)) state.drawOffer = null;
    return { ok: true };
  }

  // Devuelve un estado nuevo con colores invertidos cuando ambos aceptan la revancha.
  function requestRematch(state, color) {
    if (state.status !== 'ended' || !state.players.w || !state.players.b) return { error: 'No disponible' };
    state.rematch[color] = true;
    if (!(state.rematch.w && state.rematch.b)) return { ok: true };
    const next = newState({ id: state.id, tc: state.tc, players: { w: state.players.b, b: state.players.w } });
    next.gameNo = state.gameNo + 1;
    return { ok: true, next };
  }

  return {
    newState, rebuild, turn, ticking, remaining, checkFlag, applyMove,
    resign, abort, offerDraw, acceptDraw, declineDraw, requestRematch, end,
  };
}
