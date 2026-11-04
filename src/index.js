import { GameRoom } from './game-room.js';
import { Lobby } from './lobby.js';
import { TrucoRoom } from './truco-room.js';
import { cleanName, cleanPid, newGameId, newRoomCode, json } from './util.js';

export { GameRoom, Lobby, TrucoRoom };

const lobbyStub = (env) => env.LOBBY.get(env.LOBBY.idFromName('global'));
const roomStub = (env, id) => env.GAME_ROOM.get(env.GAME_ROOM.idFromName(id));
const trucoStub = (env, code) => env.TRUCO_ROOM.get(env.TRUCO_ROOM.idFromName('truco:' + code));
const TRUCO_MODES = ['1v1', '2v2', '3v3'];

async function createTrucoRoom(env, opts) {
  for (let i = 0; i < 6; i++) {
    const code = newRoomCode();
    const r = await trucoStub(env, code).create({ code, ...opts });
    if (r.ok) return code;
  }
  throw new Error('No se pudo crear la sala');
}

async function handleTruco(request, env, path) {
  // Página del juego para los enlaces /truco/sala/CODIGO
  if (path.startsWith('/truco/sala/')) {
    return env.ASSETS.fetch(new Request(new URL('/truco/', request.url), request));
  }
  if (path === '/api/truco/rooms' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const pid = cleanPid(body.pid);
    if (!pid) return json({ error: 'pid inválido' }, 400);
    const code = await createTrucoRoom(env, {
      mode: TRUCO_MODES.includes(body.mode) ? body.mode : '1v1',
      target: Number(body.target) === 15 ? 15 : 30,
      ayudas: !!body.ayudas,
      isPublic: !!body.isPublic,
      pid,
      name: cleanName(body.name),
    });
    return json({ code });
  }
  if (path === '/api/truco/quick' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const pid = cleanPid(body.pid);
    if (!pid) return json({ error: 'pid inválido' }, 400);
    const mode = TRUCO_MODES.includes(body.mode) ? body.mode : '1v1';
    const found = await lobbyStub(env).findTruco(mode);
    if (found) return json({ code: found, joined: true });
    const code = await createTrucoRoom(env, { mode, target: 30, ayudas: false, isPublic: true, pid, name: cleanName(body.name) });
    return json({ code, joined: false });
  }
  if (path === '/api/truco/lobby' && request.method === 'GET') {
    return json(await lobbyStub(env).listTruco());
  }
  const info = path.match(/^\/api\/truco\/rooms\/([A-Z0-9]{5})$/);
  if (info && request.method === 'GET') return json(await trucoStub(env, info[1]).info());
  const ws = path.match(/^\/api\/truco\/rooms\/([A-Z0-9]{5})\/ws$/);
  if (ws) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Se esperaba un WebSocket', { status: 426 });
    return trucoStub(env, ws[1]).fetch(request);
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/api/truco/') || path.startsWith('/truco/sala/')) {
      const res = await handleTruco(request, env, path);
      if (res) return res;
    }

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

    // Lista de partidas abiertas y en vivo
    if (path === '/api/lobby' && request.method === 'GET') {
      return json(await lobbyStub(env).list());
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
