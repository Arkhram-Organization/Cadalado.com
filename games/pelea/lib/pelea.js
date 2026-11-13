// Piña Final (pelea 2D): el servidor lleva la sala (equipos, luchador de cada uno, bots, configuración y
// resultado). La pelea la simula el navegador del anfitrión y la manda a los demás por WebRTC (como el haxball).
import { crearJuego, idPublico } from '../../../shared/salas.js';
import { registrarPartida } from '../../../shared/cuenta.js';
import { premiar, avisoPremios } from '../../../shared/premios.js';
import { getStore } from '../../../shared/store.js';
import { NPCS, POR_ID, elegirNpcs } from '../../../shared/public/npcs.js';
import { dicho } from '../../../shared/public/dichos.js';

const FIN_MS = 25_000;
const MODOS = ['1v1', '2v2'];
const ESCENARIOS = ['barrio', 'callejon', 'avenida', 'templo', 'azotea', 'volcan'];
const ROSTER = NPCS.filter((n) => n.look?.modelo).map((n) => n.id);
const tamEquipo = (r) => (r.modo === '2v2' ? 2 : 1);
const luchadorValido = (id) => (ROSTER.includes(id) ? id : null);
const azar = (a) => a[crypto.getRandomValues(new Uint32Array(1))[0] % a.length];
const nombreEq = (e) => (e === 0 ? 'Rojo' : 'Azul');

function deEquipo(r, eq, online) {
  return Object.keys(r.jugadores).filter((p) => r.equipos[p] === eq && (!online || online.has(p)));
}

export const pelea = crearJuego({
  id: 'pelea',
  nueva(opts) {
    return {
      fase: 'lobby',
      modo: MODOS.includes(opts.modo) ? opts.modo : '1v1',
      mejorDe: [1, 3, 5].includes(Number(opts.mejorDe)) ? Number(opts.mejorDe) : 3,
      tiempo: [0, 60, 90].includes(Number(opts.tiempo)) ? Number(opts.tiempo) : 90,
      dificultad: [0, 1, 2].includes(Number(opts.dificultad)) ? Number(opts.dificultad) : 1,
      escenario: ESCENARIOS.includes(opts.escenario) ? opts.escenario : azar(ESCENARIOS),
      luchadorInicial: luchadorValido(opts.luchador),
      equipos: {}, // pid → 'a' | 'b' | 'afuera'
      luchador: {}, // pid → id del personaje
      participantes: [],
      botNpc: [],
      botEq: [],
      peleaN: 0,
      ganador: null,
      victorias: [0, 0],
      resumen: '',
      inicio: 0,
      fin: 0,
    };
  },
  // al entrar: al equipo con lugar (si no hay, a mirar) y con un luchador
  unirse(r, j) {
    const pid = j.pid;
    if (!r.luchador[pid]) r.luchador[pid] = (Object.keys(r.luchador).length === 0 && r.luchadorInicial) || azar(ROSTER);
    if (r.equipos[pid]) return;
    const a = deEquipo(r, 'a').length, b = deEquipo(r, 'b').length, tam = tamEquipo(r);
    r.equipos[pid] = a <= b && a < tam ? 'a' : b < tam ? 'b' : a < tam ? 'a' : 'afuera';
  },
  accion(r, msg, ctx) {
    const { pid } = ctx;
    switch (msg.t) {
      case 'equipo': {
        if (!['a', 'b', 'afuera'].includes(msg.e)) return {};
        if (r.fase === 'pelea' && r.participantes.includes(pid)) return { error: 'Esperá a que termine la pelea' };
        if (msg.e !== 'afuera' && deEquipo(r, msg.e, ctx.online).filter((p) => p !== pid).length >= tamEquipo(r)) return { error: 'Ese equipo está lleno' };
        r.equipos[pid] = msg.e;
        return {};
      }
      case 'luchador': {
        const id = luchadorValido(msg.id);
        if (!id) return { error: 'Ese luchador no existe' };
        if (r.fase === 'pelea' && r.participantes.includes(pid)) return { error: 'Esperá a que termine la pelea' };
        r.luchador[pid] = id;
        return {};
      }
      case 'config': {
        if (!ctx.esHost || r.fase === 'pelea') return {};
        if (MODOS.includes(msg.modo)) {
          r.modo = msg.modo;
          // si se achican los equipos, los que sobran pasan a mirar
          for (const eq of ['a', 'b']) deEquipo(r, eq).slice(tamEquipo(r)).forEach((p) => (r.equipos[p] = 'afuera'));
        }
        if ([1, 3, 5].includes(Number(msg.mejorDe))) r.mejorDe = Number(msg.mejorDe);
        if ([0, 60, 90].includes(Number(msg.tiempo))) r.tiempo = Number(msg.tiempo);
        if ([0, 1, 2].includes(Number(msg.dificultad))) r.dificultad = Number(msg.dificultad);
        if (ESCENARIOS.includes(msg.escenario)) r.escenario = msg.escenario;
        return {};
      }
      case 'empezar': {
        if (!ctx.esHost) return { error: 'Arranca quien armó la sala' };
        if (r.fase === 'pelea') return {};
        const online = new Set([...ctx.online, pid]);
        const a = deEquipo(r, 'a', online), b = deEquipo(r, 'b', online);
        if (!a.length && !b.length) return { error: 'Tiene que pelear al menos una persona' };
        r.participantes = [...a, ...b];
        // los bots completan los lugares vacíos de cada equipo
        const tam = tamEquipo(r);
        const faltan = [Math.max(0, tam - a.length), Math.max(0, tam - b.length)];
        const usados = r.participantes.map((p) => r.luchador[p]);
        const semilla = crypto.getRandomValues(new Uint32Array(1))[0];
        const candidatos = elegirNpcs(ROSTER.length, semilla).filter((id) => ROSTER.includes(id));
        const libres = [...candidatos.filter((id) => !usados.includes(id)), ...candidatos];
        r.botNpc = []; r.botEq = [];
        for (const eq of [0, 1]) for (let i = 0; i < faltan[eq]; i++) { r.botNpc.push(libres.shift()); r.botEq.push(eq); }
        r.peleaN += 1;
        r.fase = 'pelea';
        r.inicio = ctx.now;
        r.ganador = null; r.victorias = [0, 0]; r.resumen = '';
        const nombres = (eq) => [...(eq ? b : a).map((p) => r.jugadores[p]?.nombre), ...r.botNpc.filter((_, i) => r.botEq[i] === eq).map((id) => POR_ID[id]?.nombre)].filter(Boolean).join(' y ');
        ctx.sistema(`¡A pelear! ${nombres(0)} contra ${nombres(1)}. Al mejor de ${r.mejorDe}.`);
        return {};
      }
      case 'resultado': {
        // lo avisa el anfitrión al terminar la pelea; n evita contar dos veces la misma
        if (r.fase !== 'pelea' || !r.participantes.includes(pid) || Number(msg.n) !== r.peleaN) return {};
        const g = msg.ganador === 0 || msg.ganador === 1 ? msg.ganador : null;
        const v = Array.isArray(msg.victorias) ? msg.victorias.slice(0, 2).map((x) => Math.max(0, Math.min(9, Number(x) || 0))) : [0, 0];
        r.ganador = g; r.victorias = v;
        r.resumen = `${v[0]} a ${v[1]} en rondas`;
        r.fase = 'fin'; r.fin = ctx.now + FIN_MS;
        ctx.sistema(g === null ? `¡Empate! ${r.resumen}.` : `¡Ganó el equipo ${nombreEq(g)}! ${r.resumen}.`);
        // un bot ganador se agranda en el chat
        const i = r.botEq.findIndex((e) => e === g);
        if (i >= 0) ctx.evento({ k: 'chat', de: 'bot' + i, nombre: POR_ID[r.botNpc[i]]?.nombre || 'Bot', npc: r.botNpc[i], bot: true, texto: dicho(r.botNpc[i], 'gana', ctx.jugador?.nombre || 'alguien') });
        return {};
      }
      case 'reiniciar': {
        if (!ctx.esHost || r.fase === 'lobby') return {};
        r.fase = 'lobby';
        ctx.sistema('La pelea se cortó: vuelven todos a la sala.');
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
  tick(r, ctx) {
    if (r.fase === 'fin' && ctx.now >= r.fin) r.fase = 'lobby';
  },
  vista(r) {
    return {
      fase: r.fase,
      modo: r.modo,
      mejorDe: r.mejorDe,
      tiempo: r.tiempo,
      dificultad: r.dificultad,
      escenario: r.escenario,
      equipos: Object.fromEntries(Object.entries(r.equipos).map(([p, e]) => [idPublico(p), e])),
      luchador: Object.fromEntries(Object.entries(r.luchador).map(([p, l]) => [idPublico(p), l])),
      participantes: r.participantes.map(idPublico),
      botNpc: r.botNpc,
      botEq: r.botEq,
      peleaN: r.peleaN,
      ganador: r.ganador,
      victorias: r.victorias,
      resumen: r.resumen,
    };
  },
  lobby(r) {
    const host = r.jugadores[r.host];
    return { titulo: host ? `Ring de ${host.nombre}` : 'Piña Final', fase: r.fase, jugadores: Object.keys(r.jugadores).length, modo: r.modo };
  },
  async despues(r, antes, ctx) {
    if (r.fase !== 'fin' || antes.fase === 'fin') return;
    const pagos = [];
    for (const pid of r.participantes) {
      const j = r.jugadores[pid];
      if (!j) continue;
      const eq = r.equipos[pid] === 'b' ? 1 : 0;
      const resultado = r.ganador === null ? 'empate' : r.ganador === eq ? 'victoria' : 'derrota';
      pagos.push({ nombre: j.nombre, monto: await premiar(pid, j.uid, resultado, r.victorias[eq] * 100) });
      if (!j.uid) continue;
      await registrarPartida(j.uid, {
        juego: 'pelea',
        sala: r.code,
        url: `/pelea/sala/${r.code}`,
        resultado,
        detalle: `con ${POR_ID[r.luchador[pid]]?.nombre || 'su luchador'}`,
        marcador: `${r.victorias[eq]} - ${r.victorias[1 - eq]}`,
        rivales: [...r.participantes.filter((p) => (r.equipos[p] === 'b' ? 1 : 0) !== eq).map((p) => r.jugadores[p]?.nombre), ...r.botNpc.filter((_, i) => r.botEq[i] !== eq).map((id) => POR_ID[id]?.nombre)].filter(Boolean).slice(0, 6),
      });
    }
    const aviso = avisoPremios(pagos);
    if (aviso) ctx?.sistema?.(aviso);
  },
  // Plan B: si dos navegadores no se conectan directo, la pelea pasa por el servidor.
  async rutas(ruta, request, { json, readJson, limpiarPid }) {
    if (ruta !== '/pos') return null;
    const url = new URL(request.url);
    if (request.method === 'POST') {
      const b = await readJson(request);
      const pid = limpiarPid(b.pid);
      const code = String(b.code || '').toUpperCase();
      if (!pid || !/^[A-Z0-9-]{3,16}$/.test(code) || typeof b.s !== 'string' || b.s.length > 2400) return json({ error: 'inválido' }, 400);
      await getStore().hset(`pos:pelea:${code}`, idPublico(pid), `${Date.now()}|${b.s}`, 600);
    }
    const code = String((request.method === 'POST' ? null : url.searchParams.get('code')) || '').toUpperCase();
    if (request.method === 'GET' && /^[A-Z0-9-]{3,16}$/.test(code)) {
      const all = await getStore().hgetall(`pos:pelea:${code}`);
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
