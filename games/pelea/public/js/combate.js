// Una pelea completa de Piña Final: rondas (al mejor de N), presentación, remate y festejo.
// Puro (sin navegador). Lo corre la compu en el modo local o el anfitrión online; los demás reciben
// `codificar(c)` unas 20 veces por segundo y lo dibujan.
import { PASO, nuevoMundo, paso, sortearPoderes, ELEMENTOS, LISTA_ELEMENTOS, LISTA_ARMAS, LISTA_ATAQUES, ESTADOS } from './motor.js';

const INTRO = 2.6, PAUSA_KO = 3.4;

// luchadores: [{ id, eq: 0|1, npc, nombre, bot }]
export function crearCombate({ luchadores, mejorDe = 3, tiempo = 90, r = Math.random }) {
  const c = { luchadores, mejorDe, tiempo, victorias: [0, 0], ronda: 0, fase: 'intro', t: 0, m: null, anuncio: null, anuncioN: 0, ganador: null, poderes: {}, r, perfecta: false };
  nuevaRonda(c);
  return c;
}
export const necesarias = (c) => Math.ceil(c.mejorDe / 2);

function anunciar(c, texto, sub = '', tipo = '') {
  c.anuncioN += 1;
  c.anuncio = { texto, sub, tipo, n: c.anuncioN, t: c.t };
}

function nuevaRonda(c) {
  c.ronda += 1;
  c.poderes = sortearPoderes(c.luchadores, c.r);
  const nec = necesarias(c);
  c.evVisto = 0; c.parada = 0; c.lento = 0;
  c.m = nuevoMundo(c.luchadores, c.poderes, { tiempo: c.tiempo || 9999, decisivo: [c.victorias[0] + 1 >= nec, c.victorias[1] + 1 >= nec] });
  c.fase = 'intro'; c.t = 0;
  const ultima = c.victorias[0] === nec - 1 && c.victorias[1] === nec - 1 && nec > 1;
  anunciar(c, ultima ? 'RONDA FINAL' : `RONDA ${c.ronda}`, '', 'ronda');
}

export const nombreEquipo = (c, eq) => {
  const ls = c.luchadores.filter((l) => l.eq === eq);
  return ls.map((l) => l.nombre).join(' y ') || (eq ? 'Derecha' : 'Izquierda');
};

export function pasoCombate(c, entradas) {
  c.t += PASO;
  const m = c.m;
  if (c.fase === 'intro') {
    paso(m, new Map());
    if (c.t >= INTRO - .9 && c.anuncio?.tipo === 'ronda') anunciar(c, '¡PELEEN!', '', 'peleen');
    if (c.t >= INTRO) { c.fase = 'pelea'; m.fase = 'pelea'; c.t = 0; }
    return;
  }
  // impacto: el mundo se frena un instante (se siente el golpe); K.O.: cámara lenta
  if (c.parada > 0) { c.parada -= PASO; return; }
  if (c.lento > 0) { c.lento -= PASO; c.alterna = !c.alterna; if (c.alterna) return; }
  paso(m, c.fase === 'pelea' || c.fase === 'remate' ? entradas : new Map());
  for (const e of m.ev) {
    if (e.n <= (c.evVisto || 0)) continue;
    c.evVisto = e.n;
    if (e.k === 'golpe' && e.fuerte) c.parada = Math.max(c.parada || 0, .075);
    else if (e.k === 'golpe') c.parada = Math.max(c.parada || 0, .03);
    if (e.k === 'ko' && m.luch.filter((f) => !f.ko).every((f) => f.eq === m.luch.find((x) => x.id === e.a)?.eq ? false : true)) { c.parada = .2; c.lento = 1.6; }
    if (e.k === 'remate') c.lento = 1;
  }
  if (c.fase === 'pelea' && m.fase === 'remate') {
    c.fase = 'remate'; c.t = 0;
    anunciar(c, '¡REMATALO!', 'Súper (O) para el remate', 'rematalo');
    return;
  }
  if (c.fase === 'remate' && m.remate && c.anuncio?.tipo !== 'remate') {
    anunciar(c, ELEMENTOS[m.remate.elem].remate, `Remate de ${ELEMENTOS[m.remate.elem].nombre.toLowerCase()}`, 'remate');
  }
  if ((c.fase === 'pelea' || c.fase === 'remate') && m.fase === 'fin') {
    const g = m.ganador;
    if (g !== null) c.victorias[g] += 1;
    c.perfecta = g !== null && c.luchadores.filter((l) => l.eq === g).every((l) => m.luch.find((f) => f.id === l.id).vida >= 100);
    c.fase = 'ko'; c.t = 0;
    if (!m.remate) anunciar(c, g === null ? 'EMPATE' : m.porTiempo ? '¡TIEMPO!' : '¡K.O.!', '', 'ko');
    return;
  }
  if (c.fase === 'ko') {
    const g = m.ganador;
    if (c.t > 1.5 && c.anuncio?.tipo !== 'gana') anunciar(c, g === null ? 'NADIE GANA' : `¡GANA ${nombreEquipo(c, g).toUpperCase()}!`, c.perfecta ? '¡Sin un rasguño!' : '', 'gana');
    if (c.t > PAUSA_KO) {
      const nec = necesarias(c);
      const campeon = c.victorias[0] >= nec ? 0 : c.victorias[1] >= nec ? 1 : null;
      if (campeon !== null || c.ronda >= c.mejorDe + 2) {
        c.fase = 'fin'; c.t = 0; c.ganador = campeon;
        anunciar(c, campeon === null ? '¡EMPATE!' : `¡${nombreEquipo(c, campeon).toUpperCase()} ${c.luchadores.filter((l) => l.eq === campeon).length > 1 ? 'GANAN' : 'GANA'} LA PELEA!`, `${c.victorias[0]} a ${c.victorias[1]} en rondas`, 'campeon');
      } else nuevaRonda(c);
    }
  }
  // en 'fin' el mundo sigue (los ganadores festejan)
}

// ---------------------------------------------------------------- red: el anfitrión manda esto a los demás
const FASES = ['intro', 'pelea', 'remate', 'ko', 'fin'];
const r2 = (v) => Math.round(v * 100) / 100;
export function codificar(c) {
  const m = c.m;
  return 'M' + JSON.stringify([
    FASES.indexOf(c.fase), c.ronda, c.victorias, r2(m.tiempo), c.ganador,
    c.anuncio ? [c.anuncio.n, c.anuncio.texto, c.anuncio.sub, c.anuncio.tipo] : 0,
    m.luch.map((f) => [f.id, r2(f.x), r2(f.y), r2(f.vida), Math.round(f.ene), ESTADOS.indexOf(f.est), f.atk ? LISTA_ATAQUES.indexOf(f.atk) : -1, r2(f.atk ? f.atkT : f.t), f.mira, LISTA_ELEMENTOS.indexOf(f.elem), LISTA_ARMAS.indexOf(f.arma), (f.quema > 0 ? 1 : 0) | (f.veneno > 0 ? 2 : 0) | (f.ko ? 4 : 0) | (f.invul > 0 ? 8 : 0), r2(f.vx), r2(f.vy), f.combo]),
    m.proy.map((p) => [p.id, LISTA_ELEMENTOS.indexOf(p.elem), r2(p.x), r2(p.y), p.grande ? 1 : 0, p.vx > 0 ? 1 : -1, r2(p.vx), r2(p.vy)]),
    m.ev.slice(-10).map((e) => ({ ...e, t: undefined })),
    m.remate ? [m.remate.de, m.remate.a, m.remate.elem, r2(m.remate.t)] : 0,
    m.ganador, c.mejorDe,
  ]);
}

export function decodificar(s) {
  try {
    const d = JSON.parse(s.slice(1));
    return {
      fase: FASES[d[0]], ronda: d[1], victorias: d[2], tiempo: d[3], ganador: d[4],
      anuncio: d[5] ? { n: d[5][0], texto: d[5][1], sub: d[5][2], tipo: d[5][3] } : null,
      luch: d[6].map((f) => ({ id: f[0], x: f[1], y: f[2], vida: f[3], ene: f[4], est: ESTADOS[f[5]], atk: f[6] >= 0 ? LISTA_ATAQUES[f[6]] : null, atkT: f[7], t: f[7], mira: f[8], elem: LISTA_ELEMENTOS[f[9]], arma: LISTA_ARMAS[f[10]], quema: f[11] & 1, veneno: f[11] & 2, ko: !!(f[11] & 4), invul: f[11] & 8, vx: f[12], vy: f[13], combo: f[14] || 0 })),
      proy: d[7].map((p) => ({ id: p[0], elem: LISTA_ELEMENTOS[p[1]], x: p[2], y: p[3], grande: !!p[4], dir: p[5], vx: p[6], vy: p[7] })),
      ev: d[8] || [],
      remate: d[9] ? { de: d[9][0], a: d[9][1], elem: d[9][2], t: d[9][3] } : null,
      ganadorRonda: d[10], mejorDe: d[11],
    };
  } catch {
    return null;
  }
}

// Lo que dibuja la pantalla (igual para local y online): sale de un combate o de lo que llegó por la red.
export function vistaDe(c) {
  const m = c.m;
  return { fase: c.fase, ronda: c.ronda, victorias: c.victorias, tiempo: m.tiempo, ganador: c.ganador, anuncio: c.anuncio, luch: m.luch, proy: m.proy, ev: m.ev, remate: m.remate, ganadorRonda: m.ganador, mejorDe: c.mejorDe };
}

// Entrada compacta de un jugador hacia el anfitrión: "I" + x,y + bits de botones
export const BITS = ['pina', 'patada', 'guardia', 'poder', 'arma', 'super'];
export function codificarEntrada(e) {
  let b = 0;
  BITS.forEach((k, i) => { if (e[k]) b |= 1 << i; });
  return `I${Math.round((e.x || 0) * 10) / 10},${Math.round((e.y || 0) * 10) / 10},${b}`;
}
export function decodificarEntrada(s) {
  const [x, y, b] = s.slice(1).split(',').map(Number);
  const e = { x: Math.max(-1, Math.min(1, x || 0)), y: Math.max(-1, Math.min(1, y || 0)) };
  BITS.forEach((k, i) => { if (b & (1 << i)) e[k] = true; });
  return e;
}
