// Salas de ajedrez guardadas en Redis.
// Cada sala es un JSON con la partida (game) y el chat. Las escrituras usan un candado
// por sala para que dos jugadas simultáneas no se pisen.
import { Chess } from 'chess.js';
import { createCore, findTimeControl } from '../public/js/core.js';
import { getStore } from '../../../shared/store.js';
import { cleanName } from './util.js';
import { registrarPartida } from '../../../shared/cuenta.js';

export const core = createCore(Chess);

const ROOM_TTL = 7 * 24 * 3600; // las salas se borran solas a los 7 días
const PRESENCE_TTL = 3600;
const ONLINE_MS = 20_000; // visto hace menos de esto = conectado
const MAX_CHAT = 60;

const roomKey = (id) => `room:${id}`;
const lockKey = (id) => `lock:${id}`;
const presKey = (id) => `pres:${id}`;
const LOBBY = 'lobby';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function loadRoom(id) {
  const raw = await getStore().get(roomKey(id));
  return raw ? JSON.parse(raw) : null;
}

async function saveRoom(room) {
  await getStore().set(roomKey(room.game.id), JSON.stringify(room), ROOM_TTL);
}

export async function createRoom({ id, tcId, color, pid, name, uid }) {
  const seat = color === 'w' || color === 'b' ? color : Math.random() < 0.5 ? 'w' : 'b';
  const players = { w: null, b: null };
  players[seat] = { pid, name, uid: uid || undefined };
  const room = { game: core.newState({ id, tc: findTimeControl(tcId), players }), chat: [], chatSeq: 0 };
  await saveRoom(room);
  await getStore().hset(presKey(id), pid, String(Date.now()), PRESENCE_TTL);
  await updateLobby(room, Date.now());
  return room;
}

// Lee, modifica y guarda la sala con un candado. `fn` recibe (room, chess) y devuelve un resultado.
export async function mutateRoom(id, fn) {
  const store = getStore();
  const token = crypto.randomUUID();
  let locked = false;
  for (let i = 0; i < 60 && !locked; i++) {
    locked = await store.setNX(lockKey(id), token, 4000);
    if (!locked) await sleep(40 + Math.random() * 40);
  }
  if (!locked) return { error: 'La sala está ocupada, probá de nuevo' };
  try {
    const room = await loadRoom(id);
    if (!room) return { notfound: true };
    const before = JSON.stringify(room);
    const endedBefore = room.game.status === 'ended' ? room.game.gameNo : null;
    const result = fn(room, core.rebuild(room.game)) || {};
    if (JSON.stringify(room) !== before) {
      await saveRoom(room);
      await updateLobby(room, Date.now());
      if (room.game.status === 'ended' && endedBefore !== room.game.gameNo) await saveHistory(room);
    }
    return { ...result, room };
  } finally {
    if ((await store.get(lockKey(id))) === token) await store.del(lockKey(id));
  }
}

// ---------- acciones ----------
export function seatOf(game, pid) {
  if (game.players.w?.pid === pid) return 'w';
  if (game.players.b?.pid === pid) return 'b';
  return null;
}

function pushChat(room, entry) {
  room.chatSeq = (room.chatSeq || 0) + 1;
  room.chat.push({ ...entry, id: room.chatSeq, ts: Date.now() });
  if (room.chat.length > MAX_CHAT) room.chat.splice(0, room.chat.length - MAX_CHAT);
}

export function applyAction(room, chess, pid, msg, now = Date.now(), cuenta = null) {
  const g = room.game;
  const color = seatOf(g, pid);
  switch (msg.t) {
    case 'join': {
      // Con cuenta, el nombre es el de la cuenta y la partida queda en su historial.
      const name = cuenta?.nombre || cleanName(msg.name);
      if (color) {
        g.players[color].name = name;
        if (cuenta) g.players[color].uid = cuenta.id;
      } else if (g.status === 'waiting') {
        const seat = g.players.w ? 'b' : 'w';
        g.players[seat] = { pid, name, uid: cuenta?.id };
        g.status = 'playing';
        pushChat(room, { system: true, text: `${name} se unió a la partida` });
      }
      return {};
    }
    case 'move': {
      if (!color) return { error: 'Estás mirando, no jugando' };
      const r = core.applyMove(g, chess, color, { from: msg.from, to: msg.to, promotion: msg.promotion }, now);
      return r.error && !r.ended ? { error: r.error } : {};
    }
    case 'flag':
      core.checkFlag(g, chess, now);
      return {};
    case 'resign':
      return color ? core.resign(g, color, now) : {};
    case 'abort':
      return color ? core.abort(g, now) : {};
    case 'draw-offer': {
      if (!color) return {};
      const r = core.offerDraw(g, color);
      return r.accept ? core.acceptDraw(g, color, now) : r;
    }
    case 'draw-accept':
      return color ? core.acceptDraw(g, color, now) : {};
    case 'draw-decline':
      return color ? core.declineDraw(g, color) : {};
    case 'rematch': {
      if (!color) return {};
      const r = core.requestRematch(g, color);
      if (r.next) {
        room.game = r.next;
        pushChat(room, { system: true, text: '¡Revancha! Se invierten los colores.' });
      }
      return r.error ? { error: r.error } : {};
    }
    case 'chat': {
      const text = String(msg.text ?? '').trim().slice(0, 300);
      if (!text) return {};
      const name = color ? g.players[color].name : cleanName(msg.name);
      pushChat(room, { name, color, text });
      return {};
    }
    default:
      return { error: 'Acción desconocida' };
  }
}

// ---------- historial de cada jugador con cuenta ----------
async function saveHistory(room) {
  const g = room.game;
  const r = g.result;
  for (const c of ['w', 'b']) {
    const p = g.players[c];
    if (!p?.uid) continue;
    const rival = g.players[c === 'w' ? 'b' : 'w'];
    await registrarPartida(p.uid, {
      juego: 'ajedrez',
      sala: g.id,
      url: `/ajedrez/game/${g.id}`,
      resultado: r.reason === 'aborted' ? 'abortada' : !r.winner ? 'tablas' : r.winner === c ? 'victoria' : 'derrota',
      detalle: r.reason,
      color: c === 'w' ? 'blancas' : 'negras',
      marcador: r.reason === 'aborted' ? '—' : !r.winner ? '½-½' : r.winner === 'w' ? '1-0' : '0-1',
      rivales: rival ? [rival.name] : [],
      jugadas: g.moves.length,
    });
  }
}

// ---------- presencia (quién está conectado) ----------
export async function touchPresence(id, pid) {
  await getStore().hset(presKey(id), pid, String(Date.now()), PRESENCE_TTL);
}

export async function getPresence(id, game, now = Date.now()) {
  const all = await getStore().hgetall(presKey(id));
  const online = new Set(Object.entries(all).filter(([, ts]) => now - Number(ts) < ONLINE_MS).map(([pid]) => pid));
  let spectators = 0;
  for (const pid of online) if (!seatOf(game, pid)) spectators++;
  return { online, spectators };
}

// ---------- lo que ve cada cliente ----------
export function view(room, pid, presence, now = Date.now()) {
  const g = room.game;
  const pub = (p) => (p ? { name: p.name, online: presence ? presence.online.has(p.pid) : null } : null);
  const { players, ...rest } = g;
  return {
    t: 'state',
    game: { ...rest, players: { w: pub(players.w), b: pub(players.b) }, spectators: presence ? presence.spectators : null },
    you: pid ? seatOf(g, pid) : null,
    chat: room.chat,
    now,
  };
}

// ---------- lobby ----------
export async function updateLobby(room, seenAt) {
  const g = room.game;
  const summary = {
    id: g.id,
    tc: g.tc,
    status: g.status,
    white: g.players.w?.name ?? null,
    black: g.players.b?.name ?? null,
    moves: g.moves.length,
    updatedAt: Date.now(),
    seenAt,
  };
  await getStore().hset(LOBBY, g.id, JSON.stringify(summary));
}

export async function listLobby(now = Date.now()) {
  const store = getStore();
  const all = await store.hgetall(LOBBY);
  const open = [];
  const live = [];
  const stale = [];
  for (const [id, raw] of Object.entries(all)) {
    let g;
    try {
      g = JSON.parse(raw);
    } catch {
      stale.push(id);
      continue;
    }
    const idle = now - Math.max(g.seenAt || 0, g.updatedAt || 0);
    if ((g.status === 'ended' && now - g.updatedAt > 2 * 60_000) || idle > 3600_000) {
      stale.push(id);
      continue;
    }
    const seen = now - (g.seenAt || 0);
    if (g.status === 'waiting' && seen < 30_000) open.push(g);
    else if (g.status === 'playing' && seen < 45_000) live.push(g);
  }
  if (stale.length) await store.hdel(LOBBY, stale);
  const recent = (a, b) => b.updatedAt - a.updatedAt;
  return { open: open.sort(recent).slice(0, 50), live: live.sort(recent).slice(0, 50) };
}
