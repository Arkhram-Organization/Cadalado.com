// API del truco: /api/truco/…
//   POST /rooms                 crear sala           POST /quick   partida rápida
//   GET  /lobby                 salas públicas       GET  /rooms/:code   info de una sala
//   GET  /rooms/:code/poll      novedades de la sala (lo usa public/js/polling-socket.js)
//   POST /rooms/:code/poll      mandar una acción y recibir novedades
import { json, readJson, serverError, subruta } from '../../shared/http.js';
import { usuarioActual } from '../../shared/cuenta.js';
import * as sala from './lib/sala.js';

const MODES = ['1v1', '2v2', '3v3'];

export async function handle(request) {
  try {
    const ruta = subruta(request, ['/api/truco']);
    const metodo = request.method;
    const url = new URL(request.url);

    if (ruta === '/rooms' && metodo === 'POST') {
      const b = await readJson(request);
      const pid = sala.cleanPid(b.pid);
      if (!pid) return json({ error: 'pid inválido' }, 400);
      const u = await usuarioActual(request);
      const code = await sala.crearSala({
        mode: MODES.includes(b.mode) ? b.mode : '1v1',
        target: Number(b.target) === 15 ? 15 : 30,
        ayudas: !!b.ayudas,
        isPublic: !!b.isPublic,
        pid,
        name: u?.nombre || b.name,
        uid: u?.id,
      });
      return json({ code });
    }
    if (ruta === '/quick' && metodo === 'POST') {
      const b = await readJson(request);
      const pid = sala.cleanPid(b.pid);
      if (!pid) return json({ error: 'pid inválido' }, 400);
      const mode = MODES.includes(b.mode) ? b.mode : '1v1';
      const found = await sala.buscarRapida(mode);
      if (found) return json({ code: found, joined: true });
      const u = await usuarioActual(request);
      const code = await sala.crearSala({ mode, target: 30, ayudas: false, isPublic: true, pid, name: u?.nombre || b.name, uid: u?.id });
      return json({ code, joined: false });
    }
    if (ruta === '/lobby' && metodo === 'GET') {
      return json(await sala.listarLobby(), 200, { 'access-control-allow-origin': '*' });
    }
    const info = ruta.match(/^\/rooms\/([A-Za-z0-9]{5})$/);
    if (info && metodo === 'GET') return json(sala.info(await sala.cargar(sala.cleanCode(info[1]))));

    const poll = ruta.match(/^\/rooms\/([A-Za-z0-9]{5})\/poll$/);
    if (poll) return await encuesta(request, sala.cleanCode(poll[1]), metodo === 'POST' ? await readJson(request) : null, url);

    return json({ error: 'No encontrado' }, 404);
  } catch (e) {
    return serverError(e);
  }
}

async function encuesta(request, code, body, url) {
  const q = body || Object.fromEntries(url.searchParams);
  const pid = sala.cleanPid(q.pid);
  const cursor = q.cursor === undefined || q.cursor === null || q.cursor === '' ? null : Number(q.cursor);
  const msg = body?.msg || null;
  if (!code) return json({ msgs: [{ t: 'notfound' }] }, 404);
  if (pid && (q.ping || msg)) await sala.tocarPresencia(code, pid);

  let r = await sala.cargar(code);
  if (!r) return json({ msgs: [{ t: 'notfound' }] }, 404);
  let pres = await sala.presencia(code);
  const errores = [];

  if (msg && pid) {
    const u = msg.t === 'join' || msg.t === 'sit' || String(msg.t).startsWith('apuesta-') ? await usuarioActual(request) : null;
    const res = await sala.mutar(code, (rm, ctx) => sala.accion(rm, msg, { pid, uid: u?.id, nombreCuenta: u?.nombre, ...ctx }));
    if (res.notfound) return json({ msgs: [{ t: 'notfound' }] }, 404);
    if (res.error) errores.push({ t: 'error', msg: res.error });
    if (res.r) ({ r, pres } = res);
  }
  // Lo que antes hacía la alarma: bots, pausas entre manos y tiempos.
  const now = Date.now();
  if (now >= sala.proximoTick(r, now, pres)) {
    const res = await sala.mutar(code, (rm, ctx) => sala.tick(rm, ctx.now, ctx.pres));
    if (res.r) ({ r, pres } = res);
  } else if (pid && sala.seatOf(r, pid) != null && Math.random() < 0.15) {
    await sala.actualizarLobby(r, pres); // refresca "online" del lobby de vez en cuando
  }
  const out = sala.mensajes(r, pid, pres, { cursor, h: q.h || null, join: msg?.t === 'join' });
  out.msgs.push(...errores);
  return json(out);
}
