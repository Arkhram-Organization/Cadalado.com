import { DurableObject } from 'cloudflare:workers';
import { MODES, newGame, act, nextHand, rematch, viewFor, waitingFor, team, closeShow } from '../public/truco/js/engine.js';
import { botAction, botSena, botClaims } from '../public/truco/js/bot.js';
import { cleanName, cleanPid } from './util.js';

export const SENAS = [
  'ancho_espada', 'ancho_basto', 'siete_espada', 'siete_oro', 'tres', 'dos', 'ancho_falso',
  'ciego', 'envido_alto', 'treinta', 'nada_envido',
];
const BOT_NAMES = ['Tito', 'Coca', 'El Ruso', 'Chacho', 'Pocha', 'Beto', 'Nené', 'Cacho', 'Mirta', 'Pirulo', 'Tota', 'Rulo'];
const MAX_CHAT = 120;
const HAND_PAUSE = 5200; // ms para ver cómo terminó la mano
const AFK_MS = 40_000; // si un humano desconectado tiene que jugar, juega el bot por él
const SHOW_MS = 15_000; // tiempo para mostrar los tantos o reclamar; después valen igual
// mezclar + cortar + repartir de a una (lo mismo que anima el cliente)
const dealMs = (n) => 1900 + n * 3 * 170 + 300;

const rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;

// Una sala de truco = un Durable Object. Guarda la sala, valida jugadas y reparte el estado por WebSocket.
export class TrucoRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.gaze = {}; // asiento -> a quién mira (asiento, 'table' o null). Vive en memoria.
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get('room')) || null;
      this.chat = (await ctx.storage.get('chat')) || [];
    });
  }

  // ---- RPC desde el Worker ----
  async create({ code, mode, target, ayudas, isPublic, pid, name }) {
    if (this.room) return { ok: false };
    const n = MODES[mode] ? MODES[mode] : 2;
    this.room = {
      code,
      cfg: { mode: MODES[mode] ? mode : '1v1', target: target === 15 ? 15 : 30, ayudas: !!ayudas, isPublic: !!isPublic },
      seats: Array(n).fill(null),
      host: pid,
      status: 'lobby',
      game: null,
      handEndedAt: 0,
      afkSince: {},
      createdAt: Date.now(),
    };
    this.room.seats[0] = { pid, name: cleanName(name) };
    await this.save();
    await this.updateLobby();
    return { ok: true };
  }

  async info() {
    if (!this.room) return { exists: false };
    const r = this.room;
    return { exists: true, mode: r.cfg.mode, status: r.status, free: r.seats.filter((s) => !s).length, isPublic: r.cfg.isPublic };
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
    if (!this.room) return this.send(ws, { t: 'notfound' });

    const r = this.room;
    const pid = msg.t === 'join' ? cleanPid(msg.pid) : ws.deserializeAttachment()?.pid;
    const seat = pid ? this.seatOf(pid) : null;
    const isHost = pid && pid === r.host;

    switch (msg.t) {
      case 'join': {
        if (!pid) return this.send(ws, { t: 'error', msg: 'Identificador inválido' });
        ws.serializeAttachment({ pid, name: cleanName(msg.name) });
        const name = cleanName(msg.name);
        if (seat != null) {
          r.seats[seat].name = name;
          delete r.afkSince[seat];
        } else if (r.status === 'lobby' && !msg.spectate) {
          const free = this.freeSeat();
          if (free != null) {
            r.seats[free] = { pid, name };
            this.addSystemChat(`${name} se sentó a la mesa`);
          }
        }
        if (!r.host || !this.isHumanSeated(r.host)) r.host = this.seatOf(pid) != null ? pid : r.host;
        this.send(ws, { t: 'chat-history', messages: this.chat });
        this.send(ws, { t: 'gaze-all', gaze: this.gaze });
        return this.commit();
      }

      case 'sit': {
        if (r.status !== 'lobby' || !pid) return;
        const to = msg.seat;
        if (!Number.isInteger(to) || to < 0 || to >= r.seats.length || r.seats[to]) return;
        const me = seat != null ? r.seats[seat] : { pid, name: ws.deserializeAttachment()?.name || 'Invitado' };
        if (seat != null) r.seats[seat] = null;
        r.seats[to] = me;
        return this.commit();
      }

      case 'stand': {
        if (r.status !== 'lobby' || seat == null) return;
        r.seats[seat] = null;
        return this.commit();
      }

      case 'addbot': {
        if (!isHost || r.status !== 'lobby') return;
        const to = Number.isInteger(msg.seat) && !r.seats[msg.seat] ? msg.seat : this.freeSeat();
        if (to == null || to >= r.seats.length) return;
        r.seats[to] = { bot: true, name: this.botName() };
        return this.commit();
      }

      case 'removebot': {
        if (!isHost || r.status !== 'lobby') return;
        if (r.seats[msg.seat]?.bot) r.seats[msg.seat] = null;
        return this.commit();
      }

      case 'kick': {
        if (!isHost || r.status !== 'lobby') return;
        const s = r.seats[msg.seat];
        if (s && !s.bot && s.pid !== r.host) r.seats[msg.seat] = null;
        return this.commit();
      }

      case 'config': {
        if (!isHost || r.status !== 'lobby') return;
        const c = msg.cfg || {};
        if ([15, 30].includes(c.target)) r.cfg.target = c.target;
        if (typeof c.ayudas === 'boolean') r.cfg.ayudas = c.ayudas;
        if (typeof c.isPublic === 'boolean') r.cfg.isPublic = c.isPublic;
        if (MODES[c.mode] && c.mode !== r.cfg.mode) {
          const people = r.seats.filter((s) => s && !s.bot);
          r.cfg.mode = c.mode;
          r.seats = Array(MODES[c.mode]).fill(null);
          people.slice(0, r.seats.length).forEach((p, i) => (r.seats[i] = p));
        }
        return this.commit();
      }

      case 'start': {
        if (!isHost || r.status !== 'lobby') return;
        if (msg.fillBots) r.seats = r.seats.map((s) => s || { bot: true, name: this.botName() });
        if (r.seats.some((s) => !s)) return this.send(ws, { t: 'error', msg: 'Faltan jugadores (o llená con bots)' });
        r.status = 'playing';
        r.game = newGame({ mode: r.cfg.mode, target: r.cfg.target, ayudas: r.cfg.ayudas, dealer: Math.floor(rng() * r.seats.length) }, rng);
        this.addSystemChat('¡Arranca la partida! Reparte ' + r.seats[r.game.dealer].name);
        this.afterDeal();
        return this.commit();
      }

      case 'act': {
        if (r.status !== 'playing' || seat == null) return;
        if (Date.now() < (r.dealUntil || 0)) return this.send(ws, { t: 'error', msg: 'Esperá que terminen de repartir' });
        const res = act(r.game, seat, msg.a, rng);
        if (res.error) {
          this.send(ws, { t: 'error', msg: res.error });
          return this.sendState(ws);
        }
        this.onGameChange();
        return this.commit();
      }

      case 'look': {
        if (seat == null) return;
        const tgt = msg.target === 'table' ? 'table' : Number.isInteger(msg.target) && msg.target >= 0 && msg.target < r.seats.length ? msg.target : null;
        if (this.gaze[seat] === tgt) return;
        this.gaze[seat] = tgt;
        return this.broadcastRaw({ t: 'gaze', seat, target: tgt }, ws);
      }

      case 'sena': {
        if (seat == null || !SENAS.includes(msg.sena) || r.status !== 'playing') return;
        this.deliverSena(seat, msg.sena);
        return;
      }

      case 'chat': {
        const text = String(msg.text ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 280);
        if (!text || !pid) return;
        const name = seat != null ? r.seats[seat].name : ws.deserializeAttachment()?.name || 'Espectador';
        const entry = { name, seat, text, ts: Date.now() };
        this.pushChat(entry);
        await this.ctx.storage.put('chat', this.chat);
        return this.broadcastRaw({ t: 'chat', msg: entry });
      }

      case 'rematch': {
        if (seat == null || r.status !== 'ended') return;
        rematch(r.game, rng);
        r.status = 'playing';
        this.addSystemChat('¡Revancha!');
        this.afterDeal();
        return this.commit();
      }

      case 'to-lobby': {
        if (!isHost || r.status !== 'ended') return;
        r.status = 'lobby';
        r.game = null;
        return this.commit();
      }
    }
  }

  async webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye');
    } catch {}
    const pid = ws.deserializeAttachment()?.pid;
    const seat = pid ? this.seatOf(pid) : null;
    if (seat != null && this.room?.status === 'lobby' && !this.online(ws).has(pid)) {
      // en la sala de espera, si se va libera el asiento
      this.room.seats[seat] = null;
      if (this.room.host === pid) this.room.host = this.room.seats.find((s) => s && !s.bot)?.pid || null;
      await this.save();
    }
    if (seat != null && this.room?.status === 'playing') this.room.afkSince[seat] = Date.now();
    this.broadcastState(ws);
    await this.scheduleAlarm();
    await this.updateLobby(ws);
  }

  async webSocketError(ws) {
    this.broadcastState(ws);
  }

  // Bots, AFK, pausa entre manos y miradas de los bots.
  async alarm() {
    const r = this.room;
    if (!r || r.status !== 'playing') return;
    const g = r.game;
    const now = Date.now();
    let changed = false;

    if (g.h.phase === 'ended' && g.status === 'playing' && now - r.handEndedAt >= HAND_PAUSE) {
      nextHand(g, rng);
      this.afterDeal();
      changed = true;
    } else if (g.h.phase === 'show') {
      // el que ganó el envido muestra (si es bot); los bots rivales reclaman si no muestra; al rato vale igual
      const sh = g.h.show;
      const since = r.showSince || now;
      const winnerBot = r.seats[sh.seat]?.bot || this.isAway(sh.seat, now);
      if (winnerBot && now - since > 1200 && !g.h.mazo[sh.seat]) {
        changed = act(g, sh.seat, { t: 'mostrar' }, rng).ok;
      } else if (r.botClaimAt && now >= r.botClaimAt) {
        changed = act(g, r.botClaimer, { t: 'reclamar' }, rng).ok;
      } else if (now - since >= SHOW_MS) {
        changed = closeShow(g);
      }
      if (changed) this.onGameChange();
    } else if (g.h.phase === 'play' && now >= (r.dealUntil || 0)) {
      const actor = this.autoActor();
      if (actor != null) {
        const a = botAction(g, actor, rng);
        if (a && act(g, actor, a, rng).ok) {
          this.onGameChange();
          changed = true;
        }
      }
    }
    this.botGlances(now);
    this.botSenas(now);
    if (changed) await this.commit();
    else await this.scheduleAlarm();
  }

  // ---- lógica de sala ----
  afterDeal() {
    const r = this.room;
    r.handEndedAt = 0;
    r.showSince = 0;
    r.botClaimAt = 0;
    r.dealUntil = Date.now() + dealMs(r.game.n);
    r.botSenaDue = {};
    if (r.game.n > 2) {
      r.seats.forEach((s, i) => {
        if (s?.bot) r.botSenaDue[i] = r.dealUntil + 400 + Math.floor(rng() * 2500);
      });
    }
  }

  isAway(seat, now = Date.now()) {
    const r = this.room;
    const p = r.seats[seat];
    if (!p || p.bot) return !!p;
    if (this.online().has(p.pid)) return false;
    return now - (r.afkSince[seat] || now) >= AFK_MS;
  }

  onGameChange() {
    const r = this.room;
    if (r.game.status === 'ended') {
      r.status = 'ended';
      const t = r.game.winner;
      const names = r.seats.filter((_, i) => team(i) === t).map((s) => s.name).join(' y ');
      this.addSystemChat(`Ganaron ${names} (${r.game.score[t]} a ${r.game.score[1 - t]})`);
    } else if (r.game.h.phase === 'ended' && !r.handEndedAt) {
      r.handEndedAt = Date.now();
    } else if (r.game.h.phase === 'show' && !r.showSince) {
      r.showSince = Date.now();
      // si el que tiene que mostrar es humano, algún bot rival puede reclamarle
      const sh = r.game.h.show;
      const claimers = r.seats.map((s, i) => (s?.bot && team(i) !== team(sh.seat) ? i : null)).filter((i) => i != null);
      r.botClaimAt = 0;
      if (!r.seats[sh.seat]?.bot && claimers.length && botClaims(r.game, claimers[0], rng)) {
        r.botClaimer = claimers[0];
        r.botClaimAt = r.showSince + 6000 + Math.floor(rng() * 4000);
      }
    }
  }

  // Asiento al que le toca y que debe jugar el servidor (bot o humano ausente).
  autoActor() {
    const r = this.room;
    const w = waitingFor(r.game);
    if (!w.seats.length) return null;
    const online = this.online();
    const now = Date.now();
    const isAway = (s) => {
      const p = r.seats[s];
      if (p.bot) return true;
      if (online.has(p.pid)) return false;
      return now - (r.afkSince[s] || now) >= AFK_MS;
    };
    // Si en el equipo que responde hay un humano conectado, esperamos a que decida él.
    if (w.seats.some((s) => !isAway(s))) return null;
    return w.seats.find((s) => r.seats[s].bot) ?? w.seats[0];
  }

  botGlances(now) {
    const r = this.room;
    r.seats.forEach((s, i) => {
      if (!s?.bot) return;
      if (rng() < 0.3) {
        // la mayor parte del tiempo miran la mesa; a veces a un compañero o a un rival
        const others = r.seats.map((_, j) => j).filter((j) => j !== i);
        const partners = others.filter((j) => team(j) === team(i));
        const roll = rng();
        let tgt = 'table';
        if (roll > 0.55 && partners.length && roll < 0.75) tgt = partners[Math.floor(rng() * partners.length)];
        else if (roll >= 0.75) tgt = others[Math.floor(rng() * others.length)];
        this.gaze[i] = tgt;
        this.broadcastRaw({ t: 'gaze', seat: i, target: tgt });
      }
    });
  }

  botSenas(now) {
    const r = this.room;
    const due = r.botSenaDue || {};
    for (const [k, at] of Object.entries(due)) {
      if (now < at) continue;
      const seat = Number(k);
      delete due[k];
      if (r.game.h.phase !== 'play' || r.game.h.mazo[seat]) continue;
      // el bot mira a un compañero antes de hacer la seña
      const partners = r.seats.map((_, j) => j).filter((j) => j !== seat && team(j) === team(seat));
      const p = partners[Math.floor(rng() * partners.length)];
      this.gaze[seat] = p;
      this.broadcastRaw({ t: 'gaze', seat, target: p });
      this.deliverSena(seat, botSena(r.game, seat));
    }
  }

  // La seña solo la ven los que en ese momento están mirando al que la hace.
  deliverSena(seat, sena) {
    const watchers = new Set(Object.entries(this.gaze).filter(([s, t]) => t === seat && Number(s) !== seat).map(([s]) => Number(s)));
    for (const s of this.sockets()) {
      const pid = s.deserializeAttachment()?.pid;
      const viewer = pid ? this.seatOf(pid) : null;
      if (viewer === seat) this.send(s, { t: 'sena', seat, sena, self: true, seenBy: [...watchers] });
      else if (viewer != null && watchers.has(viewer)) this.send(s, { t: 'sena', seat, sena });
    }
  }

  seatOf(pid) {
    const i = this.room.seats.findIndex((s) => s && !s.bot && s.pid === pid);
    return i < 0 ? null : i;
  }

  isHumanSeated(pid) {
    return this.seatOf(pid) != null;
  }

  freeSeat() {
    const seats = this.room.seats;
    // balancea equipos: primero el equipo con menos gente
    const count = [0, 1].map((t) => seats.filter((s, i) => s && team(i) === t).length);
    const prefer = count[0] <= count[1] ? 0 : 1;
    const free = seats.map((s, i) => (s ? null : i)).filter((i) => i != null);
    return free.find((i) => team(i) === prefer) ?? free[0] ?? null;
  }

  botName() {
    const used = new Set(this.room.seats.filter(Boolean).map((s) => s.name));
    const names = BOT_NAMES.filter((n) => !used.has(n));
    return names[Math.floor(rng() * names.length)] || 'Bot';
  }

  async commit() {
    await this.save();
    this.broadcastState();
    await this.scheduleAlarm();
    await this.updateLobby();
  }

  async save() {
    await this.ctx.storage.put('room', this.room);
  }

  async scheduleAlarm() {
    const r = this.room;
    if (!r || r.status !== 'playing') return this.ctx.storage.deleteAlarm();
    if (!this.online().size) return this.ctx.storage.deleteAlarm(); // nadie mirando: se duerme
    const now = Date.now();
    let at = now + 2500; // latido para miradas de los bots
    const g = r.game;
    if (g.h.phase === 'ended') at = Math.min(at, r.handEndedAt + HAND_PAUSE);
    else if (g.h.phase === 'show') {
      const since = r.showSince || now;
      at = Math.min(at, since + SHOW_MS, since + 1300);
      if (r.botClaimAt) at = Math.min(at, r.botClaimAt);
    } else if (now < (r.dealUntil || 0)) at = Math.min(at, r.dealUntil + 50);
    else if (this.autoActor() != null) at = Math.min(at, now + 900 + Math.floor(rng() * 900));
    else {
      const w = waitingFor(g);
      for (const s of w.seats) if (r.afkSince[s]) at = Math.min(at, Math.max(now + 200, r.afkSince[s] + AFK_MS));
    }
    for (const t of Object.values(r.botSenaDue || {})) at = Math.min(at, Math.max(now + 100, t));
    await this.ctx.storage.setAlarm(Math.max(now + 100, at));
  }

  addSystemChat(text) {
    const entry = { system: true, text, ts: Date.now() };
    this.pushChat(entry);
    this.ctx.storage.put('chat', this.chat);
    this.broadcastRaw({ t: 'chat', msg: entry });
  }

  pushChat(entry) {
    this.chat.push(entry);
    if (this.chat.length > MAX_CHAT) this.chat.splice(0, this.chat.length - MAX_CHAT);
  }

  sockets(exclude) {
    return this.ctx.getWebSockets().filter((s) => s !== exclude && s.readyState === WebSocket.OPEN);
  }

  online(exclude) {
    const set = new Set();
    for (const s of this.sockets(exclude)) {
      const pid = s.deserializeAttachment()?.pid;
      if (pid) set.add(pid);
    }
    return set;
  }

  publicRoom(online) {
    const r = this.room;
    let spectators = 0;
    for (const pid of online) if (this.seatOf(pid) == null) spectators++;
    return {
      code: r.code,
      cfg: r.cfg,
      status: r.status,
      seats: r.seats.map((s) => (s ? { name: s.name, bot: !!s.bot, online: s.bot || online.has(s.pid), host: !s.bot && s.pid === r.host } : null)),
      spectators,
    };
  }

  stateFor(ws, online) {
    const pid = ws.deserializeAttachment()?.pid;
    const seat = pid ? this.seatOf(pid) : null;
    const r = this.room;
    return {
      t: 'state',
      room: this.publicRoom(online),
      you: seat,
      isHost: !!pid && pid === r.host,
      game: r.game ? viewFor(r.game, seat) : null,
      now: Date.now(),
    };
  }

  sendState(ws) {
    this.send(ws, this.stateFor(ws, this.online()));
  }

  broadcastState(exclude) {
    if (!this.room) return;
    const online = this.online(exclude);
    for (const s of this.sockets(exclude)) this.send(s, this.stateFor(s, online));
  }

  broadcastRaw(obj, exclude) {
    const data = JSON.stringify(obj);
    for (const s of this.sockets(exclude)) {
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
    const r = this.room;
    if (!r) return;
    const online = this.online(exclude);
    const humans = r.seats.filter((s) => s && !s.bot);
    try {
      await this.env.LOBBY.get(this.env.LOBBY.idFromName('global')).upsertTruco({
        code: r.code,
        mode: r.cfg.mode,
        target: r.cfg.target,
        isPublic: r.cfg.isPublic,
        status: r.status,
        players: r.seats.map((s) => s?.name ?? null),
        free: r.seats.filter((s) => !s).length,
        online: humans.filter((s) => online.has(s.pid)).length,
        score: r.game?.score ?? null,
      });
    } catch (e) {
      console.error('truco lobby update failed', e);
    }
  }
}
