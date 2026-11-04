// /api/game/:id
//   GET  ?pid=…&ping=1  → estado de la partida (los clientes lo consultan ~1 vez por segundo)
//   POST {t, pid, …}    → acciones: join, move, resign, draw-offer, chat, rematch…
import { core, loadRoom, mutateRoom, applyAction, touchPresence, getPresence, updateLobby, view, seatOf } from '../../lib/room.js';
import { cleanGameId, cleanPid, json, readJson, serverError } from '../../lib/util.js';

function gameIdFrom(request) {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  return cleanGameId(parts[parts.length - 1]);
}

export async function GET(request) {
  try {
    const id = gameIdFrom(request);
    const url = new URL(request.url);
    const pid = cleanPid(url.searchParams.get('pid'));
    if (!id) return json({ t: 'notfound' }, 404);
    let readAt = Date.now();
    let room = await loadRoom(id);
    if (!room) return json({ t: 'notfound' }, 404);

    // ¿A alguien se le acabó el tiempo? Lo detecta la primera consulta que llegue.
    const g = room.game;
    if (core.ticking(g) && core.remaining(g, core.turn(g), Date.now()) <= 0) {
      const r = await mutateRoom(id, (rm, chess) => applyAction(rm, chess, pid, { t: 'flag' }));
      if (r.room) {
        room = r.room;
        readAt = Date.now();
      }
    }

    let presence = null;
    if (pid && url.searchParams.get('ping')) {
      await touchPresence(id, pid);
      presence = await getPresence(id, room.game);
      // Mantiene la sala visible en el lobby mientras sus jugadores estén conectados.
      if (room.game.status !== 'ended' && seatOf(room.game, pid)) await updateLobby(room, Date.now());
    }
    return json(view(room, pid, presence, readAt));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(request) {
  try {
    const id = gameIdFrom(request);
    const msg = await readJson(request);
    const pid = cleanPid(msg.pid);
    if (!id) return json({ t: 'notfound' }, 404);
    if (!pid) return json({ error: 'Identificador inválido' }, 400);
    if (msg.t === 'join') await touchPresence(id, pid);
    const r = await mutateRoom(id, (room, chess) => applyAction(room, chess, pid, msg));
    if (r.notfound) return json({ t: 'notfound' }, 404);
    if (!r.room) return json({ error: r.error }, 409);
    const presence = await getPresence(id, r.room.game);
    return json({ ...view(r.room, pid, presence), error: r.error || undefined });
  } catch (e) {
    return serverError(e);
  }
}
