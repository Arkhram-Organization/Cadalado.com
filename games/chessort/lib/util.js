import { StoreNotConfigured } from './store.js';

export function cleanName(name) {
  const s = String(name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
  return s || 'Invitado';
}

export function cleanPid(pid) {
  const s = String(pid ?? '');
  return /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : null;
}

export function cleanGameId(id) {
  const s = String(id ?? '');
  return /^[a-z0-9]{4,16}$/.test(s) ? s : null;
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
export function newGameId(len = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

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
  console.error(e);
  // Mostramos el motivo (sin datos sensibles) para poder diagnosticar desde el navegador.
  return json({ error: 'Error del servidor: ' + String(e?.message || e).slice(0, 200) }, 500);
}
