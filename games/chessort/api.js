// API del ajedrez en una sola función de Vercel: /ajedrez/api/…
import * as games from './api/games.js';
import * as lobby from './api/lobby.js';
import * as game from './api/game/[id].js';
import * as estado from './api/estado.js';
import { subruta, json } from '../../shared/http.js';

const RUTAS = [
  [/^\/games$/, games],
  [/^\/lobby$/, lobby],
  [/^\/game\/[a-z0-9]{4,16}$/, game],
  [/^\/estado$/, estado],
];

export async function handle(request) {
  const ruta = subruta(request, ['/ajedrez/api', '/api/ajedrez']);
  const mod = RUTAS.find(([re]) => re.test(ruta))?.[1];
  const h = mod?.[request.method];
  if (!h) return json({ error: 'No encontrado' }, mod ? 405 : 404);
  // Los manejadores sacan el id de la partida del final de la URL: le pasamos la sub-ruta real.
  const url = new URL(request.url);
  url.pathname = '/ajedrez/api' + ruta;
  url.searchParams.delete('ruta');
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
  return h(new Request(url, { method: request.method, headers: request.headers, body }));
}
