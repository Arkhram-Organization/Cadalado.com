// GET /api/estado: diagnóstico rápido. Dice qué almacenamiento se usa y si responde.
// No muestra contraseñas: solo si cada variable existe o no.
import { getStore, storeKind } from '../lib/store.js';
import { json } from '../lib/util.js';

export async function GET() {
  const vars = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'REDIS_URL', 'KV_URL'];
  const variables = Object.fromEntries(vars.map((v) => [v, Boolean(process.env[v])]));
  const almacenamiento = storeKind();
  let conexion = 'sin probar';
  try {
    const t = Date.now();
    await getStore().ping();
    conexion = `ok (${Date.now() - t} ms)`;
  } catch (e) {
    conexion = 'error: ' + String(e?.message || e).slice(0, 200);
  }
  const ok = conexion.startsWith('ok');
  return json({ ok, almacenamiento, conexion, variables, vercel: Boolean(process.env.VERCEL) }, ok ? 200 : 503);
}
