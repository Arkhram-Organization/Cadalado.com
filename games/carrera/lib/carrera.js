// Carrera de obstáculos al estilo "party game": el servidor arma la sala, larga la carrera,
// ordena las llegadas (con SU reloj, no con el de cada navegador) y presenta a los jugadores entre sí
// para que se pasen las posiciones directo (WebRTC). Los bots se calculan igual en todos lados (pista.js).
import { crearJuego, idPublico, entero } from '../../../shared/salas.js';
import { registrarPartida } from '../../../shared/cuenta.js';
import { getStore } from '../../../shared/store.js';
import { rutaBot, LIMITE_S, NOMBRES_BOT, COLORES } from '../public/js/pista.js';

const CUENTA_MS = 5000;
const PODIO_MS = 16_000;
const MINIMO_MS = 18_000; // nadie puede terminar la pista más rápido que esto

function resultados(r) {
  const lista = [];
  for (const pid of r.participantes) {
    const j = r.jugadores[pid];
    lista.push({ id: idPublico(pid), pid, nombre: j?.nombre || '—', tiempo: r.llegadas[pid] ?? null, bot: false });
  }
  for (let i = 0; i < r.botsCarrera; i++) {
    const t = Math.round(rutaBot(r.semilla, i).fin * 1000);
    lista.push({ id: 'bot' + i, nombre: NOMBRES_BOT[i % NOMBRES_BOT.length], tiempo: t <= LIMITE_S * 1000 ? t : null, bot: true });
  }
  return lista.sort((a, b) => (a.tiempo ?? Infinity) - (b.tiempo ?? Infinity));
}

export const carrera = crearJuego({
  id: 'carrera',
  nueva(opts) {
    const bots = Number(opts.bots);
    return {
      fase: 'lobby',
      bots: Number.isInteger(bots) && bots >= 0 && bots <= 11 ? bots : 7,
      botsCarrera: 0,
      semilla: 1,
      inicio: 0,
      fin: 0,
      participantes: [],
      llegadas: {},
      resultados: [],
      skins: {},
      carreras: 0,
    };
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
        if (ctx.esHost && r.fase === 'lobby' && Number.isInteger(n) && n >= 0 && n <= 11) r.bots = n;
        return {};
      }
      case 'empezar': {
        if (!ctx.esHost) return { error: 'Larga la carrera quien armó la sala' };
        if (r.fase !== 'lobby' && r.fase !== 'podio') return {};
        r.participantes = Object.keys(r.jugadores).filter((p) => ctx.online.has(p) || p === pid).slice(0, 16);
        r.botsCarrera = Math.min(r.bots, Math.max(0, 16 - r.participantes.length));
        r.semilla = crypto.getRandomValues(new Uint32Array(1))[0];
        r.inicio = ctx.now + CUENTA_MS;
        r.fin = r.inicio + LIMITE_S * 1000;
        r.llegadas = {};
        r.resultados = [];
        r.fase = 'cuenta';
        r.carreras += 1;
        ctx.sistema(`¡A la largada! ${r.participantes.length} ${r.participantes.length === 1 ? 'jugador' : 'jugadores'}${r.botsCarrera ? ` y ${r.botsCarrera} bots` : ''}.`);
        return {};
      }
      case 'meta': {
        if (r.fase !== 'carrera' || !r.participantes.includes(pid) || r.llegadas[pid] != null) return {};
        const tiempo = ctx.now - r.inicio;
        if (tiempo < MINIMO_MS) return { error: 'Llegada inválida' };
        r.llegadas[pid] = tiempo;
        const puesto = Object.keys(r.llegadas).length + resultados(r).filter((x) => x.bot && x.tiempo != null && x.tiempo < tiempo).length;
        ctx.sistema(`${ctx.jugador.nombre} llegó ${puesto}º (${(tiempo / 1000).toFixed(2)} s)`);
        // si ya llegaron todas las personas, en un ratito termina
        if (r.participantes.every((p) => r.llegadas[p] != null || !ctx.online.has(p))) r.fin = Math.min(r.fin, ctx.now + 3500);
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
  proximo: (r) => (r.fase === 'cuenta' ? r.inicio : r.fase === 'carrera' || r.fase === 'podio' ? r.fin : Infinity),
  tick(r, ctx) {
    if (r.fase === 'cuenta' && ctx.now >= r.inicio) r.fase = 'carrera';
    else if (r.fase === 'carrera' && ctx.now >= r.fin) {
      r.resultados = resultados(r).map(({ pid, ...x }) => x);
      r.fase = 'podio';
      r.fin = ctx.now + PODIO_MS;
      const g = r.resultados[0];
      if (g) ctx.sistema(`Ganó ${g.nombre}${g.tiempo ? ` en ${(g.tiempo / 1000).toFixed(2)} s` : ''}`);
    } else if (r.fase === 'podio' && ctx.now >= r.fin) r.fase = 'lobby';
  },
  vista(r) {
    const id = idPublico;
    return {
      fase: r.fase,
      semilla: r.semilla,
      inicio: r.inicio,
      fin: r.fin,
      bots: r.bots,
      botsCarrera: r.botsCarrera,
      participantes: r.participantes.map(id),
      skins: Object.fromEntries(Object.entries(r.skins).map(([p, c]) => [id(p), c])),
      llegadas: Object.fromEntries(Object.entries(r.llegadas).map(([p, t]) => [id(p), t])),
      resultados: r.resultados,
      carreras: r.carreras,
    };
  },
  lobby(r) {
    const host = r.jugadores[r.host];
    return { titulo: host ? `Carrera de ${host.nombre}` : 'Carrera', fase: r.fase, jugadores: Object.keys(r.jugadores).length, bots: r.bots };
  },
  async despues(r, antes) {
    if (r.fase !== 'podio' || antes.fase === 'podio') return;
    const total = r.resultados.length;
    for (const pid of r.participantes) {
      const j = r.jugadores[pid];
      if (!j?.uid) continue;
      const pos = r.resultados.findIndex((x) => x.id === idPublico(pid)) + 1;
      const t = r.llegadas[pid];
      await registrarPartida(j.uid, {
        juego: 'carrera',
        sala: r.code,
        url: `/carrera/sala/${r.code}`,
        resultado: pos === 1 ? 'victoria' : 'derrota',
        detalle: t ? `${(t / 1000).toFixed(2)} s` : 'no llegó',
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
