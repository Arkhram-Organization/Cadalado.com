// Haxball de cadalado: fútbol 2D por equipos. El servidor lleva la sala (equipos, bots, marcador, reloj).
// La física la corre el navegador del anfitrión y la manda a los demás por WebRTC; él avisa los goles.
import { crearJuego, idPublico } from '../../../shared/salas.js';
import { registrarPartida } from '../../../shared/cuenta.js';
import { premiar, avisoPremios } from '../../../shared/premios.js';
import { getStore } from '../../../shared/store.js';
import { elegirNpcs, limpiarElegidos, POR_ID } from '../../../shared/public/npcs.js';
import { dicho } from '../../../shared/public/dichos.js';

const CUENTA_MS = 3500;
const FIN_MS = 15_000;
const MAX_POR_EQUIPO = 10;
const MAX_BOTS = 19; // con una persona, llena los dos equipos (10 y 10)
const ESTADIOS = ['classic', 'easy', 'small', 'big', 'rounded', 'bigEasy', 'bigRounded', 'huge'];
const entero = (v, max) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= max ? n : null; };

const nombreBot = (r, i) => {
  const id = r.botNpc[i];
  const rep = r.botNpc.slice(0, i).filter((x) => x === id).length;
  return (POR_ID[id]?.nombre || 'Bot') + (rep ? ` ${rep + 1}` : '');
};
const nombreDe = (r, id) => {
  if (String(id).startsWith('bot')) return nombreBot(r, Number(String(id).slice(3)));
  const pid = Object.keys(r.jugadores).find((p) => idPublico(p) === id);
  return r.jugadores[pid]?.nombre || '—';
};

function terminar(r, ctx) {
  r.fase = 'fin';
  r.fin = ctx.now + FIN_MS;
  const { rojo, azul } = r.marcador;
  r.ganador = rojo === azul ? 'empate' : rojo > azul ? 'rojo' : 'azul';
  ctx.sistema(r.ganador === 'empate' ? `¡Terminó! Empate ${rojo} a ${azul}.` : `¡Ganó el equipo ${r.ganador}! ${rojo} a ${azul}.`);
}

export const haxball = crearJuego({
  id: 'haxball',
  nueva(opts) {
    const n = Number(opts.bots);
    const r = {
      fase: 'lobby',
      bots: Number.isInteger(n) && n >= 0 && n <= MAX_BOTS ? n : 3,
      minutos: entero(opts.minutos, 30) ?? 3, // 0 = sin límite
      golesMax: entero(opts.goles, 30) ?? 3, // 0 = sin límite
      estadio: ESTADIOS.includes(opts.estadio) ? opts.estadio : 'classic',
      semillaSala: crypto.getRandomValues(new Uint32Array(1))[0],
      botNpc: [],
      npcElegidos: limpiarElegidos(opts.npcs, MAX_BOTS),
      equipos: {}, // pid → 'rojo' | 'azul' | 'afuera'
      botEquipo: [],
      participantes: [],
      marcador: { rojo: 0, azul: 0 },
      goles: [],
      inicio: 0,
      fin: 0,
      ganador: null,
      habla: {},
      partidas: 0,
    };
    if (r.npcElegidos.length > r.bots) r.bots = r.npcElegidos.length;
    r.botNpc = elegirNpcs(r.bots, r.semillaSala, r.npcElegidos);
    return r;
  },
  // al entrar, va al equipo con menos gente
  unirse(r, j) {
    const pid = j.pid;
    if (r.equipos[pid]) return;
    const c = (e) => Object.values(r.equipos).filter((x) => x === e).length;
    r.equipos[pid] = c('rojo') <= c('azul') ? 'rojo' : 'azul';
  },
  accion(r, msg, ctx) {
    const { pid } = ctx;
    const yo = idPublico(pid);
    switch (msg.t) {
      case 'equipo': {
        if (!['rojo', 'azul', 'afuera'].includes(msg.e)) return {};
        if (r.fase === 'partida' && r.participantes.includes(pid)) return { error: 'Esperá a que termine el partido' };
        if (msg.e !== 'afuera' && Object.entries(r.equipos).filter(([p, e]) => e === msg.e && p !== pid).length >= MAX_POR_EQUIPO) return { error: 'Ese equipo está lleno' };
        r.equipos[pid] = msg.e;
        return {};
      }
      case 'config': {
        if (!ctx.esHost || r.fase === 'partida' || r.fase === 'cuenta') return {};
        const n = Number(msg.bots);
        if (Number.isInteger(n) && n >= 0 && n <= MAX_BOTS) { r.bots = n; r.botNpc = elegirNpcs(n, r.semillaSala + r.partidas, r.npcElegidos); }
        if (entero(msg.minutos, 30) !== null) r.minutos = entero(msg.minutos, 30);
        if (entero(msg.goles, 30) !== null) r.golesMax = entero(msg.goles, 30);
        if (ESTADIOS.includes(msg.estadio)) r.estadio = msg.estadio;
        return {};
      }
      case 'npcs': {
        // el anfitrión elige a mano qué personajes del club entran; los lugares que sobran se sortean
        if (!ctx.esHost || r.fase === 'partida' || r.fase === 'cuenta') return {};
        r.npcElegidos = limpiarElegidos(msg.ids, MAX_BOTS);
        if (r.npcElegidos.length > r.bots) r.bots = r.npcElegidos.length;
        r.botNpc = elegirNpcs(r.bots, r.semillaSala + r.partidas, r.npcElegidos);
        return {};
      }
      case 'reiniciar': {
        // vuelve a la configuración de la partida (equipos, bots, estadio) sin arrancar
        if (!ctx.esHost || r.fase === 'lobby') return {};
        r.fase = 'lobby';
        r.botNpc = elegirNpcs(r.bots, r.semillaSala + r.partidas, r.npcElegidos);
        ctx.sistema('La partida se reinició: volvemos a la configuración.');
        return {};
      }
      case 'empezar': {
        if (!ctx.esHost) return { error: 'Arranca quien armó la sala' };
        if (r.fase !== 'lobby' && r.fase !== 'fin') return {};
        r.participantes = Object.keys(r.jugadores).filter((p) => (ctx.online.has(p) || p === pid) && r.equipos[p] !== 'afuera');
        // entre personas y bots no pueden ser más de los que entran en la cancha
        r.bots = Math.max(0, Math.min(r.bots, MAX_POR_EQUIPO * 2 - r.participantes.length));
        if (r.botNpc.length < r.bots) r.botNpc = elegirNpcs(r.bots, r.semillaSala + r.partidas, r.npcElegidos);
        // los bots completan el equipo que tiene menos gente
        const cuenta = { rojo: r.participantes.filter((p) => r.equipos[p] === 'rojo').length, azul: r.participantes.filter((p) => r.equipos[p] === 'azul').length };
        r.botEquipo = r.botNpc.slice(0, r.bots).map(() => { const e = cuenta.rojo <= cuenta.azul ? 'rojo' : 'azul'; cuenta[e]++; return e; });
        if (cuenta.rojo < 1 || cuenta.azul < 1) return { error: 'Hace falta al menos uno por equipo (sumá bots)' };
        r.marcador = { rojo: 0, azul: 0 };
        r.goles = [];
        r.ganador = null;
        r.habla = {};
        r.inicio = ctx.now + CUENTA_MS;
        r.fase = 'cuenta';
        r.partidas += 1;
        ctx.sistema(`¡Arranca el partido! ${r.minutos ? `${r.minutos} minutos` : 'Sin límite de tiempo'}${r.golesMax ? ` · a ${r.golesMax} goles` : ''}.`);
        return {};
      }
      case 'gol': {
        // lo avisa el anfitrión (cualquiera que juegue); n evita contar dos veces el mismo gol
        if (r.fase !== 'partida' || !r.participantes.includes(pid) || !['rojo', 'azul'].includes(msg.e) || Number(msg.n) !== r.goles.length) return {};
        const autor = String(msg.autor || '').slice(0, 24);
        r.marcador[msg.e] += 1;
        const nombre = autor ? nombreDe(r, autor) : '';
        const equipoAutor = autor.startsWith('bot') ? r.botEquipo[Number(autor.slice(3))] : r.equipos[Object.keys(r.jugadores).find((p) => idPublico(p) === autor)];
        const contra = autor && equipoAutor && equipoAutor !== msg.e;
        r.goles.push({ e: msg.e, autor, nombre, contra, t: ctx.now - r.inicio });
        ctx.sistema(`¡GOL del ${msg.e}!${nombre ? ` ${contra ? 'En contra de' : 'Lo hizo'} ${nombre}.` : ''} ${r.marcador.rojo} - ${r.marcador.azul}`);
        // un bot del equipo que hizo el gol lo festeja en el chat
        const i = r.botEquipo.findIndex((e, k) => e === msg.e && ctx.now - (r.habla['bot' + k] || 0) > 6000);
        if (i >= 0) { r.habla['bot' + i] = ctx.now; ctx.evento({ k: 'chat', de: 'bot' + i, nombre: nombreBot(r, i), npc: r.botNpc[i], bot: true, texto: dicho(r.botNpc[i], 'gana', ctx.jugador?.nombre || 'alguien') }); }
        if (r.golesMax && r.marcador[msg.e] >= r.golesMax) terminar(r, ctx);
        return {};
      }
      case 'terminar': {
        if (!ctx.esHost || r.fase !== 'partida') return {};
        terminar(r, ctx);
        return {};
      }
      case 'mensaje': {
        const destino = Object.keys(r.jugadores).find((p) => idPublico(p) === msg.para);
        if (!destino || JSON.stringify(msg.datos ?? null).length > 2000) return {};
        ctx.evento({ k: 'msg', de: yo, datos: msg.datos, para: [destino] });
        return {};
      }
      case 'senal': {
        const destino = Object.keys(r.jugadores).find((p) => idPublico(p) === msg.para);
        if (!destino || JSON.stringify(msg.data ?? null).length > 12_000) return {};
        ctx.evento({ k: 'senal', de: yo, data: msg.data, para: [destino] });
        return {};
      }
      default:
        return { error: 'Acción desconocida' };
    }
  },
  proximo: (r) => (r.fase === 'cuenta' ? r.inicio : r.fase === 'partida' ? (r.minutos ? r.inicio + r.minutos * 60_000 : Infinity) : r.fase === 'fin' ? r.fin : Infinity),
  tick(r, ctx) {
    if (r.fase === 'cuenta' && ctx.now >= r.inicio) r.fase = 'partida';
    else if (r.fase === 'partida' && r.minutos && ctx.now >= r.inicio + r.minutos * 60_000) terminar(r, ctx);
    else if (r.fase === 'fin' && ctx.now >= r.fin) { r.fase = 'lobby'; r.botNpc = elegirNpcs(r.bots, r.semillaSala + r.partidas, r.npcElegidos); }
  },
  vista(r) {
    return {
      fase: r.fase,
      inicio: r.inicio,
      fin: r.fin,
      minutos: r.minutos,
      golesMax: r.golesMax,
      estadio: r.estadio || 'classic',
      bots: r.bots,
      botNpc: r.botNpc.slice(0, r.bots),
      npcElegidos: r.npcElegidos || [],
      maxBots: MAX_BOTS,
      botNombres: r.botNpc.slice(0, r.bots).map((_, i) => nombreBot(r, i)),
      botEquipo: r.botEquipo,
      equipos: Object.fromEntries(Object.entries(r.equipos).map(([p, e]) => [idPublico(p), e])),
      participantes: r.participantes.map(idPublico),
      marcador: r.marcador,
      goles: r.goles,
      ganador: r.ganador,
    };
  },
  lobby(r) {
    const host = r.jugadores[r.host];
    return { titulo: host ? `Cancha de ${host.nombre}` : 'Haxball', fase: r.fase, jugadores: Object.keys(r.jugadores).length, bots: r.bots };
  },
  async despues(r, antes, ctx) {
    if (r.fase !== 'fin' || antes.fase === 'fin') return;
    const pagos = [];
    for (const pid of r.participantes) {
      const j = r.jugadores[pid];
      if (!j) continue;
      const e = r.equipos[pid];
      const otro = e === 'rojo' ? 'azul' : 'rojo';
      const goles = r.goles.filter((g) => g.autor === idPublico(pid) && !g.contra).length;
      pagos.push({ nombre: j.nombre, monto: await premiar(pid, j.uid, r.ganador === 'empate' ? 'empate' : r.ganador === e ? 'victoria' : 'derrota', goles * 150) });
      if (!j.uid) continue;
      await registrarPartida(j.uid, {
        juego: 'haxball',
        sala: r.code,
        url: `/haxball/sala/${r.code}`,
        resultado: r.ganador === 'empate' ? 'empate' : r.ganador === e ? 'victoria' : 'derrota',
        detalle: `${r.goles.filter((g) => g.autor === idPublico(pid) && !g.contra).length} goles`,
        marcador: `${r.marcador[e]} - ${r.marcador[otro]}`,
        rivales: r.participantes.filter((p) => r.equipos[p] === otro).map((p) => r.jugadores[p]?.nombre).filter(Boolean).slice(0, 6),
      });
    }
    const aviso = avisoPremios(pagos);
    if (aviso) ctx?.sistema?.(aviso);
  },
  // Plan B: si dos navegadores no se conectan directo, el estado pasa por el servidor.
  async rutas(ruta, request, { json, readJson, limpiarPid }) {
    if (ruta !== '/pos') return null;
    const url = new URL(request.url);
    if (request.method === 'POST') {
      const b = await readJson(request);
      const pid = limpiarPid(b.pid);
      const code = String(b.code || '').toUpperCase();
      if (!pid || !/^[A-Z0-9-]{3,16}$/.test(code) || typeof b.s !== 'string' || b.s.length > 2400) return json({ error: 'inválido' }, 400);
      await getStore().hset(`pos:haxball:${code}`, idPublico(pid), `${Date.now()}|${b.s}`, 600);
    }
    const code = String((request.method === 'POST' ? null : url.searchParams.get('code')) || '').toUpperCase();
    if (request.method === 'GET' && /^[A-Z0-9-]{3,16}$/.test(code)) {
      const all = await getStore().hgetall(`pos:haxball:${code}`);
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
