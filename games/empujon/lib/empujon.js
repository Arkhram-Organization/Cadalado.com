// Empujón: el servidor lleva la sala (quién juega, personaje, equipos, bots, configuración y resultado).
// La ronda la simula el navegador del anfitrión y la manda por WebRTC. Se puede entrar en cualquier momento:
// el que llega con la ronda empezada se suma al toque (si no hay lugar, deja su lugar un bot).
import { crearJuego, idPublico } from '../../../shared/salas.js';
import { registrarPartida } from '../../../shared/cuenta.js';
import { premiar, avisoPremios } from '../../../shared/premios.js';
import { getStore } from '../../../shared/store.js';
import { NPCS, POR_ID, elegirNpcs } from '../../../shared/public/npcs.js';

const FIN_MS = 16_000;
const MAX = 20;
const MAPAS = ['terraza', 'plato', 'puente'];
const MINUTOS = [2, 3, 5];
// los personajes salen solos del club (los que tienen modelo 3D)
const ROSTER = NPCS.filter((n) => n.look?.modelo).map((n) => n.id);
const azar = (a) => a[crypto.getRandomValues(new Uint32Array(1))[0] % a.length];
const de = (r, eq, online) => Object.keys(r.jugadores).filter((p) => r.equipos[p] === eq && (!online || online.has(p)));

// arma los bots que faltan: en todos contra todos, los que pidió el anfitrión (hasta 20 en total);
// en equipos, los que completan cada equipo hasta el tamaño elegido
function armarBots(r, humanosPorEq) {
  const usados = new Set(r.participantes.map((p) => r.personaje[p]));
  const cand = elegirNpcs(ROSTER.length, crypto.getRandomValues(new Uint32Array(1))[0]).filter((id) => ROSTER.includes(id));
  const libres = [...cand.filter((id) => !usados.has(id)), ...cand, ...cand];
  const bots = [];
  if (r.modo === 'equipos') for (const eq of [0, 1]) for (let i = humanosPorEq[eq]; i < r.tamEq; i++) bots.push({ id: `b${bots.length}`, npc: libres.shift(), eq });
  else for (let i = 0; i < Math.min(r.bots, MAX - r.participantes.length); i++) bots.push({ id: `b${i}`, npc: libres.shift(), eq: null });
  return bots;
}

export const empujon = crearJuego({
  id: 'empujon',
  nueva(opts) {
    return {
      fase: 'lobby', modo: opts.modo === 'equipos' ? 'equipos' : 'todos', tamEq: [1, 2, 3, 4].includes(Number(opts.tamEq)) ? Number(opts.tamEq) : 2,
      bots: [0, 3, 7, 11, 19].includes(Number(opts.bots)) ? Number(opts.bots) : 7,
      mapa: MAPAS.includes(opts.mapa) ? opts.mapa : azar(MAPAS), minutos: MINUTOS.includes(Number(opts.minutos)) ? Number(opts.minutos) : 3,
      dificultad: [0, 1, 2, 3].includes(Number(opts.dificultad)) ? Number(opts.dificultad) : 1,
      personajeInicial: ROSTER.includes(opts.personaje) ? opts.personaje : null,
      equipos: {}, personaje: {}, participantes: [], botList: [], partidaN: 0, resultado: null, fin: 0,
    };
  },
  // al entrar: personaje, lugar (equipo o "juega") y, si la ronda ya arrancó, adentro al toque
  unirse(r, j) {
    const p = j.pid;
    if (!r.personaje[p]) r.personaje[p] = (Object.keys(r.personaje).length === 0 && r.personajeInicial) || azar(ROSTER);
    if (!r.equipos[p]) {
      if (r.modo === 'equipos') { const a = de(r, 'rojo').length, b = de(r, 'azul').length; r.equipos[p] = a <= b ? 'rojo' : 'azul'; }
      else r.equipos[p] = Object.values(r.equipos).filter((e) => e === 'juega').length < MAX ? 'juega' : 'afuera';
    }
    if (r.fase === 'juego' && r.equipos[p] !== 'afuera' && !r.participantes.includes(p)) {
      r.participantes.push(p);
      // le deja el lugar un bot (de su equipo, en equipos)
      const eq = r.equipos[p] === 'azul' ? 1 : 0;
      const total = r.participantes.length + r.botList.length;
      const i = r.modo === 'equipos' ? r.botList.findIndex((b) => b.eq === eq) : total > MAX ? r.botList.length - 1 : -1;
      if (i >= 0) r.botList.splice(i, 1);
    }
  },
  accion(r, msg, ctx) {
    const { pid } = ctx;
    switch (msg.t) {
      case 'equipo': {
        const validos = r.modo === 'equipos' ? ['rojo', 'azul', 'afuera'] : ['juega', 'afuera'];
        if (!validos.includes(msg.e)) return {};
        if (r.fase === 'juego' && r.participantes.includes(pid)) return { error: 'Esperá a que termine la ronda' };
        if (r.modo === 'equipos' && msg.e !== 'afuera' && de(r, msg.e, ctx.online).filter((p) => p !== pid).length >= r.tamEq) return { error: 'Ese equipo está lleno' };
        r.equipos[pid] = msg.e;
        return {};
      }
      case 'personaje': {
        if (!ROSTER.includes(msg.id)) return { error: 'Ese personaje no existe' };
        if (r.fase === 'juego' && r.participantes.includes(pid)) return { error: 'Esperá a que termine la ronda' };
        r.personaje[pid] = msg.id;
        return {};
      }
      case 'config': {
        if (!ctx.esHost || r.fase === 'juego') return {};
        if (['todos', 'equipos'].includes(msg.modo) && msg.modo !== r.modo) {
          r.modo = msg.modo;
          // se rearman los lugares: en equipos se reparten parejo, en todos juega cualquiera
          const gente = Object.keys(r.jugadores).filter((p) => r.equipos[p] !== 'afuera');
          gente.forEach((p, i) => (r.equipos[p] = r.modo === 'equipos' ? (i % 2 ? 'azul' : 'rojo') : 'juega'));
        }
        if ([1, 2, 3, 4].includes(Number(msg.tamEq))) r.tamEq = Number(msg.tamEq);
        if ([0, 3, 7, 11, 19].includes(Number(msg.bots))) r.bots = Number(msg.bots);
        if (MAPAS.includes(msg.mapa)) r.mapa = msg.mapa;
        if (MINUTOS.includes(Number(msg.minutos))) r.minutos = Number(msg.minutos);
        if ([0, 1, 2, 3].includes(Number(msg.dificultad))) r.dificultad = Number(msg.dificultad);
        return {};
      }
      case 'empezar': {
        if (!ctx.esHost) return { error: 'Arranca quien armó la sala' };
        if (r.fase === 'juego') return {};
        const online = new Set([...ctx.online, pid]);
        r.participantes = Object.keys(r.jugadores).filter((p) => online.has(p) && r.equipos[p] && r.equipos[p] !== 'afuera').slice(0, MAX);
        if (!r.participantes.length) return { error: 'Tiene que jugar al menos una persona' };
        const porEq = [0, 1].map((eq) => r.participantes.filter((p) => r.equipos[p] === (eq ? 'azul' : 'rojo')).length);
        r.botList = armarBots(r, porEq);
        r.partidaN += 1; r.fase = 'juego'; r.resultado = null;
        ctx.sistema(r.modo === 'equipos' ? `¡A empujar! Rojo contra Azul, ${r.tamEq} contra ${r.tamEq}.` : `¡A empujar! ${r.participantes.length + r.botList.length} arriba de la plataforma.`);
        return {};
      }
      case 'resultado': {
        if (r.fase !== 'juego' || !r.participantes.includes(pid) || Number(msg.n) !== r.partidaN) return {};
        const ranking = (Array.isArray(msg.ranking) ? msg.ranking : []).slice(0, MAX).map((x) => ({ id: String(x?.id || '').slice(0, 40), puntos: Math.max(0, Math.min(999, Math.floor(Number(x?.puntos) || 0))), puesto: Math.max(1, Math.min(60, Math.floor(Number(x?.puesto) || 1))) }));
        const top = (Array.isArray(msg.top) ? msg.top : []).slice(0, 3).map((x) => ({ nombre: String(x?.nombre || '').slice(0, 24), puntos: Math.max(0, Math.floor(Number(x?.puntos) || 0)) }));
        r.resultado = { ranking, top, titulo: String(msg.titulo || '').slice(0, 60), ganadorEq: msg.ganadorEq === 0 || msg.ganadorEq === 1 ? msg.ganadorEq : null, marcador: Array.isArray(msg.marcador) ? msg.marcador.slice(0, 2).map((x) => Math.max(0, Math.floor(Number(x) || 0))) : [0, 0] };
        r.fase = 'fin'; r.fin = ctx.now + FIN_MS;
        ctx.sistema(r.resultado.titulo || '¡Terminó la ronda!');
        return {};
      }
      case 'reiniciar': {
        if (!ctx.esHost || r.fase === 'lobby') return {};
        r.fase = 'lobby';
        ctx.sistema('La ronda se cortó: vuelven todos a la sala.');
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
      fase: r.fase, modo: r.modo, tamEq: r.tamEq, bots: r.bots, mapa: r.mapa, minutos: r.minutos, dificultad: r.dificultad,
      equipos: Object.fromEntries(Object.entries(r.equipos).map(([p, e]) => [idPublico(p), e])),
      personaje: Object.fromEntries(Object.entries(r.personaje).map(([p, l]) => [idPublico(p), l])),
      participantes: r.participantes.map(idPublico), botList: r.botList, partidaN: r.partidaN,
      resultado: r.resultado && { titulo: r.resultado.titulo, top: r.resultado.top, ganadorEq: r.resultado.ganadorEq, marcador: r.resultado.marcador },
    };
  },
  lobby(r) {
    const host = r.jugadores[r.host];
    return { titulo: host ? `Sala de ${host.nombre}` : 'Empujón', fase: r.fase, jugadores: Object.keys(r.jugadores).length, modo: r.modo, tamEq: r.tamEq };
  },
  async despues(r, antes, ctx) {
    if (r.fase !== 'fin' || antes.fase === 'fin' || !r.resultado) return;
    const pagos = [];
    for (const pid of r.participantes) {
      const j = r.jugadores[pid];
      if (!j) continue;
      const fila = r.resultado.ranking.find((x) => x.id === idPublico(pid));
      const eq = r.equipos[pid] === 'azul' ? 1 : 0;
      const resultado = r.modo === 'equipos' ? (r.resultado.ganadorEq === null ? 'empate' : r.resultado.ganadorEq === eq ? 'victoria' : 'derrota') : fila && fila.puesto <= 3 ? 'victoria' : 'derrota';
      pagos.push({ nombre: j.nombre, monto: await premiar(pid, j.uid, resultado, (fila?.puntos || 0) * 40) });
      if (!j.uid) continue;
      await registrarPartida(j.uid, {
        juego: 'empujon', sala: r.code, url: `/empujon/sala/${r.code}`, resultado,
        detalle: `${fila?.puntos || 0} tiradas con ${POR_ID[r.personaje[pid]]?.nombre || 'su personaje'}`,
        marcador: r.modo === 'equipos' ? `${r.resultado.marcador[eq]} - ${r.resultado.marcador[1 - eq]}` : `puesto ${fila?.puesto || '-'}`,
        rivales: r.participantes.filter((p) => p !== pid).map((p) => r.jugadores[p]?.nombre).filter(Boolean).slice(0, 6),
      });
    }
    const aviso = avisoPremios(pagos);
    if (aviso) ctx?.sistema?.(aviso);
  },
  // Plan B: si dos navegadores no se conectan directo, la ronda pasa por el servidor.
  async rutas(ruta, request, { json, readJson, limpiarPid }) {
    if (ruta !== '/pos') return null;
    const url = new URL(request.url);
    if (request.method === 'POST') {
      const b = await readJson(request);
      const pid = limpiarPid(b.pid);
      const code = String(b.code || '').toUpperCase();
      if (!pid || !/^[A-Z0-9-]{3,16}$/.test(code) || typeof b.s !== 'string' || b.s.length > 2400) return json({ error: 'inválido' }, 400);
      await getStore().hset(`pos:empujon:${code}`, idPublico(pid), `${Date.now()}|${b.s}`, 600);
    }
    const code = String((request.method === 'POST' ? null : url.searchParams.get('code')) || '').toUpperCase();
    if (request.method === 'GET' && /^[A-Z0-9-]{3,16}$/.test(code)) {
      const all = await getStore().hgetall(`pos:empujon:${code}`);
      const ahora = Date.now(), pos = {};
      for (const [id, v] of Object.entries(all)) { const i = v.indexOf('|'); if (ahora - Number(v.slice(0, i)) < 3000) pos[id] = v.slice(i + 1); }
      return json({ pos });
    }
    return json({ ok: true });
  },
});
