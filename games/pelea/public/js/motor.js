// Motor de Piña Final: la pelea en 2D (x de izquierda a derecha, y es la altura; el 3D es solo el dibujo).
// Es puro (sin navegador): lo corre la compu en el modo local o el anfitrión en las salas online, 60 veces
// por segundo, y lo usan los tests. Cada luchador tiene un elemento y un arma que se sortean en cada ronda.
export const PASO = 1 / 60;
export const BORDE = 7.4; // la arena va de -BORDE a BORDE
const GRAVEDAD = 25, SALTO = 9.4, CAMINA = 3.2, ATRAS = 2.5, ALTO = 1.8, ALTO_AGACHADO = 1.05;
export const VIDA = 100;

// Elementos: el poder que se tira (U), el súper (O) y el remate final.
export const ELEMENTOS = {
  fuego: { nombre: 'Fuego', emoji: '🔥', color: '#ff6a1f', color2: '#ffd23f', poder: 'bola', dmg: 10, vel: 9.5, efecto: 'quema', remate: '¡CHAMUSCADO!' },
  hielo: { nombre: 'Hielo', emoji: '❄️', color: '#7fdcff', color2: '#e8fbff', poder: 'cristal', dmg: 8, vel: 10, efecto: 'congela', remate: '¡HECHO CUBITOS!' },
  rayo: { nombre: 'Rayo', emoji: '⚡', color: '#ffe94a', color2: '#ffffff', poder: 'rayo', dmg: 9, vel: 17, efecto: 'electro', remate: '¡ELECTROCUTADO!' },
  veneno: { nombre: 'Veneno', emoji: '☠️', color: '#5dff4a', color2: '#d4ff6a', poder: 'gota', dmg: 6, vel: 7.5, efecto: 'veneno', remate: '¡DERRETIDO!' },
  sombra: { nombre: 'Ninja', emoji: '✴️', color: '#b07cff', color2: '#efe6ff', poder: 'shuriken', dmg: 4, vel: 14, efecto: null, remate: '¡HECHO COLADOR!' },
  tierra: { nombre: 'Tierra', emoji: '🪨', color: '#c58a4a', color2: '#f0c58c', poder: 'roca', dmg: 13, vel: 8, efecto: 'derriba', remate: '¡APLASTADO!' },
  viento: { nombre: 'Viento', emoji: '🌪️', color: '#a8f5e0', color2: '#ffffff', poder: 'tornado', dmg: 7, vel: 6.5, efecto: 'empuja', remate: '¡SE LO LLEVÓ EL VIENTO!' },
};
export const LISTA_ELEMENTOS = Object.keys(ELEMENTOS);

// Armas (I): golpe con el arma en la mano, que brilla con el color del elemento.
export const ARMAS = {
  katana: { nombre: 'Katana', dmg: 12, alc: 1.7, ini: .15, act: .12, rec: .3 },
  hacha: { nombre: 'Hacha', dmg: 15, alc: 1.5, ini: .25, act: .12, rec: .36, derriba: true },
  nunchaku: { nombre: 'Nunchaku', dmg: 9, alc: 1.4, ini: .09, act: .16, rec: .2 },
  martillo: { nombre: 'Martillo', dmg: 17, alc: 1.45, ini: .33, act: .12, rec: .42, derriba: true },
};
export const LISTA_ARMAS = Object.keys(ARMAS);

// Golpes: ini (arranque), act (cuándo pega), rec (recuperación) en segundos. y = franja de alto que cubre el golpe.
// alto: 'alto' (pasa por arriba si el otro está agachado), 'medio', 'bajo' (solo se cubre agachado), 'aereo' (solo parado).
export const ATAQUES = {
  pina1: { ini: .07, act: .08, rec: .15, dmg: 5, alc: 1, y: [1.15, 1.65], alto: 'alto', aturde: .32, emp: 1.2, sigue: 'pina2' },
  pina2: { ini: .07, act: .08, rec: .17, dmg: 6, alc: 1.05, y: [1.1, 1.65], alto: 'alto', aturde: .34, emp: 1.4, sigue: 'pina3' },
  pina3: { ini: .1, act: .1, rec: .3, dmg: 9, alc: 1.1, y: [1, 1.7], alto: 'alto', aturde: .5, emp: 4.2 },
  patada: { ini: .13, act: .1, rec: .25, dmg: 8, alc: 1.35, y: [.6, 1.5], alto: 'medio', aturde: .42, emp: 2.8 },
  gancho: { ini: .11, act: .1, rec: .4, dmg: 11, alc: 1.05, y: [.8, 1.95], alto: 'medio', lanza: 8.8, emp: 1.5 },
  barrida: { ini: .12, act: .12, rec: .36, dmg: 7, alc: 1.5, y: [0, .45], alto: 'bajo', derriba: true, emp: 1 },
  aerea: { ini: .06, act: .22, rec: .08, dmg: 8, alc: 1.15, y: [.2, 1.5], alto: 'aereo', aturde: .42, emp: 2.2 },
  poder: { ini: .22, act: 0, rec: .26 },
  super: { ini: .5, act: 0, rec: .4 },
  remata: { ini: .3, act: 0, rec: 3 },
};
for (const [id, a] of Object.entries(ARMAS)) ATAQUES['arma_' + id] = { ...a, y: [.4, 1.9], alto: 'medio', aturde: .5, emp: 3, arma: true };
export const LISTA_ATAQUES = Object.keys(ATAQUES);
export const ESTADOS = ['quieto', 'camina', 'atras', 'agacha', 'guardia', 'guardia_baja', 'salto', 'ataque', 'golpe', 'lanzado', 'caido', 'levanta', 'muerto', 'mareado', 'rematado', 'congelado', 'electro', 'festeja', 'derrota'];
export const BOTONES = ['pina', 'patada', 'guardia', 'poder', 'arma', 'super'];
const NADA = { x: 0, y: 0 };

const signo = (v) => (v < 0 ? -1 : 1);
const alto = (f) => (f.est === 'agacha' || f.est === 'guardia_baja' ? ALTO_AGACHADO : f.est === 'caido' || f.est === 'muerto' ? .4 : ALTO);

// Sortea elemento y arma para cada luchador (los del mismo equipo no repiten elemento).
export function sortearPoderes(luchadores, r = Math.random) {
  const out = {};
  const usados = [new Set(), new Set()];
  for (const l of luchadores) {
    let e;
    do e = LISTA_ELEMENTOS[Math.floor(r() * LISTA_ELEMENTOS.length)]; while (usados[l.eq].has(e) && usados[l.eq].size < LISTA_ELEMENTOS.length);
    usados[l.eq].add(e);
    out[l.id] = { elem: e, arma: LISTA_ARMAS[Math.floor(r() * LISTA_ARMAS.length)] };
  }
  return out;
}

// luchadores: [{ id, eq: 0|1 }]; poderes: { id: { elem, arma } }; decisivo: [eq0, eq1] si ganar esta ronda le da la pelea.
export function nuevoMundo(luchadores, poderes, { tiempo = 90, decisivo = [false, false], lee = {} } = {}) {
  const porEq = [0, 0];
  const luch = luchadores.map((l) => {
    const k = porEq[l.eq]++;
    const x = (l.eq ? 1 : -1) * (2.2 + k * 1.5);
    return {
      id: l.id, eq: l.eq, x, y: 0, vx: 0, vy: 0, emp: 0, mira: l.eq ? -1 : 1, vida: VIDA, ene: 0,
      est: 'quieto', t: 0, atk: null, atkT: 0, golpeados: [], conecto: false,
      stun: 0, invul: 0, combo: 0, comboT: 0, cdPoder: 0, quema: 0, veneno: 0,
      ko: false, elem: poderes[l.id]?.elem || 'fuego', arma: poderes[l.id]?.arma || 'katana',
      prev: {}, buf: null, golpesDados: 0, danoRecibido: 0, humano: !l.bot,
    };
  });
  // lee: lo que los bots aprendieron de cada persona (sigue de una ronda a la otra)
  return { t: 0, fase: 'intro', tiempo, luch, proy: [], ev: [], evN: 0, pN: 0, decisivo, ganador: null, remate: null, remateT: 0, porTiempo: false, lee };
}

function evento(m, e) {
  m.evN += 1;
  m.ev.push({ ...e, n: m.evN, t: m.t });
}

export const buscar = (m, id) => m.luch.find((f) => f.id === id);
const enemigos = (m, f) => m.luch.filter((o) => o.eq !== f.eq);
function enemigoCercano(m, f) {
  let mejor = null, d = Infinity;
  for (const o of enemigos(m, f)) {
    if (o.ko) continue;
    const dd = Math.abs(o.x - f.x);
    if (dd < d) { d = dd; mejor = o; }
  }
  return mejor || enemigos(m, f)[0] || null;
}

function empezar(m, f, id) {
  f.atk = id; f.atkT = 0; f.golpeados = []; f.conecto = false; f.est = 'ataque'; f.lanzo = false;
  if (f.y <= 0) f.vx = 0;
  evento(m, { k: 'ataque', a: f.id, atk: id });
}

// ---------------------------------------------------------------- aprendizaje: los bots leen cómo peleás
// Por cada persona: qué hace según la distancia, cuánto salta, cuánto se cubre y qué tira después de cada cosa.
const zona = (d) => (d < 1.7 ? 'cerca' : d < 3.6 ? 'medio' : 'lejos');
const ACCION = (atk) => (atk?.startsWith('arma_') ? 'arma' : ['pina1', 'pina2', 'pina3'].includes(atk) ? 'pina' : atk);
function lectura(m, id) {
  return (m.lee[id] ??= { total: 0, zonas: { cerca: {}, medio: {}, lejos: {} }, salto: 0, guardia: 0, agacha: 0, despues: {}, ultimo: null, avisos: {} });
}
function aprender(m, f, accion) {
  if (!f.humano) return;
  const L = lectura(m, f.id);
  const r = enemigoCercano(m, f);
  const z = zona(r ? Math.abs(r.x - f.x) : 5);
  L.total++;
  L.zonas[z][accion] = (L.zonas[z][accion] || 0) + 1;
  if (accion === 'salto') L.salto++;
  if (accion === 'guardia') L.guardia++;
  if (L.ultimo) { const d = (L.despues[L.ultimo] ??= {}); d[accion] = (d[accion] || 0) + 1; }
  L.ultimo = accion;
  // cuando un patrón ya es claro, el bot que pelea con vos lo dice (una vez por patrón)
  const avisar = (clave, texto) => {
    if (L.avisos[clave] || L.total < 10) return;
    L.avisos[clave] = true;
    const bot = m.luch.find((o) => o.eq !== f.eq && !o.humano && !o.ko);
    evento(m, { k: 'lectura', a: bot?.id || null, b: f.id, texto });
  };
  const lejos = L.zonas.lejos, n = Object.values(lejos).reduce((a, b) => a + b, 0);
  if (n >= 4 && (lejos.poder || 0) / n > .55) avisar('poder', 'Te leyó: de lejos siempre tirás el poder');
  if (L.salto / L.total > .3) avisar('salto', 'Te leyó: saltás mucho, te espera con el gancho');
  if (L.guardia / L.total > .3) avisar('guardia', 'Te leyó: te cubrís todo el tiempo, va a barrerte');
  const cerca = L.zonas.cerca, nc = Object.values(cerca).reduce((a, b) => a + b, 0);
  if (nc >= 6 && (cerca.barrida || 0) / nc > .35) avisar('barrida', 'Te leyó: abusás de la barrida');
  if (nc >= 8 && (cerca.pina || 0) / nc > .6) avisar('pina', 'Te leyó: todo piñas, ahora se cubre y te contesta');
}
// lo más probable que haga esa persona a esta distancia (y cuánto confía el bot en eso)
function predecir(m, rival, d, dificultad) {
  const L = m.lee[rival.id];
  if (!L) return null;
  const tabla = { ...L.zonas[zona(d)] };
  if (L.ultimo && L.despues[L.ultimo]) for (const [k, v] of Object.entries(L.despues[L.ultimo])) tabla[k] = (tabla[k] || 0) + v * .7;
  const total = Object.values(tabla).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const [accion, n] = Object.entries(tabla).sort((a, b) => b[1] - a[1])[0];
  return { accion, p: n / total, conf: Math.min(1, L.total / 14) * [.45, .8, 1][dificultad], L };
}

// ---------------------------------------------------------------- un paso de 1/60 s
export function paso(m, entradas = new Map()) {
  m.t += PASO;
  // los avisos viejos se van (el dibujo y la red solo necesitan los recientes)
  if (m.ev.length && m.t - m.ev[0].t > .8) m.ev = m.ev.filter((e) => m.t - e.t <= .8);
  if (m.fase === 'pelea') {
    m.tiempo = Math.max(0, m.tiempo - PASO);
  }
  const juega = m.fase === 'pelea' || m.fase === 'remate';
  for (const f of m.luch) controlar(m, f, juega ? entradas.get(f.id) || NADA : NADA);
  for (const f of m.luch) fisica(m, f);
  separar(m);
  for (const f of m.luch) golpear(m, f);
  proyectiles(m);
  for (const f of m.luch) efectos(m, f);
  revisarFin(m);
}

function controlar(m, f, inp) {
  // botones recién apretados: quedan en un búfer cortito (así un combo apretado un toque antes entra igual)
  for (const k of BOTONES) if (inp[k] && !f.prev[k]) f.buf = { k, t: m.t };
  f.prev = { ...inp };
  if (f.cdPoder > 0) f.cdPoder -= PASO;
  if (f.invul > 0) f.invul -= PASO;
  if (f.comboT > 0 && (f.comboT -= PASO) <= 0) f.combo = 0;
  f.t += PASO;
  if (f.ko && f.est !== 'mareado') return;
  if (['muerto', 'rematado', 'mareado', 'lanzado', 'festeja', 'derrota'].includes(f.est)) return;
  if (f.stun > 0) {
    f.stun -= PASO;
    if (f.stun <= 0 && ['golpe', 'congelado', 'electro'].includes(f.est)) cambiar(f, 'quieto');
    return;
  }
  if (f.est === 'caido') {
    if (f.t > .95) { cambiar(f, 'levanta'); f.invul = .55; }
    return;
  }
  if (f.est === 'levanta') {
    if (f.t > .45) cambiar(f, 'quieto');
    return;
  }
  const fresco = f.buf && m.t - f.buf.t < .16 ? f.buf.k : null;
  // remate: el ganador aprieta súper (o poder) y liquida al que quedó mareado
  if (m.fase === 'remate' && !m.remate && (fresco === 'super' || fresco === 'poder') && f.y <= 0 && !f.atk) {
    const victima = m.luch.find((o) => o.eq !== f.eq && o.est === 'mareado');
    if (victima) {
      f.buf = null; empezar(m, f, 'remata');
      m.remate = { de: f.id, a: victima.id, elem: f.elem, t: 0 };
      cambiar(victima, 'rematado');
      evento(m, { k: 'remate', a: f.id, b: victima.id, elem: f.elem });
      return;
    }
  }
  if (f.atk) {
    const def = ATAQUES[f.atk];
    f.atkT += PASO;
    // combos: la piña encadena con la siguiente; si pegó, se puede cortar con el poder
    if (fresco === 'pina' && def.sigue && f.atkT >= def.ini + def.act * .5) { f.buf = null; aprender(m, f, 'pina'); empezar(m, f, def.sigue); return; }
    if (fresco === 'poder' && f.conecto && !def.arma && f.cdPoder <= 0 && f.y <= 0 && f.atkT >= def.ini + def.act) { f.buf = null; empezar(m, f, 'poder'); return; }
    if ((f.atk === 'poder' || f.atk === 'super') && !f.lanzo && f.atkT >= def.ini) { f.lanzo = true; tirarPoder(m, f, f.atk === 'super'); }
    if (f.atkT >= def.ini + def.act + def.rec) { f.atk = null; cambiar(f, f.y > 0 ? 'salto' : 'quieto'); }
    return;
  }
  const suelo = f.y <= 0;
  if (!suelo) {
    if (fresco === 'pina' || fresco === 'patada') { f.buf = null; empezar(m, f, 'aerea'); }
    return;
  }
  // de frente al rival más cercano
  const rival = enemigoCercano(m, f);
  if (rival) f.mira = signo(rival.x - f.x);
  const abajo = inp.y > .5, arriba = inp.y < -.5;
  if (fresco) {
    let golpe = null;
    if (fresco === 'pina') golpe = abajo ? 'gancho' : 'pina1';
    else if (fresco === 'patada') golpe = abajo ? 'barrida' : 'patada';
    else if (fresco === 'arma') golpe = 'arma_' + f.arma;
    else if (fresco === 'poder' && f.cdPoder <= 0) golpe = 'poder';
    else if (fresco === 'super' && f.ene >= 100) golpe = 'super';
    if (golpe) { f.buf = null; if (golpe === 'super') f.ene = 0; aprender(m, f, ACCION(golpe)); empezar(m, f, golpe); return; }
  }
  if (inp.guardia) { if (!f.est.startsWith('guardia')) aprender(m, f, 'guardia'); cambiar(f, abajo ? 'guardia_baja' : 'guardia'); f.vx = 0; return; }
  if (abajo) { cambiar(f, 'agacha'); f.vx = 0; return; }
  if (arriba) {
    f.vy = SALTO; f.y = .001; f.vx = Math.abs(inp.x) > .3 ? signo(inp.x) * 3.6 : 0;
    cambiar(f, 'salto'); evento(m, { k: 'salto', a: f.id }); aprender(m, f, 'salto');
    return;
  }
  const adelante = inp.x * f.mira;
  f.vx = inp.x * (adelante > 0 ? CAMINA : ATRAS);
  cambiar(f, Math.abs(inp.x) > .2 ? (adelante > 0 ? 'camina' : 'atras') : 'quieto');
}

function cambiar(f, est) {
  if (f.est !== est) { f.est = est; f.t = 0; }
}

function fisica(m, f) {
  if (f.y > 0 || f.vy > 0) {
    f.vy -= GRAVEDAD * PASO;
    f.y += f.vy * PASO;
    f.x += f.vx * PASO;
    if (f.y <= 0) {
      f.y = 0; f.vy = 0; f.vx = 0;
      if (f.est === 'lanzado') {
        cambiar(f, f.ko ? 'muerto' : 'caido');
        evento(m, { k: 'cae', a: f.id, x: f.x });
      } else if (f.est === 'salto' || f.atk === 'aerea') { f.atk = null; cambiar(f, 'quieto'); }
    }
  } else if (!f.atk && !['camina', 'atras'].includes(f.est)) f.vx = 0;
  if (f.y <= 0) f.x += f.vx * PASO;
  f.x += f.emp * PASO;
  f.emp *= .86;
  if (Math.abs(f.emp) < .05) f.emp = 0;
  f.x = Math.max(-BORDE, Math.min(BORDE, f.x));
}

// nadie atraviesa a nadie (salvo saltando por arriba)
function separar(m) {
  const vivos = m.luch.filter((f) => !['muerto', 'caido', 'rematado'].includes(f.est));
  for (let i = 0; i < vivos.length; i++) for (let j = i + 1; j < vivos.length; j++) {
    const a = vivos[i], b = vivos[j];
    if (Math.abs(a.y - b.y) > 1.2) continue;
    const d = b.x - a.x, min = .62;
    if (Math.abs(d) >= min) continue;
    const s = d === 0 ? (a.eq === 0 ? 1 : -1) : signo(d);
    const empuje = (min - Math.abs(d)) / 2;
    a.x = Math.max(-BORDE, Math.min(BORDE, a.x - s * empuje));
    b.x = Math.max(-BORDE, Math.min(BORDE, b.x + s * empuje));
  }
}

function golpear(m, f) {
  if (!f.atk) return;
  const def = ATAQUES[f.atk];
  if (!def.act || f.atkT < def.ini || f.atkT >= def.ini + def.act) return;
  for (const e of enemigos(m, f)) {
    if (f.golpeados.includes(e.id)) continue;
    const dx = (e.x - f.x) * f.mira;
    if (dx < -.25 || dx > def.alc + .3) continue;
    const y0 = f.y + def.y[0], y1 = f.y + def.y[1];
    if (y1 < e.y || y0 > e.y + alto(e)) continue;
    f.golpeados.push(e.id);
    const elem = def.arma ? f.elem : null;
    if (aplicarGolpe(m, f, e, { ...def, elem, efecto: def.arma ? ELEMENTOS[f.elem].efecto : null }, f.x)) f.conecto = true;
  }
}

// Aplica un golpe (cuerpo a cuerpo o poder) de `a` a `e`. Devuelve true si pegó (aunque lo haya cubierto).
function aplicarGolpe(m, a, e, def, origenX) {
  if (e.ko || e.invul > 0 || ['caido', 'levanta', 'muerto', 'rematado'].includes(e.est)) return false;
  const dir = signo(e.x - origenX);
  const deFrente = e.mira === -dir;
  const bloquea = deFrente && !e.atk && e.y <= 0 && ((e.est === 'guardia' && def.alto !== 'bajo') || (e.est === 'guardia_baja' && def.alto !== 'aereo'));
  const escala = Math.max(.45, 1 - e.combo * .1);
  const dmg = Math.round(def.dmg * (bloquea ? .12 : escala) * 10) / 10;
  e.vida = Math.max(0, e.vida - dmg);
  e.danoRecibido += dmg; a.golpesDados += bloquea ? 0 : 1;
  a.ene = Math.min(100, a.ene + dmg * .9);
  e.ene = Math.min(100, e.ene + dmg * .5);
  const hy = Math.min(e.y + alto(e) - .2, Math.max(e.y + .3, a.y + ((def.y?.[0] ?? 1) + (def.y?.[1] ?? 1.3)) / 2));
  evento(m, { k: bloquea ? 'bloqueo' : 'golpe', a: a.id, b: e.id, x: e.x - dir * .25, y: hy, dmg, elem: def.elem || null, fuerte: dmg >= 10 || !!def.lanza || !!def.derriba, atk: def.arma ? 'arma' : def.proy ? 'poder' : 'cuerpo' });
  if (bloquea) { e.emp = dir * 1.6; e.stun = .13; return true; }
  e.atk = null; e.combo += 1; e.comboT = .9;
  if (e.vida <= 0) { caerKO(m, e, dir); return true; }
  const ef = def.efecto;
  if (ef === 'quema') e.quema = Math.max(e.quema, def.proy ? 2.6 : 1.2);
  if (ef === 'veneno') e.veneno = Math.max(e.veneno, def.proy ? 4.5 : 1.5);
  if (def.lanza || e.y > 0 || (ef === 'derriba' && def.proy)) {
    cambiar(e, 'lanzado'); e.t = 0;
    e.vy = def.lanza || (e.y > 0 ? 5.5 : 6.5); e.vx = dir * (def.lanza ? 1.8 : 2.6); e.y = Math.max(e.y, .01);
  } else if (def.derriba) {
    cambiar(e, 'caido'); e.emp = dir * 2.5;
    evento(m, { k: 'cae', a: e.id, x: e.x });
  } else if (ef === 'congela' && def.proy) {
    cambiar(e, 'congelado'); e.stun = def.grande ? 1.8 : 1.15; e.emp = dir;
  } else if (ef === 'electro' && def.proy) {
    cambiar(e, 'electro'); e.stun = def.grande ? 1.4 : .85; e.emp = dir * 1.5;
  } else {
    cambiar(e, 'golpe'); e.t = 0;
    e.stun = def.aturde ?? .4;
    e.emp = dir * ((ef === 'empuja' && def.proy ? 9 : 0) || (def.emp ?? 2));
  }
  return true;
}

// Sin vida: si con eso se termina la pelea, queda mareado para el remate; si no, vuela y cae.
function caerKO(m, e, dir) {
  e.ko = true; e.quema = 0; e.veneno = 0;
  const quedan = m.luch.some((o) => o.eq === e.eq && !o.ko);
  if (!quedan && m.decisivo[1 - e.eq] && m.fase === 'pelea') {
    cambiar(e, 'mareado'); e.vx = 0; e.emp = dir * 3; e.y = 0; e.vy = 0;
  } else {
    cambiar(e, 'lanzado'); e.vy = 6.5; e.vx = dir * 3.2; e.y = Math.max(e.y, .01);
  }
  evento(m, { k: 'ko', a: e.id });
}

function tirarPoder(m, f, grande) {
  const E = ELEMENTOS[f.elem];
  const base = { de: f.id, eq: f.eq, tipo: E.poder, elem: f.elem, dmg: grande ? 22 : E.dmg, efecto: E.efecto, vida: 2.4, r: grande ? .7 : .32, grande, vy: 0, arco: false };
  const nuevo = (extra) => { m.pN += 1; m.proy.push({ ...base, id: m.pN, x: f.x + f.mira * .7, y: 1.25, vx: f.mira * E.vel * (grande ? 1.1 : 1), ...extra }); };
  if (E.poder === 'shuriken') {
    const alturas = grande ? [1.7, 1.45, 1.2, .95, .7] : [1.5, 1.2, .9];
    for (const y of alturas) nuevo({ y, dmg: grande ? 6 : E.dmg, r: .22, grande: false, super: grande });
  } else if (E.poder === 'roca') nuevo({ y: 1.6, vy: grande ? 3 : 4.5, arco: true, vx: f.mira * E.vel * (grande ? .9 : 1) });
  else if (E.poder === 'tornado') nuevo({ y: grande ? .95 : .9 });
  else nuevo({});
  f.cdPoder = grande ? .6 : 1.35;
  evento(m, { k: 'poder', a: f.id, elem: f.elem, grande });
}

function proyectiles(m) {
  for (const p of m.proy) {
    p.vida -= PASO;
    p.x += p.vx * PASO;
    if (p.arco) {
      p.vy -= 11 * PASO; p.y += p.vy * PASO;
      if (p.y < .25) { p.vida = 0; evento(m, { k: 'rompe', x: p.x, y: .2, elem: p.elem }); }
    }
    if (p.vida <= 0 || Math.abs(p.x) > BORDE + 2.5) { p.vida = 0; continue; }
    for (const e of m.luch) {
      if (e.eq === p.eq || e.ko || e.invul > 0 || ['caido', 'levanta', 'muerto', 'rematado'].includes(e.est)) continue;
      if (Math.abs(p.x - e.x) > p.r + .32) continue;
      if (p.y + p.r * .6 < e.y || p.y - p.r * .6 > e.y + alto(e)) continue;
      const a = buscar(m, p.de) || { id: p.de, ene: 0, golpesDados: 0 };
      aplicarGolpe(m, a, e, { dmg: p.dmg, alto: 'medio', aturde: .45, emp: 2.4, efecto: p.efecto, elem: p.elem, proy: true, grande: p.grande, y: [p.y - a.y, p.y - a.y] }, p.x - p.vx);
      p.vida = 0;
      break;
    }
  }
  // dos poderes de equipos distintos que se cruzan se anulan
  for (let i = 0; i < m.proy.length; i++) for (let j = i + 1; j < m.proy.length; j++) {
    const a = m.proy[i], b = m.proy[j];
    if (a.vida <= 0 || b.vida <= 0 || a.eq === b.eq) continue;
    if (Math.abs(a.x - b.x) < a.r + b.r && Math.abs(a.y - b.y) < a.r + b.r) {
      if (a.grande && !b.grande) { b.vida = 0; } else if (b.grande && !a.grande) { a.vida = 0; } else { a.vida = 0; b.vida = 0; }
      evento(m, { k: 'choque', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, elem: a.elem, elem2: b.elem });
    }
  }
  m.proy = m.proy.filter((p) => p.vida > 0);
}

// quemaduras y veneno: van sacando vida de a poco
function efectos(m, f) {
  if (f.ko) return;
  let d = 0;
  if (f.quema > 0) { f.quema -= PASO; d += 2.4 * PASO; }
  if (f.veneno > 0) { f.veneno -= PASO; d += 2 * PASO; }
  if (!d || m.fase !== 'pelea') return;
  f.vida = Math.max(0, f.vida - d);
  f.danoRecibido += d;
  if (f.vida <= 0) caerKO(m, f, -f.mira);
}

function revisarFin(m) {
  if (m.fase === 'pelea') {
    const vivos = [0, 1].map((eq) => m.luch.some((f) => f.eq === eq && !f.ko));
    let ganador;
    if (!vivos[0] || !vivos[1]) ganador = vivos[0] ? 0 : vivos[1] ? 1 : null;
    else if (m.tiempo <= 0) {
      const v = [0, 1].map((eq) => m.luch.filter((f) => f.eq === eq).reduce((s, f) => s + f.vida, 0));
      ganador = Math.abs(v[0] - v[1]) < .5 ? null : v[0] > v[1] ? 0 : 1;
      m.porTiempo = true;
    } else return;
    m.ganador = ganador;
    if (ganador !== null && m.luch.some((f) => f.est === 'mareado')) {
      m.fase = 'remate'; m.remateT = 6;
      evento(m, { k: 'rematalo' });
    } else terminar(m);
  } else if (m.fase === 'remate') {
    if (m.remate) {
      m.remate.t += PASO;
      if (m.remate.t > 3.4) {
        const v = buscar(m, m.remate.a);
        if (v) v.est = 'muerto';
        terminar(m);
      }
    } else if ((m.remateT -= PASO) <= 0) {
      // no lo remató a tiempo: se cae solo
      for (const f of m.luch) if (f.est === 'mareado') { cambiar(f, 'lanzado'); f.vy = 3; f.y = .01; f.vx = 0; }
      terminar(m);
    }
  } else if (m.fase === 'fin') {
    m.finT += PASO;
    if (m.finT > .9) for (const f of m.luch) {
      if (f.ko || f.atk) continue;
      if (m.ganador === null) continue;
      if (f.eq === m.ganador && !['festeja'].includes(f.est) && f.y <= 0) cambiar(f, 'festeja');
    }
  }
}

function terminar(m) {
  m.fase = 'fin'; m.finT = 0;
  for (const f of m.luch) { f.stun = 0; f.quema = 0; f.veneno = 0; if (!f.ko && f.eq !== m.ganador && m.ganador !== null && f.y <= 0) cambiar(f, 'derrota'); }
  evento(m, { k: 'fin', ganador: m.ganador });
}

// ---------------------------------------------------------------- bots
// dificultad: 0 fácil, 1 normal, 2 difícil. Devuelve la entrada del bot para este paso.
export function pensarBot(m, f, dificultad = 1, r = Math.random) {
  const ia = (f.ia ??= { prox: 0, mantener: { x: 0, y: 0 }, cola: [], colaT: 0 });
  const salida = { ...ia.mantener };
  if (f.ko || !(m.fase === 'pelea' || m.fase === 'remate')) return { x: 0, y: 0 };
  // remate: el ganador se toma un segundo y liquida
  if (m.fase === 'remate') {
    if (m.luch.some((o) => o.eq !== f.eq && o.est === 'mareado') && !m.remate) {
      ia.remateT = (ia.remateT || 0) + PASO;
      if (ia.remateT > .9 + r() * .5) { ia.remateT = 0; return { x: 0, y: 0, super: true }; }
    }
    return { x: 0, y: 0 };
  }
  // combos encolados (piña, piña, piña…)
  if (ia.cola.length) {
    ia.colaT -= PASO;
    if (ia.colaT <= 0) { const b = ia.cola.shift(); ia.colaT = .13; return { x: 0, y: b.y || 0, [b.k]: true }; }
    return { x: 0, y: 0 };
  }
  if (m.t < ia.prox) return salida;
  const reaccion = [.34, .2, .1][dificultad] ?? .2;
  ia.prox = m.t + reaccion + r() * .16;
  const rival = enemigoCercano(m, f);
  if (!rival || rival.ko) { ia.mantener = { x: 0, y: 0 }; return ia.mantener; }
  const dx = rival.x - f.x, dist = Math.abs(dx), dir = signo(dx);
  const pred = rival.humano ? predecir(m, rival, dist, dificultad) : null;
  const lee = pred?.conf || 0;
  // le leyó los saltos: gancho al que viene por el aire
  if (rival.y > .4 && rival.vy < 2 && dist < 2 && pred && pred.L.salto / pred.L.total > .2 && r() < .25 + lee * .6) return { x: 0, y: 1, pina: true };
  let cubre = [.2, .45, .72][dificultad] ?? .45;
  if (pred && ['pina', 'patada', 'arma', 'gancho'].includes(pred.accion)) cubre += lee * .25;
  // se viene un golpe: cubrirse (agachado si es una barrida)
  const peligro = rival.atk && ATAQUES[rival.atk].act && dist < (ATAQUES[rival.atk].alc || 1) + .6 && rival.atkT < ATAQUES[rival.atk].ini + ATAQUES[rival.atk].act;
  const poderCerca = m.proy.find((p) => p.eq !== f.eq && Math.abs(p.x - f.x) < 3.6 && signo(f.x - p.x) === signo(p.vx));
  if ((peligro || poderCerca) && r() < cubre) {
    if (poderCerca && r() < .35 && f.y <= 0) { ia.prox = m.t + .25; ia.mantener = { x: 0, y: 0 }; return { x: dir, y: -1 }; }
    // si sabe que abusás de la barrida, se cubre agachado
    const barre = rival.atk === 'barrida' || (pred?.accion === 'barrida' && r() < lee);
    ia.mantener = { x: 0, y: peligro && barre ? 1 : 0, guardia: true };
    ia.prox = m.t + .32;
    return ia.mantener;
  }
  ia.mantener = { x: 0, y: 0 };
  if (f.ene >= 100 && r() < .5) return { x: 0, y: 0, super: true };
  // al que se cubre todo el tiempo, barrida (la guardia parada no la para)
  if (pred && pred.L.guardia / pred.L.total > .25 && dist < 1.5 && r() < lee * .55) return { x: 0, y: 1, patada: true };
  if (dist > 3.2) {
    // al que tira poderes de lejos: se le mete saltando
    if (pred?.accion === 'poder' && r() < lee * .6) return { x: dir, y: -1 };
    if (f.cdPoder <= 0 && r() < [.25, .4, .5][dificultad]) return { x: 0, y: 0, poder: true };
    if (r() < .1) return { x: dir, y: -1 };
    ia.mantener = { x: dir, y: 0 };
    return ia.mantener;
  }
  if (dist > 1.35) {
    const p = r();
    if (p < .14 && dist < 1.95) return { x: 0, y: 0, arma: true };
    if (p < .24) return { x: dir, y: -1 };
    if (p < .3 && f.cdPoder <= 0) return { x: 0, y: 0, poder: true };
    ia.mantener = { x: dir, y: 0 };
    ia.prox = m.t + .12 + r() * .12;
    return ia.mantener;
  }
  // cuerpo a cuerpo
  const p = r();
  if (p < .3) { ia.cola = [{ k: 'pina' }, { k: 'pina' }, ...(r() < .5 + dificultad * .2 ? [{ k: 'pina' }] : []), ...(dificultad > 0 && r() < .4 ? [{ k: 'poder' }] : [])]; ia.colaT = 0; return { x: 0, y: 0 }; }
  if (p < .45) return { x: 0, y: 0, patada: true };
  if (p < .55) return { x: 0, y: 1, patada: true };
  if (p < .65) return { x: 0, y: 1, pina: true };
  if (p < .75) return { x: 0, y: 0, arma: true };
  if (p < .85) { ia.mantener = { x: -dir, y: 0 }; return ia.mantener; }
  ia.mantener = { x: 0, y: 0, guardia: true };
  return ia.mantener;
}
