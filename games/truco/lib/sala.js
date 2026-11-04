// Salas de truco guardadas en Redis (versión para Vercel de src/truco-room.js).
// Misma lógica que la sala original: asientos, bots, AFK, señas, miradas y pausas entre manos.
// Diferencias por no tener WebSockets ni alarmas:
//  - Los navegadores consultan la sala cada ~1 s (ver public/js/polling-socket.js).
//  - Lo que antes hacía la alarma (bots, pausas, tiempos) lo hace `tick`, que corre en esas consultas.
//  - Los avisos sueltos (chat, miradas, señas) quedan en una lista de eventos con número; cada
//    navegador pide "lo nuevo desde el evento N".
import { MODES, newGame, act, nextHand, rematch, viewFor, waitingFor, team, closeShow } from '../public/js/engine.js';
import { botAction, botSena, botClaims } from '../public/js/bot.js';
import { getStore } from '../../../shared/store.js';
import { registrarPartida } from '../../../shared/cuenta.js';

export const SENAS = [
  'ancho_espada', 'ancho_basto', 'siete_espada', 'siete_oro', 'tres', 'dos', 'ancho_falso',
  'ciego', 'envido_alto', 'treinta', 'nada_envido',
];
const BOT_NAMES = ['Tito', 'Coca', 'El Ruso', 'Chacho', 'Pocha', 'Beto', 'Nené', 'Cacho', 'Mirta', 'Pirulo', 'Tota', 'Rulo'];
const MAX_CHAT = 120;
const MAX_EV = 150;
const HAND_PAUSE = 5200; // ms para ver cómo terminó la mano
const AFK_MS = 40_000; // si un humano desconectado tiene que jugar, juega el bot por él
const SHOW_MS = 15_000; // tiempo para mostrar los tantos o reclamar; después valen igual
const ONLINE_MS = 15_000; // consultó hace menos de esto = conectado
const LOBBY_LEAVE_MS = 25_000; // en la sala de espera, si no aparece en este tiempo se libera el asiento
const ROOM_TTL = 3 * 24 * 3600;
const dealMs = (n) => 1900 + n * 3 * 170 + 300;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const roomKey = (code) => `truco:${code}`;
const lockKey = (code) => `lock:truco:${code}`;
const presKey = (code) => `pres:truco:${code}`;
const LOBBY = 'lobby:truco';

export function cleanName(name) {
  const s = String(name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
  return s || 'Invitado';
}
export const cleanPid = (pid) => (/^[A-Za-z0-9_-]{8,64}$/.test(String(pid ?? '')) ? String(pid) : null);
export const cleanCode = (c) => (/^[A-Z0-9]{5}$/.test(String(c ?? '').toUpperCase()) ? String(c).toUpperCase() : null);
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

// ---------------------------------------------------------------- guardar / leer
export async function cargar(code) {
  const raw = await getStore().get(roomKey(code));
  return raw ? JSON.parse(raw) : null;
}

async function guardar(r) {
  r.rev = (r.rev || 0) + 1;
  await getStore().set(roomKey(r.code), JSON.stringify(r), ROOM_TTL);
}

export async function crearSala({ mode, target, ayudas, isPublic, pid, name, uid }) {
  const n = MODES[mode] ? MODES[mode] : 2;
  for (let i = 0; i < 8; i++) {
    const code = newCode();
    const r = {
      code,
      cfg: { mode: MODES[mode] ? mode : '1v1', target: target === 15 ? 15 : 30, ayudas: !!ayudas, isPublic: !!isPublic, trucoDesdeSegunda: true },
      seats: Array(n).fill(null),
      host: pid,
      status: 'lobby',
      game: null,
      handEndedAt: 0,
      gaze: {},
      chat: [],
      ev: [],
      evSeq: 0,
      createdAt: Date.now(),
      rev: 1,
    };
    r.seats[0] = { pid, name: cleanName(name), uid: uid || undefined };
    // setNX: el código no puede pisar una sala existente
    if (await getStore().setNX(roomKey(code), JSON.stringify(r), ROOM_TTL * 1000)) {
      await tocarPresencia(code, pid);
      await actualizarLobby(r, { [pid]: Date.now() });
      return code;
    }
  }
  throw new Error('No se pudo crear la sala');
}

// Lee, modifica y guarda con un candado por sala. fn(r, ctx) puede devolver { error }.
export async function mutar(code, fn) {
  const store = getStore();
  const token = crypto.randomUUID();
  let locked = false;
  for (let i = 0; i < 60 && !locked; i++) {
    locked = await store.setNX(lockKey(code), token, 4000);
    if (!locked) await sleep(30 + Math.random() * 40);
  }
  if (!locked) return { error: 'La sala está ocupada, probá de nuevo' };
  try {
    const r = await cargar(code);
    if (!r) return { notfound: true };
    const pres = await presencia(code);
    const antes = JSON.stringify(r);
    const estadoAntes = r.status;
    const res = fn(r, { now: Date.now(), pres }) || {};
    if (JSON.stringify(r) !== antes) {
      await guardar(r);
      await actualizarLobby(r, pres);
      if (r.status === 'ended' && estadoAntes !== 'ended') await guardarHistorial(r);
    }
    return { ...res, r, pres };
  } finally {
    if ((await store.get(lockKey(code))) === token) await store.del(lockKey(code));
  }
}

// ---------------------------------------------------------------- presencia
export async function tocarPresencia(code, pid) {
  await getStore().hset(presKey(code), pid, String(Date.now()), 3600);
}

export async function presencia(code) {
  const all = await getStore().hgetall(presKey(code));
  const out = {};
  for (const [pid, ts] of Object.entries(all)) out[pid] = Number(ts);
  return out;
}

const onlineSet = (pres, now = Date.now()) => new Set(Object.entries(pres).filter(([, ts]) => now - ts < ONLINE_MS).map(([p]) => p));

// ---------------------------------------------------------------- ayudas de sala
export function seatOf(r, pid) {
  const i = r.seats.findIndex((s) => s && !s.bot && s.pid === pid);
  return i < 0 ? null : i;
}

function freeSeat(r) {
  const seats = r.seats;
  const count = [0, 1].map((t) => seats.filter((s, i) => s && team(i) === t).length);
  const prefer = count[0] <= count[1] ? 0 : 1;
  const free = seats.map((s, i) => (s ? null : i)).filter((i) => i != null);
  return free.find((i) => team(i) === prefer) ?? free[0] ?? null;
}

function botName(r) {
  const used = new Set(r.seats.filter(Boolean).map((s) => s.name));
  const names = BOT_NAMES.filter((n) => !used.has(n));
  return names[Math.floor(rng() * names.length)] || 'Bot';
}

function evento(r, e) {
  r.evSeq = (r.evSeq || 0) + 1;
  r.ev.push({ ...e, id: r.evSeq });
  if (r.ev.length > MAX_EV) r.ev.splice(0, r.ev.length - MAX_EV);
}

function pushChat(r, entry) {
  r.chat.push(entry);
  if (r.chat.length > MAX_CHAT) r.chat.splice(0, r.chat.length - MAX_CHAT);
  evento(r, { k: 'chat', msg: entry });
}

const systemChat = (r, text) => pushChat(r, { system: true, text, ts: Date.now() });

function setGaze(r, seat, target, from = null) {
  r.gaze[seat] = target;
  evento(r, { k: 'gaze', seat, target, from });
}

function isAway(r, seat, now, pres) {
  const p = r.seats[seat];
  if (!p || p.bot) return !!p;
  const seen = pres[p.pid];
  if (seen && now - seen < ONLINE_MS) return false;
  return now - (seen || now) >= AFK_MS;
}

function afterDeal(r) {
  r.handEndedAt = 0;
  r.showSince = 0;
  r.botClaimAt = 0;
  r.botAt = 0;
  r.dealUntil = Date.now() + dealMs(r.game.n);
  r.botSenaDue = {};
  if (r.game.n > 2) {
    r.seats.forEach((s, i) => {
      if (s?.bot) r.botSenaDue[i] = r.dealUntil + 400 + Math.floor(rng() * 2500);
    });
  }
}

function onGameChange(r) {
  if (r.game.status === 'ended') {
    r.status = 'ended';
    const t = r.game.winner;
    const names = r.seats.filter((_, i) => team(i) === t).map((s) => s.name).join(' y ');
    systemChat(r, `Ganaron ${names} (${r.game.score[t]} a ${r.game.score[1 - t]})`);
  } else if (r.game.h.phase === 'ended' && !r.handEndedAt) {
    r.handEndedAt = Date.now();
  } else if (r.game.h.phase === 'show' && !r.showSince) {
    r.showSince = Date.now();
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
function autoActor(r, now, pres) {
  const w = waitingFor(r.game);
  if (!w.seats.length) return null;
  if (w.seats.some((s) => !isAway(r, s, now, pres))) return null;
  return w.seats.find((s) => r.seats[s].bot) ?? w.seats[0];
}

// La seña la ven solo los que en ese momento miran al que la hace.
function deliverSena(r, seat, sena) {
  const watchers = Object.entries(r.gaze).filter(([s, t]) => t === seat && Number(s) !== seat).map(([s]) => Number(s));
  evento(r, { k: 'sena', seat, sena, watchers });
}

// ---------------------------------------------------------------- acciones de los jugadores
export function accion(r, msg, { pid, uid, nombreCuenta, now, pres }) {
  const seat = pid ? seatOf(r, pid) : null;
  const isHost = !!pid && pid === r.host;
  const name = nombreCuenta || cleanName(msg.name);

  switch (msg.t) {
    case 'join': {
      if (seat != null) {
        r.seats[seat].name = name;
        if (uid) r.seats[seat].uid = uid;
      } else if (r.status === 'lobby' && !msg.spectate) {
        const free = freeSeat(r);
        if (free != null) {
          r.seats[free] = { pid, name, uid: uid || undefined };
          systemChat(r, `${name} se sentó a la mesa`);
        }
      }
      if (!r.host || seatOf(r, r.host) == null) r.host = seatOf(r, pid) != null ? pid : r.host;
      return {};
    }
    case 'sit': {
      if (r.status !== 'lobby') return {};
      const to = msg.seat;
      if (!Number.isInteger(to) || to < 0 || to >= r.seats.length || r.seats[to]) return {};
      const me = seat != null ? r.seats[seat] : { pid, name, uid: uid || undefined };
      if (seat != null) r.seats[seat] = null;
      r.seats[to] = me;
      if (!r.host || seatOf(r, r.host) == null) r.host = pid;
      return {};
    }
    case 'stand':
      if (r.status === 'lobby' && seat != null) r.seats[seat] = null;
      return {};
    case 'addbot': {
      if (!isHost || r.status !== 'lobby') return {};
      const to = Number.isInteger(msg.seat) && !r.seats[msg.seat] ? msg.seat : freeSeat(r);
      if (to == null || to >= r.seats.length) return {};
      r.seats[to] = { bot: true, name: botName(r) };
      return {};
    }
    case 'removebot':
      if (isHost && r.status === 'lobby' && r.seats[msg.seat]?.bot) r.seats[msg.seat] = null;
      return {};
    case 'kick': {
      if (!isHost || r.status !== 'lobby') return {};
      const s = r.seats[msg.seat];
      if (s && !s.bot && s.pid !== r.host) r.seats[msg.seat] = null;
      return {};
    }
    case 'config': {
      if (!isHost || r.status !== 'lobby') return {};
      const c = msg.cfg || {};
      if ([15, 30].includes(c.target)) r.cfg.target = c.target;
      if (typeof c.ayudas === 'boolean') r.cfg.ayudas = c.ayudas;
      if (typeof c.isPublic === 'boolean') r.cfg.isPublic = c.isPublic;
      if (typeof c.trucoDesdeSegunda === 'boolean') r.cfg.trucoDesdeSegunda = c.trucoDesdeSegunda;
      if (MODES[c.mode] && c.mode !== r.cfg.mode) {
        const people = r.seats.filter((s) => s && !s.bot);
        r.cfg.mode = c.mode;
        r.seats = Array(MODES[c.mode]).fill(null);
        people.slice(0, r.seats.length).forEach((p, i) => (r.seats[i] = p));
      }
      return {};
    }
    case 'start': {
      if (!isHost || r.status !== 'lobby') return {};
      if (msg.fillBots) r.seats = r.seats.map((s) => s || { bot: true, name: botName(r) });
      if (r.seats.some((s) => !s)) return { error: 'Faltan jugadores (o llená con bots)' };
      r.status = 'playing';
      r.game = newGame({ mode: r.cfg.mode, target: r.cfg.target, ayudas: r.cfg.ayudas, trucoDesdeSegunda: r.cfg.trucoDesdeSegunda !== false, dealer: Math.floor(rng() * r.seats.length) }, rng);
      systemChat(r, '¡Arranca la partida! Reparte ' + r.seats[r.game.dealer].name);
      afterDeal(r);
      return {};
    }
    case 'act': {
      if (r.status !== 'playing' || seat == null) return {};
      if (now < (r.dealUntil || 0)) return { error: 'Esperá que terminen de repartir' };
      const res = act(r.game, seat, msg.a, rng);
      if (res.error) return { error: res.error };
      onGameChange(r);
      return {};
    }
    case 'look': {
      if (seat == null) return {};
      const tgt = msg.target === 'table' ? 'table' : Number.isInteger(msg.target) && msg.target >= 0 && msg.target < r.seats.length ? msg.target : null;
      if (r.gaze[seat] !== tgt) setGaze(r, seat, tgt, seat);
      return {};
    }
    case 'sena':
      if (seat != null && SENAS.includes(msg.sena) && r.status === 'playing') deliverSena(r, seat, msg.sena);
      return {};
    case 'chat': {
      const text = String(msg.text ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 280);
      if (!text || !pid) return {};
      pushChat(r, { name: seat != null ? r.seats[seat].name : name, seat, text, ts: now });
      return {};
    }
    case 'rematch':
      if (seat == null || r.status !== 'ended') return {};
      rematch(r.game, rng);
      r.status = 'playing';
      systemChat(r, '¡Revancha!');
      afterDeal(r);
      return {};
    case 'to-lobby':
      if (isHost && r.status === 'ended') {
        r.status = 'lobby';
        r.game = null;
      }
      return {};
    default:
      return {};
  }
}

// ---------------------------------------------------------------- lo que antes hacía la alarma
// ¿Cuándo tiene que intervenir el servidor? (bots, pausas, tiempos). Infinity = nada pendiente.
export function proximoTick(r, now, pres) {
  if (r.status === 'lobby') {
    const stale = r.seats.some((s) => s && !s.bot && now - (pres[s.pid] || r.createdAt) > LOBBY_LEAVE_MS);
    return stale ? now : Infinity;
  }
  if (r.status !== 'playing') return Infinity;
  const g = r.game;
  const hasBots = r.seats.some((s) => s?.bot);
  let at = hasBots ? r.nextGlanceAt || now : Infinity;
  if (g.h.phase === 'ended') at = Math.min(at, r.handEndedAt + HAND_PAUSE);
  else if (g.h.phase === 'show') {
    const since = r.showSince || now;
    const sh = g.h.show;
    const winnerAuto = r.seats[sh.seat]?.bot || isAway(r, sh.seat, now, pres);
    at = Math.min(at, since + SHOW_MS, winnerAuto && !g.h.mazo[sh.seat] ? since + 1250 : Infinity, r.botClaimAt || Infinity);
  } else if (now < (r.dealUntil || 0)) at = Math.min(at, r.dealUntil);
  else if (autoActor(r, now, pres) != null) at = Math.min(at, r.botAt || now);
  else if (r.botAt) at = now; // había un bot pensando y ya no le toca: se limpia
  for (const t of Object.values(r.botSenaDue || {})) at = Math.min(at, t);
  return at;
}

export function tick(r, now, pres) {
  if (r.status === 'lobby') {
    r.seats.forEach((s, i) => {
      if (s && !s.bot && now - (pres[s.pid] || r.createdAt) > LOBBY_LEAVE_MS) r.seats[i] = null;
    });
    if (!r.host || seatOf(r, r.host) == null) r.host = r.seats.find((s) => s && !s.bot)?.pid || null;
    return;
  }
  if (r.status !== 'playing') return;
  const g = r.game;
  if (g.h.phase === 'ended' && g.status === 'playing' && now - r.handEndedAt >= HAND_PAUSE) {
    nextHand(g, rng);
    afterDeal(r);
  } else if (g.h.phase === 'show') {
    const sh = g.h.show;
    const since = r.showSince || now;
    const winnerAuto = r.seats[sh.seat]?.bot || isAway(r, sh.seat, now, pres);
    let changed = false;
    if (winnerAuto && now - since > 1200 && !g.h.mazo[sh.seat]) changed = act(g, sh.seat, { t: 'mostrar' }, rng).ok;
    else if (r.botClaimAt && now >= r.botClaimAt) changed = act(g, r.botClaimer, { t: 'reclamar' }, rng).ok;
    else if (now - since >= SHOW_MS) changed = closeShow(g);
    if (changed) onGameChange(r);
  } else if (g.h.phase === 'play' && now >= (r.dealUntil || 0)) {
    const actor = autoActor(r, now, pres);
    if (actor == null) r.botAt = 0;
    else if (!r.botAt) r.botAt = now + 900 + Math.floor(rng() * 900); // el bot "piensa"
    else if (now >= r.botAt) {
      r.botAt = 0;
      const a = botAction(g, actor, rng);
      if (a && act(g, actor, a, rng).ok) onGameChange(r);
    }
  }
  if (r.status === 'playing' && r.seats.some((s) => s?.bot) && now >= (r.nextGlanceAt || 0)) {
    r.nextGlanceAt = now + 4000;
    botGlances(r);
  }
  if (r.status === 'playing') botSenas(r, now);
}

function botGlances(r) {
  r.seats.forEach((s, i) => {
    if (!s?.bot || rng() >= 0.3) return;
    const others = r.seats.map((_, j) => j).filter((j) => j !== i);
    const partners = others.filter((j) => team(j) === team(i));
    const roll = rng();
    let tgt = 'table';
    if (roll > 0.55 && partners.length && roll < 0.75) tgt = partners[Math.floor(rng() * partners.length)];
    else if (roll >= 0.75) tgt = others[Math.floor(rng() * others.length)];
    setGaze(r, i, tgt);
  });
}

function botSenas(r, now) {
  const due = r.botSenaDue || {};
  for (const [k, at] of Object.entries(due)) {
    if (now < at) continue;
    const seat = Number(k);
    delete due[k];
    if (r.game.h.phase !== 'play' || r.game.h.mazo[seat]) continue;
    const partners = r.seats.map((_, j) => j).filter((j) => j !== seat && team(j) === team(seat));
    const p = partners[Math.floor(rng() * partners.length)];
    setGaze(r, seat, p);
    deliverSena(r, seat, botSena(r.game, seat));
  }
}

// ---------------------------------------------------------------- lo que recibe cada navegador
function publicRoom(r, online) {
  let spectators = 0;
  for (const pid of online) if (seatOf(r, pid) == null) spectators++;
  return {
    code: r.code,
    cfg: r.cfg,
    status: r.status,
    seats: r.seats.map((s) => (s ? { name: s.name, bot: !!s.bot, online: s.bot || online.has(s.pid), host: !s.bot && s.pid === r.host } : null)),
    spectators,
  };
}

function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

// Arma los mensajes (con el mismo formato que mandaba el WebSocket) para un navegador.
export function mensajes(r, pid, pres, { cursor = null, h = null, join = false } = {}) {
  const now = Date.now();
  const online = onlineSet(pres, now);
  const seat = pid ? seatOf(r, pid) : null;
  const out = [];
  if (join || cursor == null) {
    out.push({ t: 'chat-history', messages: r.chat });
    out.push({ t: 'gaze-all', gaze: r.gaze });
  } else {
    for (const e of r.ev) {
      if (e.id <= cursor) continue;
      if (e.k === 'chat') out.push({ t: 'chat', msg: e.msg });
      else if (e.k === 'gaze' && (seat == null || e.from !== seat)) out.push({ t: 'gaze', seat: e.seat, target: e.target });
      else if (e.k === 'sena') {
        if (seat === e.seat) out.push({ t: 'sena', seat: e.seat, sena: e.sena, self: true, seenBy: e.watchers });
        else if (seat != null && e.watchers.includes(seat)) out.push({ t: 'sena', seat: e.seat, sena: e.sena });
      }
    }
  }
  const state = { t: 'state', room: publicRoom(r, online), you: seat, isHost: !!pid && pid === r.host, game: r.game ? viewFor(r.game, seat) : null };
  const sh = hash(JSON.stringify(state));
  if (join || sh !== h) out.push({ ...state, now });
  return { msgs: out, cursor: r.evSeq || 0, h: sh };
}

export function info(r) {
  if (!r) return { exists: false };
  return { exists: true, mode: r.cfg.mode, status: r.status, free: r.seats.filter((s) => !s).length, isPublic: r.cfg.isPublic };
}

// ---------------------------------------------------------------- lobby e historial
export async function actualizarLobby(r, pres) {
  const online = onlineSet(pres);
  const humans = r.seats.filter((s) => s && !s.bot);
  await getStore().hset(
    LOBBY,
    r.code,
    JSON.stringify({
      code: r.code,
      mode: r.cfg.mode,
      target: r.cfg.target,
      isPublic: r.cfg.isPublic,
      status: r.status,
      players: r.seats.map((s) => s?.name ?? null),
      free: r.seats.filter((s) => !s).length,
      online: humans.filter((s) => online.has(s.pid)).length,
      score: r.game?.score ?? null,
      updatedAt: Date.now(),
    })
  );
}

export async function listarLobby() {
  const store = getStore();
  const all = await store.hgetall(LOBBY);
  const now = Date.now();
  const MIN = 60_000;
  const open = [];
  const live = [];
  const stale = [];
  for (const [code, raw] of Object.entries(all)) {
    let r;
    try {
      r = JSON.parse(raw);
    } catch {
      stale.push(code);
      continue;
    }
    const age = now - r.updatedAt;
    if ((r.online === 0 && age > 10 * MIN) || (r.status === 'ended' && age > 5 * MIN) || age > 24 * 60 * MIN) {
      stale.push(code);
      continue;
    }
    // "online" se refresca con las consultas de los jugadores; si hace rato que no, no la mostramos
    if (!r.isPublic || age > 45_000) continue;
    if (r.status === 'lobby' && r.free > 0 && r.online > 0) open.push(r);
    else if (r.status === 'playing' && r.online > 0) live.push(r);
  }
  if (stale.length) await store.hdel(LOBBY, stale);
  const byRecent = (a, b) => b.updatedAt - a.updatedAt;
  return { open: open.sort(byRecent).slice(0, 50), live: live.sort(byRecent).slice(0, 50) };
}

export async function buscarRapida(mode) {
  const { open } = await listarLobby();
  const r = open.filter((x) => x.mode === mode).sort((a, b) => a.free - b.free)[0];
  return r ? r.code : null;
}

async function guardarHistorial(r) {
  const g = r.game;
  if (!g) return;
  const t = g.winner;
  for (let i = 0; i < r.seats.length; i++) {
    const s = r.seats[i];
    if (!s?.uid) continue;
    const mio = team(i);
    await registrarPartida(s.uid, {
      juego: 'truco',
      sala: r.code,
      url: `/truco/sala/${r.code}`,
      resultado: t == null ? 'tablas' : t === mio ? 'victoria' : 'derrota',
      detalle: `${r.cfg.mode} a ${r.cfg.target}`,
      marcador: `${g.score[mio]} a ${g.score[1 - mio]}`,
      companeros: r.seats.filter((x, j) => j !== i && x && team(j) === mio).map((x) => x.name),
      rivales: r.seats.filter((x, j) => x && team(j) !== mio).map((x) => x.name),
    });
  }
}
