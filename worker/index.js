// cadalado en Cloudflare: el Worker recibe los pedidos, sirve los archivos del sitio (páginas, modelos,
// imágenes: no pasan por acá salvo las rutas de abajo) y manda cada pedido de /api al Durable Object
// que corresponde: el de la sala (si es de una sala) o el del club (todo lo demás).
export { Objeto } from './objeto.js';

const SALA = /^\/api\/(memes|casino|carrera|royale|haxball|pelea|futbol)\/salas\/([A-Za-z0-9-]{3,24})(?:\/|$)/;
const TRUCO = /^\/api\/truco\/rooms\/([A-Za-z0-9]{5})(?:\/|$)/;
const AJEDREZ = /^\/ajedrez\/api\/game\/([a-z0-9]{4,16})(?:\/|$)/;
const POS = /^\/api\/(royale|haxball|carrera|pelea|futbol)\/pos$/;
// páginas de sala: se sirve el juego y él acomoda la dirección
const PAGINA_SALA = /^\/(royale|carrera|casino|memes|haxball|pelea|futbol|truco)\/(?:sala|mesa)\/[A-Za-z0-9-]+\/?$|^\/(ajedrez)\/(?:game\/[a-z0-9]+|local)\/?$|^\/(pelea|futbol)\/(?:bots|local)\/?$/;
const REDIRIGIR = { '/equipo': '/', '/creadores': '/' };

async function objetoPara(request, path) {
  let m;
  if ((m = SALA.exec(path))) return `${m[1]}:${m[2].toUpperCase()}`;
  if ((m = TRUCO.exec(path))) return `truco:${m[1].toUpperCase()}`;
  if ((m = AJEDREZ.exec(path))) return `ajedrez:${m[1]}`;
  if ((m = POS.exec(path))) {
    // el plan B de posiciones va a la sala (el código viene en la consulta o en el cuerpo)
    let code = new URL(request.url).searchParams.get('code');
    if (!code && request.method === 'POST') code = (await request.clone().json().catch(() => ({}))).code;
    if (code && /^[A-Za-z0-9-]{3,24}$/.test(code)) return `${m[1]}:${String(code).toUpperCase()}`;
  }
  return 'club';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path.startsWith('/api/') || path.startsWith('/ajedrez/api/')) {
      const nombre = await objetoPara(request, path);
      const stub = env.OBJETOS.get(env.OBJETOS.idFromName(nombre));
      const pedido = new Request(request);
      pedido.headers.set('x-objeto', nombre);
      try {
        return await stub.fetch(pedido);
      } catch (e) {
        console.error(e);
        return Response.json({ error: 'No se pudo completar la operación. Probá de nuevo.' }, { status: 503 });
      }
    }
    if (REDIRIGIR[path]) return Response.redirect(new URL(REDIRIGIR[path], url), 302);
    const m = PAGINA_SALA.exec(path);
    if (m) return env.ASSETS.fetch(new Request(new URL(`/${m[1] || m[2] || m[3]}/`, url), request));
    return env.ASSETS.fetch(request);
  },
};
