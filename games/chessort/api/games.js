// POST /api/games: crea una partida nueva.
import { createRoom } from '../lib/room.js';
import { cleanName, cleanPid, newGameId, json, readJson, serverError } from '../lib/util.js';

export async function POST(request) {
  try {
    const body = await readJson(request);
    const pid = cleanPid(body.pid);
    if (!pid) return json({ error: 'pid inválido' }, 400);
    const id = newGameId();
    await createRoom({
      id,
      tcId: String(body.tc || '10+0'),
      color: ['w', 'b'].includes(body.color) ? body.color : 'random',
      pid,
      name: cleanName(body.name),
    });
    return json({ id });
  } catch (e) {
    return serverError(e);
  }
}
