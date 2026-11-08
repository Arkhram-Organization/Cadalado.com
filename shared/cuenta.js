// Cuentas de cadalado: registro, sesión, historial de partidas, amigos y chats.
// Todo vive en Redis (shared/store.js). Las contraseñas se guardan con scrypt (nunca en texto plano).
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { getStore } from './store.js';
import { limpiarLook } from './public/look.js';

const SESSION_DAYS = 60;
const COOKIE = 'cl_ses';
const MAX_HIST = 100;
const MAX_DM = 200;
const MAX_GENERAL = 200;
const ONLINE_MS = 2 * 60_000;

export class ErrorCuenta extends Error {
  constructor(msg, status = 400) {
    super(msg);
    this.status = status;
  }
}

// ---------- utilidades ----------
const scryptAsync = (pass, salt) =>
  new Promise((res, rej) => scrypt(pass, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));

const randomId = (bytes = 9) => randomBytes(bytes).toString('base64url');
export const limpiarUsuario = (u) => String(u ?? '').trim().toLowerCase();
const usuarioValido = (u) => /^[a-z0-9_.]{3,20}$/.test(u);
const limpiarNombre = (n) => String(n ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);
const limpiarTexto = (t, max = 500) => String(t ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, max);
const parse = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

function cookies(request) {
  const out = {};
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function esHttps(request) {
  return new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
}

export function cookieSesion(request, token) {
  const secure = esHttps(request) ? '; Secure' : '';
  if (!token) return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

// Lo que se puede mostrar de un usuario (sin la contraseña).
export const publico = (u) => u && { id: u.id, usuario: u.usuario, nombre: u.nombre, creado: u.creado, look: u.look || null };

async function usuarioPorId(id) {
  return id ? parse(await getStore().get(`u:${id}`)) : null;
}

export async function usuarioPorNombre(usuario) {
  const id = await getStore().get(`uname:${limpiarUsuario(usuario)}`);
  return usuarioPorId(id);
}

// Frena intentos repetidos (por IP y minuto).
async function limitar(request, accion, max = 15) {
  const ip = (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  const n = await getStore().incr(`rl:${accion}:${ip}:${Math.floor(Date.now() / 60_000)}`, 120);
  if (n > max) throw new ErrorCuenta('Demasiados intentos. Esperá un minuto.', 429);
}

// ---------- sesión ----------
export async function usuarioActual(request) {
  const token = cookies(request)[COOKIE];
  if (!token || !/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null;
  const store = getStore();
  const id = await store.get(`ses:${token}`);
  const u = await usuarioPorId(id);
  if (u) await store.set(`visto:${u.id}`, String(Date.now()), 30 * 86400);
  return u;
}

async function abrirSesion(id) {
  const token = randomBytes(32).toString('base64url');
  await getStore().set(`ses:${token}`, id, SESSION_DAYS * 86400);
  return token;
}

export async function registrar(request, { usuario, nombre, clave }) {
  await limitar(request, 'registro', 8);
  usuario = limpiarUsuario(usuario);
  if (!usuarioValido(usuario)) throw new ErrorCuenta('El usuario tiene que tener de 3 a 20 letras, números, punto o guion bajo.');
  if (String(clave ?? '').length < 6) throw new ErrorCuenta('La contraseña tiene que tener al menos 6 caracteres.');
  if (String(clave).length > 200) throw new ErrorCuenta('La contraseña es demasiado larga.');
  const store = getStore();
  const id = randomId();
  // setNX reserva el nombre de usuario aunque dos personas se registren a la vez
  if (!(await store.setNX(`uname:${usuario}`, id, 10 * 365 * 86400 * 1000))) throw new ErrorCuenta('Ese usuario ya existe. Probá con otro.', 409);
  const sal = randomBytes(16).toString('base64url');
  const hash = (await scryptAsync(String(clave), sal)).toString('base64url');
  const u = { id, usuario, nombre: limpiarNombre(nombre) || usuario, sal, hash, creado: Date.now() };
  await store.set(`u:${id}`, JSON.stringify(u));
  return { usuario: publico(u), token: await abrirSesion(id) };
}

export async function entrar(request, { usuario, clave }) {
  await limitar(request, 'entrar');
  const u = await usuarioPorNombre(usuario);
  const malo = new ErrorCuenta('Usuario o contraseña incorrectos.', 401);
  if (!u) throw malo;
  const hash = await scryptAsync(String(clave ?? ''), u.sal);
  const guardado = Buffer.from(u.hash, 'base64url');
  if (guardado.length !== hash.length || !timingSafeEqual(guardado, hash)) throw malo;
  return { usuario: publico(u), token: await abrirSesion(u.id) };
}

export async function salir(request) {
  const token = cookies(request)[COOKIE];
  if (token) await getStore().del(`ses:${token}`);
}

export async function cambiarNombre(u, nombre) {
  const n = limpiarNombre(nombre);
  if (!n) throw new ErrorCuenta('Poné un nombre.');
  u.nombre = n;
  await getStore().set(`u:${u.id}`, JSON.stringify(u));
  return publico(u);
}

// ---------- personaje ----------
// El personaje que cada uno arma en /personaje (se guarda limpio: solo opciones permitidas).
export async function guardarLook(u, look) {
  u.look = limpiarLook(look);
  await getStore().set(`u:${u.id}`, JSON.stringify(u));
  return publico(u);
}

// ---------- historial ----------
// entrada: { juego, sala, url, resultado: 'victoria'|'derrota'|'tablas'|'abortada', detalle, rivales:[], companeros:[], marcador }
export async function registrarPartida(uid, entrada) {
  if (!uid) return;
  await getStore().lpush(`hist:${uid}`, JSON.stringify({ ...entrada, fecha: Date.now() }), MAX_HIST);
}

export async function historial(uid, cuantos = 50) {
  return (await getStore().lrange(`hist:${uid}`, 0, cuantos - 1)).map(parse).filter(Boolean);
}

export function resumen(hist) {
  const r = { jugadas: 0, victorias: 0, derrotas: 0, tablas: 0, porJuego: {} };
  for (const h of hist) {
    if (h.resultado === 'abortada') continue;
    r.jugadas++;
    if (h.resultado === 'victoria') r.victorias++;
    else if (h.resultado === 'derrota') r.derrotas++;
    else r.tablas++;
    r.porJuego[h.juego] = (r.porJuego[h.juego] || 0) + 1;
  }
  return r;
}

export async function perfil(usuario) {
  const u = await usuarioPorNombre(usuario);
  if (!u) throw new ErrorCuenta('No existe ese usuario.', 404);
  const hist = await historial(u.id, MAX_HIST);
  const visto = Number(await getStore().get(`visto:${u.id}`)) || 0;
  return { usuario: publico(u), resumen: resumen(hist), ultimas: hist.slice(0, 10), enLinea: Date.now() - visto < ONLINE_MS };
}

// ---------- amigos ----------
const amigosKey = (id) => `amigos:${id}`;

export async function amigos(u) {
  const store = getStore();
  const rel = await store.hgetall(amigosKey(u.id));
  const out = { amigos: [], recibidas: [], enviadas: [] };
  for (const [id, estado] of Object.entries(rel)) {
    const otro = await usuarioPorId(id);
    if (!otro) continue;
    const visto = Number(await store.get(`visto:${id}`)) || 0;
    const item = { ...publico(otro), enLinea: Date.now() - visto < ONLINE_MS, visto };
    if (estado === 'amigo') {
      const ultimo = parse((await store.lrange(dmKey(u.id, id), 0, 0))[0]);
      const leido = Number(await store.hget(`leido:${u.id}`, id)) || 0;
      item.ultimo = ultimo && { texto: ultimo.texto, ts: ultimo.ts, mio: ultimo.de === u.id };
      item.sinLeer = !!ultimo && ultimo.de !== u.id && ultimo.ts > leido;
      out.amigos.push(item);
    } else if (estado === 'recibida') out.recibidas.push(item);
    else if (estado === 'enviada') out.enviadas.push(item);
  }
  out.amigos.sort((a, b) => (b.ultimo?.ts || 0) - (a.ultimo?.ts || 0) || b.enLinea - a.enLinea);
  return out;
}

export async function accionAmistad(u, accion, usuario) {
  const otro = await usuarioPorNombre(usuario);
  if (!otro) throw new ErrorCuenta('No existe ese usuario.', 404);
  if (otro.id === u.id) throw new ErrorCuenta('No podés agregarte a vos.');
  const store = getStore();
  const mio = await store.hget(amigosKey(u.id), otro.id);
  switch (accion) {
    case 'pedir':
      if (mio === 'amigo') throw new ErrorCuenta('Ya son amigos.');
      if (mio === 'recibida') return accionAmistad(u, 'aceptar', usuario); // los dos se pidieron
      await store.hset(amigosKey(u.id), otro.id, 'enviada');
      await store.hset(amigosKey(otro.id), u.id, 'recibida');
      return { estado: 'enviada' };
    case 'aceptar':
      if (mio !== 'recibida') throw new ErrorCuenta('No hay una solicitud de esa persona.');
      await store.hset(amigosKey(u.id), otro.id, 'amigo');
      await store.hset(amigosKey(otro.id), u.id, 'amigo');
      return { estado: 'amigo' };
    case 'rechazar':
    case 'eliminar':
      await store.hdel(amigosKey(u.id), [otro.id]);
      await store.hdel(amigosKey(otro.id), [u.id]);
      return { estado: null };
    default:
      throw new ErrorCuenta('Acción desconocida.');
  }
}

// ---------- chats ----------
const dmKey = (a, b) => `dm:${[a, b].sort().join('|')}`;

async function claveChat(u, con) {
  if (con === 'general') return { key: 'chat:general', max: MAX_GENERAL };
  const otro = await usuarioPorNombre(con);
  if (!otro) throw new ErrorCuenta('No existe ese usuario.', 404);
  if ((await getStore().hget(amigosKey(u.id), otro.id)) !== 'amigo') throw new ErrorCuenta('Solo podés chatear con tus amigos.', 403);
  return { key: dmKey(u.id, otro.id), max: MAX_DM, otro };
}

export async function leerChat(u, con, cuantos = 60) {
  const { key, otro } = await claveChat(u, con);
  const store = getStore();
  const lista = (await store.lrange(key, 0, cuantos - 1)).map(parse).filter(Boolean).reverse();
  if (otro) await store.hset(`leido:${u.id}`, otro.id, String(Date.now()));
  return lista.map(({ de, ...m }) => ({ ...m, mio: de === u.id }));
}

export async function escribirChat(request, u, con, texto) {
  await limitar(request, 'chat', 40);
  const t = limpiarTexto(texto);
  if (!t) throw new ErrorCuenta('Escribí algo.');
  const { key, max } = await claveChat(u, con);
  const msg = { id: randomId(6), de: u.id, usuario: u.usuario, nombre: u.nombre, texto: t, ts: Date.now() };
  await getStore().lpush(key, JSON.stringify(msg), max);
  const { de, ...pub } = msg;
  return { ...pub, mio: true };
}
