import { Chess } from '/vendor/chess.js';
import { createCore, findTimeControl } from './core.js';
import { getPid, getName } from './settings.js';

const core = createCore(Chess);

class Emitter {
  constructor() {
    this.handlers = {};
  }
  on(evt, fn) {
    (this.handlers[evt] ||= []).push(fn);
  }
  emit(evt, data) {
    for (const fn of this.handlers[evt] || []) fn(data);
  }
}

// Conexión con la sala en el servidor (Vercel no tiene WebSockets: consultamos el estado
// cada ~1 segundo y mandamos las acciones por POST).
export class OnlineController extends Emitter {
  constructor(gameId) {
    super();
    this.gameId = gameId;
    this.online = true;
    this.closed = false;
    this.base = `/api/game/${gameId}`;
    this.lastChatId = null;
    this.lastNow = 0;
    this.lastPing = 0;
    this.presence = null;
    this.failures = 0;
    this.connected = true;
    this.onVisible = () => {
      if (!document.hidden) this.schedule(0);
    };
    document.addEventListener('visibilitychange', this.onVisible);
    this.post({ t: 'join' }).then(() => this.schedule(this.interval()));
  }

  // Cada cuánto preguntar: rápido cuando mueve el rival, más lento si la pestaña está oculta.
  interval() {
    if (document.hidden) return 5000;
    const g = this.game;
    if (!g) return 1000;
    if (g.status === 'playing') {
      const turn = g.moves.length % 2 === 0 ? 'w' : 'b';
      return this.you === turn ? 2000 : 700;
    }
    return g.status === 'waiting' ? 1500 : 2500;
  }

  schedule(ms) {
    clearTimeout(this.timer);
    if (!this.closed) this.timer = setTimeout(() => this.poll(), ms);
  }

  setConnected(ok) {
    if (ok === this.connected) return;
    this.connected = ok;
    this.emit('connection', ok);
  }

  async poll() {
    if (this.closed) return;
    const ping = Date.now() - this.lastPing > 8000;
    try {
      const res = await fetch(`${this.base}?pid=${encodeURIComponent(getPid())}${ping ? '&ping=1' : ''}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) return this.notFound();
      if (data.t === 'state') {
        if (ping) this.lastPing = Date.now();
        if (!this.pending) this.handle(data);
      } else if (data.error) this.emit('error', data.error);
      this.failures = 0;
      this.setConnected(true);
    } catch {
      if (++this.failures >= 2) this.setConnected(false);
    }
    this.schedule(this.interval());
  }

  async post(msg) {
    this.pending = (this.pending || 0) + 1;
    try {
      const res = await fetch(this.base, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...msg, pid: getPid(), name: getName() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) return this.notFound();
      if (data.error) this.emit('error', data.error);
      if (data.t === 'state') this.handle(data);
      this.setConnected(true);
    } catch {
      this.setConnected(false);
      this.emit('error', 'Sin conexión con el servidor');
    } finally {
      this.pending--;
    }
  }

  handle(data) {
    // Ignora respuestas viejas que llegan tarde (por ejemplo, una consulta anterior a tu jugada).
    if (data.now < this.lastNow) return;
    this.lastNow = data.now;
    const g = data.game;
    // La presencia (quién está conectado) no viene en todas las respuestas: se completa con la última.
    if (g.spectators === null) {
      g.spectators = this.presence?.spectators ?? 0;
      for (const c of ['w', 'b']) if (g.players[c] && g.players[c].online === null) g.players[c].online = this.presence?.[c] ?? true;
    } else {
      this.presence = { spectators: g.spectators, w: g.players.w?.online, b: g.players.b?.online };
    }
    const chat = data.chat || [];
    if (this.lastChatId === null) this.emit('chat-history', chat);
    else for (const m of chat) if (m.id > this.lastChatId) this.emit('chat', m);
    if (chat.length) this.lastChatId = chat[chat.length - 1].id;
    else this.lastChatId ??= 0;
    this.game = g;
    this.you = data.you;
    this.emit('state', data);
  }

  notFound() {
    this.emit('notfound');
    this.close();
  }

  send(msg) {
    this.post(msg).then(() => this.schedule(this.interval()));
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    document.removeEventListener('visibilitychange', this.onVisible);
  }
}

// Partida en el mismo dispositivo: usa la misma lógica que el servidor, pero en el navegador.
export class LocalController extends Emitter {
  constructor(tcId) {
    super();
    this.online = false;
    this.tc = findTimeControl(tcId);
    this.reset();
  }

  reset() {
    this.game = core.newState({
      id: 'local',
      tc: this.tc,
      players: { w: { name: 'Blancas' }, b: { name: 'Negras' } },
    });
    this.chess = new Chess();
  }

  start() {
    this.publish();
  }

  publish() {
    const g = this.game;
    const players = {
      w: { name: g.players.w.name, online: true },
      b: { name: g.players.b.name, online: true },
    };
    // structuredClone para que la vista no comparta referencias con el estado interno
    this.emit('state', { t: 'state', game: structuredClone({ ...g, players, spectators: 0 }), you: 'both', now: Date.now() });
  }

  send(msg) {
    const g = this.game;
    const now = Date.now();
    const side = core.turn(g);
    let r = null;
    switch (msg.t) {
      case 'move':
        r = core.applyMove(g, this.chess, side, msg, now);
        break;
      case 'flag':
        core.checkFlag(g, this.chess, now);
        break;
      case 'resign':
        r = core.resign(g, side, now);
        break;
      case 'abort':
        r = core.abort(g, now);
        break;
      case 'draw-offer':
        if (g.status === 'playing') core.end(g, null, 'agreement', now);
        break;
      case 'rematch':
        this.reset();
        break;
      default:
        return;
    }
    if (r?.error && !r.ended) this.emit('error', r.error);
    this.publish();
  }

  close() {}
}
