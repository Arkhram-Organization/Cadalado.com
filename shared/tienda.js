// La tienda de skins: los personajes del elenco se compran con las mismas fichas del casino de Dobro.
// Las skins compradas quedan en tu cuenta (o en tu dispositivo, si jugás sin cuenta).
import { getStore } from './store.js';
import { usuarioPorNombre } from './cuenta.js';
import { cargaEspecial } from './premios.js';
import { quien, saldo, mover } from '../games/casino/lib/fichas.js';

export const RAREZAS = {
  comun: { nombre: 'Común', color: '#9aa4ad' },
  rara: { nombre: 'Rara', color: '#3f8cff' },
  epica: { nombre: 'Épica', color: '#a45cff' },
  legendaria: { nombre: 'Legendaria', color: '#ffb020' },
  mitica: { nombre: 'Mítica', color: '#ff3b8a' },
};
// Cuanto más exclusiva, más cara: míticas 12.500, legendarias 7.500, épicas 5.500.
// Cada una con su frase célebre, que sale en la portada.
export const SKINS = [
  { id: 'trosman', rareza: 'epica', precio: 5_500, frase: 'YA ESTÁ, Shmitz y Jávila.', nuevo: true },
  { id: 'batata', rareza: 'mitica', precio: 12_500, frase: '¡Fe, gloria y aguante el Gasolero!', nuevo: true },
  { id: 'capitan', rareza: 'comun', precio: 800, frase: '¡Ningún pibe se queda sin mate!' },
  { id: 'chapa', rareza: 'comun', precio: 800, frase: 'Mi batería está al 3%. Igual corro.' },
  { id: 'colon', rareza: 'comun', precio: 1_200, frase: '¡Tierra a la vista!' },
  { id: 'claude', rareza: 'comun', precio: 1_200, frase: 'Si encuentran un bug, era una función.' },
  { id: 'angie', rareza: 'rara', precio: 3_000, frase: '¿Vieron a Nacho? Qué lindo que es Nacho.' },
  { id: 'olcho', rareza: 'rara', precio: 3_000, frase: 'Hola, soy la rata. Jaja.' },
  { id: 'sandra', rareza: 'rara', precio: 3_500, frase: 'Desde el caso Bernstein no volví a ser la misma.' },
  { id: 'franba', rareza: 'legendaria', precio: 7_500, frase: 'No me estoy quedando pelado. Es la luz.' },
  { id: 'elidiprimio', rareza: 'epica', precio: 5_500, frase: '¿Qué hacen, manga de wops?', nuevo: true },
  { id: 'julo', rareza: 'epica', precio: 5_500, frase: 'Hice un deploy en la heladera. Anda.' },
  { id: 'faur', rareza: 'epica', precio: 5_500, frase: 'Uno más y me voy. Mentira, me quedo.' },
  { id: 'volcho', rareza: 'epica', precio: 5_500, frase: '¿Quién? El volcho.' },
  { id: 'glinsky', rareza: 'epica', precio: 5_500, frase: 'Esto es una tecnología exponencial, ¿se dan cuenta?' },
  { id: 'angeles', rareza: 'legendaria', precio: 7_500, frase: 'Mi stack: HTML, CSS y danza contemporánea.' },
  { id: 'dobro', rareza: 'mitica', precio: 12_500, frase: 'La casa siempre gana. La casa soy yo.' },
  { id: 'mati', rareza: 'mitica', precio: 12_500, frase: 'Queque.' },
];

// La tienda rota todos los días a la medianoche de Argentina: no está todo en venta, solo un par.
// 3 destacadas (una mítica o legendaria, la nueva y una épica) y 4 diarias (comunes y raras, alguna épica).
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
  const top = mezclar(SKINS.filter((s) => (s.rareza === 'mitica' || s.rareza === 'legendaria') && !s.nuevo), dia);
  const fijas = SKINS.filter((s) => s.nuevo);
  const epicas = mezclar(SKINS.filter((s) => s.rareza === 'epica' && !s.nuevo), dia * 31 + 7);
  const destacadas = [...fijas, ...top, ...epicas].slice(0, Math.max(3, fijas.length));
  const resto = mezclar(SKINS.filter((s) => !destacadas.includes(s) && (s.rareza === 'comun' || s.rareza === 'rara')), dia * 37 + 13);
  const sobra = mezclar(SKINS.filter((s) => !destacadas.includes(s) && s.rareza === 'epica'), dia * 41 + 29);
  const diarias = [...resto.slice(0, 3), dia % 2 ? sobra[0] : resto[3]].filter(Boolean);
  return { destacadas: destacadas.map((s) => s.id), diarias: diarias.map((s) => s.id) };
}
export const enVenta = (dia = diaDeHoy()) => { const r = rotacion(dia); return [...r.destacadas, ...r.diarias]; };
const clave = (q) => `skins:${q}`;

export async function mias(q) {
  const store = getStore();
  const todas = q.startsWith('u:') && await store.get(`codigo:quieneschapamax:${q.slice(2)}`);
  const propias = JSON.parse((await store.get(clave(q))) || '[]');
  return todas ? [...new Set([...propias, ...SKINS.map(s => s.id)])] : propias;
}
export async function tienda(pid, u) {
  const q = quien(pid, u?.id);
  const dia = diaDeHoy(), rot = rotacion(dia);
  await cargaEspecial(u).catch(() => 0);
  return {
    saldo: await saldo(q), mias: await mias(q), rarezas: RAREZAS, cuenta: !!u, regalos: u ? await regalosNuevos(u) : [],
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
  await getStore().set(clave(q), JSON.stringify(nuevas));
  return { saldo: restan, mias: nuevas };
}

// ---------- regalos: comprás una skin de la tienda de hoy y le llega a un amigo ----------
const err = (m, status = 400) => Object.assign(new Error(m), { status });
export async function regalar(pid, u, id, para) {
  if (!u) throw err('Para regalar tenés que entrar con tu cuenta.', 401);
  const skin = SKINS.find((s) => s.id === id);
  if (!skin) throw err('Esa skin no existe', 404);
  if (!enVenta().includes(id)) throw err('Hoy no está en la tienda. Volvé mañana.');
  const otro = await usuarioPorNombre(String(para || ''));
  if (!otro || otro.id === u.id) throw err('Elegí a un amigo.', 404);
  if ((await getStore().hget(`amigos:${u.id}`, otro.id)) !== 'amigo') throw err('Solo se le regala a tus amigos.', 403);
  const qOtro = quien(null, otro.id);
  const suyas = await mias(qOtro);
  if (suyas.includes(id)) throw err(`${otro.nombre} ya la tiene.`);
  const q = quien(pid, u.id);
  const restan = await mover(q, -skin.precio);
  await getStore().set(clave(qOtro), JSON.stringify([...suyas, id]));
  await getStore().lpush(`regalos:${otro.id}`, JSON.stringify({ de: u.nombre, usuario: u.usuario, skin: id, ts: Date.now() }), 50, 365 * 86400);
  return { saldo: restan, mias: await mias(q), para: otro.nombre };
}
async function regalosNuevos(u) {
  const store = getStore();
  const visto = Number(await store.get(`regalos-visto:${u.id}`)) || 0;
  const lista = (await store.lrange(`regalos:${u.id}`, 0, 9)).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter((x) => x && x.ts > visto);
  if (lista.length) await store.set(`regalos-visto:${u.id}`, String(lista[0].ts), 365 * 86400);
  return lista;
}

// ---------- códigos de creador: cada código se canjea una sola vez por cuenta ----------
const CODIGOS = { opusreligioso: 40_000, ad1min: 100_000, quieneschapamax: 'todas-las-skins' };
export async function canjear(pid, u, codigo) {
  const c = String(codigo || '').trim().toLowerCase();
  const premio = Object.hasOwn(CODIGOS, c) ? CODIGOS[c] : null;
  if (!premio) throw err('Ese código no existe.', 404);
  if (!u) throw err('Para canjear códigos tenés que entrar con tu cuenta.', 401);
  const store = getStore(), marca = `codigo:${c}:${u.id}`;
  if (!(await store.setNX(marca, '1', 3650 * 86400 * 1000))) throw err('Ya canjeaste ese código.');
  const q = quien(pid, u.id);
  try {
    if (premio === 'todas-las-skins') {
      const tengo = JSON.parse((await store.get(clave(q))) || '[]');
      const miasNuevas = [...new Set([...tengo, ...SKINS.map((s) => s.id)])];
      await store.set(clave(q), JSON.stringify(miasNuevas));
      return { saldo: await saldo(q), mias: miasNuevas, skins: miasNuevas.length - tengo.length };
    }
    return { saldo: await mover(q, premio), monto: premio };
  } catch (e) {
    await store.del(marca).catch(() => {});
    throw e;
  }
}

// ¿Puede usar esta skin? (las del elenco hay que comprarlas)
export async function puedeUsar(pid, u, id) {
  if (!id) return true;
  return (await mias(quien(pid, u?.id))).includes(id);
}
