import { Chess } from '/vendor/chess.js';
import { Board } from './board.js';
import { createCore, REASON_TEXT, other } from './core.js';
import { playSound, soundForMove } from './sound.js';
import { getSettings } from './settings.js';
import { esc, avatarHtml, icon, toast } from './ui.js';

const core = createCore(Chess);
const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const START_COUNT = { p: 8, b: 2, n: 2, r: 2, q: 1 };
const FIGURINES = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞' };

export function mountGame(root, ctrl, { gameId = null, navigate }) {
  const isOnline = ctrl.online;
  root.innerHTML = `
    <div class="game-layout">
      <section class="board-col">
        <div class="player-bar" data-pos="top"></div>
        <div class="board-wrap">
          <div class="board-el"></div>
          <div class="result-modal hidden"></div>
        </div>
        <div class="player-bar" data-pos="bottom"></div>
      </section>
      <aside class="side-panel">
        <div class="conn-banner hidden">Reconectando…</div>
        <div class="panel-tabs">
          <button class="tab active" data-tab="moves">${icon('list')}<span>Jugadas</span></button>
          ${isOnline ? `<button class="tab" data-tab="chat">${icon('chat')}<span>Chat</span><b class="badge hidden">0</b></button>` : ''}
        </div>
        <div class="panel-body">
          <div class="tab-pane" data-pane="moves">
            <div class="invite hidden"></div>
            <div class="moves-list"></div>
          </div>
          ${isOnline ? `<div class="tab-pane hidden" data-pane="chat">
            <div class="chat-log"></div>
            <form class="chat-form"><input maxlength="300" placeholder="Escribe un mensaje…" autocomplete="off"/><button>${icon('send')}</button></form>
          </div>` : ''}
        </div>
        <div class="offer-bar hidden"></div>
        <div class="nav-controls">
          <button data-nav="flip" title="Girar tablero (F)">${icon('flip')}</button>
          <button data-nav="first" title="Inicio">${icon('first')}</button>
          <button data-nav="prev" title="Anterior (←)">${icon('prev')}</button>
          <button data-nav="next" title="Siguiente (→)">${icon('next')}</button>
          <button data-nav="last" title="Final">${icon('last')}</button>
        </div>
        <div class="game-actions"></div>
        <div class="spectators"></div>
      </aside>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const v = {
    game: null,
    you: null,
    offset: 0,
    ucis: [],
    fens: [new Chess().fen()],
    verbose: [],
    liveChess: new Chess(),
    viewPly: null,
    flipped: false,
    lastStatus: null,
    lastGameNo: null,
    modalDismissed: false,
    confirmResign: false,
    lowTimeWarned: false,
    flagSentAt: 0,
    unread: 0,
    tab: 'moves',
  };

  const board = new Board($('.board-el'), {
    settings: getSettings,
    getDests: (sq) => v.liveChess.moves({ square: sq, verbose: true }).map((m) => ({ to: m.to, promotion: !!m.promotion })),
    onMove: (from, to, promotion) => userMove(from, to, promotion),
  });

  // ---------- historia de jugadas ----------
  function syncHistory(moves) {
    const sameStart = moves.length >= v.ucis.length && v.ucis.every((u, i) => moves[i] === u);
    const added = [];
    if (!sameStart) {
      v.ucis = [];
      v.fens = [new Chess().fen()];
      v.verbose = [];
      v.liveChess = new Chess();
    }
    for (let i = v.ucis.length; i < moves.length; i++) {
      const u = moves[i];
      const m = v.liveChess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      v.ucis.push(u);
      v.fens.push(v.liveChess.fen());
      v.verbose.push(m);
      added.push(m);
    }
    return { added, reset: !sameStart };
  }

  function userMove(from, to, promotion) {
    if (isOnline) {
      // Jugada optimista: se ve al instante y el servidor la confirma.
      let m;
      try {
        m = v.liveChess.move({ from, to, promotion });
      } catch {
        return;
      }
      v.ucis.push(m.from + m.to + (m.promotion || ''));
      v.fens.push(v.liveChess.fen());
      v.verbose.push(m);
      v.viewPly = null;
      v.optimistic = true;
      playSound(soundForMove(m));
      renderBoard(true);
      renderMoves();
      board.setMovable(null);
    }
    ctrl.send({ t: 'move', from, to, promotion });
  }

  // ---------- estado entrante ----------
  ctrl.on('state', (msg) => {
    const prev = v.game;
    v.game = msg.game;
    v.you = msg.you;
    v.offset = msg.now - Date.now();
    const g = v.game;

    if (v.lastGameNo !== null && g.gameNo !== v.lastGameNo) {
      v.modalDismissed = false;
      v.viewPly = null;
      v.lowTimeWarned = false;
      playSound('start');
    }
    const { added, reset } = syncHistory(g.moves);
    v.optimistic = false;
    if (added.length && prev) {
      v.viewPly = null;
      playSound(soundForMove(added[added.length - 1]));
    }
    if (prev && prev.status === 'waiting' && g.status === 'playing') {
      playSound('start');
      toast('¡Tu rival llegó! Empieza la partida.');
    }
    if (prev && prev.status !== 'ended' && g.status === 'ended') playSound('end');
    if (!prev) v.flipped = false;

    v.lastStatus = g.status;
    v.lastGameNo = g.gameNo;
    if (g.status !== 'playing') v.confirmResign = false;
    renderAll(!!prev && !reset);
  });

  ctrl.on('chat-history', (msgs) => {
    const log = $('.chat-log');
    if (!log) return;
    log.innerHTML = '';
    msgs.forEach((m) => addChat(m, false));
  });
  ctrl.on('chat', (m) => addChat(m, true));
  ctrl.on('error', (e) => toast(e, 'error'));
  ctrl.on('connection', (ok) => $('.conn-banner').classList.toggle('hidden', ok));
  ctrl.on('notfound', () => {
    root.innerHTML = `<div class="notfound card"><h2>Partida no encontrada</h2>
      <p>El enlace no es válido o la partida ya no existe.</p>
      <button class="btn btn-green" data-home>Ir al inicio</button></div>`;
    root.querySelector('[data-home]').onclick = () => navigate('/');
  });

  // ---------- render ----------
  function orientation() {
    const base = v.you === 'b' ? 'b' : 'w';
    return v.flipped ? other(base) : base;
  }

  function viewedPly() {
    return v.viewPly ?? v.fens.length - 1;
  }

  function renderAll(animate) {
    if (!v.game) return;
    board.setOrientation(orientation());
    renderBoard(animate);
    renderBars();
    renderMoves();
    renderPanel();
    renderModal();
    renderClocks();
    updateTitle();
  }

  function renderBoard(animate) {
    const ply = viewedPly();
    const fen = v.fens[ply];
    const mv = v.verbose[ply - 1];
    const chessAt = new Chess(fen);
    let check = null;
    if (chessAt.inCheck()) {
      const turn = chessAt.turn();
      for (const row of chessAt.board()) for (const p of row) if (p && p.type === 'k' && p.color === turn) check = p.square;
    }
    board.setPosition(fen, { lastMove: mv ? [mv.from, mv.to] : null, check, animate });
    const g = v.game;
    const live = v.viewPly === null;
    const turn = v.liveChess.turn();
    const canMove = g && g.status === 'playing' && live && !v.optimistic && (v.you === 'both' || v.you === turn);
    board.setMovable(canMove ? turn : null);
    root.querySelector('.board-wrap').classList.toggle('viewing-history', !live);
  }

  function playerName(color) {
    const p = v.game.players[color];
    return p ? p.name : null;
  }

  function renderBars() {
    const ori = orientation();
    renderBar($('.player-bar[data-pos="top"]'), other(ori));
    renderBar($('.player-bar[data-pos="bottom"]'), ori);
  }

  function renderBar(el, color) {
    const g = v.game;
    const p = g.players[color];
    const fen = v.fens[viewedPly()];
    const { captured, diff } = material(fen, color);
    const isYou = v.you === color;
    const name = p ? p.name : 'Esperando rival…';
    el.dataset.color = color;
    el.innerHTML = `
      ${p ? avatarHtml(p.name, color) : `<div class="avatar avatar-empty"><span class="spinner"></span></div>`}
      <div class="pinfo">
        <div class="pname">
          <span class="name-text">${esc(name)}</span>
          ${isYou ? '<span class="you-tag">Tú</span>' : ''}
          ${p && isOnline ? `<span class="presence ${p.online ? 'on' : 'off'}" title="${p.online ? 'Conectado' : 'Desconectado'}"></span>` : ''}
        </div>
        <div class="captured">${captured}${diff > 0 ? `<span class="adv">+${diff}</span>` : ''}</div>
      </div>
      <div class="clock ${g.tc.initial > 0 ? '' : 'hidden'}" data-clock="${color}">
        <span class="clock-icon">${icon('clock')}</span><span class="clock-time">--:--</span>
      </div>`;
  }

  function material(fen, color) {
    const counts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
    const placement = fen.split(' ')[0];
    for (const ch of placement) {
      const lc = ch.toLowerCase();
      if (lc in VALUES) counts[ch === lc ? 'b' : 'w'][lc]++;
    }
    const opp = other(color);
    let html = '';
    for (const t of ['p', 'b', 'n', 'r', 'q']) {
      const n = Math.max(0, START_COUNT[t] - counts[opp][t]);
      if (n) html += `<span class="cap-group">${`<img src="/pieces/${opp}${t}.svg" alt="">`.repeat(n)}</span>`;
    }
    const score = (c) => Object.entries(counts[c]).reduce((s, [t, n]) => s + VALUES[t] * n, 0);
    return { captured: html, diff: score(color) - score(opp) };
  }

  function formatClock(ms) {
    ms = Math.max(0, ms);
    if (ms < 20000) {
      const s = Math.floor(ms / 1000);
      const t = Math.floor((ms % 1000) / 100);
      return `0:${String(s).padStart(2, '0')}.${t}`;
    }
    const total = Math.ceil(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  function renderClocks() {
    const g = v.game;
    if (!g || g.tc.initial <= 0) return;
    const now = Date.now() + v.offset;
    const turn = core.turn(g);
    for (const color of ['w', 'b']) {
      const el = root.querySelector(`[data-clock="${color}"]`);
      if (!el) continue;
      const ms = core.remaining(g, color, now);
      el.querySelector('.clock-time').textContent = formatClock(ms);
      const active = g.status === 'playing' && turn === color;
      el.classList.toggle('active', active);
      el.classList.toggle('low', active && ms < 20000);
      if (active && ms <= 0 && Date.now() - v.flagSentAt > 1000) {
        v.flagSentAt = Date.now();
        ctrl.send({ t: 'flag' });
      }
      if (active && (v.you === color) && ms < 10000 && ms > 0 && !v.lowTimeWarned && g.tc.initial >= 60) {
        v.lowTimeWarned = true;
        playSound('lowtime');
      }
    }
  }
  const clockTimer = setInterval(renderClocks, 100);

  function sanFig(san) {
    return san.replace(/^[KQRBN]/, (c) => `<span class="fig">${FIGURINES[c]}</span>`).replace(/=([QRBN])/, (_, c) => `=<span class="fig">${FIGURINES[c]}</span>`);
  }

  function renderMoves() {
    const list = $('.moves-list');
    const active = viewedPly();
    let html = '';
    for (let i = 0; i < v.verbose.length; i += 2) {
      const w = v.verbose[i];
      const b = v.verbose[i + 1];
      html += `<div class="move-row ${(i / 2) % 2 ? 'odd' : ''}"><span class="move-no">${i / 2 + 1}.</span>
        <span class="move ${active === i + 1 ? 'current' : ''}" data-ply="${i + 1}">${sanFig(w.san)}</span>
        ${b ? `<span class="move ${active === i + 2 ? 'current' : ''}" data-ply="${i + 2}">${sanFig(b.san)}</span>` : '<span></span>'}</div>`;
    }
    const g = v.game;
    if (g?.status === 'ended') {
      const r = g.result;
      const score = r.reason === 'aborted' ? '—' : r.winner === 'w' ? '1-0' : r.winner === 'b' ? '0-1' : '½-½';
      html += `<div class="move-result">${score}<small>${esc(resultSubtitle(r))}</small></div>`;
    }
    if (!v.verbose.length && g?.status !== 'ended') html += `<div class="moves-empty">${g?.status === 'waiting' ? '' : 'Las blancas mueven primero'}</div>`;
    list.innerHTML = html;
    if (v.viewPly === null) list.scrollTop = list.scrollHeight;
    else list.querySelector('.move.current')?.scrollIntoView({ block: 'nearest' });
  }

  function resultSubtitle(r) {
    if (r.reason === 'aborted') return 'Partida abortada';
    const base = REASON_TEXT[r.reason] || '';
    if (!r.winner) return 'Tablas ' + base;
    return (r.winner === 'w' ? 'Blancas ganan ' : 'Negras ganan ') + base;
  }

  function renderPanel() {
    const g = v.game;
    const you = v.you;
    const isPlayer = you === 'w' || you === 'b' || you === 'both';

    // Invitación mientras se espera rival
    const invite = $('.invite');
    if (g.status === 'waiting' && isOnline) {
      const link = `${location.origin}/game/${gameId}`;
      invite.classList.remove('hidden');
      if (!invite.dataset.ready) {
        invite.dataset.ready = '1';
        invite.innerHTML = `
          <div class="invite-title">${icon('link')} Invita a un amigo</div>
          <p>Comparte este enlace. La partida empieza cuando entre tu rival.</p>
          <div class="invite-row"><input readonly value="${esc(link)}"><button class="btn btn-gray btn-sm" data-copy>Copiar</button></div>
          <div class="invite-meta">${esc(g.tc.id === '0+0' ? 'Sin reloj' : g.tc.id.replace('+', ' | '))} · Juegas con ${you === 'w' ? 'blancas' : 'negras'}</div>`;
        invite.querySelector('[data-copy]').onclick = async (e) => {
          try {
            await navigator.clipboard.writeText(link);
          } catch {
            invite.querySelector('input').select();
            document.execCommand('copy');
          }
          e.target.textContent = '¡Copiado!';
          setTimeout(() => (e.target.textContent = 'Copiar'), 1500);
        };
      }
    } else invite.classList.add('hidden');

    // Oferta de tablas / revancha
    const offer = $('.offer-bar');
    let offerHtml = '';
    if (g.status === 'playing' && isOnline && g.drawOffer && isPlayer) {
      if (g.drawOffer === you) offerHtml = `<span>Ofreciste tablas</span>`;
      else
        offerHtml = `<span>${esc(playerName(g.drawOffer))} ofrece tablas</span>
          <button class="btn btn-green btn-sm" data-act="draw-accept">Aceptar</button>
          <button class="btn btn-gray btn-sm" data-act="draw-decline">Rechazar</button>`;
    }
    if (g.status === 'ended' && isOnline && isPlayer && g.result.reason !== 'aborted') {
      const opp = other(you);
      if (g.rematch[opp] && !g.rematch[you]) offerHtml = `<span>${esc(playerName(opp))} quiere la revancha</span><button class="btn btn-green btn-sm" data-act="rematch">Aceptar</button>`;
      else if (g.rematch[you]) offerHtml = `<span>Revancha solicitada…</span>`;
    }
    offer.innerHTML = offerHtml;
    offer.classList.toggle('hidden', !offerHtml);

    // Botones de acción
    const actions = $('.game-actions');
    let a = '';
    if (g.status === 'playing' && isPlayer) {
      if (g.moves.length < 2) a += `<button class="btn btn-gray" data-act="abort">${icon('x')} Abortar</button>`;
      else if (v.confirmResign) a += `<button class="btn btn-red" data-act="resign-confirm">${icon('flag')} ¿Abandonar?</button><button class="btn btn-gray" data-act="resign-cancel">No</button>`;
      else a += `<button class="btn btn-gray" data-act="resign">${icon('flag')} Abandonar</button>`;
      if (!v.confirmResign && g.moves.length >= 2)
        a += `<button class="btn btn-gray" data-act="draw-offer" ${g.drawOffer === you ? 'disabled' : ''}>½ Tablas</button>`;
    } else if (g.status === 'ended') {
      if (isPlayer && (!isOnline || g.result.reason !== 'aborted'))
        a += `<button class="btn btn-gray" data-act="rematch" ${isOnline && g.rematch[you] ? 'disabled' : ''}>${icon('repeat')} ${isOnline ? 'Revancha' : 'Otra vez'}</button>`;
      a += `<button class="btn btn-green" data-act="new">${icon('plus')} Nueva partida</button>`;
    } else if (g.status === 'waiting') {
      a += `<button class="btn btn-gray" data-act="leave">Cancelar</button>`;
    }
    if (!isPlayer && g.status !== 'waiting') a = `<div class="spectating">${icon('eye')} Estás mirando como espectador</div>` + (g.status === 'ended' ? `<button class="btn btn-green" data-act="new">${icon('plus')} Nueva partida</button>` : '');
    actions.innerHTML = a;

    $('.spectators').innerHTML = isOnline && g.spectators ? `${icon('eye')} ${g.spectators} espectador${g.spectators > 1 ? 'es' : ''}` : '';
  }

  function renderModal() {
    const g = v.game;
    const modal = $('.result-modal');
    if (g.status !== 'ended' || v.modalDismissed) {
      modal.classList.add('hidden');
      return;
    }
    const r = g.result;
    const you = v.you;
    let title;
    if (r.reason === 'aborted') title = 'Partida abortada';
    else if (!r.winner) title = 'Tablas';
    else if (you === 'w' || you === 'b') title = r.winner === you ? '¡Ganaste!' : 'Perdiste';
    else title = r.winner === 'w' ? 'Ganan las blancas' : 'Ganan las negras';
    const sub = r.reason === 'aborted' ? 'Nadie pierde puntos' : REASON_TEXT[r.reason] || '';
    const score = r.reason === 'aborted' ? '—' : r.winner === 'w' ? '1 - 0' : r.winner === 'b' ? '0 - 1' : '½ - ½';
    const isPlayer = you === 'w' || you === 'b' || you === 'both';
    const won = r.winner && r.winner === you;
    modal.innerHTML = `
      <div class="modal-card ${won ? 'won' : ''}">
        <button class="modal-close" data-act="close-modal">✕</button>
        <div class="modal-head">${won ? `<div class="trophy">${icon('trophy')}</div>` : ''}<h2>${title}</h2><p>${esc(sub)}</p></div>
        <div class="modal-players">
          <div class="mp ${r.winner === 'w' ? 'winner' : ''}">${avatarHtml(g.players.w?.name || '?', 'w', true)}<span>${esc(g.players.w?.name || '')}</span></div>
          <div class="mp-score">${score}</div>
          <div class="mp ${r.winner === 'b' ? 'winner' : ''}">${avatarHtml(g.players.b?.name || '?', 'b', true)}<span>${esc(g.players.b?.name || '')}</span></div>
        </div>
        <div class="modal-actions">
          ${isPlayer && (!isOnline || r.reason !== 'aborted') ? `<button class="btn btn-green btn-lg" data-act="rematch" ${isOnline && g.rematch[you] ? 'disabled' : ''}>${isOnline ? (g.rematch[you] ? 'Esperando…' : 'Revancha') : 'Jugar otra vez'}</button>` : ''}
          <button class="btn btn-gray btn-lg" data-act="new">Nueva partida</button>
        </div>
      </div>`;
    modal.classList.remove('hidden');
  }

  function updateTitle() {
    const g = v.game;
    const myTurn = g.status === 'playing' && isOnline && v.you === core.turn(g);
    document.title = (myTurn ? '● Tu turno · ' : '') + 'ChessORT';
  }

  // ---------- chat ----------
  function addChat(m, live) {
    const log = $('.chat-log');
    if (!log) return;
    const el = document.createElement('div');
    if (m.system) {
      el.className = 'chat-msg system';
      el.textContent = m.text;
    } else {
      el.className = 'chat-msg';
      el.innerHTML = `<b class="chat-name ${m.color ? 'c-' + m.color : 'c-spec'}">${esc(m.name)}:</b> ${esc(m.text)}`;
    }
    log.append(el);
    log.scrollTop = log.scrollHeight;
    if (live && v.tab !== 'chat' && !m.system) {
      v.unread++;
      const badge = root.querySelector('.tab .badge');
      badge.textContent = v.unread;
      badge.classList.remove('hidden');
      playSound('notify');
    }
  }

  const form = $('.chat-form');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      ctrl.send({ t: 'chat', text });
      input.value = '';
    };
  }

  // ---------- eventos de UI ----------
  root.querySelectorAll('.tab').forEach((t) => {
    t.onclick = () => {
      v.tab = t.dataset.tab;
      root.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
      root.querySelectorAll('.tab-pane').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== v.tab));
      if (v.tab === 'chat') {
        v.unread = 0;
        root.querySelector('.tab .badge')?.classList.add('hidden');
        const log = $('.chat-log');
        log.scrollTop = log.scrollHeight;
        $('.chat-form input').focus();
      }
    };
  });

  function goPly(p) {
    if (!v.game) return;
    const max = v.fens.length - 1;
    p = Math.max(0, Math.min(max, p));
    v.viewPly = p === max ? null : p;
    renderBoard(true);
    renderBars();
    renderMoves();
    const mv = v.verbose[p - 1];
    if (mv) playSound(soundForMove(mv));
  }

  function nav(action) {
    const cur = viewedPly();
    if (action === 'flip') {
      v.flipped = !v.flipped;
      renderAll(false);
    } else if (action === 'first') goPly(0);
    else if (action === 'prev') goPly(cur - 1);
    else if (action === 'next') goPly(cur + 1);
    else if (action === 'last') goPly(v.fens.length - 1);
  }

  root.addEventListener('click', (e) => {
    const n = e.target.closest('[data-nav]');
    if (n) return nav(n.dataset.nav);
    const mv = e.target.closest('.move[data-ply]');
    if (mv) return goPly(Number(mv.dataset.ply));
    const act = e.target.closest('[data-act]');
    if (!act || act.disabled) return;
    switch (act.dataset.act) {
      case 'resign':
        v.confirmResign = true;
        return renderPanel();
      case 'resign-cancel':
        v.confirmResign = false;
        return renderPanel();
      case 'resign-confirm':
        v.confirmResign = false;
        return ctrl.send({ t: 'resign' });
      case 'close-modal':
        v.modalDismissed = true;
        return renderModal();
      case 'new':
        return navigate('/');
      case 'leave':
        return navigate('/');
      default:
        ctrl.send({ t: act.dataset.act });
    }
  });

  function onKey(e) {
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowLeft') nav('prev');
    else if (e.key === 'ArrowRight') nav('next');
    else if (e.key === 'ArrowUp' || e.key === 'Home') nav('first');
    else if (e.key === 'ArrowDown' || e.key === 'End') nav('last');
    else if (e.key === 'f' || e.key === 'F') nav('flip');
    else return;
    e.preventDefault();
  }
  document.addEventListener('keydown', onKey);

  ctrl.start?.();

  return () => {
    clearInterval(clockTimer);
    document.removeEventListener('keydown', onKey);
    ctrl.close();
    document.title = 'ChessORT';
  };
}
