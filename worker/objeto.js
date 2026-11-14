// El Durable Object de cadalado. Hay uno por sala ('royale:ABCDE', 'truco:XYZ12', 'ajedrez:abc123…')
// y uno para todo el club ('club': cuentas, fichas, tienda, lobbys, muro, chats).
//
// Corre el mismo código de siempre (los manejadores de /api) con un almacén propio en vez de Redis, y
// suma WebSockets: en vez de que cada navegador pregunte cada segundo, el objeto le avisa cuando algo cambia.
// Para no reescribir los juegos, el aviso se arma corriendo, por cada jugador conectado, la misma consulta
// que hacía su navegador (con su cursor): si trae novedades, se la manda.
import { DurableObject } from 'cloudflare:workers';
import { AsyncLocalStorage } from 'node:async_hooks';
import { usarAlmacen } from '../shared/store.js';
import { avisos as avisosGrupo } from '../shared/grupos.js';
import { idPublico } from '../shared/salas.js';
import { AlmacenLocal, almacenRuteado, OPERACIONES } from './almacen.js';
import { handle as royale } from '../games/royale/api.js';
import { handle as carrera } from '../games/carrera/api.js';
import { handle as casino } from '../games/casino/api.js';
import { handle as memes } from '../games/memes/api.js';
import { handle as haxball } from '../games/haxball/api.js';
import { handle as pelea } from '../games/pelea/api.js';
import { handle as futbol } from '../games/futbol/api.js';
import { handle as empujon } from '../games/empujon/api.js';
import { handle as truco } from '../games/truco/api.js';
import { handle as ajedrez } from '../games/chessort/api.js';
import { handle as club } from '../shared/club-api.js';

// Cada pedido corre con el almacén (y el objeto) que le toca, aunque varios objetos compartan la máquina.
const contexto = new AsyncLocalStorage();
usarAlmacen(() => contexto.getStore()?.store);
avisosGrupo.alCambiar = (g) => contexto.getStore()?.objeto?.avisarGrupo(g);

const API = [['/api/royale/', royale], ['/api/carrera/', carrera], ['/api/casino/', casino], ['/api/memes/', memes], ['/api/haxball/', haxball], ['/api/pelea/', pelea], ['/api/futbol/', futbol], ['/api/empujon/', empujon], ['/api/truco/', truco], ['/ajedrez/api/', ajedrez], ['/api/club/', club]];
const JUEGOS_SALA = new Set(['memes', 'casino', 'carrera', 'royale', 'haxball', 'pelea', 'futbol', 'empujon']);
// Con gente conectada la sala avanza sola cada segundo (bots, tiempos, tormenta…). Si nadie hace nada
// (ninguna acción) por un rato, más despacio: cada alarma es un pedido y el plan gratis tiene un tope por día.
const tickMs = (quieta) => (quieta > 30 * 60_000 ? 30_000 : quieta > 5 * 60_000 ? 5000 : 1000);

// Qué consulta hace el navegador en cada tipo de sala (la misma de siempre).
function consultaDe(nombre) {
  const i = nombre.indexOf(':');
  const tipo = nombre.slice(0, i), code = nombre.slice(i + 1);
  if (JUEGOS_SALA.has(tipo)) return `/api/${tipo}/salas/${code}`;
  if (tipo === 'truco') return `/api/truco/rooms/${code}/poll`;
  if (tipo === 'ajedrez') return `/ajedrez/api/game/${code}`;
  return null;
}

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
// lo que cambia aunque no haya pasado nada (la hora del servidor) no cuenta como novedad
const sinHora = (r) => JSON.stringify(r, (k, v) => (k === 'now' || k === 'serverNow' ? undefined : v));

export class Objeto extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // las claves del panel de Cloudflare (secretos o variables) también quedan a mano para el código común
    for (const k of ['ADMIN_CLAVE', 'CLUB_ADMINS']) if (env[k] && !process.env[k]) process.env[k] = String(env[k]);
    this.local = new AlmacenLocal(ctx.storage);
    this.nombre = null;
    this.firmasGrupo = new Map();
    ctx.blockConcurrencyWhile(async () => {
      this.nombre = (await ctx.storage.get('__nombre')) || null;
      if (this.nombre) this.prepararAlmacen();
    });
  }

  // El nombre lo trae cada pedido (el Worker o el objeto que llama); se guarda para las alarmas.
  async conocer(nombre) {
    if (!nombre || this.nombre === nombre) return;
    this.nombre = nombre;
    this.prepararAlmacen();
    await this.ctx.storage.put('__nombre', nombre);
  }
  prepararAlmacen() {
    this.store = almacenRuteado({
      propio: this.nombre,
      local: this.local,
      remoto: (dueno, op, args) => this.env.OBJETOS.get(this.env.OBJETOS.idFromName(dueno)).almacen(dueno, op, args),
    });
    this.consulta = consultaDe(this.nombre);
  }

  // Otro objeto le pide un dato que vive acá.
  async almacen(nombre, op, args) {
    await this.conocer(nombre);
    if (!OPERACIONES.includes(op)) throw new Error('operación desconocida');
    return this.local[op](...args);
  }

  // Corre un manejador de /api con el almacén de este objeto.
  correr(request) {
    const path = new URL(request.url).pathname;
    const h = API.find(([p]) => path.startsWith(p))?.[1];
    if (!h) return Response.json({ error: 'No encontrado' }, { status: 404 });
    return contexto.run({ store: this.store, objeto: this }, () => h(request));
  }

  async fetch(request) {
    await this.conocer(request.headers.get('x-objeto'));
    if (request.headers.get('upgrade') === 'websocket') return this.abrirSocket(request);
    if (this.nombre === 'club' && new URL(request.url).pathname === '/api/club/importar') return this.importar(request);
    if (this.consulta && request.method === 'POST') await this.marcarAccion();
    const res = await this.correr(request);
    if (this.consulta) this.programarAviso(); // lo que cambió por HTTP también se avisa a los conectados
    // le dice al navegador que acá hay WebSocket (en Vercel no viene y se sigue consultando)
    const r = new Response(res.body, res);
    r.headers.set('x-cadalado-ws', '1');
    return r;
  }

  // ------------------------------------------------------------ WebSockets
  abrirSocket(request) {
    const url = new URL(request.url);
    const { 0: cliente, 1: servidor } = new WebSocketPair();
    this.ctx.acceptWebSocket(servidor);
    const pid = String(url.searchParams.get('pid') || '').slice(0, 64);
    servidor.serializeAttachment({
      q: { pid },
      cookie: (request.headers.get('cookie') || '').slice(0, 600),
      ip: request.headers.get('cf-connecting-ip') || '',
      ultimo: 0,
      grupo: null,
    });
    if (this.consulta) this.marcarAccion().catch(() => {}); // alguien que llega cuenta como movimiento
    return new Response(null, { status: 101, webSocket: cliente });
  }

  pedidoInterno(a, ruta, { metodo = 'GET', query = null, cuerpo = null } = {}) {
    const url = new URL('https://cadalado.interno' + ruta);
    if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    const headers = { cookie: a.cookie || '', 'cf-connecting-ip': a.ip || '' };
    if (cuerpo) headers['content-type'] = 'application/json';
    return new Request(url, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  }

  // Después de una respuesta, el cursor del jugador queda donde lo dejó esa respuesta.
  avanzar(a, r) {
    if (!r || typeof r !== 'object') return;
    if (r.cursor !== undefined && r.cursor !== null) a.q.cursor = r.cursor;
    if (r.h) a.q.h = r.h;
  }

  async webSocketMessage(ws, data) {
    let m;
    try {
      m = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data));
    } catch {
      return;
    }
    const a = ws.deserializeAttachment() || { q: {} };

    // Plan B de posiciones: se reenvía al resto en el momento (no se guarda nada)
    if (typeof m.pos === 'string' && m.pos.length <= 2400 && a.q.pid) {
      const msg = JSON.stringify({ pos: { [idPublico(a.q.pid)]: m.pos } });
      for (const otro of this.ctx.getWebSockets()) if (otro !== ws) try { otro.send(msg); } catch {}
      return;
    }
    if (m.hola && typeof m.hola === 'object') {
      for (const k of ['pid', 'cursor', 'h']) if (m.hola[k] !== undefined && m.hola[k] !== null && m.hola[k] !== '') a.q[k] = String(m.hola[k]).slice(0, 80);
      ws.serializeAttachment(a);
    }
    if (m.id !== undefined) {
      let s = 500, r = { error: 'No se pudo completar la operación.' };
      try {
        // En una sala, la consulta es siempre la de esa sala; en el club, cualquier ruta del club.
        let ruta = this.consulta;
        if (!ruta) {
          ruta = String(m.ruta || '');
          if (!/^\/api\/club\/[a-z0-9/-]*$/.test(ruta) || ruta.startsWith('/api/club/ws')) throw new Error('ruta');
        }
        const metodo = m.m === 'POST' ? 'POST' : 'GET';
        if (metodo === 'POST' && this.consulta) await this.marcarAccion();
        const res = await this.correr(this.pedidoInterno(a, ruta, metodo === 'GET' ? { query: m.q || a.q } : { metodo, query: m.q, cuerpo: m.b || {} }));
        s = res.status;
        r = await res.json().catch(() => null);
        if (this.consulta) this.avanzar(a, r);
        if (!this.consulta && ruta === '/api/club/grupo' && r?.grupo?.id) a.grupo = r.grupo.id;
        ws.serializeAttachment(a);
      } catch (e) {
        if (e?.message !== 'ruta') console.error(e);
      }
      try { ws.send(JSON.stringify({ id: m.id, s, r })); } catch {}
    }
    if (this.consulta) this.programarAviso();
  }

  async webSocketClose(ws, code) {
    try { ws.close(code === 1005 ? 1000 : code); } catch {}
  }
  async webSocketError() {}

  // ------------------------------------------------------------ avisos a los conectados de la sala
  programarAviso() {
    if (this.avisoProgramado) return;
    this.avisoProgramado = setTimeout(() => {
      this.avisoProgramado = null;
      this.avisar().catch((e) => console.error(e));
    }, 25);
  }

  async avisar() {
    if (this.avisando) return void (this.otraVuelta = true);
    this.avisando = true;
    try {
      do {
        this.otraVuelta = false;
        for (const ws of this.ctx.getWebSockets()) {
          const a = ws.deserializeAttachment();
          if (!a?.q?.pid) continue;
          const res = await this.correr(this.pedidoInterno(a, this.consulta, { query: { ...a.q, ping: 1 } }));
          const r = await res.json().catch(() => null);
          if (!r) continue;
          let nuevo;
          if ('estado' in r || 'eventos' in r) nuevo = r.estado != null || r.eventos?.length > 0;
          else if ('msgs' in r) nuevo = r.msgs.length > 0;
          else {
            const h = hash(sinHora(r));
            nuevo = h !== a.ultimo;
            a.ultimo = h;
          }
          nuevo ||= !!r.error || !!r.noExiste || res.status >= 400;
          this.avanzar(a, r);
          ws.serializeAttachment(a);
          if (nuevo) try { ws.send(JSON.stringify({ p: r, s: res.status })); } catch {}
        }
      } while (this.otraVuelta);
    } finally {
      this.avisando = false;
    }
  }

  async marcarAccion() {
    const antes = this.ultimaAccion || 0;
    this.ultimaAccion = Date.now();
    // se guarda cada tanto (para las alarmas después de que el objeto se duerma)
    if (this.ultimaAccion - antes > 60_000) await this.ctx.storage.put('__accion', this.ultimaAccion);
    // si la sala estaba lenta, la próxima vuelta es ya
    const alarma = await this.ctx.storage.getAlarm();
    if (!alarma || alarma - Date.now() > 1500) await this.ctx.storage.setAlarm(Date.now() + 200);
  }

  async asegurarAlarma() {
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + 1000);
  }
  // Mientras haya alguien conectado, la sala avanza sola (los juegos hacen sus "ticks" en las consultas).
  async alarm() {
    if (!this.consulta || !this.ctx.getWebSockets().length) return;
    await this.avisar();
    const ultima = this.ultimaAccion || (await this.ctx.storage.get('__accion')) || 0;
    await this.ctx.storage.setAlarm(Date.now() + tickMs(Date.now() - ultima));
  }

  // ------------------------------------------------------------ club: traer los datos de Redis (una sola vez)
  // scripts/migrar-upstash.mjs manda los datos en tandas; solo con la clave secreta IMPORTAR_CLAVE.
  async importar(request) {
    const clave = this.env.IMPORTAR_CLAVE;
    if (request.method !== 'POST' || !clave || request.headers.get('x-importar-token') !== clave) return Response.json({ error: 'No autorizado' }, { status: 403 });
    const { entradas = [] } = await request.json().catch(() => ({}));
    let n = 0;
    for (const { k, e } of entradas) {
      if (typeof k !== 'string' || !e || typeof e !== 'object' || !('v' in e)) continue;
      await this.local.guardar(k, { v: e.v, exp: Number(e.exp) || 0 });
      n++;
    }
    return Response.json({ ok: n });
  }

  // ------------------------------------------------------------ club: avisos de lobbys
  // Se avisa solo si cambió algo que se ve (no por el "sigo acá" de cada miembro).
  avisarGrupo(g) {
    const firma = hash(JSON.stringify({ ...g, miembros: g.miembros.map(({ visto, ...m }) => m) }));
    if (this.firmasGrupo.get(g.id) === firma) return;
    this.firmasGrupo.set(g.id, firma);
    if (this.firmasGrupo.size > 5000) this.firmasGrupo.clear();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.deserializeAttachment()?.grupo === g.id) try { ws.send(JSON.stringify({ aviso: 'grupo' })); } catch {}
    }
  }
}
