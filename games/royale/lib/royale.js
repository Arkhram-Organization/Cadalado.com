// "Battle Shmitz": battle royale 3D. El servidor arma la partida, lleva quién sigue vivo, las bajas,
// el botín que ya se agarró y el ganador. El movimiento y los disparos van directo entre navegadores (WebRTC);
// los bots (NPC de cadalado) los simula el navegador del anfitrión y él avisa sus bajas.
import { crearJuego, idPublico } from '../../../shared/salas.js';
import { registrarPartida } from '../../../shared/cuenta.js';
import { premiar, avisoPremios } from '../../../shared/premios.js';
import { getStore } from '../../../shared/store.js';
import { elegirNpcs, POR_ID } from '../../../shared/public/npcs.js';
import { dicho } from '../../../shared/public/dichos.js';
import { DURACION_MAX, LADO, TAM, T, BALDOSA, CAJAS, MATERIALES, generarMapa } from '../public/js/mundo.js';
import { COSTO_PIEZA, VIDA_PIEZA, validarPieza } from '../public/js/construccion.js';

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
  // si ya no queda ninguna persona viva, no tiene sentido seguir (los bots solos no terminan nunca)
  if (r.vivos.length <= 1 || !r.vivos.some((x) => !String(x).startsWith('bot'))) terminar(r, ctx);
}

function terminar(r, ctx) {
  r.fase = 'fin';
  // si se terminó el tiempo y queda una sola persona (con bots trabados), gana la persona
  const personas = r.vivos.filter((x) => !String(x).startsWith('bot'));
  r.ganador = r.vivos.length === 1 ? r.vivos[0] : personas.length === 1 ? personas[0] : r.vivos[0] || null;
  r.fin = ctx.now + FIN_MS;
  if (r.ganador) ctx.sistema(`¡${nombreDe(r, r.ganador)} es el ganador de Battle Shmitz!`);
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
      abiertos: [],
      aperturas: {},
      fuentes: {},
      materiales: {},
      municion: {},
      construcciones: [],
      golpes: {},
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
        r.propietarios = Object.fromEntries(r.vivos.map(id => ['inicio-' + id, id]));
        r.abiertos = []; r.aperturas = {}; r.fuentes = {}; r.construcciones = []; r.golpes = {};
        r.materiales = Object.fromEntries(r.vivos.map(id => [id, {madera: 0, piedra: 0, metal: 0}]));
        r.municion = Object.fromEntries(r.vivos.map(id => [id, {livianas: 48, medianas: 0, pesadas: 0, cartuchos: 0, cohetes: 0}]));
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
        const original = Number.isInteger(id) ? generarMapa(r.semilla).botin[id] : r.sueltos?.find(b => b.id === id);
        const dueno = msg.bot && ctx.esHost && r.vivos.includes(msg.bot) ? msg.bot : yo;
        if (r.propietarios?.[id] === dueno) return {}; // el mismo pedido repetido (reintento): ya es suyo
        if (r.fase !== 'partida' || !r.vivos.includes(dueno) || !original || original.tipo === 'cofre' || (original.cofre !== undefined && !r.abiertos.includes(original.cofre)) || r.tomados.includes(id)) return {error:'Ese objeto ya no está disponible'};
        if (MATERIALES[original.tipo]) {
          r.materiales[dueno] ??= {madera:0,piedra:0,metal:0};
          r.materiales[dueno][original.tipo] = Math.min(500, r.materiales[dueno][original.tipo] + 30);
          r.tomados.push(id);
          return {};
        }
        if (CAJAS[original.tipo]) {
          const caja = CAJAS[original.tipo];
          r.municion[dueno] ??= {};
          r.municion[dueno][caja.municion] = Math.min(999, (r.municion[dueno][caja.municion] || 0) + caja.cantidad);
          r.tomados.push(id);
          return {};
        }
        const cambio = msg.cambio;
        if (cambio) {
          const viejo = cambio.item?.id;
          const origen = String(viejo).startsWith('inicio-') ? {tipo:'pistola',rareza:'comun'} : Number.isInteger(Number(viejo)) ? generarMapa(r.semilla).botin[Number(viejo)] : r.sueltos.find(b=>b.id===viejo);
          if (!viejo || r.propietarios[viejo] !== dueno || cambio.tipo !== cambio.item?.tipo || cambio.tipo !== origen?.tipo || (origen.rareza || origen.item?.rareza || 'comun') !== (cambio.item?.rareza || 'comun') || !String(cambio.id).startsWith('drop-' + dueno + '-') || r.sueltos.some(b => b.id === cambio.id) || Math.hypot(cambio.x - original.x, cambio.y - original.y) > 2) return {error:'Ese objeto no es tuyo'};
          r.sueltos.push({id:cambio.id,tipo:cambio.tipo,x:original.x,y:original.y,rareza:cambio.item.rareza||'comun',item:{...cambio.item}});
          r.propietarios[viejo] = 'suelo';
        }
        r.tomados.push(id);
        (r.propietarios??={})[id]=dueno;
        return {};
      }
      case 'iniciarCofre': {
        const id = Number(msg.id);
        const b = generarMapa(r.semilla).botin[id];
        if (r.fase !== 'partida' || !r.vivos.includes(yo) || b?.tipo !== 'cofre' || r.abiertos.includes(id)) return {error:'Ese cofre no está disponible'};
        r.aperturas[yo + ':' + id] = ctx.now;
        return {};
      }
      case 'abrirCofre': {
        const id = Number(msg.id);
        const b = generarMapa(r.semilla).botin[id];
        if (r.fase !== 'partida' || !r.vivos.includes(yo) || b?.tipo !== 'cofre') return {error:'Ese cofre no está disponible'};
        if (r.abiertos.includes(id)) return {}; // apertura idempotente: dos personas pueden pulsar a la vez
        r.abiertos.push(id);
        r.tomados.push(id);
        delete r.aperturas[yo + ':' + id];
        ctx.sistema(`¡${nombreDe(r, yo)} abrió un cofre!`);
        return {};
      }
      case 'dispararFuente': {
        // árboles, rocas, autos y cajas también se rompen a tiros (sin dar materiales)
        const id = String(msg.id || '');
        const o = generarMapa(r.semilla).obstaculos.find((x) => x.id === id);
        if (r.fase !== 'partida' || !r.vivos.includes(yo) || !o || o.vida > 5000) return {};
        r.tiros ??= {};
        if (ctx.now - (r.tiros[yo] || 0) < 70) return {};
        r.tiros[yo] = ctx.now;
        const vida = r.fuentes[id]?.vida ?? o.vida;
        if (vida <= 0) return {};
        r.fuentes[id] = { vida: Math.max(0, vida - Math.min(120, Math.max(0, Number(msg.dano) || 0))), golpes: r.fuentes[id]?.golpes || 0 };
        return {};
      }
      case 'picar': {
        const id = String(msg.id || '');
        const dueno = msg.bot && ctx.esHost && r.vivos.includes(msg.bot) ? msg.bot : yo;
        const mapa = generarMapa(r.semilla);
        const obstaculo = mapa.obstaculos.find(o => o.id === id);
        const baldosa = /^m\d+$/.test(id) ? Number(id.slice(1)) : -1;
        const pared = baldosa >= 0 && baldosa < TAM * TAM && mapa.t[baldosa] === T.PARED;
        if (r.fase !== 'partida' || !r.vivos.includes(dueno) || (!obstaculo && !pared) || ctx.now - (r.golpes[dueno] || 0) < 450) return {error:'No podés picar eso'};
        const vida = obstaculo?.vida || 100;
        const golpe = (r.fuentes[id]?.golpes || 0) + 1;
        if ((r.fuentes[id]?.vida ?? vida) <= 0) return {error:'Eso ya se rompió'};
        r.golpes[dueno] = ctx.now;
        const restante = Math.max(0, (r.fuentes[id]?.vida ?? vida) - 25);
        r.fuentes[id] = { vida: restante, golpes: golpe };
        const material = obstaculo?.material || 'piedra';
        const cantidad = 5 + ((r.semilla ^ baldosa ^ golpe * 17 ^ id.length) >>> 0) % 6;
        r.materiales[dueno] ??= {madera:0,piedra:0,metal:0};
        r.materiales[dueno][material] = Math.min(500, r.materiales[dueno][material] + cantidad);
        return {};
      }
      case 'construir': {
        const p = msg.pieza;
        const dueno = msg.bot && ctx.esHost && r.vivos.includes(msg.bot) ? msg.bot : yo;
        if (r.fase !== 'partida' || !r.vivos.includes(dueno) || !p || typeof p.id !== 'string' || !p.id.startsWith('pieza-' + dueno + '-') || p.id.length > 75 || r.construcciones.length >= 400 || r.construcciones.some(x => x.id === p.id)) return {error:'No podés construir ahí'};
        const materiales = r.materiales[dueno] || {};
        if (!validarPieza(generarMapa(r.semilla), r.construcciones, p, materiales)) return {error:'No podés construir ahí'};
        materiales[p.material] -= COSTO_PIEZA;
        r.construcciones.push({id:p.id,dueno,x:p.x,y:p.y,tipo:p.tipo,material:p.material,rotacion:p.rotacion,vida:VIDA_PIEZA[p.material],dano:0,inicio:ctx.now});
        return {};
      }
      case 'danarPieza': {
        const p = r.construcciones.find(x => x.id === msg.id && x.vida > 0);
        if (r.fase !== 'partida' || !r.vivos.includes(yo) || !p) return {error:'Esa pieza ya no está'};
        const vidaActual = Math.max(0, Math.min(p.vida, VIDA_PIEZA[p.material] * Math.min(1, (ctx.now - p.inicio) / 1000)) - (p.dano || 0));
        const golpe = Math.min(200, Math.max(0, Number(msg.dano) || 0));
        p.dano = (p.dano || 0) + golpe;
        if (golpe >= vidaActual) p.vida = 0;
        return {};
      }
      case 'soltar': {
        const b=msg.b;
        if(r.fase!=='partida'||!r.vivos.includes(yo)||!b||typeof b.id!=='string'||!b.id.startsWith('drop-'+yo+'-')||b.id.length>70)return {error:'No podés soltar eso'};
        const tipos=['pistola','subfusil','escopeta','rifle','francotirador','rpg','mini','escudo','venda','botiquin','granada'];
        const viejo=b.item?.id;
        const origen=String(viejo).startsWith('inicio-')?{tipo:'pistola',rareza:'comun'}:Number.isInteger(Number(viejo))?generarMapa(r.semilla).botin[Number(viejo)]:r.sueltos.find(s=>s.id===viejo);
        if(!tipos.includes(b.tipo)||![b.x,b.y].every(n=>Number.isFinite(n)&&n>=0&&n<=LADO)||(r.sueltos?.length||0)>300||r.propietarios[viejo]!==yo||b.item?.tipo!==b.tipo||origen?.tipo!==b.tipo||(origen.rareza||origen.item?.rareza||'comun')!==(b.item?.rareza||'comun'))return {error:'Ese objeto no es tuyo'};
        r.sueltos??=[];if(!r.sueltos.some(s=>s.id===b.id)){r.sueltos.push({id:b.id,tipo:b.tipo,x:b.x,y:b.y,rareza:b.item.rareza||'comun',item:{tipo:b.tipo,id:b.item.id,rareza:b.item.rareza||'comun',cantidad:Math.max(1,Math.min(10,Number(b.item?.cantidad)||1)),bala:Math.max(0,Math.min(30,Number(b.item?.bala)||0))}});r.propietarios[b.item.id]='suelo';}
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
      // red de seguridad: con la tormenta cerrada del todo (20 de daño por segundo) nadie aguanta 25 s;
      // si algún bot figura vivo es porque nadie lo estaba simulando: queda afuera
      if (r.fase === 'partida' && ctx.now >= r.inicio + (DURACION_MAX - 60 + 25) * 1000)
        for (const b of r.vivos.filter((x) => String(x).startsWith('bot'))) if (r.fase === 'partida') baja(r, b, 'zona', ctx);
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
      abiertos: r.abiertos || [],
      fuentes: r.fuentes || {},
      materiales: r.materiales || {},
      municion: r.municion || {},
      construcciones: (r.construcciones || []).map(p=>({...p,vida:p.vida<=0?0:Math.max(1,Math.min(p.vida,VIDA_PIEZA[p.material]*Math.min(1,(Date.now()-p.inicio)/1000))-(p.dano||0))})),
      bajas: r.bajas,
      kills: r.kills,
      ganador: r.ganador,
      ganadorNombre: r.ganador ? nombreDe(r, r.ganador) : null,
      partidas: r.partidas,
    };
  },
  lobby(r) {
    const host = r.jugadores[r.host];
    return { titulo: host ? `Battle Shmitz de ${host.nombre}` : 'Battle Shmitz', fase: r.fase, jugadores: Object.keys(r.jugadores).length, bots: r.bots };
  },
  async despues(r, antes, ctx) {
    if (r.fase !== 'fin' || antes.fase === 'fin') return;
    const total = r.participantes.length + r.botNpc.length;
    const pagos = [];
    for (const pid of r.participantes) {
      const j = r.jugadores[pid];
      if (!j) continue;
      const yo = idPublico(pid);
      const gano = r.ganador === yo;
      const b = r.bajas.find((x) => x.id === yo);
      const puesto = gano ? 1 : b?.puesto || total;
      pagos.push({ nombre: j.nombre, monto: await premiar(pid, j.uid, gano ? 'victoria' : 'derrota', (r.kills[yo] || 0) * 120 + (total - puesto) * 40) });
      if (!j.uid) continue;
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
    const aviso = avisoPremios(pagos);
    if (aviso) ctx?.sistema?.(aviso);
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
