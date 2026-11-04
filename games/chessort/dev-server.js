// Servidor para probar en tu compu: imita a Vercel (archivos de public/ + funciones de api/).
// Sin REDIS_URL guarda las partidas en memoria. Uso: npm run dev
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import * as games from './api/games.js';
import * as lobby from './api/lobby.js';
import * as game from './api/game/[id].js';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = join(import.meta.dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain' };

const routes = [
  [/^\/api\/games$/, games],
  [/^\/api\/lobby$/, lobby],
  [/^\/api\/game\/[^/]+$/, game],
];

async function toRequest(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body: req.method === 'GET' ? undefined : body });
}

async function send(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

http
  .createServer(async (req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    try {
      for (const [re, mod] of routes) {
        if (re.test(path)) {
          const handler = mod[req.method];
          if (!handler) return send(res, new Response('Method Not Allowed', { status: 405 }));
          return send(res, await handler(await toRequest(req)));
        }
      }
      let file = path === '/' || /^\/game\/[^/]+$/.test(path) || path === '/local' ? '/index.html' : path;
      file = normalize(join(PUBLIC, file));
      if (!file.startsWith(PUBLIC)) throw new Error('fuera de public');
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch (e) {
      if (e.code !== 'ENOENT' && e.message !== 'fuera de public') console.error(e);
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('No encontrado');
    }
  })
  .listen(PORT, () => console.log(`Ajedrez en http://localhost:${PORT}${process.env.REDIS_URL ? ' (Redis)' : ' (memoria)'}`));
