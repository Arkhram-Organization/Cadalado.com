// Muro del club (publicaciones con texto y foto) y sugerencias. No hace falta cuenta para usarlos:
// cada publicación devuelve una "clave" que el navegador guarda para poder borrarla después.
// Con cuenta, la publicación sale con tu nombre y tu personaje, y la podés borrar desde cualquier lado.
import { getStore } from './store.js';
import { ErrorCuenta } from './cuenta.js';
import { limpiarLook } from './public/look.js';

const MAX_POSTS = 200;
const MAX_SUG = 300;
const POR_PAGINA = 20;
const MAX_FOTO = 900_000; // largo del data URL (~650 KB de imagen)
const FOTO_OK = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
export const TIPOS_SUG = { juego: 'Juego nuevo', cambio: 'Cambio en la página', otro: 'Otra idea' };
export const ESTADOS_SUG = { '': 'Pendiente', camino: 'En camino', hecho: 'Hecho' };

const err = (m, s = 400) => new ErrorCuenta(m, s);
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nuevaClave = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');
const parse = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};
const idOk = (id) => typeof id === 'string' && /^[a-z0-9]{6,24}$/.test(id);
const dispOk = (d) => typeof d === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(d);

// Texto limpio: sin caracteres de control, sin más de dos renglones vacíos seguidos.
export function limpiarTexto(t, max) {
  return String(t ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}
export const limpiarNombre = (n) => limpiarTexto(n, 30).replace(/\s+/g, ' ') || 'Anónimo';

function ipDe(request) {
  return (request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
}
// Tope de acciones por IP cada 10 minutos.
async function limitar(request, accion, max) {
  const n = await getStore().incr(`rl:${accion}:${ipDe(request)}:${Math.floor(Date.now() / 600_000)}`, 900);
  if (n > max) throw err('Pará un poquito: probá de nuevo en unos minutos.', 429);
}
const admins = () => (globalThis.process?.env?.CLUB_ADMINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
export const esAdmin = (u) => !!u && admins().includes(String(u.usuario).toLowerCase());

// Autor: con cuenta, su nombre y su personaje; sin cuenta, el nombre que escribió.
function autor(u, nombre) {
  if (u) return { nombre: u.nombre, uid: u.id, cuenta: true, look: u.look ? limpiarLook(u.look) : null };
  return { nombre: limpiarNombre(nombre), cuenta: false };
}
const vista = (p, u, extra = {}) => {
  const { uid, ...resto } = p;
  return { ...resto, ...extra, tuyo: !!(u && uid && uid === u.id), puedeBorrar: !!(u && ((uid && uid === u.id) || esAdmin(u))) };
};

// ---------------------------------------------------------------- muro
export async function leerMuro(u, { antes } = {}) {
  const s = getStore();
  const [todos, cuentas] = await Promise.all([s.hgetall('muro:posts'), s.hgetall('muro:cuentas')]);
  const tope = Number(antes) || Infinity;
  const lista = Object.values(todos).map(parse).filter((p) => p && p.t < tope).sort((a, b) => b.t - a.t);
  return {
    posts: lista.slice(0, POR_PAGINA).map((p) => vista(p, u, { likes: Number(cuentas[`l:${p.id}`] || 0), respuestas: Number(cuentas[`r:${p.id}`] || 0) })),
    mas: lista.length > POR_PAGINA,
    admin: esAdmin(u),
  };
}

export async function publicar(request, u, { nombre, texto, foto }) {
  const t = limpiarTexto(texto, 600);
  let f = null;
  if (foto) {
    if (typeof foto !== 'string' || foto.length > MAX_FOTO) throw err('La foto es muy pesada. Probá con otra.');
    if (!FOTO_OK.test(foto)) throw err('Solo se pueden subir fotos (JPG, PNG o WebP).');
    f = foto;
  }
  if (!t && !f) throw err('Escribí algo o subí una foto.');
  await limitar(request, 'muro', 8);
  const s = getStore();
  const p = { id: nuevoId(), ...autor(u, nombre), texto: t, foto: !!f, t: Date.now() };
  const clave = nuevaClave();
  if (f) await s.set(`muro:foto:${p.id}`, f);
  await Promise.all([s.hset('muro:posts', p.id, JSON.stringify(p)), s.hset('muro:claves', p.id, clave)]);
  await podar(s);
  return { post: vista(p, u, { likes: 0, respuestas: 0 }), clave };
}

// Deja solo las últimas MAX_POSTS publicaciones.
async function podar(s) {
  const todos = Object.values(await s.hgetall('muro:posts')).map(parse).filter(Boolean);
  if (todos.length <= MAX_POSTS) return;
  todos.sort((a, b) => b.t - a.t);
  for (const p of todos.slice(MAX_POSTS)) await borrarPost(s, p);
}
async function borrarPost(s, p) {
  await Promise.all([
    s.hdel('muro:posts', [p.id]),
    s.hdel('muro:claves', [p.id]),
    s.hdel('muro:cuentas', [`l:${p.id}`, `r:${p.id}`]),
    p.foto ? s.del(`muro:foto:${p.id}`) : null,
    s.del(`muro:resp:${p.id}`),
    s.del(`muro:l:${p.id}`),
    s.del(`muro:rc:${p.id}`),
  ]);
}

export async function foto(id) {
  if (!idOk(id)) return null;
  const f = await getStore().get(`muro:foto:${id}`);
  const m = f && FOTO_OK.exec(f);
  if (!m) return null;
  return { tipo: `image/${m[1]}`, bytes: Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)) };
}

async function postDe(s, id) {
  if (!idOk(id)) throw err('No existe esa publicación.', 404);
  const p = parse(await s.hget('muro:posts', id));
  if (!p) throw err('Esa publicación ya no está.', 404);
  return p;
}

// Me gusta: uno por dispositivo; si lo volvés a tocar, se saca.
export async function likear(request, { id, dispositivo }) {
  if (!dispOk(dispositivo)) throw err('Falta el dispositivo.');
  const s = getStore();
  await postDe(s, id);
  await limitar(request, 'like', 200);
  const marca = `muro:dio:${id}:${dispositivo}`;
  let diste;
  let n;
  if (await s.setNX(marca, '1', 400 * 86400_000)) {
    n = await s.incr(`muro:l:${id}`);
    diste = true;
  } else {
    await s.del(marca);
    n = Math.max(0, await s.incrby(`muro:l:${id}`, -1));
    diste = false;
  }
  await s.hset('muro:cuentas', `l:${id}`, String(n));
  return { likes: n, diste };
}

export async function responder(request, u, { id, nombre, texto }) {
  const t = limpiarTexto(texto, 300);
  if (!t) throw err('Escribí tu comentario.');
  const s = getStore();
  await postDe(s, id);
  await limitar(request, 'resp', 30);
  const r = { id: nuevoId(), ...autor(u, nombre), texto: t, t: Date.now() };
  await s.lpush(`muro:resp:${id}`, JSON.stringify(r), 100);
  const n = await s.incr(`muro:rc:${id}`);
  await s.hset('muro:cuentas', `r:${id}`, String(Math.min(n, 100)));
  return { respuesta: vista(r, u), respuestas: Math.min(n, 100) };
}

export async function respuestas(u, id) {
  if (!idOk(id)) throw err('No existe esa publicación.', 404);
  const raw = await getStore().lrange(`muro:resp:${id}`, 0, 99);
  return { respuestas: raw.map(parse).filter(Boolean).reverse().map((r) => vista(r, u)) };
}

export async function borrar(u, { id, clave }) {
  const s = getStore();
  const p = await postDe(s, id);
  const suya = await s.hget('muro:claves', id);
  const ok = (clave && suya && clave === suya) || (u && ((p.uid && p.uid === u.id) || esAdmin(u)));
  if (!ok) throw err('Solo quien la publicó puede borrarla.', 403);
  await borrarPost(s, p);
  return { ok: true };
}

// ---------------------------------------------------------------- sugerencias
export async function leerSugerencias(u) {
  const s = getStore();
  const [todas, votos] = await Promise.all([s.hgetall('sug:items'), s.hgetall('sug:votos')]);
  const lista = Object.values(todas)
    .map(parse)
    .filter(Boolean)
    .map((x) => vista(x, u, { votos: Number(votos[x.id] || 0) }))
    .sort((a, b) => (a.estado === 'hecho') - (b.estado === 'hecho') || b.votos - a.votos || b.t - a.t);
  return { sugerencias: lista, admin: esAdmin(u) };
}

export async function sugerir(request, u, { tipo, texto, nombre }) {
  const t = limpiarTexto(texto, 400);
  if (t.length < 4) throw err('Contanos un poco más tu idea.');
  if (!TIPOS_SUG[tipo]) tipo = 'otro';
  await limitar(request, 'sug', 6);
  const s = getStore();
  const x = { id: nuevoId(), tipo, ...autor(u, nombre), texto: t, estado: '', t: Date.now() };
  delete x.look;
  const clave = nuevaClave();
  await Promise.all([s.hset('sug:items', x.id, JSON.stringify(x)), s.hset('sug:claves', x.id, clave)]);
  const todas = Object.values(await s.hgetall('sug:items')).map(parse).filter(Boolean);
  if (todas.length > MAX_SUG) {
    const votos = await s.hgetall('sug:votos');
    todas.sort((a, b) => Number(votos[a.id] || 0) - Number(votos[b.id] || 0) || a.t - b.t);
    for (const v of todas.slice(0, todas.length - MAX_SUG)) await borrarSug(s, v.id);
  }
  return { sugerencia: vista(x, u, { votos: 0 }), clave };
}

async function sugDe(s, id) {
  if (!idOk(id)) throw err('No existe esa sugerencia.', 404);
  const x = parse(await s.hget('sug:items', id));
  if (!x) throw err('Esa sugerencia ya no está.', 404);
  return x;
}
async function borrarSug(s, id) {
  await Promise.all([s.hdel('sug:items', [id]), s.hdel('sug:claves', [id]), s.hdel('sug:votos', [id]), s.del(`sug:v:${id}`)]);
}

// Apoyar una idea: uno por dispositivo; si lo volvés a tocar, se saca.
export async function votar(request, { id, dispositivo }) {
  if (!dispOk(dispositivo)) throw err('Falta el dispositivo.');
  const s = getStore();
  await sugDe(s, id);
  await limitar(request, 'voto', 200);
  const marca = `sug:dio:${id}:${dispositivo}`;
  let diste;
  let n;
  if (await s.setNX(marca, '1', 400 * 86400_000)) {
    n = await s.incr(`sug:v:${id}`);
    diste = true;
  } else {
    await s.del(marca);
    n = Math.max(0, await s.incrby(`sug:v:${id}`, -1));
    diste = false;
  }
  await s.hset('sug:votos', id, String(n));
  return { votos: n, diste };
}

export async function borrarSugerencia(u, { id, clave }) {
  const s = getStore();
  const x = await sugDe(s, id);
  const suya = await s.hget('sug:claves', id);
  const ok = (clave && suya && clave === suya) || (u && ((x.uid && x.uid === u.id) || esAdmin(u)));
  if (!ok) throw err('Solo quien la escribió puede borrarla.', 403);
  await borrarSug(s, id);
  return { ok: true };
}

// Solo los admins (CLUB_ADMINS) marcan una idea como "en camino" o "hecho".
export async function marcarSugerencia(u, { id, estado }) {
  if (!esAdmin(u)) throw err('Solo los admins pueden cambiar el estado.', 403);
  if (!(estado in ESTADOS_SUG)) throw err('Estado inválido.');
  const s = getStore();
  const x = await sugDe(s, id);
  x.estado = estado;
  await s.hset('sug:items', id, JSON.stringify(x));
  return { ok: true };
}
