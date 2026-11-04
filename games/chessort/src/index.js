import { GameRoom } from './game-room.js';
import { Lobby } from './lobby.js';
import { cleanName, cleanPid, newGameId, json } from './util.js';

export { GameRoom, Lobby };

const lobbyStub = (env) => env.LOBBY.get(env.LOBBY.idFromName('global'));
const roomStub = (env, id) => env.GAME_ROOM.get(env.GAME_ROOM.idFromName(id));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Crear una partida nueva
    if (path === '/api/games' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const pid = cleanPid(body.pid);
      if (!pid) return json({ error: 'pid inválido' }, 400);
      const id = newGameId();
      await roomStub(env, id).create({
        id,
        tcId: String(body.tc || '10+0'),
        color: ['w', 'b'].includes(body.color) ? body.color : 'random',
        pid,
        name: cleanName(body.name),
      });
      return json({ id });
    }

    // Lista de partidas abiertas y en vivo (pública: el portal cadalado.com la muestra)
    if (path === '/api/lobby' && request.method === 'GET') {
      return json(await lobbyStub(env).list(), 200, { 'access-control-allow-origin': '*' });
    }

    // WebSocket de una partida
    const m = path.match(/^\/api\/games\/([a-z0-9]{4,16})\/ws$/);
    if (m) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Se esperaba un WebSocket', { status: 426 });
      }
      return roomStub(env, m[1]).fetch(request);
    }

    return json({ error: 'No encontrado' }, 404);
  },
};
