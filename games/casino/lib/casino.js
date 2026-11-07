// Casino de cadalado: ruleta, blackjack y tragamonedas con fichas ficticias.
// Todo lo decide el servidor (con números al azar criptográficos): los navegadores solo muestran.
// Varias personas juegan en la misma mesa al mismo tiempo; el saldo de cada una está en fichas.js.
import { crearJuego, idPublico, entero, mezclar } from '../../../shared/salas.js';
import { quien, mover, saldo } from './fichas.js';

// ============================================================ RULETA (europea, un solo cero)
export const RUEDA = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const ROJOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const APUESTAS_MS = 22_000;
const GIRO_MS = 8_000;
const PAGO_MS = 6_500;
const FICHAS_VALIDAS = [10, 50, 100, 500, 1000, 5000];

// Casillero de apuesta → números que cubre y cuánto paga (además de devolver lo apostado).
export function casillero(k) {
  const m = /^n(\d{1,2})$/.exec(k);
  if (m && Number(m[1]) <= 36) return { nums: [Number(m[1])], paga: 35 };
  const r = (f, paga) => ({ nums: Array.from({ length: 36 }, (_, i) => i + 1).filter(f), paga });
  return {
    rojo: r((n) => ROJOS.has(n), 1),
    negro: r((n) => !ROJOS.has(n), 1),
    par: r((n) => n % 2 === 0, 1),
    impar: r((n) => n % 2 === 1, 1),
    falta: r((n) => n <= 18, 1),
    pasa: r((n) => n >= 19, 1),
    d1: r((n) => n <= 12, 2),
    d2: r((n) => n > 12 && n <= 24, 2),
    d3: r((n) => n > 24, 2),
    c1: r((n) => n % 3 === 1, 2),
    c2: r((n) => n % 3 === 2, 2),
    c3: r((n) => n % 3 === 0, 2),
  }[k];
}

function ruletaNueva() {
  return { fase: 'apuestas', fin: Date.now() + APUESTAS_MS, apuestas: {}, resultado: null, historial: [], pagos: {}, giro: 0 };
}

async function ruletaAccion(r, msg, ctx) {
  const { pid, jugador } = ctx;
  const q = quien(pid, jugador.uid);
  if (msg.t === 'apostar') {
    if (r.fase !== 'apuestas') return { error: 'No va más: esperá la próxima' };
    const monto = Number(msg.monto);
    if (!FICHAS_VALIDAS.includes(monto) || !casillero(msg.casillero)) return { error: 'Apuesta inválida' };
    const mias = (r.apuestas[pid] ||= []);
    if (mias.length >= 80) return { error: 'Llegaste al máximo de fichas en la mesa' };
    await mover(q, -monto);
    mias.push({ k: msg.casillero, m: monto });
    return {};
  }
  if (msg.t === 'deshacer' || msg.t === 'limpiar') {
    if (r.fase !== 'apuestas') return {};
    const mias = r.apuestas[pid] || [];
    const sacar = msg.t === 'deshacer' ? mias.splice(-1) : mias.splice(0);
    const total = sacar.reduce((a, b) => a + b.m, 0);
    if (total) await mover(q, total);
    return {};
  }
  if (msg.t === 'repetir') {
    if (r.fase !== 'apuestas' || r.apuestas[pid]?.length) return {};
    const prev = r.ultimas?.[pid] || [];
    const total = prev.reduce((a, b) => a + b.m, 0);
    if (!total) return { error: 'No hay apuesta anterior' };
    await mover(q, -total);
    r.apuestas[pid] = prev.map((x) => ({ ...x }));
    return {};
  }
  return { error: 'Acción desconocida' };
}

async function ruletaTick(r, ctx) {
  if (ctx.now < r.fin) return;
  if (ctx.now - r.fin > 60_000) {
    // la mesa estuvo vacía un rato: arranca una ronda nueva
    Object.assign(r, { fase: 'apuestas', fin: ctx.now + APUESTAS_MS, pagos: {} });
    return;
  }
  if (r.fase === 'apuestas') {
    r.fase = 'girando';
    r.resultado = entero(37);
    r.giro += 1;
    r.fin = ctx.now + GIRO_MS;
  } else if (r.fase === 'girando') {
    const n = r.resultado;
    r.pagos = {};
    for (const [pid, lista] of Object.entries(r.apuestas)) {
      let gana = 0;
      let puso = 0;
      for (const a of lista) {
        puso += a.m;
        const c = casillero(a.k);
        if (c.nums.includes(n)) gana += a.m * (c.paga + 1);
      }
      if (gana) await mover(quien(pid, r.jugadores[pid]?.uid), gana);
      r.pagos[pid] = { puso, gana };
    }
    const grandes = Object.entries(r.pagos).filter(([, p]) => p.gana > p.puso).sort((a, b) => b[1].gana - a[1].gana);
    ctx.sistema(`Salió el ${n} ${n === 0 ? 'verde' : ROJOS.has(n) ? 'rojo' : 'negro'}` + (grandes[0] ? ` · ${r.jugadores[grandes[0][0]]?.nombre} se lleva ${grandes[0][1].gana.toLocaleString('es-AR')}` : ''));
    r.historial = [n, ...r.historial].slice(0, 16);
    r.ultimas = Object.fromEntries(Object.entries(r.apuestas).filter(([, l]) => l.length));
    r.apuestas = {};
    r.fase = 'pago';
    r.fin = ctx.now + PAGO_MS;
  } else {
    r.fase = 'apuestas';
    r.fin = ctx.now + APUESTAS_MS;
  }
}

function ruletaVista(r, { pid }) {
  const id = idPublico;
  return {
    fase: r.fase,
    fin: r.fin,
    giro: r.giro,
    resultado: r.fase === 'apuestas' ? null : r.resultado,
    historial: r.historial,
    apuestas: Object.entries(r.apuestas).map(([p, l]) => ({ id: id(p), lista: l })),
    pagos: r.fase === 'pago' ? Object.entries(r.pagos).map(([p, x]) => ({ id: id(p), ...x })) : [],
    puedeRepetir: !!r.ultimas?.[pid]?.length,
  };
}

// ============================================================ BLACKJACK
const PALOS = ['P', 'C', 'D', 'T']; // picas, corazones, diamantes, tréboles
const VALORES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const ASIENTOS = 5;
const BJ_APUESTAS_MS = 15_000;
const TURNO_MS = 20_000;
const BANCA_PASO_MS = 950;
const BJ_PAGO_MS = 6_000;

function zapato() {
  const z = [];
  for (let m = 0; m < 6; m++) for (const p of PALOS) for (const v of VALORES) z.push(v + p);
  return mezclar(z);
}
export function puntaje(cartas) {
  let total = 0;
  let ases = 0;
  for (const c of cartas) {
    const v = c.slice(0, -1);
    if (v === 'A') {
      ases++;
      total += 11;
    } else total += ['J', 'Q', 'K'].includes(v) ? 10 : Number(v);
  }
  while (total > 21 && ases) {
    total -= 10;
    ases--;
  }
  return { total, blanda: ases > 0 };
}
const esBJ = (cartas) => cartas.length === 2 && puntaje(cartas).total === 21;

function bjNueva() {
  return { fase: 'espera', fin: 0, asientos: Array(ASIENTOS).fill(null), banca: [], oculta: true, turno: -1, zapato: zapato() };
}

function sacar(r) {
  if (r.zapato.length < 60) r.zapato = zapato();
  return r.zapato.pop();
}

function bjSiguienteTurno(r, ctx) {
  for (let i = r.turno + 1; i < ASIENTOS; i++) {
    const a = r.asientos[i];
    if (a?.estado === 'jugando') {
      r.turno = i;
      r.fin = ctx.now + TURNO_MS;
      return;
    }
  }
  r.turno = -1;
  r.fase = 'banca';
  r.oculta = false;
  r.fin = ctx.now + BANCA_PASO_MS;
}

async function bjLiquidar(r, ctx) {
  const banca = puntaje(r.banca).total;
  const bancaBJ = esBJ(r.banca);
  const nombres = [];
  for (const a of r.asientos) {
    if (!a?.apuesta || !a.cartas.length) continue;
    const yo = puntaje(a.cartas).total;
    let cobra = 0;
    if (a.estado === 'pasado') a.res = 'pierde';
    else if (esBJ(a.cartas) && a.cartas.length === 2 && !a.doblo) {
      a.res = bancaBJ ? 'empate' : 'blackjack';
      cobra = bancaBJ ? a.apuesta : Math.floor(a.apuesta * 2.5);
    } else if (bancaBJ) a.res = 'pierde';
    else if (banca > 21 || yo > banca) {
      a.res = 'gana';
      cobra = a.apuesta * 2;
    } else if (yo === banca) {
      a.res = 'empate';
      cobra = a.apuesta;
    } else a.res = 'pierde';
    a.cobra = cobra;
    if (cobra) await mover(quien(a.pid, r.jugadores[a.pid]?.uid), cobra);
    if (cobra > a.apuesta) nombres.push(r.jugadores[a.pid]?.nombre);
  }
  ctx.sistema(`La banca hizo ${banca > 21 ? `${banca} y se pasó` : banca}${nombres.length ? ` · ganan ${nombres.join(', ')}` : ''}`);
  r.fase = 'pago';
  r.fin = ctx.now + BJ_PAGO_MS;
}

async function bjAccion(r, msg, ctx) {
  const { pid, jugador } = ctx;
  const q = quien(pid, jugador.uid);
  const mio = r.asientos.findIndex((a) => a?.pid === pid);
  const a = r.asientos[mio];
  switch (msg.t) {
    case 'sentarse': {
      const i = Number(msg.asiento);
      if (mio >= 0) return { error: 'Ya estás sentado' };
      if (!(i >= 0 && i < ASIENTOS) || r.asientos[i]) return { error: 'Ese lugar está ocupado' };
      r.asientos[i] = { pid, apuesta: 0, cartas: [], estado: 'espera' };
      if (r.fase === 'espera') {
        r.fase = 'apuestas';
        r.fin = ctx.now + BJ_APUESTAS_MS;
      }
      return {};
    }
    case 'levantarse': {
      if (mio < 0) return {};
      if (r.fase !== 'apuestas' && r.fase !== 'espera' && r.fase !== 'pago' && a.cartas.length) return { error: 'Terminá la mano primero' };
      if (a.apuesta && r.fase === 'apuestas') await mover(q, a.apuesta);
      r.asientos[mio] = null;
      return {};
    }
    case 'apostar': {
      if (r.fase !== 'apuestas' || !a) return { error: 'Esperá la próxima mano' };
      const monto = Number(msg.monto);
      if (!FICHAS_VALIDAS.includes(monto)) return { error: 'Apuesta inválida' };
      if (a.apuesta + monto > 50_000) return { error: 'La apuesta máxima es 50.000' };
      await mover(q, -monto);
      a.apuesta += monto;
      return {};
    }
    case 'limpiar': {
      if (r.fase !== 'apuestas' || !a?.apuesta) return {};
      await mover(q, a.apuesta);
      a.apuesta = 0;
      return {};
    }
    case 'pedir':
    case 'plantarse':
    case 'doblar': {
      if (r.fase !== 'jugando' || r.turno !== mio) return { error: 'No es tu turno' };
      if (msg.t === 'doblar') {
        if (a.cartas.length !== 2) return { error: 'Solo se dobla con las dos primeras cartas' };
        await mover(q, -a.apuesta);
        a.apuesta *= 2;
        a.doblo = true;
        a.cartas.push(sacar(r));
        a.estado = puntaje(a.cartas).total > 21 ? 'pasado' : 'plantado';
      } else if (msg.t === 'pedir') {
        a.cartas.push(sacar(r));
        const t = puntaje(a.cartas).total;
        if (t > 21) a.estado = 'pasado';
        else if (t === 21) a.estado = 'plantado';
        else {
          r.fin = ctx.now + TURNO_MS;
          return {};
        }
      } else a.estado = 'plantado';
      bjSiguienteTurno(r, ctx);
      return {};
    }
    default:
      return { error: 'Acción desconocida' };
  }
}

async function bjTick(r, ctx) {
  if (r.fase === 'espera' || ctx.now < r.fin) return;
  if (r.fase === 'apuestas') {
    // se van los que se desconectaron sin apostar
    r.asientos.forEach((a, i) => {
      if (a && !a.apuesta && !ctx.online.has(a.pid)) r.asientos[i] = null;
    });
    const jugando = r.asientos.filter((a) => a?.apuesta > 0);
    if (!jugando.length) {
      if (r.asientos.some(Boolean)) r.fin = ctx.now + BJ_APUESTAS_MS;
      else r.fase = 'espera';
      return;
    }
    r.banca = [];
    r.oculta = true;
    for (const a of r.asientos) if (a) Object.assign(a, { cartas: [], estado: a.apuesta ? 'jugando' : 'espera', res: null, cobra: 0, doblo: false });
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      for (const a of r.asientos) if (a?.apuesta) a.cartas.push(sacar(r));
      r.banca.push(sacar(r));
    }
    for (const a of r.asientos) if (a?.apuesta && esBJ(a.cartas)) a.estado = 'plantado';
    r.fase = 'jugando';
    r.turno = -1;
    // si la banca tiene blackjack se ve enseguida
    if (esBJ(r.banca)) {
      r.oculta = false;
      return bjLiquidar(r, ctx);
    }
    bjSiguienteTurno(r, ctx);
    return;
  }
  if (r.fase === 'jugando') {
    // se le terminó el tiempo: se planta solo
    const a = r.asientos[r.turno];
    if (a) a.estado = 'plantado';
    bjSiguienteTurno(r, ctx);
    return;
  }
  if (r.fase === 'banca') {
    const vivos = r.asientos.some((a) => a?.apuesta && a.estado !== 'pasado');
    const { total } = puntaje(r.banca);
    if (vivos && total < 17) { // la banca se planta con 17 (también con 17 blando)
      r.banca.push(sacar(r));
      r.fin = ctx.now + BANCA_PASO_MS;
      return;
    }
    return bjLiquidar(r, ctx);
  }
  if (r.fase === 'pago') {
    for (const a of r.asientos) if (a) Object.assign(a, { apuesta: 0, cartas: [], estado: 'espera', res: null, cobra: 0, doblo: false });
    r.banca = [];
    r.fase = r.asientos.some(Boolean) ? 'apuestas' : 'espera';
    r.fin = ctx.now + BJ_APUESTAS_MS;
  }
}

function bjVista(r, { pid }) {
  return {
    fase: r.fase,
    fin: r.fin,
    turno: r.turno,
    banca: r.oculta ? [r.banca[0], 'X'].filter(Boolean) : r.banca,
    bancaTotal: r.oculta ? (r.banca[0] ? puntaje([r.banca[0]]).total : 0) : puntaje(r.banca).total,
    asientos: r.asientos.map((a) =>
      a
        ? { id: idPublico(a.pid), nombre: r.jugadores[a.pid]?.nombre || '—', soyYo: a.pid === pid, apuesta: a.apuesta, cartas: a.cartas, total: puntaje(a.cartas).total, estado: a.estado, res: a.res, cobra: a.cobra }
        : null
    ),
    quedan: r.zapato.length,
  };
}

// ============================================================ TRAGAMONEDAS
// Rodillos con símbolos repetidos según lo común que son. 3 rodillos, se ven 3 filas, 5 líneas.
export const SIMBOLOS = ['cereza', 'limon', 'naranja', 'uva', 'campana', 'bar', 'diamante', 'siete'];
const PESOS = { cereza: 7, limon: 6, naranja: 6, uva: 5, campana: 4, bar: 3, diamante: 2, siete: 1 };
const TRIPLE = { cereza: 10, limon: 12, naranja: 15, uva: 25, campana: 40, bar: 80, diamante: 150, siete: 400 };
const RODILLO = Object.entries(PESOS).flatMap(([s, n]) => Array(n).fill(s));
export const LINEAS = [
  [[0, 1], [1, 1], [2, 1]], // medio
  [[0, 0], [1, 0], [2, 0]], // arriba
  [[0, 2], [1, 2], [2, 2]], // abajo
  [[0, 0], [1, 1], [2, 2]], // diagonal
  [[0, 2], [1, 1], [2, 0]], // diagonal
];
const POZO_INICIAL = 25_000;
const APUESTAS_SLOT = [10, 50, 100, 500, 1000];

export function tirada() {
  // cada rodillo: 3 símbolos visibles (arriba, medio, abajo)
  const rod = [0, 1, 2].map(() => {
    const i = entero(RODILLO.length);
    return [RODILLO[(i + RODILLO.length - 1) % RODILLO.length], RODILLO[i], RODILLO[(i + 1) % RODILLO.length]];
  });
  return rod;
}

export function premios(rod, apuesta) {
  const porLinea = apuesta / LINEAS.length;
  const lineas = [];
  let total = 0;
  let jackpot = false;
  LINEAS.forEach((l, i) => {
    const s = l.map(([c, f]) => rod[c][f]);
    let mult = 0;
    if (s[0] === s[1] && s[1] === s[2]) {
      mult = TRIPLE[s[0]];
      if (s[0] === 'siete' && i === 0) jackpot = true;
    } else if (s[0] === 'cereza' && s[1] === 'cereza') mult = 3;
    else if (s[0] === 'cereza') mult = 2;
    if (mult) {
      lineas.push(i);
      total += Math.floor(porLinea * mult);
    }
  });
  return { total, lineas, jackpot };
}

function slotsNueva() {
  return { pozo: POZO_INICIAL, feed: [], tiradas: 0, ultimas: {} };
}

async function slotsAccion(r, msg, ctx) {
  if (msg.t !== 'tirar') return { error: 'Acción desconocida' };
  const { pid, jugador } = ctx;
  const apuesta = Number(msg.apuesta);
  if (!APUESTAS_SLOT.includes(apuesta)) return { error: 'Apuesta inválida' };
  const q = quien(pid, jugador.uid);
  await mover(q, -apuesta);
  const rod = tirada();
  const p = premios(rod, apuesta);
  let gana = p.total;
  let pozo = 0;
  if (p.jackpot && apuesta >= 100) {
    // el pozo completo solo con apuestas de 100 o más; con menos, una parte
    pozo = r.pozo;
    r.pozo = POZO_INICIAL;
  } else if (p.jackpot) {
    pozo = Math.floor(r.pozo * (apuesta / 100));
    r.pozo -= pozo;
  }
  gana += pozo;
  r.pozo += Math.ceil(apuesta * 0.03);
  r.tiradas += 1;
  if (gana) await mover(q, gana);
  r.ultimas[pid] = { rod, lineas: p.lineas, gana, pozo, apuesta, n: r.tiradas };
  if (gana >= apuesta * 10 || pozo) {
    r.feed = [{ nombre: jugador.nombre, gana, pozo: !!pozo, ts: ctx.now }, ...r.feed].slice(0, 12);
    if (pozo) ctx.sistema(`🎰 ¡${jugador.nombre} se llevó el pozo de ${gana.toLocaleString('es-AR')}!`);
  }
  return {};
}

function slotsVista(r, { pid }) {
  return { pozo: r.pozo, feed: r.feed, tiradas: r.tiradas, ultima: r.ultimas[pid] || null };
}

// ============================================================ juego
const TIPOS = {
  ruleta: { nueva: ruletaNueva, accion: ruletaAccion, tick: ruletaTick, vista: ruletaVista, proximo: (r) => r.fin },
  blackjack: { nueva: bjNueva, accion: bjAccion, tick: bjTick, vista: bjVista, proximo: (r) => (r.fase === 'espera' ? Infinity : r.fin) },
  slots: { nueva: slotsNueva, accion: slotsAccion, tick: null, vista: slotsVista, proximo: () => Infinity },
};
export const NOMBRES = { ruleta: 'Ruleta', blackjack: 'Blackjack', slots: 'Tragamonedas' };

export const MESAS_PUBLICAS = {
  RULETA: { tipo: 'ruleta', nombre: 'Ruleta principal' },
  'RULETA-2': { tipo: 'ruleta', nombre: 'Ruleta 2' },
  'BLACKJACK-1': { tipo: 'blackjack', nombre: 'Blackjack 1' },
  'BLACKJACK-2': { tipo: 'blackjack', nombre: 'Blackjack 2' },
  SLOTS: { tipo: 'slots', nombre: 'Salón de tragamonedas' },
};

export const casino = crearJuego({
  id: 'casino',
  publicas: MESAS_PUBLICAS,
  nueva(opts) {
    const tipo = TIPOS[opts.tipo] ? opts.tipo : 'ruleta';
    return { tipo, nombre: String(opts.nombre || `Mesa de ${NOMBRES[tipo].toLowerCase()}`).slice(0, 40), ...TIPOS[tipo].nueva() };
  },
  accion: (r, msg, ctx) => TIPOS[r.tipo].accion(r, msg, ctx),
  proximo: (r) => TIPOS[r.tipo].proximo(r),
  async tick(r, ctx) {
    if (TIPOS[r.tipo].tick) await TIPOS[r.tipo].tick(r, ctx);
  },
  vista: (r, ctx) => ({ tipo: r.tipo, nombre: r.nombre, publica: r.publica, ...TIPOS[r.tipo].vista(r, ctx) }),
  lobby: (r) => ({ tipo: r.tipo, nombre: r.nombre, publica: r.publica, jugadores: Object.keys(r.jugadores).length }),
  async extra(r, pid) {
    const j = pid && r.jugadores[pid];
    return j ? { saldo: await saldo(quien(pid, j.uid)) } : {};
  },
  async rutas(ruta, request, { json, readJson, usuarioActual, limpiarPid }) {
    if (ruta === '/saldo' || ruta === '/ayuda') {
      const body = request.method === 'POST' ? await readJson(request) : Object.fromEntries(new URL(request.url).searchParams);
      const pid = limpiarPid(body.pid);
      if (!pid) return json({ error: 'Identificador inválido' }, 400);
      const u = await usuarioActual(request);
      const q = quien(pid, u?.id);
      if (ruta === '/ayuda') {
        const { ayuda } = await import('./fichas.js');
        return json({ saldo: await ayuda(q) });
      }
      return json({ saldo: await saldo(q), cuenta: !!u });
    }
    return null;
  },
});
