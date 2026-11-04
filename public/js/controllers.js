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

// Conexión WebSocket con la sala en el servidor (con reconexión automática).
export class OnlineController extends Emitter {
  constructor(gameId) {
    super();
    this.gameId = gameId;
    this.online = true;
    this.closed = false;
    this.retry = 0;
    this.connect();
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/api/games/${this.gameId}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.emit('connection', true);
      ws.send(JSON.stringify({ t: 'join', pid: getPid(), name: getName() }));
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.send({ t: 'ping' }), 25000);
    };
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.t === 'state') this.emit('state', msg);
      else if (msg.t === 'chat') this.emit('chat', msg.msg);
      else if (msg.t === 'chat-history') this.emit('chat-history', msg.messages);
      else if (msg.t === 'error') this.emit('error', msg.msg);
      else if (msg.t === 'notfound') {
        this.emit('notfound');
        this.close();
      }
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      if (this.closed) return;
      this.emit('connection', false);
      const delay = Math.min(8000, 500 * 2 ** this.retry++);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
  }

  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ ...msg, name: getName() }));
  }

  close() {
    this.closed = true;
    clearInterval(this.pingTimer);
    clearTimeout(this.reconnectTimer);
    this.ws?.close();
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
