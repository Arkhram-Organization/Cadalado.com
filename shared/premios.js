// Premios en fichas por jugar: cada partida terminada de cualquier juego te deja fichas (más si ganás).
// Sirven para el casino de Dobro y para la tienda de skins. Con tope diario para que no se farmee.
import { getStore } from './store.js';
import { quien, mover } from '../games/casino/lib/fichas.js';

export const PREMIOS = { victoria: 900, tablas: 450, empate: 450, derrota: 300 };
export const TOPE_DIARIO = 40; // partidas con premio por día
const ARG_MS = 3 * 3_600_000;
const hoy = () => Math.floor((Date.now() - ARG_MS) / 86_400_000);

// extra: bonus por el juego (goles, eliminaciones, puesto…). Devuelve lo que se pagó (0 si no corresponde).
export async function premiar(pid, uid, resultado, extra = 0) {
  if (!pid && !uid) return 0;
  if (resultado === 'abortada') return 0;
  const q = quien(pid, uid);
  try {
    const n = await getStore().incr(`premios:${q}:${hoy()}`, 2 * 86400);
    if (n > TOPE_DIARIO) return 0;
    const monto = Math.round((PREMIOS[resultado] ?? PREMIOS.derrota) + Math.max(0, Math.min(extra, 1500)));
    await mover(q, monto);
    return monto;
  } catch { return 0; }
}

// Cuenta el reparto en el chat de la sala: "Fichas: Seba +900 · Theo +300"
export function avisoPremios(lista) {
  const l = lista.filter((x) => x.monto > 0);
  return l.length ? `Fichas ganadas: ${l.map((x) => `${x.nombre} +${x.monto.toLocaleString('es-AR')}`).join(' · ')}` : '';
}

// Cargas especiales: una sola vez por cuenta (por nombre de usuario). Los admins del club (CLUB_ADMINS) también.
const CARGAS = { elsegundo: 100_000 };
const admins = () => (globalThis.process?.env?.CLUB_ADMINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
export async function cargaEspecial(u) {
  if (!u?.usuario) return 0;
  const nombre = String(u.usuario).toLowerCase();
  const monto = CARGAS[nombre] || (admins().includes(nombre) ? 100_000 : 0);
  if (!monto) return 0;
  if (!(await getStore().setNX(`carga:${u.id}:1`, '1', 3650 * 86400 * 1000))) return 0;
  await mover(quien(null, u.id), monto);
  return monto;
}
