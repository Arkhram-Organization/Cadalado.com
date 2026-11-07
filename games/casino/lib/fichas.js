// Saldo de fichas (dinero ficticio). Con cuenta se guarda en la cuenta; sin cuenta, en el dispositivo.
// Las operaciones son atómicas (INCRBY): dos mesas a la vez no pueden gastar las mismas fichas.
import { getStore } from '../../../shared/store.js';

export const INICIAL = 10_000;
const AYUDA = 2_000;
const AYUDA_MS = 10 * 60_000;

export const quien = (pid, uid) => (uid ? `u:${uid}` : `p:${pid}`);
const clave = (q) => `fichas:${q}`;

export async function saldo(q) {
  const store = getStore();
  const v = await store.get(clave(q));
  if (v != null) return Number(v);
  await store.setNX(clave(q), String(INICIAL), 365 * 86400 * 1000);
  return Number(await store.get(clave(q)));
}

// Suma (o resta) fichas. Si no alcanza, no descuenta nada y avisa.
export async function mover(q, delta) {
  await saldo(q); // crea el saldo inicial si no existía
  const store = getStore();
  const n = await store.incrby(clave(q), Math.round(delta));
  if (n < 0) {
    await store.incrby(clave(q), -Math.round(delta));
    throw Object.assign(new Error('No te alcanzan las fichas'), { status: 400 });
  }
  return n;
}

// Si te quedaste sin fichas, la casa te presta para seguir jugando (cada 10 minutos).
export async function ayuda(q) {
  const actual = await saldo(q);
  if (actual >= 500) throw Object.assign(new Error('Todavía tenés fichas'), { status: 400 });
  const store = getStore();
  if (!(await store.setNX(`fichas-ayuda:${q}`, '1', AYUDA_MS))) throw Object.assign(new Error('La casa ya te ayudó hace poco. Probá en unos minutos.'), { status: 429 });
  return store.incrby(clave(q), AYUDA - actual);
}
