// "Último en pie": battle royale 2D. El servidor arma la partida, lleva quién sigue vivo, las bajas,
// el botín que ya se agarró y el ganador. El movimiento y los disparos van directo entre navegadores (WebRTC);
// los bots (NPC de cadalado) los simula el navegador del anfitrión y él avisa sus bajas.
import { crearJuego, idPublico } from '../../../shared/salas.js';
import { registrarPartida } from '../../../shared/cuenta.js';
import { getStore } from '../../../shared/store.js';
import { elegirNpcs, POR_ID } from '../../../shared/public/npcs.js';
import { dicho } from '../../../shared/public/dichos.js';
import { DURACION_MAX } from '../public/js/mundo.js';

const CUENTA_MS = 4000;
const FIN_MS = 20_000;
const MAX_JUGADORES = 24;
const MAX_BOTS = 15;

const nombreBot = (r, i) => {
  const id = r.botNpc[i];
  const rep = r.botNpc.slice(0, i).filter((x) => x === id).length;
  return (POR_ID[id]?.nombre || 'Bot') + (rep ? ` ${rep + 1}` : '');
};
const nombreDe = (r, id) => {
  if (id === 'zona') return 'la zona';
  if (String(id).startsWith('bot')) return nombreBot(r, Number(String(id).slice(3)));
  const pid = r.participantes.find((p) => idPublico(p) === id);
  return r.jugadores[pid]?.nombre || '—';
};

function baja(r, id, por, ctx) {
  if (!r.vivos.includes(id)) return;
  r.vivos = r.vivos.filter((x) => x !== id);
  r.bajas.push({ id, nombre: nombreDe(r, id), por, porNombre: nombreDe(r, por), puesto: r.vivos.length + 1, t: ctx.now - r.inicio });
  if (por && por !== 'zona' && por !== id) r.kills[por] = (r.kills[por] || 0) + 1;
  const texto = por === 'zona' ? `${nombreDe(r, id)} se quedó en la zona` : por === 'afuera' ? `${nombreDe(r, id)} se desconectó` : `${nombreDe(r, por)} eliminó a ${nombreDe(r, id)}`;
  ctx.sistema(`${texto} · quedan ${r.vivos.length}`);
  if (r.vivos.length <= 1) terminar(r, ctx);
}

function terminar(r, ctx) {
  r.fase = 'fin';
  r.ganador = r.vivos[0] || null;
  r.fin = ctx.now + FIN_MS;
  if (r.ganador) ctx.sistema(`¡${nombreDe(r, r.ganador)} es el último en pie!`);
}

export const royale = crearJuego({
  id: 'royale',
  nueva(opts) {
    const n = Number(opts.bots);
    const r = {
      fase: 'lobby',
      bots: Number.isInteger(n) && n >= 0 && n <= MAX_BOTS ? n : 9,
      semillaSala: crypto.getRandomValues(new Uint32Array(1))[0],
      botNpc: [],
      semilla: 1,
      inicio: 0,
      fin: 0,
      participantes: [],
      vivos: [],
      tomados: [],
      sueltos: [],
      propietarios: {},
      bajas: [],
      kills: {},
      ganador: null,
      habla: {},
      chequeo: 0,
      partidas: 0,
    };
    r.botNpc = elegirNpcs(r.bots, r.semillaSala);
    return r;
  },
  accion(r, msg, ctx) {
    const { pid } = ctx;
    const yo = idPublico(pid);
    switch (msg.t) {
      case 'bots': {
        const n = Number(msg.n);
        if (ctx.esHost && r.fase === 'lobby' && Number.isInteger(n) && n >= 0 && n <= MAX_BOTS) {
          r.bots = n;
          r.botNpc = elegirNpcs(n, r.semillaSala + r.partidas);
        }
        return {};
      }
      case 'empezar': {
        if (!ctx.esHost) return { error: 'Arranca quien armó la sala' };
        if (r.fase !== 'lobby' && r.fase !== 'fin') return {};
        r.participantes = Object.keys(r.jugadores).filter((p) => ctx.online.has(p) || p === pid).slice(0, MAX_JUGADORES);
        const nBots = Math.min(r.bots, MAX_JUGADORES - r.participantes.length);
        if (r.botNpc.length < nBots) r.botNpc = elegirNpcs(nBots, r.semillaSala + r.partidas);
        r.botNpc = r.botNpc.slice(0, nBots);
        if (r.participantes.length + nBots < 2) return { error: 'Hacen falta al menos 2 (sumá bots)' };
        r.semilla = crypto.getRandomValues(new Uint32Array(1))[0];
        r.inicio = ctx.now + CUENTA_MS;
        r.vivos = [...r.participantes.map(idPublico), ...r.botNpc.map((_, i) => 'bot' + i)];
        r.tomados = [];
        r.sueltos = [];
        r.propietarios = {};
        r.bajas = [];
        r.kills = {};
        r.ganador = null;
        r.habla = {};
        r.fase = 'cuenta';
        r.partidas += 1;
        ctx.sistema(`¡Arranca! ${r.vivos.length} en la isla. Quedate adentro de la zona.`);
        return {};
      }
      case 'agarrar': {
        // botín: el primero que lo pide se lo queda
        const id = typeof msg.id === 'string' && msg.id.startsWith('drop-') ? msg.id : Number(msg.id);
        if (r.fase !== 'partida' || (!Number.isInteger(id) && !r.sueltos?.some(b=>b.id===id)) || r.tomados.includes(id)) return {error:'Ese objeto ya no está disponible'};
        r.tomados.push(id);
        (r.propietarios??={})[id]=msg.bot && ctx.esHost ? msg.bot : yo;
        return {};
      }
      case 'soltar': {
        const b=msg.b;
        if(r.fase!=='partida'||!r.vivos.includes(yo)||!b||typeof b.id!=='string'||!b.id.startsWith('drop-'+yo+'-')||b.id.length>70)return {};
        const tipos=['pistola','subfusil','escopeta','rifle','mini','escudo','venda','botiquin','granada'];
        if(!tipos.includes(b.tipo)||![b.x,b.y].every(n=>Number.isFinite(n)&&n>=0&&n<=1536)||(r.sueltos?.length||0)>300)return {};
        r.sueltos??=[];if(!r.sueltos.some(s=>s.id===b.id))r.sueltos.push({id:b.id,tipo:b.tipo,x:b.x,y:b.y,item:{tipo:b.tipo,cantidad:Math.max(1,Math.min(10,Number(b.item?.cantidad)||1)),bala:Math.max(0,Math.min(30,Number(b.item?.bala)||0))}});
        return {};
      }
      case 'muerte': {
        if (r.fase !== 'partida') return {};
        const victima = String(msg.victima || '');
        const por = String(msg.por || '').slice(0, 24);
        // una persona avisa su propia muerte; las de los bots las avisa quien los simula
        if (victima === yo || (victima.startsWith('bot') && r.participantes.includes(pid))) baja(r, victima, por, ctx);
        return {};
      }
      case 'botdice': {
        // el anfitrión hace hablar a un bot (va al chat de todos); cada bot habla como mucho cada 6 s
        const b = String(msg.bot || '');
        const i = Number(b.slice(3));
        const npc = r.botNpc[i];
        const sit = ['saludo', 'gana', 'pierde', 'turno'].includes(msg.situacion) ? msg.situacion : 'turno';
        if (!npc || !r.participantes.includes(pid) || ctx.now - (r.habla[b] || 0) < 6000) return {};
        r.habla[b] = ctx.now;
        ctx.evento({ k: 'chat', de: b, nombre: nombreBot(r, i), npc, bot: true, texto: dicho(npc, sit, ctx.jugador?.nombre || 'alguien') });
        return {};
      }
      case 'mensaje': {
        // plan B de los mensajes directos (si no hay conexión entre navegadores)
        const destino = Object.keys(r.jugadores).find((p) => idPublico(p) === msg.para);
        const data = JSON.stringify(msg.datos ?? null);
        if (!destino || data.length > 2000) return {};
        ctx.evento({ k: 'msg', de: yo, datos: msg.datos, para: [destino] });
        return {};
      }
      case 'senal': {
        const destino = Object.keys(r.jugadores).find((p) => idPublico(p) === msg.para);
        const data = JSON.stringify(msg.data ?? null);
        if (!destino || data.length > 12_000) return {};
        ctx.evento({ k: 'senal', de: yo, data: msg.data, para: [destino] });
        return {};
      }
      default:
        return { error: 'Acción desconocida' };
    }
  },
  proximo: (r) => {
    if (r.fase === 'cuenta') return r.inicio;
    if (r.fase === 'partida') return Math.min(r.inicio + DURACION_MAX * 1000, r.chequeo + 5000);
    if (r.fase === 'fin') return r.fin;
    return Infinity;
  },
  tick(r, ctx) {
    if (r.fase === 'cuenta' && ctx.now >= r.inicio) {
      r.fase = 'partida';
      r.chequeo = ctx.now;
    } else if (r.fase === 'partida') {
      r.chequeo = ctx.now;
      // los que se fueron quedan afuera
      for (const p of r.participantes) if (!ctx.online.has(p) && r.vivos.includes(idPublico(p))) baja(r, idPublico(p), 'afuera', ctx);
      if (r.fase === 'partida' && ctx.now >= r.inicio + DURACION_MAX * 1000) terminar(r, ctx);
    } else if (r.fase === 'fin' && ctx.now >= r.fin) {
      r.fase = 'lobby';
      r.botNpc = elegirNpcs(r.bots, r.semillaSala + r.partidas);
    }
  },
  vista(r) {
    const id = idPublico;
    return {
      fase: r.fase,
      semilla: r.semilla,
      inicio: r.inicio,
      fin: r.fin,
      bots: r.bots,
      botNpc: r.botNpc,
      botNombres: r.botNpc.map((_, i) => nombreBot(r, i)),
      participantes: r.participantes.map(id),
      vivos: r.vivos,
      tomados: r.tomados,
      sueltos: r.sueltos || [],
      propietarios: r.propietarios || {},
      bajas: r.bajas,
      kills: r.kills,
      ganador: r.ganador,
      ganadorNombre: r.ganador ? nombreDe(r, r.ganador) : null,
      partidas: r.partidas,
    };
  },
  lobby(r) {
    const host = r.jugadores[r.host];
    return { titulo: host ? `Isla de ${host.nombre}` : 'Último en pie', fase: r.fase, jugadores: Object.keys(r.jugadores).length, bots: r.bots };
  },
  async despues(r, antes) {
    if (r.fase !== 'fin' || antes.fase === 'fin') return;
    const total = r.participantes.length + r.botNpc.length;
    for (const pid of r.participantes) {
      const j = r.jugadores[pid];
      if (!j?.uid) continue;
      const yo = idPublico(pid);
      const gano = r.ganador === yo;
      const b = r.bajas.find((x) => x.id === yo);
      await registrarPartida(j.uid, {
        juego: 'royale',
        sala: r.code,
        url: `/royale/sala/${r.code}`,
        resultado: gano ? 'victoria' : 'derrota',
        detalle: `${r.kills[yo] || 0} eliminaciones`,
        marcador: gano ? `1º de ${total}` : `${b?.puesto || '?'}º de ${total}`,
        rivales: [...r.participantes.filter((p) => p !== pid).map((p) => r.jugadores[p]?.nombre), ...r.botNpc.map((_, i) => nombreBot(r, i))].filter(Boolean).slice(0, 6),
      });
    }
  },
  // Plan B de posiciones (si dos navegadores no se conectan directo). El anfitrión manda también sus bots.
  async rutas(ruta, request, { json, readJson, limpiarPid }) {
    if (ruta !== '/pos') return null;
    const url = new URL(request.url);
    if (request.method === 'POST') {
      const b = await readJson(request);
      const pid = limpiarPid(b.pid);
      const code = String(b.code || '').toUpperCase();
      if (!pid || !/^[A-Z0-9-]{3,16}$/.test(code) || typeof b.s !== 'string' || b.s.length > 2400) return json({ error: 'inválido' }, 400);
      await getStore().hset(`pos:royale:${code}`, idPublico(pid), `${Date.now()}|${b.s}`, 600);
    }
    const code = String((request.method === 'POST' ? null : url.searchParams.get('code')) || '').toUpperCase();
    if (request.method === 'GET' && /^[A-Z0-9-]{3,16}$/.test(code)) {
      const all = await getStore().hgetall(`pos:royale:${code}`);
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
