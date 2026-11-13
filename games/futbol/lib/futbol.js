// La Canchita (fútbol 5 a 8): el servidor lleva la sala (equipos, personaje de cada uno, bots, formato y resultado).
// El partido lo simula el navegador del anfitrión y lo manda por WebRTC (como el haxball y Piña Final).
import { crearJuego, idPublico } from '../../../shared/salas.js';
import { registrarPartida } from '../../../shared/cuenta.js';
import { premiar, avisoPremios } from '../../../shared/premios.js';
import { getStore } from '../../../shared/store.js';
import { NPCS, POR_ID, elegirNpcs } from '../../../shared/public/npcs.js';
import { dicho } from '../../../shared/public/dichos.js';

const FIN_MS = 25_000;
const FORMATOS = [5, 6, 7, 8];
const MINUTOS = [2, 4, 6, 8];
const CANCHAS = ['barrio', 'terraza', 'lluvia'];
// los jugadores salen solos de los personajes del club con modelo 3D
const ROSTER = NPCS.filter((n) => n.look?.modelo).map((n) => n.id);
const azar = (a) => a[crypto.getRandomValues(new Uint32Array(1))[0] % a.length];
const NOMBRE = { rojo: 'Rojo', azul: 'Azul' };
const cupo = (r) => r.formato; // si nadie elige arco, ataja un bot (o, con el equipo lleno, una persona al azar)
const ROLES = ['aleatorio', 'arquero', 'defensa', 'medio', 'delantero'];
const de = (r, eq, online) => Object.keys(r.jugadores).filter((p) => r.equipos[p] === eq && (!online || online.has(p)));

export const futbol = crearJuego({
  id: 'futbol',
  nueva(opts) {
    return {
      fase: 'lobby',
      formato: FORMATOS.includes(Number(opts.formato)) ? Number(opts.formato) : 5,
      minutos: MINUTOS.includes(Number(opts.minutos)) ? Number(opts.minutos) : 4,
      golesMax: 0,
      dificultad: [0, 1, 2].includes(Number(opts.dificultad)) ? Number(opts.dificultad) : 1,
      cancha: CANCHAS.includes(opts.cancha) ? opts.cancha : azar(CANCHAS),
      personajeInicial: ROSTER.includes(opts.personaje) ? opts.personaje : null,
      equipos: {}, personaje: {}, rol: {}, participantes: [], bots: { rojo: [], azul: [] },
      partidoN: 0, marcador: [0, 0], ganador: null, goles: [], fin: 0,
    };
  },
  unirse(r, j) {
    const pid = j.pid;
    if (!r.personaje[pid]) r.personaje[pid] = (Object.keys(r.personaje).length === 0 && r.personajeInicial) || azar(ROSTER);
    if (r.equipos[pid]) return;
    const a = de(r, 'rojo').length, b = de(r, 'azul').length;
    r.equipos[pid] = a <= b && a < cupo(r) ? 'rojo' : b < cupo(r) ? 'azul' : a < cupo(r) ? 'rojo' : 'afuera';
  },
  accion(r, msg, ctx) {
    const { pid } = ctx;
    switch (msg.t) {
      case 'equipo': {
        if (!['rojo', 'azul', 'afuera'].includes(msg.e)) return {};
        if (r.fase === 'partido' && r.participantes.includes(pid)) return { error: 'Esperá a que termine el partido' };
        if (msg.e !== 'afuera' && de(r, msg.e, ctx.online).filter((p) => p !== pid).length >= cupo(r)) return { error: 'Ese equipo está lleno' };
        r.equipos[pid] = msg.e;
        // si en el equipo nuevo ya hay arquero, pasa a aleatorio
        if (r.rol[pid] === 'arquero' && de(r, msg.e, ctx.online).some((p) => p !== pid && r.rol[p] === 'arquero')) r.rol[pid] = 'aleatorio';
        return {};
      }
      case 'personaje': {
        if (!ROSTER.includes(msg.id)) return { error: 'Ese personaje no existe' };
        if (r.fase === 'partido' && r.participantes.includes(pid)) return { error: 'Esperá a que termine el partido' };
        r.personaje[pid] = msg.id;
        return {};
      }
      case 'rol': {
        // el puesto que quiere cada uno (arquero, defensa, medio, delantero o aleatorio)
        if (!ROLES.includes(msg.rol)) return { error: 'Ese puesto no existe' };
        if (r.fase === 'partido' && r.participantes.includes(pid)) return { error: 'Esperá a que termine el partido' };
        const eq = r.equipos[pid];
        if (msg.rol === 'arquero' && eq !== 'afuera' && de(r, eq, ctx.online).some((p) => p !== pid && r.rol[p] === 'arquero')) return { error: 'Ya hay alguien al arco en tu equipo' };
        r.rol[pid] = msg.rol;
        return {};
      }
      case 'config': {
        if (!ctx.esHost || r.fase === 'partido') return {};
        if (FORMATOS.includes(Number(msg.formato))) {
          r.formato = Number(msg.formato);
          for (const eq of ['rojo', 'azul']) de(r, eq).slice(cupo(r)).forEach((p) => (r.equipos[p] = 'afuera'));
        }
        if (MINUTOS.includes(Number(msg.minutos))) r.minutos = Number(msg.minutos);
        if ([0, 1, 2].includes(Number(msg.dificultad))) r.dificultad = Number(msg.dificultad);
        if (CANCHAS.includes(msg.cancha)) r.cancha = msg.cancha;
        return {};
      }
      case 'empezar': {
        if (!ctx.esHost) return { error: 'Arranca quien armó la sala' };
        if (r.fase === 'partido') return {};
        const online = new Set([...ctx.online, pid]);
        const rojo = de(r, 'rojo', online), azul = de(r, 'azul', online);
        if (!rojo.length && !azul.length) return { error: 'Tiene que jugar al menos una persona' };
        r.participantes = [...rojo, ...azul];
        // bots: el arquero de cada equipo y los que faltan para completar
        const usados = new Set(r.participantes.map((p) => r.personaje[p]));
        const cand = elegirNpcs(ROSTER.length, crypto.getRandomValues(new Uint32Array(1))[0]).filter((id) => ROSTER.includes(id));
        const libres = [...cand.filter((id) => !usados.has(id)), ...cand, ...cand];
        r.bots = { rojo: [], azul: [] };
        for (const [eq, gente] of [['rojo', rojo], ['azul', azul]]) for (let i = 0; i < r.formato - gente.length; i++) r.bots[eq].push(libres.shift());
        r.partidoN += 1; r.fase = 'partido'; r.marcador = [0, 0]; r.ganador = null; r.goles = [];
        ctx.sistema(`¡Arranca el partido! Fútbol ${r.formato}, ${r.minutos} minutos.`);
        return {};
      }
      case 'resultado': {
        if (r.fase !== 'partido' || !r.participantes.includes(pid) || Number(msg.n) !== r.partidoN) return {};
        const mk = Array.isArray(msg.marcador) ? msg.marcador.slice(0, 2).map((x) => Math.max(0, Math.min(99, Math.floor(Number(x) || 0)))) : [0, 0];
        r.marcador = mk;
        r.ganador = mk[0] === mk[1] ? null : mk[0] > mk[1] ? 0 : 1;
        r.goles = (Array.isArray(msg.goles) ? msg.goles : []).slice(0, 60).map((g) => ({ eq: g?.eq === 1 ? 1 : 0, autor: String(g?.autor || '').slice(0, 40), contra: !!g?.contra }));
        r.fase = 'fin'; r.fin = ctx.now + FIN_MS;
        ctx.sistema(r.ganador === null ? `¡Terminó! Empate ${mk[0]} a ${mk[1]}.` : `¡Ganó el ${r.ganador ? 'Azul' : 'Rojo'}! ${mk[0]} a ${mk[1]}.`);
        const eqG = r.ganador === null ? null : r.ganador ? 'azul' : 'rojo';
        const bot = eqG && r.bots[eqG][1];
        if (bot) ctx.evento({ k: 'chat', de: 'bot', nombre: POR_ID[bot]?.nombre || 'Bot', npc: bot, bot: true, texto: dicho(bot, 'gana', ctx.jugador?.nombre || 'alguien') });
        return {};
      }
      case 'reiniciar': {
        if (!ctx.esHost || r.fase === 'lobby') return {};
        r.fase = 'lobby';
        ctx.sistema('El partido se cortó: vuelven todos a la sala.');
        return {};
      }
      case 'mensaje': {
        const destino = Object.keys(r.jugadores).find((p) => idPublico(p) === msg.para);
        if (!destino || JSON.stringify(msg.datos ?? null).length > 2000) return {};
        ctx.evento({ k: 'msg', de: idPublico(pid), datos: msg.datos, para: [destino] });
        return {};
      }
      case 'senal': {
        const destino = Object.keys(r.jugadores).find((p) => idPublico(p) === msg.para);
        if (!destino || JSON.stringify(msg.data ?? null).length > 12_000) return {};
        ctx.evento({ k: 'senal', de: idPublico(pid), data: msg.data, para: [destino] });
        return {};
      }
      default:
        return { error: 'Acción desconocida' };
    }
  },
  proximo: (r) => (r.fase === 'fin' ? r.fin : Infinity),
  tick(r, ctx) { if (r.fase === 'fin' && ctx.now >= r.fin) r.fase = 'lobby'; },
  vista(r) {
    return {
      fase: r.fase, formato: r.formato, minutos: r.minutos, golesMax: r.golesMax, dificultad: r.dificultad, cancha: r.cancha,
      equipos: Object.fromEntries(Object.entries(r.equipos).map(([p, e]) => [idPublico(p), e])),
      personaje: Object.fromEntries(Object.entries(r.personaje).map(([p, l]) => [idPublico(p), l])),
      rol: Object.fromEntries(Object.entries(r.rol || {}).map(([p, l]) => [idPublico(p), l])),
      participantes: r.participantes.map(idPublico), bots: r.bots, partidoN: r.partidoN, marcador: r.marcador, ganador: r.ganador,
    };
  },
  lobby(r) {
    const host = r.jugadores[r.host];
    return { titulo: host ? `Canchita de ${host.nombre}` : 'La Canchita', fase: r.fase, jugadores: Object.keys(r.jugadores).length, formato: r.formato };
  },
  async despues(r, antes, ctx) {
    if (r.fase !== 'fin' || antes.fase === 'fin') return;
    const pagos = [];
    for (const pid of r.participantes) {
      const j = r.jugadores[pid];
      if (!j) continue;
      const eq = r.equipos[pid] === 'azul' ? 1 : 0;
      const resultado = r.ganador === null ? 'empate' : r.ganador === eq ? 'victoria' : 'derrota';
      const goles = r.goles.filter((g) => g.autor === idPublico(pid) && !g.contra).length;
      pagos.push({ nombre: j.nombre, monto: await premiar(pid, j.uid, resultado, goles * 150) });
      if (!j.uid) continue;
      await registrarPartida(j.uid, {
        juego: 'futbol', sala: r.code, url: `/futbol/sala/${r.code}`, resultado,
        detalle: `${goles} goles con ${POR_ID[r.personaje[pid]]?.nombre || 'su jugador'}`,
        marcador: `${r.marcador[eq]} - ${r.marcador[1 - eq]}`,
        rivales: r.participantes.filter((p) => (r.equipos[p] === 'azul' ? 1 : 0) !== eq).map((p) => r.jugadores[p]?.nombre).filter(Boolean).slice(0, 6),
      });
    }
    const aviso = avisoPremios(pagos);
    if (aviso) ctx?.sistema?.(aviso);
  },
  // Plan B: si dos navegadores no se conectan directo, el partido pasa por el servidor.
  async rutas(ruta, request, { json, readJson, limpiarPid }) {
    if (ruta !== '/pos') return null;
    const url = new URL(request.url);
    if (request.method === 'POST') {
      const b = await readJson(request);
      const pid = limpiarPid(b.pid);
      const code = String(b.code || '').toUpperCase();
      if (!pid || !/^[A-Z0-9-]{3,16}$/.test(code) || typeof b.s !== 'string' || b.s.length > 2400) return json({ error: 'inválido' }, 400);
      await getStore().hset(`pos:futbol:${code}`, idPublico(pid), `${Date.now()}|${b.s}`, 600);
    }
    const code = String((request.method === 'POST' ? null : url.searchParams.get('code')) || '').toUpperCase();
    if (request.method === 'GET' && /^[A-Z0-9-]{3,16}$/.test(code)) {
      const all = await getStore().hgetall(`pos:futbol:${code}`);
      const ahora = Date.now(), pos = {};
      for (const [id, v] of Object.entries(all)) { const i = v.indexOf('|'); if (ahora - Number(v.slice(0, i)) < 3000) pos[id] = v.slice(i + 1); }
      return json({ pos });
    }
    return json({ ok: true });
  },
});
