// API del club: /api/club/…  (cuenta, historial, amigos y chats)
import { json, readJson, serverError, subruta } from './http.js';
import * as c from './cuenta.js';
import * as muro from './muro.js';

const necesitaCuenta = async (request) => {
  const u = await c.usuarioActual(request);
  if (!u) throw new c.ErrorCuenta('Tenés que entrar con tu cuenta.', 401);
  return u;
};

export async function handle(request) {
  try {
    const ruta = subruta(request, ['/api/club']);
    const url = new URL(request.url);
    const metodo = request.method;
    const body = metodo === 'POST' ? await readJson(request) : {};

    if (ruta === '/registro' && metodo === 'POST') {
      const { usuario, token } = await c.registrar(request, body);
      return json({ usuario }, 200, { 'set-cookie': c.cookieSesion(request, token) });
    }
    if (ruta === '/entrar' && metodo === 'POST') {
      const { usuario, token } = await c.entrar(request, body);
      return json({ usuario }, 200, { 'set-cookie': c.cookieSesion(request, token) });
    }
    if (ruta === '/salir' && metodo === 'POST') {
      await c.salir(request);
      return json({ ok: true }, 200, { 'set-cookie': c.cookieSesion(request, null) });
    }
    if (ruta === '/yo' && metodo === 'GET') {
      const u = await c.usuarioActual(request);
      return json({ usuario: c.publico(u) || null });
    }
    if (ruta === '/yo' && metodo === 'POST') {
      return json({ usuario: await c.cambiarNombre(await necesitaCuenta(request), body.nombre) });
    }
    if (ruta === '/look' && metodo === 'POST') {
      return json({ usuario: await c.guardarLook(await necesitaCuenta(request), body.look) });
    }
    if (ruta === '/historial' && metodo === 'GET') {
      const u = await necesitaCuenta(request);
      const hist = await c.historial(u.id);
      return json({ historial: hist, resumen: c.resumen(hist) });
    }
    if (ruta === '/perfil' && metodo === 'GET') {
      return json(await c.perfil(url.searchParams.get('usuario')));
    }
    if (ruta === '/amigos' && metodo === 'GET') {
      return json(await c.amigos(await necesitaCuenta(request)));
    }
    if (ruta === '/amigos' && metodo === 'POST') {
      return json(await c.accionAmistad(await necesitaCuenta(request), body.accion, body.usuario));
    }
    if (ruta === '/chat' && metodo === 'GET') {
      const con = url.searchParams.get('con') || 'general';
      const u = con === 'general' ? await c.usuarioActual(request) : await necesitaCuenta(request);
      if (!u) return json({ mensajes: await chatGeneralAnonimo() });
      return json({ mensajes: await c.leerChat(u, con) });
    }
    if (ruta === '/chat' && metodo === 'POST') {
      const u = await necesitaCuenta(request);
      return json({ mensaje: await c.escribirChat(request, u, body.con || 'general', body.texto) });
    }
    // Muro y sugerencias: se usan sin cuenta (con cuenta salen con tu nombre y tu personaje).
    if (ruta === '/muro/foto' && metodo === 'GET') {
      const f = await muro.foto(url.searchParams.get('id'));
      if (!f) return new Response('No encontrada', { status: 404 });
      return new Response(f.bytes, { headers: { 'content-type': f.tipo, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
    }
    if (ruta.startsWith('/muro') || ruta.startsWith('/sugerencias')) {
      const u = await c.usuarioActual(request);
      const r = {
        'GET /muro': () => muro.leerMuro(u, { antes: url.searchParams.get('antes') }),
        'POST /muro': () => muro.publicar(request, u, body),
        'POST /muro/like': () => muro.likear(request, body),
        'GET /muro/respuestas': () => muro.respuestas(u, url.searchParams.get('id')),
        'POST /muro/responder': () => muro.responder(request, u, body),
        'POST /muro/borrar': () => muro.borrar(u, body),
        'GET /sugerencias': () => muro.leerSugerencias(u),
        'POST /sugerencias': () => muro.sugerir(request, u, body),
        'POST /sugerencias/votar': () => muro.votar(request, body),
        'POST /sugerencias/borrar': () => muro.borrarSugerencia(u, body),
        'POST /sugerencias/estado': () => muro.marcarSugerencia(u, body),
      }[`${metodo} ${ruta}`];
      if (r) return json(await r());
    }
    return json({ error: 'No encontrado' }, 404);
  } catch (e) {
    return serverError(e);
  }
}

// El chat general se puede leer sin cuenta (para escribir hay que entrar).
async function chatGeneralAnonimo() {
  const { getStore } = await import('./store.js');
  const raw = await getStore().lrange('chat:general', 0, 59);
  return raw.map((r) => JSON.parse(r)).reverse().map(({ de, ...m }) => m);
}
