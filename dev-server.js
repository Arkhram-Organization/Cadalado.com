// Servidor para probar todo cadalado en tu compu, igual que en Vercel (ver vercel.json):
//   http://localhost:3000/          → portal
//   http://localhost:3000/ajedrez/  → ajedrez        http://localhost:3000/truco/ → truco
//   /api/club/…                     → cuentas, amigos y chats
// Sin REDIS_URL todo se guarda en memoria (se borra al cerrar). Uso: npm run dev
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import * as ajedrez from './games/chessort/api.js';
import * as truco from './games/truco/api.js';
import * as club from './shared/club-api.js';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = import.meta.dirname;
const PORTAL = join(ROOT, 'portal/public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.txt': 'text/plain', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4',
};

// API: prefijo → manejador (igual que los "rewrites" de vercel.json)
const API = [
  ['/ajedrez/api/', ajedrez.handle],
  ['/api/truco/', truco.handle],
  ['/api/club/', club.handle],
  ...['memes', 'casino', 'carrera', 'royale', 'haxball', 'pelea'].map((j) => [`/api/${j}/`, async (req) => (await import(`./games/${j}/api.js`)).handle(req)]),
];

// Juegos: ruta → carpeta y páginas que abren la app
const JUEGOS = [
  { ruta: 'ajedrez', publico: join(ROOT, 'games/chessort/public'), paginas: [/^\/?$/, /^\/game\/[^/]+$/, /^\/local$/] },
  { ruta: 'truco', publico: join(ROOT, 'games/truco/public'), paginas: [/^\/?$/, /^\/sala\/[^/]+$/] },
  ...['memes', 'casino', 'carrera', 'royale', 'haxball'].map((j) => ({ ruta: j, publico: join(ROOT, `games/${j}/public`), paginas: [/^\/?$/, /^\/sala\/[^/]+$/, /^\/mesa\/[^/]+$/] })),
  { ruta: 'pelea', publico: join(ROOT, 'games/pelea/public'), paginas: [/^\/?$/, /^\/sala\/[^/]+$/, /^\/bots$/, /^\/local$/] },
  { ruta: 'comun', publico: join(ROOT, 'shared/public'), paginas: [] },
];

async function toRequest(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = req.method === 'GET' || !chunks.length ? undefined : Buffer.concat(chunks);
  return new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body });
}

async function send(res, response) {
  const headers = {};
  response.headers.forEach((v, k) => (headers[k] = k === 'set-cookie' ? response.headers.getSetCookie() : v));
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function sendFile(res, dir, rel, status = 200) {
  let file = normalize(join(dir, rel));
  if (!file.startsWith(dir)) throw Object.assign(new Error(), { code: 'ENOENT' });
  if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  const data = await readFile(file);
  res.writeHead(status, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(data);
}

http
  .createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    try {
      const api = API.find(([p]) => path.startsWith(p));
      if (api) return send(res, await api[1](await toRequest(req)));
      for (const j of JUEGOS) {
        if (path === `/${j.ruta}` || path.startsWith(`/${j.ruta}/`)) {
          const rel = path.slice(j.ruta.length + 1);
          if (j.paginas.some((re) => re.test(rel))) return await sendFile(res, j.publico, 'index.html');
          return await sendFile(res, j.publico, rel);
        }
      }
      // Portal (con URLs limpias: /club → club.html)
      if (path === '/') return await sendFile(res, PORTAL, 'index.html');
      try {
        return await sendFile(res, PORTAL, path);
      } catch {
        return await sendFile(res, PORTAL, path + '.html');
      }
    } catch (e) {
      if (e.code !== 'ENOENT' && e.code !== 'EISDIR' && e.code !== 'ENOTDIR') console.error(e);
      try {
        await sendFile(res, PORTAL, '404.html', 404);
      } catch {
        res.writeHead(404);
        res.end('No encontrado');
      }
    }
  })
  .listen(PORT, () => console.log(`cadalado en http://localhost:${PORT}  ${process.env.REDIS_URL || process.env.KV_REST_API_URL ? '(Redis)' : '(todo en memoria)'}`));
