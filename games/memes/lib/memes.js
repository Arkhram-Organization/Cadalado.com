// Make it Meme: cada jugador recibe una plantilla, le pone textos donde quiere,
// después se votan los memes de a uno (anónimos, del 1 al 5) y suma puntos el autor.
import { PLANTILLAS } from '../public/js/plantillas.js';
import { crearJuego, idPublico, mezclar, entero } from '../../../shared/salas.js';
import { registrarPartida } from '../../../shared/cuenta.js';

const POR_ID = new Map(PLANTILLAS.map((p) => [p.id, p]));
const VOTO_MS = 13_000; // cada meme se vota durante este tiempo
const RESULTADOS_MS = 16_000;
const COLORES = ['blanco', 'negro', 'amarillo', 'rojo'];
const MAX_TEXTOS = 8;

function nuevaPlantilla(r, excepto) {
  let libres = PLANTILLAS.filter((p) => !r.usadas.includes(p.id) && p.id !== excepto);
  if (!libres.length) {
    r.usadas = [];
    libres = PLANTILLAS.filter((p) => p.id !== excepto);
  }
  const p = libres[entero(libres.length)];
  r.usadas.push(p.id);
  return p.id;
}

function limpiarTextos(lista) {
  if (!Array.isArray(lista)) return [];
  const num = (v, a, b, d) => (Number.isFinite(Number(v)) ? Math.min(b, Math.max(a, Number(v))) : d);
  return lista.slice(0, MAX_TEXTOS).map((t) => ({
    x: num(t.x, 0, 1, 0.1),
    y: num(t.y, 0, 1, 0.1),
    w: num(t.w, 0.1, 1, 0.8),
    s: num(t.s, 0.025, 0.2, 0.07),
    c: COLORES.includes(t.c) ? t.c : 'blanco',
    t: String(t.t ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, '').slice(0, 140),
  }));
}
const tieneTexto = (m) => m?.textos?.some((t) => t.t.trim());

function empezarRonda(r, ctx) {
  r.ronda += 1;
  r.fase = 'creando';
  r.fin = ctx.now + r.segCrear * 1000;
  r.memes = {};
  r.asignadas = {};
  r.cambios = {};
  r.participantes = Object.keys(r.jugadores);
  for (const pid of r.participantes) r.asignadas[pid] = nuevaPlantilla(r);
  ctx.sistema(`Ronda ${r.ronda} de ${r.rondas}: ¡a memear!`);
}

function empezarVotacion(r, ctx) {
  r.orden = mezclar(Object.keys(r.memes).filter((pid) => tieneTexto(r.memes[pid])));
  r.votos = {};
  r.idx = 0;
  if (!r.orden.length) return mostrarResultados(r, ctx);
  r.fase = 'votando';
  r.fin = ctx.now + VOTO_MS;
}

function puntosDe(r, autor) {
  return Object.values(r.votos[autor] || {}).reduce((a, b) => a + b, 0);
}

function mostrarResultados(r, ctx) {
  const ronda = r.orden.map((autor) => ({ autor, plantilla: r.memes[autor].plantilla, textos: r.memes[autor].textos, puntos: puntosDe(r, autor), votos: Object.keys(r.votos[autor] || {}).length }));
  for (const m of ronda) r.puntos[m.autor] = (r.puntos[m.autor] || 0) + m.puntos;
  ronda.sort((a, b) => b.puntos - a.puntos);
  r.resultados = ronda;
  if (ronda[0] && (!r.mejor || ronda[0].puntos > r.mejor.puntos)) r.mejor = { ...ronda[0], ronda: r.ronda };
  r.fase = r.ronda >= r.rondas ? 'final' : 'resultados';
  r.fin = r.fase === 'final' ? 0 : ctx.now + RESULTADOS_MS;
  if (r.fase === 'final') {
    const top = Object.entries(r.puntos).sort((a, b) => b[1] - a[1])[0];
    if (top) ctx.sistema(`¡Ganó ${r.jugadores[top[0]]?.nombre || 'alguien'} con ${top[1]} puntos!`);
  }
}

function avanzarVoto(r, ctx) {
  r.idx += 1;
  if (r.idx >= r.orden.length) mostrarResultados(r, ctx);
  else r.fin = ctx.now + VOTO_MS;
}

const votantes = (r, autor, online) => r.participantes.filter((p) => p !== autor && r.jugadores[p] && (!online || online.has(p)));

export const memes = crearJuego({
  id: 'memes',
  nueva(opts) {
    return {
      fase: 'lobby',
      rondas: [2, 3, 4, 5].includes(Number(opts.rondas)) ? Number(opts.rondas) : 3,
      segCrear: [60, 90, 120].includes(Number(opts.segundos)) ? Number(opts.segundos) : 90,
      ronda: 0,
      puntos: {},
      usadas: [],
      memes: {},
      asignadas: {},
      cambios: {},
      participantes: [],
      orden: [],
      votos: {},
      idx: 0,
      fin: 0,
      resultados: [],
      mejor: null,
    };
  },
  unirse(r, j, ctx) {
    // si entra en medio de una ronda con tiempo, juega esta ronda
    if (r.fase === 'creando' && r.fin - ctx.now > 25_000 && !r.participantes.includes(j.pid)) {
      r.participantes.push(j.pid);
      r.asignadas[j.pid] = nuevaPlantilla(r);
    }
  },
  accion(r, msg, ctx) {
    const { pid } = ctx;
    switch (msg.t) {
      case 'empezar': {
        if (!ctx.esHost) return { error: 'Solo quien creó la sala puede empezar' };
        if (!['lobby', 'final'].includes(r.fase)) return {};
        const conectados = Object.keys(r.jugadores).filter((p) => ctx.online.has(p) || p === pid);
        if (conectados.length < 2) return { error: 'Hacen falta al menos 2 jugadores. ¡Mandá el link!' };
        // los que se fueron no siguen en la tabla
        for (const p of Object.keys(r.jugadores)) if (!conectados.includes(p)) delete r.jugadores[p];
        r.ronda = 0;
        r.puntos = {};
        r.mejor = null;
        empezarRonda(r, ctx);
        return {};
      }
      case 'cambiar': {
        if (r.fase !== 'creando' || !r.participantes.includes(pid)) return {};
        r.cambios[pid] = (r.cambios[pid] || 0) + 1;
        r.asignadas[pid] = nuevaPlantilla(r, r.asignadas[pid]);
        delete r.memes[pid];
        return {};
      }
      case 'enviar': {
        if (r.fase !== 'creando' || !r.participantes.includes(pid)) return { error: 'Ya se terminó el tiempo' };
        const textos = limpiarTextos(msg.textos);
        if (!textos.some((t) => t.t.trim())) return { error: 'Escribí algo en tu meme' };
        r.memes[pid] = { plantilla: r.asignadas[pid], textos };
        // si ya mandaron todos los conectados, se vota enseguida
        const faltan = r.participantes.filter((p) => !r.memes[p] && ctx.online.has(p));
        if (!faltan.length) r.fin = Math.min(r.fin, ctx.now + 1500);
        return {};
      }
      case 'votar': {
        if (r.fase !== 'votando') return {};
        const autor = r.orden[r.idx];
        if (autor === pid) return { error: 'No podés votar tu propio meme' };
        if (!r.participantes.includes(pid) && !r.jugadores[pid]) return {};
        const n = Math.round(Number(msg.n));
        if (!(n >= 1 && n <= 5)) return {};
        (r.votos[autor] ||= {})[pid] = n;
        const faltan = votantes(r, autor, ctx.online).filter((p) => !r.votos[autor][p]);
        if (!faltan.length) r.fin = Math.min(r.fin, ctx.now + 1800);
        return {};
      }
      case 'siguiente':
        if (ctx.esHost && r.fase === 'resultados') r.fin = ctx.now;
        return {};
      default:
        return { error: 'Acción desconocida' };
    }
  },
  proximo: (r) => (['creando', 'votando', 'resultados'].includes(r.fase) ? r.fin : Infinity),
  tick(r, ctx) {
    if (ctx.now < r.fin) return;
    if (r.fase === 'creando') empezarVotacion(r, ctx);
    else if (r.fase === 'votando') avanzarVoto(r, ctx);
    else if (r.fase === 'resultados') empezarRonda(r, ctx);
  },
  vista(r, ctx) {
    const { pid } = ctx;
    const id = idPublico;
    const v = {
      fase: r.fase,
      ronda: r.ronda,
      rondas: r.rondas,
      segCrear: r.segCrear,
      fin: r.fin,
      puntos: Object.fromEntries(Object.entries(r.puntos).map(([p, n]) => [id(p), n])),
      participantes: r.participantes.map(id),
      listos: Object.keys(r.memes).map(id),
    };
    if (r.fase === 'creando' && r.participantes.includes(pid)) {
      v.miPlantilla = r.asignadas[pid];
      v.miMeme = r.memes[pid] || null;
      v.misCambios = r.cambios[pid] || 0;
    }
    if (r.fase === 'votando') {
      const autor = r.orden[r.idx];
      const m = r.memes[autor];
      v.voto = {
        idx: r.idx,
        total: r.orden.length,
        plantilla: m.plantilla,
        textos: m.textos,
        esMio: autor === pid,
        miVoto: r.votos[autor]?.[pid] || null,
        votaron: Object.keys(r.votos[autor] || {}).length,
        pueden: votantes(r, autor).length,
      };
    }
    if (r.fase === 'resultados' || r.fase === 'final') {
      v.resultados = r.resultados.map((m) => ({ ...m, autor: id(m.autor), nombre: r.jugadores[m.autor]?.nombre || '—' }));
    }
    if (r.fase === 'final' && r.mejor) v.mejor = { ...r.mejor, autor: id(r.mejor.autor), nombre: r.jugadores[r.mejor.autor]?.nombre || '—' };
    return v;
  },
  lobby(r) {
    if (!r.publica) return null;
    const host = r.jugadores[r.host];
    return { titulo: host ? `Sala de ${host.nombre}` : 'Sala de memes', fase: r.fase, jugadores: Object.keys(r.jugadores).length, ronda: r.ronda, rondas: r.rondas };
  },
  async despues(r, antes) {
    if (r.fase !== 'final' || antes.fase === 'final') return;
    const tabla = Object.entries(r.puntos).sort((a, b) => b[1] - a[1]);
    const max = tabla[0]?.[1] ?? 0;
    const ganadores = tabla.filter(([, n]) => n === max).length;
    for (const [pid, pts] of tabla) {
      const j = r.jugadores[pid];
      if (!j?.uid) continue;
      await registrarPartida(j.uid, {
        juego: 'memes',
        sala: r.code,
        url: `/memes/sala/${r.code}`,
        resultado: pts === max ? (ganadores > 1 ? 'tablas' : 'victoria') : 'derrota',
        detalle: `${r.rondas} rondas`,
        marcador: `${pts} pts · ${tabla.findIndex(([p]) => p === pid) + 1}º de ${tabla.length}`,
        rivales: tabla.filter(([p]) => p !== pid).map(([p]) => r.jugadores[p]?.nombre).filter(Boolean),
      });
    }
  },
});

export { POR_ID };
