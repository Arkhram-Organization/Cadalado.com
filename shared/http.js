// Ayudas comunes para las funciones de Vercel de cadalado.
import { StoreNotConfigured } from './store.js';

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function serverError(e) {
  if (e instanceof StoreNotConfigured) return json({ error: e.message }, 503);
  if (e?.status && e.status < 500) return json({ error: e.message }, e.status);
  console.error(e);
  return json({ error: 'Error del servidor: ' + String(e?.message || e).slice(0, 200) }, 500);
}

// Sub-ruta pedida. Vercel la pasa como ?ruta=… (ver vercel.json); en desarrollo sale del path.
export function subruta(request, prefijos) {
  const url = new URL(request.url);
  const q = url.searchParams.get('ruta');
  if (q != null) return '/' + q.replace(/^\/+/, '');
  for (const p of prefijos) if (url.pathname.startsWith(p)) return url.pathname.slice(p.length) || '/';
  return url.pathname;
}
