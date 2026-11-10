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
// Cada una con su frase célebre, que sale en la portada.
export const SKINS = [
  { id: 'capitan', rareza: 'comun', precio: 800, frase: '¡Ningún pibe se queda sin mate!' },
  { id: 'chapa', rareza: 'comun', precio: 800, frase: 'Mi batería está al 3%. Igual corro.' },
  { id: 'colon', rareza: 'comun', precio: 1_200, frase: '¡Tierra a la vista!' },
  { id: 'claude', rareza: 'comun', precio: 1_200, frase: 'Si encuentran un bug, era una función.' },
  { id: 'angie', rareza: 'rara', precio: 3_500, frase: '¿Vieron a Nacho? Qué lindo que es Nacho.' },
  { id: 'olcho', rareza: 'rara', precio: 3_500, frase: 'Hola, soy la rata. Jaja.' },
  { id: 'sandra', rareza: 'rara', precio: 4_000, frase: 'Desde el caso Bernstein no volví a ser la misma.' },
  { id: 'franba', rareza: 'epica', precio: 7_500, frase: 'No me estoy quedando pelado. Es la luz.', nuevo: true },
  { id: 'julo', rareza: 'epica', precio: 7_500, frase: 'Hice un deploy en la heladera. Anda.' },
  { id: 'faur', rareza: 'epica', precio: 7_500, frase: 'Uno más y me voy. Mentira, me quedo.' },
  { id: 'volcho', rareza: 'epica', precio: 8_000, frase: '¿Quién? El volcho.' },
  { id: 'glinsky', rareza: 'epica', precio: 8_500, frase: 'Esto es una tecnología exponencial, ¿se dan cuenta?' },
  { id: 'angeles', rareza: 'legendaria', precio: 15_000, frase: 'Mi stack: HTML, CSS y danza contemporánea.' },
  { id: 'dobro', rareza: 'legendaria', precio: 18_000, frase: 'La casa siempre gana. La casa soy yo.' },
  { id: 'mati', rareza: 'mitica', precio: 40_000, frase: 'Queque.' },
];

// La tienda rota todos los días a la medianoche de Argentina: no está todo en venta, solo un par.
// 3 destacadas (una de las top, las demás épicas para arriba) y 4 diarias (comunes y raras, alguna épica).
const DIA_MS = 86_400_000, ARG_MS = 3 * 3_600_000;
export const diaDeHoy = (ahora = Date.now()) => Math.floor((ahora - ARG_MS) / DIA_MS);
function mezclar(lista, semilla) {
  let x = semilla >>> 0; // mulberry32
  const r = () => { x = (x + 0x6d2b79f5) >>> 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function rotacion(dia = diaDeHoy()) {
  const top = mezclar(SKINS.filter((s) => s.rareza === 'mitica' || s.rareza === 'legendaria'), dia);
  const fijas = SKINS.filter((s) => s.nuevo);
  const epicas = mezclar(SKINS.filter((s) => s.rareza === 'epica' && !s.nuevo), dia * 31 + 7);
  const destacadas = [top[0], ...fijas, ...epicas].slice(0, 3);
  const resto = mezclar(SKINS.filter((s) => !destacadas.includes(s) && (s.rareza === 'comun' || s.rareza === 'rara')), dia * 37 + 13);
  const sobra = mezclar(SKINS.filter((s) => !destacadas.includes(s) && s.rareza === 'epica'), dia * 41 + 29);
  const diarias = [...resto.slice(0, 3), dia % 2 ? sobra[0] : resto[3]].filter(Boolean);
  return { destacadas: destacadas.map((s) => s.id), diarias: diarias.map((s) => s.id) };
}
export const enVenta = (dia = diaDeHoy()) => { const r = rotacion(dia); return [...r.destacadas, ...r.diarias]; };
const clave = (q) => `skins:${q}`;

export async function mias(q) {
  try { return JSON.parse((await getStore().get(clave(q))) || '[]'); } catch { return []; }
}
export async function tienda(pid, u) {
  const q = quien(pid, u?.id);
  const dia = diaDeHoy(), rot = rotacion(dia);
  return {
    saldo: await saldo(q), mias: await mias(q), rarezas: RAREZAS, cuenta: !!u,
    skins: SKINS,
    ...rot,
    renueva: (dia + 1) * DIA_MS + ARG_MS,
  };
}
export async function comprar(pid, u, id) {
  const skin = SKINS.find((s) => s.id === id);
  if (!skin) throw Object.assign(new Error('Esa skin no existe'), { status: 404 });
  const q = quien(pid, u?.id);
  const tengo = await mias(q);
  if (tengo.includes(id)) return { saldo: await saldo(q), mias: tengo };
  if (!enVenta().includes(id)) throw Object.assign(new Error('Hoy no está en la tienda. Volvé mañana.'), { status: 400 });
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
