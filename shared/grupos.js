// Grupos de la lobby (como las "parties"): te juntás con amigos o con gente de lobbys abiertas,
// el líder elige el juego y cuando aprieta JUGAR se van todos a la misma sala.
// Funciona con y sin cuenta: la clave de cada uno es su cuenta ('u:<id>') o su dispositivo ('p:<pid>').
import { getStore } from './store.js';
import { ErrorCuenta } from './cuenta.js';
import { limpiarLook } from './public/look.js';

const TTL = 3 * 3600;
const VIVO_MS = 40_000; // si no aparece en 40 s, se fue
const MAX = 8;
const err = (m, s = 400) => new ErrorCuenta(m, s);
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const codigo = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
const limpiarNombre = (n) => String(n ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 20) || 'Invitado';

// quién sos: con cuenta, tu cuenta; sin cuenta, tu dispositivo
export function quien(u, body) {
  if (u) return { k: 'u:' + u.id, nombre: u.nombre, uid: u.id, usuario: u.usuario, look: u.look ? limpiarLook(u.look) : null };
  const p = String(body.pid || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(p)) throw err('Falta tu identificador.');
  return { k: 'p:' + p, nombre: limpiarNombre(body.nombre), look: body.look ? limpiarLook(body.look) : null };
}

async function leer(id) { return id ? parse(await getStore().get(`grupo:${id}`)) : null; }
async function guardar(g) {
  const s = getStore();
  g.miembros = g.miembros.filter((m) => Date.now() - m.visto < VIVO_MS);
  if (!g.miembros.length) {
    await s.del(`grupo:${g.id}`); await s.hdel('grupos:abiertos', [g.id]);
    return null;
  }
  if (!g.miembros.some((m) => m.k === g.lider)) g.lider = g.miembros[0].k;
  await s.set(`grupo:${g.id}`, JSON.stringify(g), TTL);
  if (g.abierto) await s.hset('grupos:abiertos', g.id, JSON.stringify({ id: g.id, t: Date.now() }));
  else await s.hdel('grupos:abiertos', [g.id]);
  return g;
}
const vista = (g, yo) => g && {
  id: g.id, abierto: g.abierto, juego: g.juego, ir: g.ir, soyLider: g.lider === yo.k,
  miembros: g.miembros.map((m) => ({ nombre: m.nombre, usuario: m.usuario || null, look: m.look, lider: m.k === g.lider, yo: m.k === yo.k })),
};

async function entrar(yo, id) {
  const s = getStore();
  const g = await leer(id);
  if (!g) throw err('Esa lobby ya no existe.', 404);
  const ya = g.miembros.find((m) => m.k === yo.k);
  if (!ya && g.miembros.filter((m) => Date.now() - m.visto < VIVO_MS).length >= MAX) throw err('Esa lobby está llena.');
  // salir de la anterior
  const antes = await s.get(`grupo-de:${yo.k}`);
  if (antes && antes !== id) await salir(yo);
  if (ya) Object.assign(ya, { ...yo, visto: Date.now() });
  else g.miembros.push({ ...yo, visto: Date.now() });
  await s.set(`grupo-de:${yo.k}`, id, TTL);
  return guardar(g);
}

async function salir(yo) {
  const s = getStore();
  const id = await s.get(`grupo-de:${yo.k}`);
  await s.del(`grupo-de:${yo.k}`);
  const g = await leer(id);
  if (!g) return;
  g.miembros = g.miembros.filter((m) => m.k !== yo.k);
  await guardar(g);
}

// Mi grupo (y de paso marca que sigo acá). Si no tengo, me arma uno solo para mí.
export async function miGrupo(yo) {
  const s = getStore();
  let g = await leer(await s.get(`grupo-de:${yo.k}`));
  if (!g || !g.miembros.some((m) => m.k === yo.k)) {
    g = { id: codigo(), lider: yo.k, abierto: false, juego: 'royale', ir: null, miembros: [], creado: Date.now() };
    await s.set(`grupo:${g.id}`, JSON.stringify(g), TTL);
    return vista(await entrar(yo, g.id), yo);
  }
  const m = g.miembros.find((x) => x.k === yo.k);
  Object.assign(m, { nombre: yo.nombre, look: yo.look, visto: Date.now() });
  return vista(await guardar(g), yo);
}

export async function accionGrupo(yo, body) {
  const s = getStore();
  const id = await s.get(`grupo-de:${yo.k}`);
  switch (body.accion) {
    case 'unirse': {
      const destino = String(body.id || '').toUpperCase();
      if (!/^[A-Z0-9]{5}$/.test(destino)) throw err('Código inválido.');
      const g = await leer(destino);
      if (!g) throw err('Esa lobby ya no existe.', 404);
      // a una lobby cerrada solo se entra con invitación, siendo amigo o con el link
      return vista(await entrar(yo, destino), yo);
    }
    case 'salir': {
      await salir(yo);
      return miGrupo(yo);
    }
    default: break;
  }
  const g = await leer(id);
  if (!g) throw err('No estás en ninguna lobby.');
  const lider = g.lider === yo.k;
  switch (body.accion) {
    case 'abierto':
      if (!lider) throw err('Solo el líder puede abrir o cerrar la lobby.', 403);
      g.abierto = !!body.valor;
      break;
    case 'juego':
      if (!lider) throw err('El juego lo elige el líder.', 403);
      if (typeof body.juego === 'string' && /^[a-z]{3,12}$/.test(body.juego)) g.juego = body.juego;
      break;
    case 'jugar': {
      if (!lider) throw err('Arranca el líder.', 403);
      if (g.ir?.url === String(body.url || '')) break; // ya estaban yendo ahí
      const url = String(body.url || '');
      if (!/^\/[a-z]{3,12}\/((sala|mesa|game)\/[A-Za-z0-9-]{3,24})?$/.test(url)) throw err('Destino inválido.');
      g.ir = { url, ts: Date.now() };
      break;
    }
    case 'echar':
      if (!lider) throw err('Solo el líder puede sacar gente.', 403);
      g.miembros = g.miembros.filter((m) => m.nombre !== body.nombre || m.k === yo.k);
      break;
    case 'invitar': {
      if (!yo.uid) throw err('Para invitar amigos tenés que entrar con tu cuenta.', 401);
      const otro = await s.get(`uname:${String(body.usuario || '').trim().toLowerCase()}`);
      if (!otro || (await s.hget(`amigos:${yo.uid}`, otro)) !== 'amigo') throw err('Solo podés invitar a tus amigos.', 403);
      await s.lpush(`invit:${otro}`, JSON.stringify({ grupo: g.id, de: yo.nombre, ts: Date.now() }), 10, 3600);
      break;
    }
    default:
      throw err('Acción desconocida.');
  }
  const m = g.miembros.find((x) => x.k === yo.k);
  if (m) m.visto = Date.now();
  return vista(await guardar(g), yo);
}

// Invitaciones nuevas (se leen una vez) para quien tiene cuenta.
export async function invitaciones(yo, desde = 0) {
  if (!yo.uid) return [];
  const lista = (await getStore().lrange(`invit:${yo.uid}`, 0, 9)).map(parse).filter((x) => x && x.ts > desde && Date.now() - x.ts < 10 * 60_000);
  return lista;
}

// Lobbys para unirse: las abiertas y las de tus amigos.
export async function listarGrupos(yo) {
  const s = getStore();
  const resumen = async (id) => {
    const g = await leer(id);
    if (!g) return null;
    const vivos = g.miembros.filter((m) => Date.now() - m.visto < VIVO_MS);
    if (!vivos.length) return null;
    const lider = vivos.find((m) => m.k === g.lider) || vivos[0];
    return { id: g.id, lider: lider.nombre, juego: g.juego, abierto: g.abierto, miembros: vivos.map((m) => ({ nombre: m.nombre, look: m.look })), mia: vivos.some((m) => m.k === yo.k), lleno: vivos.length >= MAX };
  };
  const abiertos = [];
  for (const id of Object.keys(await s.hgetall('grupos:abiertos'))) {
    const r = await resumen(id);
    if (r) abiertos.push(r); else await s.hdel('grupos:abiertos', [id]);
  }
  const amigos = [];
  if (yo.uid) {
    for (const [id, estado] of Object.entries(await s.hgetall(`amigos:${yo.uid}`))) {
      if (estado !== 'amigo') continue;
      const u = parse(await s.get(`u:${id}`));
      if (!u) continue;
      const visto = Number(await s.get(`visto:${id}`)) || 0;
      const r = await resumen(await s.get(`grupo-de:u:${id}`));
      amigos.push({ nombre: u.nombre, usuario: u.usuario, look: u.look || null, enLinea: Date.now() - visto < 5 * 60_000 || !!r, grupo: r });
    }
    amigos.sort((a, b) => !!b.grupo - !!a.grupo || b.enLinea - a.enLinea);
  }
  return { abiertos: abiertos.filter((g) => !g.mia).slice(0, 30), amigos };
}
