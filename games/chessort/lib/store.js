// Almacenamiento de partidas.
// - En Vercel: Redis (variable REDIS_URL o KV_URL, la crea la integración de Redis/Upstash del Marketplace).
// - En tu compu sin Redis: memoria (sirve para probar con `npm run dev`).
import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || process.env.KV_URL || '';

export class StoreNotConfigured extends Error {}

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
};

export function getStore() {
  if (REDIS_URL) return redisStore;
  // En Vercel cada función puede correr en una máquina distinta: la memoria no sirve.
  if (process.env.VERCEL) {
    throw new StoreNotConfigured('Falta conectar Redis al proyecto en Vercel (Storage → Redis).');
  }
  return memoryStore;
}
