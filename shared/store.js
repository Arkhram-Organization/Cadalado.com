// Almacenamiento compartido por todo cadalado (partidas, cuentas, chats). Usa lo primero que encuentre:
// 1. Upstash por HTTP: KV_REST_API_URL + KV_REST_API_TOKEN (o UPSTASH_REDIS_REST_URL + _TOKEN).
// 2. Redis común: REDIS_URL o KV_URL.
//    (Las variables las crea Vercel al conectar Redis/Upstash en la pestaña Storage.)
// 3. En tu compu sin nada de eso: memoria (sirve para probar con `npm run dev`).
import { createClient } from 'redis';

const env = process.env;
const REST_URL = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '';
const REST_TOKEN = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || '';
const REDIS_URL = env.REDIS_URL || env.KV_URL || '';

export class StoreNotConfigured extends Error {}

// ---------- Upstash REST (HTTP: ideal para funciones serverless) ----------
async function rest(...command) {
  const res = await fetch(REST_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${REST_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(command.map(String)),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`Redis (HTTP ${res.status}): ${data.error || 'respuesta inválida'}`);
  return data.result;
}

const restStore = {
  get: (key) => rest('GET', key),
  async set(key, value, ttlSec) {
    if (ttlSec) await rest('SET', key, value, 'EX', ttlSec);
    else await rest('SET', key, value);
  },
  async setNX(key, value, ttlMs) {
    return (await rest('SET', key, value, 'NX', 'PX', ttlMs)) === 'OK';
  },
  async del(key) {
    await rest('DEL', key);
  },
  async hset(key, field, value, ttlSec) {
    await rest('HSET', key, field, value);
    if (ttlSec) await rest('EXPIRE', key, ttlSec);
  },
  async hgetall(key) {
    const res = (await rest('HGETALL', key)) || [];
    if (!Array.isArray(res)) return res; // por si llega como objeto
    const obj = {}; // Upstash lo devuelve como lista plana: [campo, valor, campo, valor…]
    for (let i = 0; i < res.length; i += 2) obj[res[i]] = res[i + 1];
    return obj;
  },
  async hdel(key, fields) {
    if (fields.length) await rest('HDEL', key, ...fields);
  },
  async lpush(key, value, max, ttlSec) {
    await rest('LPUSH', key, value);
    if (max) await rest('LTRIM', key, 0, max - 1);
    if (ttlSec) await rest('EXPIRE', key, ttlSec);
  },
  lrange: async (key, start, stop) => (await rest('LRANGE', key, start, stop)) || [],
  async incr(key, ttlSec) {
    const n = await rest('INCR', key);
    if (ttlSec) await rest('EXPIRE', key, ttlSec);
    return Number(n);
  },
  hget: (key, field) => rest('HGET', key, field),
  incrby: async (key, n) => Number(await rest('INCRBY', key, n)),
  ping: () => rest('PING'),
};

// ---------- Redis ----------
let clientPromise = null;
function redis() {
  if (!clientPromise) {
    const client = createClient({ url: REDIS_URL, socket: { connectTimeout: 5000, keepAlive: true } });
    client.on('error', (e) => console.error('redis error', e.message));
    clientPromise = client.connect().then(() => client).catch((e) => {
      clientPromise = null;
      throw e;
    });
  }
  return clientPromise;
}

const redisStore = {
  async get(key) {
    return (await redis()).get(key);
  },
  async set(key, value, ttlSec) {
    await (await redis()).set(key, value, ttlSec ? { EX: ttlSec } : undefined);
  },
  async setNX(key, value, ttlMs) {
    return (await (await redis()).set(key, value, { NX: true, PX: ttlMs })) === 'OK';
  },
  async del(key) {
    await (await redis()).del(key);
  },
  async hset(key, field, value, ttlSec) {
    const c = await redis();
    await c.hSet(key, field, value);
    if (ttlSec) await c.expire(key, ttlSec);
  },
  async hgetall(key) {
    return (await redis()).hGetAll(key);
  },
  async hdel(key, fields) {
    if (fields.length) await (await redis()).hDel(key, fields);
  },
  async lpush(key, value, max, ttlSec) {
    const c = await redis();
    await c.lPush(key, value);
    if (max) await c.lTrim(key, 0, max - 1);
    if (ttlSec) await c.expire(key, ttlSec);
  },
  lrange: async (key, start, stop) => (await redis()).lRange(key, start, stop),
  async incr(key, ttlSec) {
    const c = await redis();
    const n = await c.incr(key);
    if (ttlSec) await c.expire(key, ttlSec);
    return Number(n);
  },
  hget: async (key, field) => (await redis()).hGet(key, field),
  incrby: async (key, n) => Number(await (await redis()).incrBy(key, n)),
  ping: async () => (await redis()).ping(),
};

// ---------- memoria (solo desarrollo local) ----------
const mem = new Map();
const alive = (k) => {
  const e = mem.get(k);
  if (e && e.exp && e.exp < Date.now()) mem.delete(k);
  return mem.get(k);
};
const memoryStore = {
  async get(key) {
    return alive(key)?.v ?? null;
  },
  async set(key, value, ttlSec) {
    mem.set(key, { v: value, exp: ttlSec ? Date.now() + ttlSec * 1000 : 0 });
  },
  async setNX(key, value, ttlMs) {
    if (alive(key)) return false;
    mem.set(key, { v: value, exp: Date.now() + ttlMs });
    return true;
  },
  async del(key) {
    mem.delete(key);
  },
  async hset(key, field, value, ttlSec) {
    const e = alive(key) || { v: {}, exp: 0 };
    e.v[field] = value;
    if (ttlSec) e.exp = Date.now() + ttlSec * 1000;
    mem.set(key, e);
  },
  async hgetall(key) {
    return { ...(alive(key)?.v || {}) };
  },
  async hdel(key, fields) {
    const e = alive(key);
    if (e) for (const f of fields) delete e.v[f];
  },
  async lpush(key, value, max, ttlSec) {
    const e = alive(key) || { v: [], exp: 0 };
    e.v.unshift(value);
    if (max) e.v.length = Math.min(e.v.length, max);
    if (ttlSec) e.exp = Date.now() + ttlSec * 1000;
    mem.set(key, e);
  },
  async lrange(key, start, stop) {
    const list = alive(key)?.v || [];
    return list.slice(start, stop === -1 ? undefined : stop + 1);
  },
  async incr(key, ttlSec) {
    const e = alive(key) || { v: '0', exp: 0 };
    e.v = String(Number(e.v) + 1);
    if (ttlSec) e.exp = Date.now() + ttlSec * 1000;
    mem.set(key, e);
    return Number(e.v);
  },
  async hget(key, field) {
    return alive(key)?.v?.[field] ?? null;
  },
  async incrby(key, n) {
    const e = alive(key) || { v: '0', exp: 0 };
    e.v = String(Number(e.v) + Number(n));
    mem.set(key, e);
    return Number(e.v);
  },
  ping: async () => 'PONG',
};

export function storeKind() {
  if (proveedor) return 'cloudflare';
  if (REST_URL && REST_TOKEN) return 'upstash-http';
  if (REDIS_URL) return 'redis';
  return process.env.VERCEL ? 'ninguno' : 'memoria';
}

// En Cloudflare (worker/), cada pedido corre dentro de un Durable Object con su propio almacén:
// el objeto registra acá cómo encontrarlo y getStore() lo usa en vez de Redis.
let proveedor = null;
export function usarAlmacen(fn) {
  proveedor = fn;
}

export function getStore() {
  if (proveedor) {
    const s = proveedor();
    if (s) return s;
  }
  if (REST_URL && REST_TOKEN) return restStore;
  if (REDIS_URL) return redisStore;
  // En Vercel cada función puede correr en una máquina distinta: la memoria no sirve.
  if (process.env.VERCEL) {
    throw new StoreNotConfigured('Falta conectar Redis al proyecto en Vercel (pestaña Storage → Redis) y hacer Redeploy.');
  }
  return memoryStore;
}
