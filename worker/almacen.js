// Almacenamiento en Cloudflare: reemplaza a Redis con la misma interfaz (get, set, setNX, hset…).
// Cada dato vive en el Durable Object que le corresponde: lo de una sala, en el objeto de esa sala
// (así las consultas del juego no salen de la memoria), y todo lo demás (cuentas, fichas, tienda, lobbys,
// muro), en el objeto del club. El código de los juegos no se entera: usa getStore() como siempre.

// ¿A qué objeto pertenece una clave?
export function destinoDe(clave) {
  let m;
  if ((m = /^(?:sala|lock|pres|pos):(memes|casino|carrera|royale|haxball|pelea|futbol|empujon):([A-Za-z0-9-]+)$/.exec(clave))) return `${m[1]}:${m[2].toUpperCase()}`;
  if ((m = /^(?:lock:|pres:)?truco:([A-Za-z0-9]+)$/.exec(clave))) return `truco:${m[1].toUpperCase()}`;
  if ((m = /^(?:room|lock|pres):([a-z0-9]{4,16})$/.exec(clave))) return `ajedrez:${m[1]}`;
  return 'club';
}
// Candados, presencia y posiciones duran segundos: viven solo en memoria (no gastan escrituras).
const SOLO_MEMORIA = /^(lock|pres|pos):/;

// ---------------------------------------------------------------- almacén local (en el propio objeto)
// Memoria + la base del Durable Object (SQLite). Lo que se lee se trae una vez y queda en memoria;
// lo que se escribe se guarda enseguida (salvo lo que es solo de memoria).
export class AlmacenLocal {
  constructor(storage) {
    this.storage = storage;
    this.mem = new Map(); // clave → { v, exp } | null (no existe)
  }

  async entrada(k) {
    let e = this.mem.get(k);
    if (e === undefined) {
      e = SOLO_MEMORIA.test(k) ? null : (await this.storage.get(k)) ?? null;
      if (this.mem.size > 20000) this.mem.clear(); // por las dudas (el club guarda mucho)
      this.mem.set(k, e);
    }
    if (e && e.exp && e.exp < Date.now()) {
      this.mem.set(k, null);
      if (!SOLO_MEMORIA.test(k)) await this.storage.delete(k);
      return null;
    }
    return e;
  }
  async guardar(k, e) {
    this.mem.set(k, e);
    if (SOLO_MEMORIA.test(k)) return;
    if (e) await this.storage.put(k, e);
    else await this.storage.delete(k);
  }
  vence(ttlSec) {
    return ttlSec ? Date.now() + ttlSec * 1000 : 0;
  }

  async get(k) {
    return (await this.entrada(k))?.v ?? null;
  }
  async set(k, v, ttlSec) {
    await this.guardar(k, { v: String(v), exp: this.vence(ttlSec) });
  }
  async setNX(k, v, ttlMs) {
    if (await this.entrada(k)) return false;
    await this.guardar(k, { v: String(v), exp: Date.now() + ttlMs });
    return true;
  }
  async del(k) {
    this.mem.set(k, null);
    if (!SOLO_MEMORIA.test(k)) await this.storage.delete(k);
  }
  async hset(k, campo, valor, ttlSec) {
    const e = (await this.entrada(k)) || { v: {}, exp: 0 };
    const nueva = { v: { ...e.v, [campo]: String(valor) }, exp: ttlSec ? this.vence(ttlSec) : e.exp };
    await this.guardar(k, nueva);
  }
  async hgetall(k) {
    return { ...((await this.entrada(k))?.v || {}) };
  }
  async hget(k, campo) {
    return (await this.entrada(k))?.v?.[campo] ?? null;
  }
  async hdel(k, campos) {
    const e = await this.entrada(k);
    if (!e || !campos.length) return;
    const v = { ...e.v };
    for (const c of campos) delete v[c];
    await this.guardar(k, Object.keys(v).length ? { v, exp: e.exp } : null);
  }
  async lpush(k, valor, max, ttlSec) {
    const e = (await this.entrada(k)) || { v: [], exp: 0 };
    const v = [String(valor), ...e.v];
    if (max) v.length = Math.min(v.length, max);
    await this.guardar(k, { v, exp: ttlSec ? this.vence(ttlSec) : e.exp });
  }
  async lrange(k, desde, hasta) {
    const l = (await this.entrada(k))?.v || [];
    return l.slice(desde, hasta === -1 ? undefined : hasta + 1);
  }
  async incr(k, ttlSec) {
    const e = await this.entrada(k);
    const n = Number(e?.v || 0) + 1;
    await this.guardar(k, { v: String(n), exp: ttlSec ? this.vence(ttlSec) : e?.exp || 0 });
    return n;
  }
  async incrby(k, n) {
    const e = await this.entrada(k);
    const total = Number(e?.v || 0) + Number(n);
    await this.guardar(k, { v: String(total), exp: e?.exp || 0 });
    return total;
  }
  async ping() {
    return 'PONG';
  }
}

export const OPERACIONES = ['get', 'set', 'setNX', 'del', 'hset', 'hgetall', 'hget', 'hdel', 'lpush', 'lrange', 'incr', 'incrby', 'ping'];

// ---------------------------------------------------------------- almacén con ruteo
// Lo que es de este objeto se resuelve acá; lo de otro, se le pide por la red interna de Cloudflare.
export function almacenRuteado({ propio, local, remoto }) {
  const store = {};
  for (const op of OPERACIONES) {
    store[op] = (clave, ...args) => {
      const dueno = op === 'ping' ? propio : destinoDe(clave);
      if (dueno === propio) return local[op](clave, ...args);
      if (op === 'hset' && esResumenDeLobby(clave) && !hayQueMandar(clave, args[0], args[1])) return Promise.resolve();
      return remoto(dueno, op, [clave, ...args]);
    };
  }
  return store;
}

// Las salas actualizan su resumen en la lista de salas abiertas muy seguido (casi en cada consulta).
// Esa lista vive en el club: se le manda solo si cambió algo que se ve, o cada 15 s (para que siga "viva").
const LISTAS_DE_LOBBY = /^(lobby:[a-z]+|lobby:truco|chessort:lobby|lobby)$/;
const esResumenDeLobby = (clave) => LISTAS_DE_LOBBY.test(clave);
const ultimosResumenes = new Map();
const HORAS = new Set(['act', 'updatedAt', 'seenAt', 'ts', 'now']);
function hayQueMandar(clave, campo, valor) {
  let firma = String(valor);
  try {
    firma = JSON.stringify(JSON.parse(valor), (k, v) => (HORAS.has(k) ? undefined : v));
  } catch {}
  const id = clave + '|' + campo;
  const antes = ultimosResumenes.get(id);
  if (antes && antes.firma === firma && Date.now() - antes.t < 15_000) return false;
  if (ultimosResumenes.size > 5000) ultimosResumenes.clear();
  ultimosResumenes.set(id, { firma, t: Date.now() });
  return true;
}
