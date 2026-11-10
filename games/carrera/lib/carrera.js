// Full Gays: carrera de obstáculos por rondas con eliminación.
// El servidor arma la sala, larga cada ronda, ordena las llegadas (con SU reloj), decide quién clasifica
// y presenta a los jugadores entre sí para que se pasen las posiciones directo (WebRTC).
// Los bots son los NPC de cadalado y se calculan igual en todos lados (pista.js).
import { crearJuego, idPublico, entero } from '../../../shared/salas.js';
import { registrarPartida } from '../../../shared/cuenta.js';
import { getStore } from '../../../shared/store.js';
import { elegirNpcs, POR_ID } from '../../../shared/public/npcs.js';
import { rutaBot, rng, ordenLargada, LIMITE_S, COLORES, MAPAS } from '../public/js/pista.js';

const CUENTA_MS = 5000;
const RONDA_MS = 13000; // pantalla de "clasificados" entre rondas
const PODIO_MS = 22_000;
const MINIMO_MS = 18_000; // nadie puede terminar un mapa más rápido que esto
const CIERRE_MS = 1200; // cuando se llena el cupo, la ronda termina un toque después
const MAX_BOTS = 11;

const nombreBot = (r, i) => {
  const id = r.botNpc[i];
  const base = POR_ID[id]?.nombre || 'Bot';
  const repetido = r.botNpc.slice(0, i).filter((x) => x === id).length;
  return repetido ? `${base} ${repetido + 1}` : base;
};
const finBot = (r, i) => {
  const orden = ordenLargada(r.participantes.map(idPublico), r.botsVivos);
  const t = Math.round(rutaBot(r.mapa, r.semilla, i, orden.indexOf('bot' + i), orden.length).fin * 1000);
  return t <= LIMITE_S * 1000 ? t : null;
};

// Qué mapas se juegan y con cuántos clasificados, según cuántos largan.
function planRondas(total, semilla) {
  const azar = rng(semilla);
  const previas = [1, 2, 4, 5];
  for (let i = previas.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [previas[i], previas[j]] = [previas[j], previas[i]]; }
  const final = azar() < 0.5 ? 3 : previas.pop();
  if (total <= 2 && total > 1) return [final];
  if (total <= 5 && total > 1) return [previas[0], final];
  return [previas[0], previas[1], final];
}
function cupoDe(r) {
  const n = r.vivos.length + r.botsVivos.length;
  if (n <= 1) return 1;
  if (r.ronda >= r.rondas.length) return 1; // la final: gana el primero
  const quedan = r.rondas.length - r.ronda; // rondas que faltan después de esta
  const k = quedan >= 2 ? 0.55 : 0.4; // clasifican menos: cada ronda pesa
  return Math.max(2, Math.min(n - 1, Math.ceil(n * k)));
}

// Llegadas de la ronda (personas y bots) ordenadas por tiempo.
function llegadasRonda(r) {
  const lista = [];
  for (const pid of r.vivos) lista.push({ id: idPublico(pid), pid, nombre: r.jugadores[pid]?.nombre || '—', tiempo: r.llegadas[pid] ?? null, bot: false });
  for (const i of r.botsVivos) lista.push({ id: 'bot' + i, i, nombre: nombreBot(r, i), npc: r.botNpc[i], tiempo: finBot(r, i), bot: true });
  return lista.sort((a, b) => (a.tiempo ?? Infinity) - (b.tiempo ?? Infinity));
}
// Cuándo se llena el cupo con lo que ya se sabe (bots + personas que llegaron).
function cuandoSeLlena(r) {
  const tiempos = [];
  for (const pid of r.vivos) if (r.llegadas[pid] != null) tiempos.push(r.llegadas[pid]);
  for (const i of r.botsVivos) {
    const t = finBot(r, i);
    if (t != null) tiempos.push(t);
  }
  tiempos.sort((a, b) => a - b);
  return tiempos.length >= r.cupo ? r.inicio + tiempos[r.cupo - 1] + CIERRE_MS : Infinity;
}

function largarRonda(r, ctx) {
  r.mapa = r.rondas[r.ronda - 1];
  r.semilla = crypto.getRandomValues(new Uint32Array(1))[0];
  r.inicio = ctx.now + CUENTA_MS;
  r.fin = r.inicio + LIMITE_S * 1000;
  r.llegadas = {};
  r.cupo = cupoDe(r);
  r.fase = 'cuenta';
  const final = r.ronda === r.rondas.length;
  ctx.sistema(`Ronda ${r.ronda}${final ? ' (final)' : ''}: ${MAPAS[r.mapa].nombre}. ${final ? 'Gana el primero en llegar.' : `Clasifican ${r.cupo}.`}`);
}

function cerrarRonda(r, ctx) {
  const lista = llegadasRonda(r);
  const pasan = lista.slice(0, r.cupo).filter((x) => x.tiempo != null);
  const ids = new Set(pasan.map((x) => x.id));
  r.clasificacion = lista.map(({ pid, i, ...x }) => ({ ...x, paso: ids.has(x.id) }));
  // los eliminados quedan en el ranking según la ronda en la que quedaron afuera
  const afuera = lista.filter((x) => !ids.has(x.id)).map(({ pid, i, ...x }) => ({ ...x, ronda: r.ronda }));
  r.eliminados = [...afuera, ...r.eliminados];
  r.vivos = r.vivos.filter((p) => ids.has(idPublico(p)));
  r.botsVivos = r.botsVivos.filter((i) => ids.has('bot' + i));
  // termina si era la final, si nadie llegó o si quedó uno solo (salvo jugando solo: ahí se juegan los tres mapas)
  const final = r.ronda >= r.rondas.length || pasan.length === 0 || (pasan.length === 1 && lista.length > 1);
  if (final) {
    r.resultados = [...r.clasificacion.filter((x) => x.paso).map((x) => ({ ...x, ronda: r.ronda })), ...r.eliminados];
    r.fase = 'podio';
    r.fin = ctx.now + PODIO_MS;
    const g = r.resultados[0];
    ctx.sistema(g?.paso ? `¡${g.nombre} ganó Full Gays!` : 'Nadie llegó a la meta.');
  } else {
    r.fase = 'ronda';
    r.fin = ctx.now + RONDA_MS;
    ctx.sistema(`Clasificaron ${pasan.length}: ${pasan.map((x) => x.nombre).join(', ')}.`);
  }
}

export const carrera = crearJuego({
  id: 'carrera',
  nueva(opts) {
    const bots = Number(opts.bots);
    const r = {
      fase: 'lobby',
      bots: Number.isInteger(bots) && bots >= 0 && bots <= MAX_BOTS ? bots : 7,
      semillaSala: crypto.getRandomValues(new Uint32Array(1))[0],
      botNpc: [],
      botsVivos: [],
      mapa: 1,
      rondas: [],
      ronda: 0,
      cupo: 0,
      semilla: 1,
      inicio: 0,
      fin: 0,
      participantes: [],
      vivos: [],
      llegadas: {},
      clasificacion: [],
      eliminados: [],
      resultados: [],
      skins: {},
      golpes: {},
      carreras: 0,
    };
    r.botNpc = elegirNpcs(r.bots, r.semillaSala);
    return r;
  },
  unirse(r, j) {
    const usados = new Set(Object.values(r.skins));
    const libre = COLORES.findIndex((_, i) => !usados.has(i));
    r.skins[j.pid] = libre >= 0 ? libre : entero(COLORES.length);
  },
  accion(r, msg, ctx) {
    const { pid } = ctx;
    switch (msg.t) {
      case 'skin': {
        const c = Number(msg.color);
        if (Number.isInteger(c) && c >= 0 && c < COLORES.length) r.skins[pid] = c;
        return {};
      }
      case 'bots': {
        const n = Number(msg.n);
        if (ctx.esHost && r.fase === 'lobby' && Number.isInteger(n) && n >= 0 && n <= MAX_BOTS) {
          r.bots = n;
          r.botNpc = elegirNpcs(n, r.semillaSala + r.carreras);
        }
        return {};
      }
      case 'reiniciar':
      case 'empezar': {
        if (!ctx.esHost) return { error: 'Larga la carrera quien armó la sala' };
        if (msg.t === 'empezar' && r.fase !== 'lobby' && r.fase !== 'podio') return {};
        if (msg.t === 'reiniciar') ctx.sistema('La partida se reinició.');
        r.participantes = Object.keys(r.jugadores).filter((p) => ctx.online.has(p) || p === pid).slice(0, 16);
        const nBots = Math.min(r.bots, Math.max(0, 16 - r.participantes.length));
        if (r.botNpc.length !== r.bots) r.botNpc = elegirNpcs(r.bots, r.semillaSala + r.carreras);
        r.botsVivos = Array.from({ length: nBots }, (_, i) => i);
        r.vivos = [...r.participantes];
        r.rondas = planRondas(r.vivos.length + nBots, crypto.getRandomValues(new Uint32Array(1))[0]);
        r.ronda = 1;
        r.eliminados = [];
        r.resultados = [];
        r.clasificacion = [];
        r.carreras += 1;
        ctx.sistema(`¡A la largada! ${r.participantes.length} ${r.participantes.length === 1 ? 'jugador' : 'jugadores'}${nBots ? ` y ${nBots} bots` : ''}, ${r.rondas.length} ${r.rondas.length === 1 ? 'ronda' : 'rondas'}.`);
        largarRonda(r, ctx);
        return {};
      }
      case 'meta': {
        if (r.fase !== 'carrera' || !r.vivos.includes(pid) || r.llegadas[pid] != null) return {};
        const tiempo = ctx.now - r.inicio;
        if (tiempo < MINIMO_MS) return { error: 'Llegada inválida' };
        r.llegadas[pid] = tiempo;
        const puesto = llegadasRonda(r).findIndex((x) => x.pid === pid) + 1;
        ctx.sistema(`${ctx.jugador.nombre} llegó ${puesto}º (${(tiempo / 1000).toFixed(2)} s)${puesto <= r.cupo ? ' y clasificó' : ''}`);
        // si ya llegaron todas las personas que siguen en juego, en un ratito termina
        if (r.vivos.every((p) => r.llegadas[p] != null || !ctx.online.has(p))) r.fin = Math.min(r.fin, ctx.now + 3500);
        return {};
      }
      case 'golpe': {
        // plan B de las piñas (si no hay conexión directa): se le avisa solo al que la recibe
        if (r.fase !== 'carrera' && r.fase !== 'lobby') return {};
        const ultimo = r.golpes[pid] || 0;
        if (ctx.now - ultimo < 9000) return {};
        const destino = Object.keys(r.jugadores).find((p) => idPublico(p) === msg.para);
        const dx = Number(msg.dx);
        const dz = Number(msg.dz);
        if (!destino || !Number.isFinite(dx) || !Number.isFinite(dz)) return {};
        r.golpes[pid] = ctx.now;
        ctx.evento({ k: 'golpe', de: idPublico(pid), dx, dz, para: [destino] });
        return {};
      }
      case 'senal': {
        // señalización WebRTC: se reenvía solo al destinatario
        const destino = Object.keys(r.jugadores).find((p) => idPublico(p) === msg.para);
        const data = JSON.stringify(msg.data ?? null);
        if (!destino || data.length > 12_000) return {};
        ctx.evento({ k: 'senal', de: idPublico(pid), data: msg.data, para: [destino] });
        return {};
      }
      default:
        return { error: 'Acción desconocida' };
    }
  },
  proximo: (r) => {
    if (r.fase === 'cuenta') return r.inicio;
    if (r.fase === 'carrera') return Math.min(r.fin, cuandoSeLlena(r));
    if (r.fase === 'ronda' || r.fase === 'podio') return r.fin;
    return Infinity;
  },
  tick(r, ctx) {
    if (r.fase === 'cuenta' && ctx.now >= r.inicio) r.fase = 'carrera';
    else if (r.fase === 'carrera' && ctx.now >= Math.min(r.fin, cuandoSeLlena(r))) cerrarRonda(r, ctx);
    else if (r.fase === 'ronda' && ctx.now >= r.fin) {
      r.ronda += 1;
      largarRonda(r, ctx);
    } else if (r.fase === 'podio' && ctx.now >= r.fin) {
      r.fase = 'lobby';
      r.golpes = {};
      // otra tanda de NPC para la próxima
      r.botNpc = elegirNpcs(r.bots, r.semillaSala + r.carreras);
    }
  },
  vista(r) {
    const id = idPublico;
    return {
      fase: r.fase,
      mapa: r.mapa,
      ronda: r.ronda,
      rondas: r.rondas,
      cupo: r.cupo,
      semilla: r.semilla,
      semillaSala: r.semillaSala,
      inicio: r.inicio,
      fin: r.fin,
      bots: r.bots,
      botNpc: r.botNpc,
      botsVivos: r.botsVivos,
      participantes: r.participantes.map(id),
      vivos: r.vivos.map(id),
      skins: Object.fromEntries(Object.entries(r.skins).map(([p, c]) => [id(p), c])),
      llegadas: Object.fromEntries(Object.entries(r.llegadas).map(([p, t]) => [id(p), t])),
      clasificacion: r.clasificacion,
      resultados: r.resultados,
      carreras: r.carreras,
    };
  },
  lobby(r) {
    const host = r.jugadores[r.host];
    return { titulo: host ? `Full Gays de ${host.nombre}` : 'Full Gays', fase: r.fase, jugadores: Object.keys(r.jugadores).length, bots: r.bots };
  },
  async despues(r, antes) {
    if (r.fase !== 'podio' || antes.fase === 'podio') return;
    const total = r.resultados.length;
    for (const pid of r.participantes) {
      const j = r.jugadores[pid];
      if (!j?.uid) continue;
      const pos = r.resultados.findIndex((x) => x.id === idPublico(pid)) + 1;
      const yo = r.resultados[pos - 1];
      await registrarPartida(j.uid, {
        juego: 'carrera',
        sala: r.code,
        url: `/carrera/sala/${r.code}`,
        resultado: pos === 1 && yo?.paso ? 'victoria' : 'derrota',
        detalle: yo?.paso ? 'ganó la final' : `afuera en la ronda ${yo?.ronda ?? 1}`,
        marcador: `${pos}º de ${total}`,
        rivales: r.resultados.filter((x) => x.id !== idPublico(pid)).map((x) => x.nombre).slice(0, 6),
      });
    }
  },
  // Plan B si dos navegadores no se pueden conectar directo: se pasan la posición por acá (sin candado).
  async rutas(ruta, request, { json, readJson, limpiarPid }) {
    if (ruta !== '/pos') return null;
    const url = new URL(request.url);
    if (request.method === 'POST') {
      const b = await readJson(request);
      const pid = limpiarPid(b.pid);
      const code = String(b.code || '').toUpperCase();
      if (!pid || !/^[A-Z0-9-]{3,16}$/.test(code) || typeof b.s !== 'string' || b.s.length > 200) return json({ error: 'inválido' }, 400);
      await getStore().hset(`pos:carrera:${code}`, idPublico(pid), `${Date.now()}|${b.s}`, 600);
    }
    const code = String((request.method === 'POST' ? null : url.searchParams.get('code')) || '').toUpperCase();
    if (request.method === 'GET' && /^[A-Z0-9-]{3,16}$/.test(code)) {
      const all = await getStore().hgetall(`pos:carrera:${code}`);
      const ahora = Date.now();
      const pos = {};
      for (const [id, v] of Object.entries(all)) {
        const i = v.indexOf('|');
        if (ahora - Number(v.slice(0, i)) < 3000) pos[id] = v.slice(i + 1);
      }
      return json({ pos });
    }
    return json({ ok: true });
  },
});
