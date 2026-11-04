import { DurableObject } from 'cloudflare:workers';
import { Chess } from 'chess.js';
import { createCore, findTimeControl } from '../public/js/core.js';
import { cleanName, cleanPid } from './util.js';

const core = createCore(Chess);
const MAX_CHAT = 100;

// Una sala = un Durable Object. Guarda la partida, valida jugadas y reparte el estado por WebSocket.
// Usa la API de WebSockets con hibernación: el objeto puede dormirse sin cortar las conexiones.
export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.game = (await ctx.storage.get('game')) || null;
      this.chat = (await ctx.storage.get('chat')) || [];
      this.chess = this.game ? core.rebuild(this.game) : null;
    });
  }

  // ---- RPC desde el Worker ----
  async create({ id, tcId, color, pid, name }) {
    if (this.game) return { ok: false };
    const seat = color === 'w' || color === 'b' ? color : Math.random() < 0.5 ? 'w' : 'b';
    const players = { w: null, b: null };
    players[seat] = { pid, name };
    this.game = core.newState({ id, tc: findTimeControl(tcId), players });
    this.chess = new Chess();
    await this.save();
    return { ok: true };
  }

  async fetch() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ pid: null });
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---- WebSocket ----
  async webSocketMessage(ws, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.t === 'ping') return this.send(ws, { t: 'pong', now: Date.now() });
    if (!this.game) return this.send(ws, { t: 'notfound' });

    const g = this.game;
    const now = Date.now();
    const pid = msg.t === 'join' ? cleanPid(msg.pid) : ws.deserializeAttachment()?.pid;
    const color = pid ? this.seatOf(pid) : null;

    switch (msg.t) {
      case 'join': {
        if (!pid) return this.send(ws, { t: 'error', msg: 'Identificador inválido' });
        ws.serializeAttachment({ pid });
        const name = cleanName(msg.name);
        let seat = color;
        if (seat) {
          g.players[seat].name = name;
        } else if (g.status === 'waiting') {
          seat = g.players.w ? 'b' : 'w';
          g.players[seat] = { pid, name };
          g.status = 'playing';
          this.addSystemChat(`${name} se unió a la partida`);
        }
        this.send(ws, { t: 'chat-history', messages: this.chat });
        return this.commit();
      }
      case 'move': {
        if (!color) return;
        const r = core.applyMove(g, this.chess, color, msg, now);
        if (r.error && !r.ended) {
          this.send(ws, { t: 'error', msg: r.error });
          return this.sendState(ws);
        }
        return this.commit();
      }
      case 'flag':
        if (core.checkFlag(g, this.chess, now)) return this.commit();
        return this.sendState(ws);
      case 'resign':
        return color && this.result(ws, core.resign(g, color, now));
      case 'abort':
        return color && this.result(ws, core.abort(g, now));
      case 'draw-offer': {
        if (!color) return;
        const r = core.offerDraw(g, color);
        return this.result(ws, r.accept ? core.acceptDraw(g, color, now) : r);
      }
      case 'draw-accept':
        return color && this.result(ws, core.acceptDraw(g, color, now));
      case 'draw-decline':
        return color && this.result(ws, core.declineDraw(g, color));
      case 'rematch': {
        if (!color) return;
        const r = core.requestRematch(g, color);
        if (r.next) {
          this.game = r.next;
          this.chess = new Chess();
          this.addSystemChat('¡Revancha! Se invierten los colores.');
        }
        return this.result(ws, r);
      }
      case 'chat': {
        const text = String(msg.text ?? '').trim().slice(0, 300);
        if (!text || !pid) return;
        const name = color ? g.players[color].name : cleanName(msg.name);
        const entry = { name, color, text, ts: now };
        this.pushChat(entry);
        await this.ctx.storage.put('chat', this.chat);
        return this.broadcastRaw({ t: 'chat', msg: entry });
      }
    }
  }

  async webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye');
    } catch {}
    this.broadcastState(ws);
    await this.updateLobby(ws);
  }

  async webSocketError(ws) {
    this.broadcastState(ws);
  }

  // Se dispara cuando a alguien se le debería acabar el tiempo.
  async alarm() {
    if (this.game && core.checkFlag(this.game, this.chess, Date.now())) await this.commit();
    else await this.scheduleAlarm();
  }

  // ---- helpers ----
  seatOf(pid) {
    const p = this.game.players;
    if (p.w?.pid === pid) return 'w';
    if (p.b?.pid === pid) return 'b';
    return null;
  }

  async result(ws, r) {
    if (r?.error) return this.send(ws, { t: 'error', msg: r.error });
    return this.commit();
  }

  async commit() {
    await this.save();
    this.broadcastState();
    await this.scheduleAlarm();
    await this.updateLobby();
  }

  async save() {
    await this.ctx.storage.put('game', this.game);
  }

  async scheduleAlarm() {
    const g = this.game;
    if (g && core.ticking(g)) {
      const t = core.turn(g);
      await this.ctx.storage.setAlarm(Date.now() + Math.max(0, core.remaining(g, t, Date.now())) + 50);
    } else {
      await this.ctx.storage.deleteAlarm();
    }
  }

  addSystemChat(text) {
    this.pushChat({ system: true, text, ts: Date.now() });
    this.ctx.storage.put('chat', this.chat);
    this.broadcastRaw({ t: 'chat', msg: this.chat[this.chat.length - 1] });
  }

  pushChat(entry) {
    this.chat.push(entry);
    if (this.chat.length > MAX_CHAT) this.chat.splice(0, this.chat.length - MAX_CHAT);
  }

  sockets(exclude) {
    return this.ctx.getWebSockets().filter((s) => s !== exclude && s.readyState === WebSocket.OPEN);
  }

  presence(exclude) {
    const online = new Set();
    let spectators = 0;
    for (const s of this.sockets(exclude)) {
      const pid = s.deserializeAttachment()?.pid;
      if (!pid) continue;
      online.add(pid);
      if (!this.seatOf(pid)) spectators++;
    }
    return { online, spectators };
  }

  publicState(online, spectators) {
    const g = this.game;
    const pub = (p) => (p ? { name: p.name, online: online.has(p.pid) } : null);
    const { players, ...rest } = g;
    return { ...rest, players: { w: pub(players.w), b: pub(players.b) }, spectators };
  }

  stateFor(ws, online, spectators) {
    const pid = ws.deserializeAttachment()?.pid;
    return { t: 'state', game: this.publicState(online, spectators), you: pid ? this.seatOf(pid) : null, now: Date.now() };
  }

  sendState(ws) {
    const { online, spectators } = this.presence();
    this.send(ws, this.stateFor(ws, online, spectators));
  }

  broadcastState(exclude) {
    if (!this.game) return;
    const { online, spectators } = this.presence(exclude);
    for (const s of this.sockets(exclude)) this.send(s, this.stateFor(s, online, spectators));
  }

  broadcastRaw(obj) {
    const data = JSON.stringify(obj);
    for (const s of this.sockets()) {
      try {
        s.send(data);
      } catch {}
    }
  }

  send(ws, obj) {
    try {
      ws.send(JSON.stringify(obj));
    } catch {}
  }

  async updateLobby(exclude) {
    const g = this.game;
    if (!g) return;
    const { online } = this.presence(exclude);
    const seated = ['w', 'b'].filter((c) => g.players[c]);
    try {
      await this.env.LOBBY.get(this.env.LOBBY.idFromName('global')).upsert({
        id: g.id,
        tc: g.tc,
        status: g.status,
        white: g.players.w?.name ?? null,
        black: g.players.b?.name ?? null,
        moves: g.moves.length,
        hostOnline: seated.some((c) => online.has(g.players[c].pid)),
        online: seated.filter((c) => online.has(g.players[c].pid)).length,
      });
    } catch (e) {
      console.error('lobby update failed', e);
    }
  }
}
