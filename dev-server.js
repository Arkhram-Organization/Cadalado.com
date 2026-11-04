// Servidor para probar todo cadalado en tu compu, igual que en Vercel:
//   http://localhost:3000/          → portal
//   http://localhost:3000/ajedrez/  → ajedrez (con su API)
// Sin REDIS_URL las partidas se guardan en memoria. Uso: npm run dev
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import * as ajedrezGames from './games/chessort/api/games.js';
import * as ajedrezLobby from './games/chessort/api/lobby.js';
import * as ajedrezGame from './games/chessort/api/game/[id].js';
import * as ajedrezEstado from './games/chessort/api/estado.js';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = import.meta.dirname;
const PORTAL = join(ROOT, 'portal/public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.txt': 'text/plain', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
};

// Juegos: ruta pública → carpeta, páginas que abren la app y funciones de su API
const JUEGOS = [
  {
    ruta: 'ajedrez',
    publico: join(ROOT, 'games/chessort/public'),
    paginas: [/^\/?$/, /^\/game\/[^/]+$/, /^\/local$/],
    api: [
      [/^\/games$/, ajedrezGames],
      [/^\/lobby$/, ajedrezLobby],
      [/^\/game\/[^/]+$/, ajedrezGame],
      [/^\/estado$/, ajedrezEstado],
    ],
  },
];

async function toRequest(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = req.method === 'GET' || !chunks.length ? undefined : Buffer.concat(chunks);
  return new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body });
}

async function send(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function sendFile(res, dir, rel, status = 200) {
  const file = normalize(join(dir, rel));
  if (!file.startsWith(dir)) throw Object.assign(new Error(), { code: 'ENOENT' });
  const data = await readFile(file);
  res.writeHead(status, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(data);
}

http
  .createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    try {
      for (const j of JUEGOS) {
        const m = path.match(new RegExp(`^(?:/${j.ruta}/api|/api/${j.ruta})(/.*)$`));
        if (m) {
          const mod = j.api.find(([re]) => re.test(m[1]))?.[1];
          const handler = mod?.[req.method];
          if (!handler) return send(res, new Response('No encontrado', { status: mod ? 405 : 404 }));
          return send(res, await handler(await toRequest(req)));
        }
        if (path === `/${j.ruta}` || path.startsWith(`/${j.ruta}/`)) {
          const rel = path.slice(j.ruta.length + 1);
          if (j.paginas.some((re) => re.test(rel))) return sendFile(res, j.publico, 'index.html');
          return sendFile(res, j.publico, rel);
        }
      }
      // Portal (con URLs limpias: /creadores → creadores.html)
      if (path === '/') return sendFile(res, PORTAL, 'index.html');
      try {
        return await sendFile(res, PORTAL, path);
      } catch {
        return await sendFile(res, PORTAL, path + '.html');
      }
    } catch (e) {
      if (e.code !== 'ENOENT' && e.code !== 'EISDIR') console.error(e);
      try {
        await sendFile(res, PORTAL, '404.html', 404);
      } catch {
        res.writeHead(404);
        res.end('No encontrado');
      }
    }
  })
  .listen(PORT, () => console.log(`cadalado en http://localhost:${PORT}  ${process.env.REDIS_URL ? '(Redis)' : '(partidas en memoria)'}`));
