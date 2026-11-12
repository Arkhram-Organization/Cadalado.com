// Conexión en vivo con el club (Cloudflare): las consultas de la lobby van por un WebSocket y el club
// avisa al instante cuando tu lobby cambia (alguien entra, el líder elige juego, un gesto, "jugar").
// En Vercel no hay WebSocket: todo sigue por HTTP, igual que antes.
// (Entrar, salir y crear cuenta van siempre por HTTP: necesitan guardar la cookie de la sesión.)
import { Conexion } from './conexion.js';

let vivo = null;
const oyentes = new Set();

export const clubEnVivo = () => !!vivo?.abierta;
export function alCambiarLobby(fn) {
  oyentes.add(fn);
}

function activar() {
  if (vivo) return;
  vivo = new Conexion('/api/club/ws', { alCambiar: (ok) => ok && oyentes.forEach((f) => f('conexion')) });
  vivo.alAvisoClub = (aviso) => oyentes.forEach((f) => f(aviso));
}

// Igual que un fetch al club: por el WebSocket si está abierto; si no, por HTTP.
export async function pedirClub(ruta, { q, b } = {}) {
  if (vivo?.abierta) {
    let resp = null;
    try {
      resp = await vivo.pedir(b ? 'POST' : 'GET', { ruta, q, b });
    } catch {}
    if (resp) {
      if (resp.s >= 400) throw Object.assign(new Error(resp.r?.error || `Error ${resp.s}`), { status: resp.s, data: resp.r });
      return resp.r;
    }
  }
  const res = await fetch(q ? `${ruta}?${new URLSearchParams(q)}` : ruta, {
    method: b ? 'POST' : 'GET',
    headers: b ? { 'content-type': 'application/json' } : undefined,
    body: b ? JSON.stringify(b) : undefined,
    cache: 'no-store',
  });
  if (res.headers.get('x-cadalado-ws')) activar();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status, data });
  return data;
}
