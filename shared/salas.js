// Motor de salas multijugador para Vercel (sin WebSockets): lo usan memes, casino y carrera.
// Cada juego define sus reglas y el motor se encarga de lo común:
//  - guardar la sala en Redis con un candado (dos acciones a la vez no se pisan)
//  - presencia (quién está conectado), chat, eventos con número y "tick" para los tiempos
//  - la API: crear sala, lobby y la consulta de cada navegador (GET novedades / POST acción)
//
// Definición de un juego:
//   id            'memes'
//   nueva(opts, ctx)        → campos propios de la sala nueva
//   unirse(r, jugador, ctx) → (opcional) qué pasa cuando alguien entra
//   accion(r, msg, ctx)     → aplica una acción; puede devolver { error }
//   proximo(r, ctx)         → (opcional) cuándo hay que intervenir (timestamp) o Infinity
//   tick(r, ctx)            → (opcional) lo que pasa con el tiempo (fases, bots, timers)
//   vista(r, ctx)           → lo que ve cada jugador (puede ocultar datos)
//   lobby(r, ctx)           → (opcional) resumen para la lista de salas, o null
//   despues(r, antes, ctx)  → (opcional, async) al guardar: historial, saldos…
//   rutas(ruta, request, util) → (opcional, async) rutas extra de la API
import { limpiarLook } from './public/look.js';
import { getStore } from './store.js';
import { usuarioActual, anotarJuntos } from './cuenta.js';
import { json, readJson, serverError, subruta } from './http.js';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ONLINE_MS = 15_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const limpiarNombre = (n) => String(n ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20) || 'Invitado';
export const limpiarPid = (p) => (/^[A-Za-z0-9_-]{8,64}$/.test(String(p ?? '')) ? String(p) : null);
export const limpiarCodigo = (c) => {
  const s = String(c ?? '').toUpperCase();
  return /^[A-Z0-9-]{3,16}$/.test(s) ? s : null;
};
export const azar = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
export const entero = (n) => Math.floor(azar() * n);
export function mezclar(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = entero(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function crearJuego(def) {
  const id = def.id;
  const clave = (code) => `sala:${id}:${code}`;
  const candado = (code) => `lock:${id}:${code}`;
  const presKey = (code) => `pres:${id}:${code}`;
  const LOBBY = `lobby:${id}`;
  const TTL = def.ttl || 3 * 24 * 3600;
  const MAX_EV = def.maxEventos || 200;

  // ---------------------------------------------------------- guardar / leer
  async function cargar(code) {
    const raw = await getStore().get(clave(code));
    return raw ? JSON.parse(raw) : null;
  }

  async function presencia(code) {
    const all = await getStore().hgetall(presKey(code));
    const out = {};
    for (const [p, ts] of Object.entries(all)) out[p] = Number(ts);
    return out;
  }
  const enLinea = (pres, now) => new Set(Object.entries(pres).filter(([, ts]) => now - ts < ONLINE_MS).map(([p]) => p));
  const tocar = (code, pid) => getStore().hset(presKey(code), pid, String(Date.now()), 3600);

  function contexto(r, extra) {
    const ctx = {
      now: Date.now(),
      ...extra,
      evento(e) {
        r.evSeq = (r.evSeq || 0) + 1;
        r.ev.push({ ...e, id: r.evSeq, ts: Date.now() });
        if (r.ev.length > MAX_EV) r.ev.splice(0, r.ev.length - MAX_EV);
      },
      sistema(texto) {
        ctx.evento({ k: 'chat', sistema: true, texto });
      },
    };
    ctx.online = enLinea(ctx.pres || {}, ctx.now);
    return ctx;
  }

  async function nuevaSala({ code, pid, nombre, uid, opciones }) {
    const r = {
      code,
      juego: id,
      host: pid,
      jugadores: {},
      ev: [],
      evSeq: 0,
      rev: 1,
      creada: Date.now(),
      publica: !!opciones?.publica,
    };
    const ctx = contexto(r, { pid, pres: {} });
    Object.assign(r, def.nueva(opciones || {}, ctx));
    if (pid) agregarJugador(r, pid, { nombre, uid }, ctx);
    return r;
  }

  function agregarJugador(r, pid, { nombre, uid, look }, ctx) {
    const ya = r.jugadores[pid];
    if (ya) {
      ya.nombre = nombre;
      if (uid) ya.uid = uid;
      if (look) ya.look = limpiarLook(look);
      return ya;
    }
    const j = { pid, nombre, uid: uid || undefined, unido: Date.now(), look: look ? limpiarLook(look) : undefined };
    r.jugadores[pid] = j;
    def.unirse?.(r, j, ctx);
    return j;
  }

  async function crear({ pid, nombre, uid, opciones, code: fijo }) {
    const store = getStore();
    for (let i = 0; i < 8; i++) {
      const code = fijo || Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => ALFABETO[b % ALFABETO.length]).join('');
      const r = await nuevaSala({ code, pid, nombre, uid, opciones });
      if (await store.setNX(clave(code), JSON.stringify(r), TTL * 1000)) {
        if (pid) await tocar(code, pid);
        await actualizarLobby(r, pid ? { [pid]: Date.now() } : {});
        return r;
      }
      if (fijo) return cargar(fijo);
    }
    throw new Error('No se pudo crear la sala');
  }

  // Lee, aplica fn y guarda con candado. fn(r, ctx) puede devolver { error }.
  async function mutar(code, fn, extra = {}) {
    const store = getStore();
    const token = crypto.randomUUID();
    let ok = false;
    for (let i = 0; i < 80 && !ok; i++) {
      ok = await store.setNX(candado(code), token, 4000);
      if (!ok) await sleep(25 + Math.random() * 35);
    }
    if (!ok) return { error: 'La sala está ocupada, probá de nuevo' };
    try {
      const r = await cargar(code);
      if (!r) return { noExiste: true };
      const pres = await presencia(code);
      const antesTxt = JSON.stringify(r);
      const antes = JSON.parse(antesTxt);
      const ctx = contexto(r, { pres, ...extra });
      const res = (await fn(r, ctx)) || {};
      if (JSON.stringify(r) !== antesTxt) {
        r.rev = (r.rev || 0) + 1;
        await store.set(clave(code), JSON.stringify(r), TTL);
        await actualizarLobby(r, pres);
        if (def.despues) await def.despues(r, antes, ctx);
      }
      return { ...res, r, pres };
    } finally {
      if ((await store.get(candado(code))) === token) await store.del(candado(code));
    }
  }

  // ---------------------------------------------------------- lobby
  async function actualizarLobby(r, pres) {
    if (!def.lobby) return;
    const ctx = contexto(r, { pres });
    const resumen = def.lobby(r, ctx);
    if (!resumen) return getStore().hdel(LOBBY, [r.code]);
    await getStore().hset(LOBBY, r.code, JSON.stringify({ code: r.code, ...resumen, online: [...ctx.online].length, act: Date.now() }));
  }

  async function listarLobby() {
    const store = getStore();
    const all = await store.hgetall(LOBBY);
    const now = Date.now();
    const lista = [];
    const viejas = [];
    for (const [code, raw] of Object.entries(all)) {
      let s;
      try {
        s = JSON.parse(raw);
      } catch {
        viejas.push(code);
        continue;
      }
      if (now - s.act > 6 * 3600_000) viejas.push(code);
      else if (now - s.act < 60_000 && s.online > 0) lista.push(s);
    }
    if (viejas.length) await store.hdel(LOBBY, viejas);
    return lista.sort((a, b) => b.act - a.act).slice(0, 60);
  }

  // ---------------------------------------------------------- lo que recibe cada navegador
  function mensaje(r, pid, pres, { cursor = null, h = null, primera = false } = {}) {
    const now = Date.now();
    const ctx = contexto(r, { pid, pres, jugador: pid ? r.jugadores[pid] : null });
    const jugadores = Object.values(r.jugadores).map((j) => ({ id: idPublico(j.pid), nombre: j.nombre, online: ctx.online.has(j.pid), cuenta: !!j.uid, look: j.look || null }));
    const estado = { code: r.code, host: idPublico(r.host), yo: pid ? idPublico(pid) : null, jugadores, ...def.vista(r, ctx) };
    const hs = hash(JSON.stringify(estado));
    const eventos = [];
    for (const e of r.ev) {
      if (!primera && cursor != null && e.id <= cursor) continue;
      if (primera && e.k !== 'chat') continue; // al entrar: solo el historial del chat
      if (e.para && !e.para.includes(pid)) continue;
      const { para, ...pub } = e;
      eventos.push(pub);
    }
    return { estado: primera || hs !== h ? estado : null, eventos, cursor: r.evSeq || 0, h: hs, now };
  }

  async function encuesta(request, code, body, url) {
    const q = body || Object.fromEntries(url.searchParams);
    const pid = limpiarPid(q.pid);
    const cursor = q.cursor === undefined || q.cursor === null || q.cursor === '' ? null : Number(q.cursor);
    const msg = body?.msg || null;
    if (!code) return json({ noExiste: true }, 404);
    if (pid && (q.ping || msg)) await tocar(code, pid);

    let r = await cargar(code);
    if (!r && def.publicas?.[code]) r = await crear({ code, opciones: { ...def.publicas[code], publica: true } });
    if (!r) return json({ noExiste: true }, 404);
    let pres = await presencia(code);
    let error;

    if (msg && pid) {
      const u = msg.t === 'join' ? await usuarioActual(request) : null;
      const res = await mutar(code, async (rm, ctx) => {
        if (msg.t === 'join') {
          // el personaje: el de la cuenta, o el que trae el navegador
          agregarJugador(rm, pid, { nombre: u?.nombre || limpiarNombre(msg.nombre), uid: u?.id, look: u?.look || msg.look || null }, ctx);
          if (!rm.host || !rm.jugadores[rm.host]) rm.host = pid;
          return {};
        }
        const jugador = rm.jugadores[pid];
        if (msg.t === 'chat') {
          const texto = String(msg.texto ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 280);
          if (texto && jugador) ctx.evento({ k: 'chat', de: idPublico(pid), nombre: jugador.nombre, texto });
          return {};
        }
        if (!jugador) return { error: 'Entrá a la sala primero' };
        return def.accion(rm, msg, { ...ctx, pid, jugador, esHost: rm.host === pid });
      });
      if (res.noExiste) return json({ noExiste: true }, 404);
      error = res.error;
      if (res.r) ({ r, pres } = res);
      // para "jugaste hace poco": quiénes con cuenta compartieron esta sala
      if (msg.t === 'join' && u && res.r) await anotarJuntos([u.id, ...Object.values(res.r.jugadores).map((j) => j.uid)]).catch(() => {});
    }

    const now = Date.now();
    if (def.tick && now >= (def.proximo ? def.proximo(r, contexto(r, { pres })) : now)) {
      const res = await mutar(code, (rm, ctx) => def.tick(rm, ctx));
      if (res.r) ({ r, pres } = res);
    } else if (pid && r.jugadores[pid] && azar() < 0.1) {
      await actualizarLobby(r, pres);
    }
    const out = mensaje(r, pid, pres, { cursor, h: q.h || null, primera: msg?.t === 'join' });
    if (error) out.error = error;
    if (def.extra) Object.assign(out, await def.extra(r, pid));
    return json(out);
  }

  // ---------------------------------------------------------- API: /api/<id>/…
  async function handle(request) {
    try {
      const ruta = subruta(request, [`/api/${id}`]);
      const url = new URL(request.url);
      if (ruta === '/crear' && request.method === 'POST') {
        const b = await readJson(request);
        const pid = limpiarPid(b.pid);
        if (!pid) return json({ error: 'Identificador inválido' }, 400);
        const u = await usuarioActual(request);
        const r = await crear({ pid, nombre: u?.nombre || limpiarNombre(b.nombre), uid: u?.id, opciones: b.opciones || {} });
        return json({ code: r.code });
      }
      if (ruta === '/lobby' && request.method === 'GET') {
        return json({ salas: await listarLobby() }, 200, { 'access-control-allow-origin': '*' });
      }
      const m = ruta.match(/^\/salas\/([A-Za-z0-9-]{3,16})$/);
      if (m) return await encuesta(request, limpiarCodigo(m[1]), request.method === 'POST' ? await readJson(request) : null, url);
      if (def.rutas) {
        const res = await def.rutas(ruta, request, { json, readJson, usuarioActual, limpiarPid });
        if (res) return res;
      }
      return json({ error: 'No encontrado' }, 404);
    } catch (e) {
      return serverError(e);
    }
  }

  return { handle, crear, cargar, mutar, presencia, tocar, listarLobby, mensaje };
}

// Los pid son secretos (sirven para reclamar tu asiento): afuera se muestra un id derivado.
export function idPublico(pid) {
  if (!pid) return null;
  return hash('cadalado:' + pid);
}
