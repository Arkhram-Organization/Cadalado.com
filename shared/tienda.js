// La tienda de skins: los personajes del elenco se compran con las mismas fichas del casino de Dobro.
// Las skins compradas quedan en tu cuenta (o en tu dispositivo, si jugás sin cuenta).
import { getStore } from './store.js';
import { quien, saldo, mover } from '../games/casino/lib/fichas.js';

export const RAREZAS = {
  comun: { nombre: 'Común', color: '#9aa4ad' },
  rara: { nombre: 'Rara', color: '#3f8cff' },
  epica: { nombre: 'Épica', color: '#a45cff' },
  legendaria: { nombre: 'Legendaria', color: '#ffb020' },
  mitica: { nombre: 'Mítica', color: '#ff3b8a' },
};
// Cuanto más exclusiva, más cara. Las que tienen modelo 3D propio son las mejores.
export const SKINS = [
  { id: 'capitan', rareza: 'comun', precio: 800 },
  { id: 'chapa', rareza: 'comun', precio: 800 },
  { id: 'colon', rareza: 'comun', precio: 1_200 },
  { id: 'claude', rareza: 'comun', precio: 1_200 },
  { id: 'angie', rareza: 'rara', precio: 3_500 },
  { id: 'olcho', rareza: 'rara', precio: 3_500 },
  { id: 'sandra', rareza: 'rara', precio: 4_000 },
  { id: 'julo', rareza: 'epica', precio: 7_500 },
  { id: 'faur', rareza: 'epica', precio: 7_500 },
  { id: 'volcho', rareza: 'epica', precio: 8_000 },
  { id: 'glinsky', rareza: 'epica', precio: 8_500 },
  { id: 'angeles', rareza: 'legendaria', precio: 15_000 },
  { id: 'dobro', rareza: 'legendaria', precio: 18_000 },
  { id: 'mati', rareza: 'mitica', precio: 40_000 },
];
const clave = (q) => `skins:${q}`;

export async function mias(q) {
  try { return JSON.parse((await getStore().get(clave(q))) || '[]'); } catch { return []; }
}
export async function tienda(pid, u) {
  const q = quien(pid, u?.id);
  return { saldo: await saldo(q), mias: await mias(q), skins: SKINS, rarezas: RAREZAS, cuenta: !!u };
}
export async function comprar(pid, u, id) {
  const skin = SKINS.find((s) => s.id === id);
  if (!skin) throw Object.assign(new Error('Esa skin no existe'), { status: 404 });
  const q = quien(pid, u?.id);
  const tengo = await mias(q);
  if (tengo.includes(id)) return { saldo: await saldo(q), mias: tengo };
  const restan = await mover(q, -skin.precio); // si no alcanza, tira error y no descuenta
  const nuevas = [...tengo, id];
  await getStore().set(clave(q), JSON.stringify(nuevas), 365 * 86400);
  return { saldo: restan, mias: nuevas };
}
// ¿Puede usar esta skin? (las del elenco hay que comprarlas)
export async function puedeUsar(pid, u, id) {
  if (!id) return true;
  return (await mias(quien(pid, u?.id))).includes(id);
}
