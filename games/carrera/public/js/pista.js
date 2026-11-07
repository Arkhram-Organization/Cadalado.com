// La pista de la carrera: geometría, obstáculos en movimiento y la ruta de los bots.
// Todo es determinístico (depende de la "semilla" de la carrera y del tiempo), así que todos los
// navegadores ven lo mismo sin mandarse nada, y el servidor puede calcular cuándo llega cada bot.
// Unidades: metros y segundos. La pista avanza hacia -Z. El piso arranca en y = 0.

export function rng(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const META_Z = -160;
export const LIMITE_S = 150; // si alguien no llega en este tiempo, termina igual
export const CHECKPOINTS = [
  { z: -2, y: 0, nombre: 'Largada' },
  { z: -42, y: 0, nombre: 'Barras' },
  { z: -67, y: 0, nombre: 'Martillos' },
  { z: -100, y: 0, nombre: 'Puertas' },
  { z: -146, y: 6, nombre: 'Recta final' },
];

// Cajas fijas: centro (x, y, z) y tamaño (w, h, d). color = índice de la paleta.
export function estaticos(semilla) {
  const cajas = [
    { x: 0, y: -0.5, z: -7, w: 16, h: 1, d: 14, c: 0 }, // largada
    { x: 0, y: -0.5, z: -29, w: 18, h: 1, d: 30, c: 1 }, // barras giratorias
    { x: 0, y: -0.5, z: -82, w: 14, h: 1, d: 32, c: 2 }, // martillos
    { x: 0, y: -0.5, z: -106, w: 14, h: 1, d: 16, c: 3 }, // puertas
    { x: 0, y: 5.5, z: -152, w: 14, h: 1, d: 16, c: 0 }, // recta final
    // bordes bajos para no caerse sin querer
    { x: -8.6, y: 0.4, z: -7, w: 0.6, h: 0.8, d: 14, c: 4 },
    { x: 8.6, y: 0.4, z: -7, w: 0.6, h: 0.8, d: 14, c: 4 },
    { x: -9.3, y: 0.4, z: -29, w: 0.6, h: 0.8, d: 30, c: 4 },
    { x: 9.3, y: 0.4, z: -29, w: 0.6, h: 0.8, d: 30, c: 4 },
    { x: -7.3, y: 0.4, z: -82, w: 0.6, h: 0.8, d: 32, c: 4 },
    { x: 7.3, y: 0.4, z: -82, w: 0.6, h: 0.8, d: 32, c: 4 },
    { x: -7.3, y: 6.4, z: -152, w: 0.6, h: 0.8, d: 16, c: 4 },
    { x: 7.3, y: 6.4, z: -152, w: 0.6, h: 0.8, d: 16, c: 4 },
    // columna central de las barras
    { x: 0, y: 1, z: -22, w: 1, h: 2, d: 1, c: 4 },
    { x: 0, y: 1, z: -36, w: 1, h: 2, d: 1, c: 4 },
  ];
  // pared de puertas: 5 puertas, 2 se abren (según la semilla) y 3 son macizas
  for (const p of puertas(semilla)) if (!p.abierta) cajas.push({ x: p.x, y: 2, z: -104, w: 2.2, h: 4, d: 0.6, c: 5, puerta: true });
  for (const x of [-6, -3.6, -1.2, 1.2, 3.6, 6]) cajas.push({ x, y: 2, z: -104, w: 0.3, h: 4, d: 0.8, c: 4 });
  cajas.push({ x: 0, y: 4.4, z: -104, w: 12.6, h: 0.8, d: 0.8, c: 4 });
  return cajas;
}

export function puertas(semilla) {
  const r = rng(semilla ^ 0x9e3779b9);
  const abiertas = new Set();
  while (abiertas.size < 2) abiertas.add(Math.floor(r() * 5));
  return [-4.8, -2.4, 0, 2.4, 4.8].map((x, i) => ({ x, abierta: abiertas.has(i) }));
}

// Rampa con bolas: de z -114 (y 0) a z -144 (y 6), 12 de ancho.
export const RAMPA = { z0: -114, z1: -144, y0: 0, y1: 6, ancho: 12 };
export const alturaRampa = (z) => RAMPA.y0 + ((RAMPA.z0 - z) / (RAMPA.z0 - RAMPA.z1)) * (RAMPA.y1 - RAMPA.y0);

// Filas de plataformas que se mueven de lado sobre el vacío (z -45 a -66).
const FILAS = [
  { z: -47.5, amp: 5, w: 0.9 },
  { z: -54.5, amp: 5.5, w: 1.15 },
  { z: -61.5, amp: 4.5, w: 0.8 },
];
const BARRAS = [
  { z: -22, w: 1.3, largo: 8.2 },
  { z: -36, w: -1.05, largo: 9 },
];
const MARTILLOS = [
  { z: -74, w: 1.5 },
  { z: -83, w: 1.25 },
  { z: -92, w: 1.7 },
];
const CARRILES_BOLA = [-4, 0, 4];
export const PERIODO_BOLA = 3.6;
const VEL_BOLA = 8.5;

function fases(semilla) {
  const r = rng(semilla ^ 0x51ed27);
  return { filas: FILAS.map(() => r() * 6.28), martillos: MARTILLOS.map(() => r() * 6.28), bolas: CARRILES_BOLA.map(() => r() * PERIODO_BOLA) };
}
const cache = new Map();
const fasesDe = (semilla) => (cache.has(semilla) ? cache.get(semilla) : cache.set(semilla, fases(semilla)).get(semilla));

// Lo que se mueve en el instante t (segundos desde la largada).
export function moviles(t, semilla) {
  const f = fasesDe(semilla);
  const plataformas = FILAS.map((fila, i) => {
    const x = fila.amp * Math.sin(fila.w * t + f.filas[i]);
    const vx = fila.amp * fila.w * Math.cos(fila.w * t + f.filas[i]);
    return { x, y: -0.5, z: fila.z, w: 5, h: 1, d: 5, vx };
  });
  const barras = BARRAS.map((b, i) => ({ x: 0, y: 0.75, z: b.z, ang: b.w * t + i, w: b.w, largo: b.largo, r: 0.38 }));
  const martillos = MARTILLOS.map((m, i) => {
    const ang = 1.15 * Math.sin(m.w * t + f.martillos[i]);
    const dang = 1.15 * m.w * Math.cos(m.w * t + f.martillos[i]);
    return { pivote: { x: 0, y: 9.5, z: m.z }, ang, brazo: 8, x: 8 * Math.sin(ang), y: 9.5 - 8 * Math.cos(ang), z: m.z, vx: 8 * Math.cos(ang) * dang, r: 1.5 };
  });
  const bolas = [];
  CARRILES_BOLA.forEach((x, i) => {
    // cada bola sale de arriba de la rampa y baja; aparece una por carril cada PERIODO_BOLA
    for (let k = 0; k < 3; k++) {
      const edad = ((t + f.bolas[i]) % PERIODO_BOLA) + k * PERIODO_BOLA;
      const z = RAMPA.z1 + 1 + edad * VEL_BOLA;
      if (z > RAMPA.z0 + 2) continue;
      bolas.push({ x, y: alturaRampa(Math.max(RAMPA.z1, Math.min(RAMPA.z0, z))) + 1.1, z, r: 1.1, vz: VEL_BOLA, giro: edad * VEL_BOLA / 1.1 });
    }
  });
  return { plataformas, barras, martillos, bolas };
}

// ---------------------------------------------------------------- bots
// Cada bot sigue una ruta armada con segmentos (caminar, saltar, esperar, tropezar).
// La ruta sale de la semilla, así que en todos lados el bot hace exactamente lo mismo.
export const NOMBRES_BOT = ['Tito', 'Coca', 'Pocha', 'Lito', 'Nené', 'Cacho', 'Mirta', 'Rulo', 'Tota', 'Pirulo', 'Chacho', 'Lalo', 'Quique', 'Fito'];
export const COLORES = ['#ff4fa3', '#7aa2ff', '#ff7a45', '#f2c94c', '#c084fc', '#4fd1c5', '#ff6b5b', '#9be15d', '#ffffff', '#38d9e6', '#ffa94d', '#e599f7'];

export function rutaBot(semilla, i) {
  const r = rng((semilla * 31 + i * 7919) >>> 0);
  const v = 6.2 + r() * 1.6;
  const carril = (r() - 0.5) * 7;
  const segs = [];
  let t = 0;
  let pos = { x: carril, y: 0, z: -3 - r() * 4 };
  const ir = (x, y, z, vel = v, tipo = 'camina') => {
    const d = Math.hypot(x - pos.x, z - pos.z);
    const dur = Math.max(0.05, d / vel);
    segs.push({ t0: t, t1: t + dur, a: { ...pos }, b: { x, y, z }, tipo });
    t += dur;
    pos = { x, y, z };
  };
  const quieto = (dur, tipo = 'quieto') => {
    segs.push({ t0: t, t1: t + dur, a: { ...pos }, b: { ...pos }, tipo });
    t += dur;
  };
  const saltar = (x, y, z, dur = 0.6) => {
    segs.push({ t0: t, t1: t + dur, a: { ...pos }, b: { x, y, z }, tipo: 'salto' });
    t += dur;
    pos = { x, y, z };
  };
  quieto(0.2 + r() * 0.5);
  // barras: caminar zigzagueando; a veces una barra lo voltea
  ir(carril * 0.6, 0, -18);
  if (r() < 0.35) {
    quieto(0.3, 'golpe');
    ir(pos.x + (r() - 0.5) * 3, 0, pos.z + 2.5, 6, 'golpe');
    quieto(0.6);
  }
  ir(carril * 0.8, 0, -32);
  ir(carril * 0.5, 0, -43.5);
  // plataformas: espera y salta a cada fila; arriba de la plataforma se mueve con ella
  quieto(0.3 + r() * 1.4);
  for (let k = 0; k < FILAS.length; k++) {
    const llegada = { fila: k };
    segs.push({ t0: t, t1: t + 0.6, a: { ...pos }, b: llegada, tipo: 'salto' });
    t += 0.6;
    const estar = 0.5 + r() * 0.9;
    segs.push({ t0: t, t1: t + estar, a: llegada, b: llegada, tipo: 'plataforma' });
    t += estar;
    pos = llegada;
  }
  segs.push({ t0: t, t1: t + 0.6, a: { ...pos }, b: { x: carril * 0.4, y: 0, z: -67.5 }, tipo: 'salto' });
  t += 0.6;
  pos = { x: carril * 0.4, y: 0, z: -67.5 };
  // martillos: a veces uno lo saca volando para atrás
  ir(carril * 0.3, 0, -79);
  if (r() < 0.4) {
    saltar(pos.x + (r() < 0.5 ? -3 : 3), 0, pos.z + 3.5, 0.8);
    quieto(0.8, 'golpe');
  }
  ir(-carril * 0.3, 0, -96);
  // puertas: elige una abierta
  const abiertas = puertas(semilla).filter((p) => p.abierta);
  const puerta = abiertas[Math.floor(r() * abiertas.length)];
  if (r() < 0.45) {
    // primero se equivoca de puerta y rebota
    const falsa = puertas(semilla).find((p) => !p.abierta);
    ir(falsa.x, 0, -102.6);
    ir(falsa.x, 0, -101.2, 5, 'golpe');
    quieto(0.4);
  }
  ir(puerta.x, 0, -102.6);
  ir(puerta.x, 0, -106);
  // rampa con bolas (más lenta); alguna bola puede bajarlo
  ir(carril * 0.4, 0, -113);
  ir(carril * 0.4, alturaRampa(-128), -128, v * 0.82);
  if (r() < 0.4) {
    ir(pos.x, alturaRampa(-122), -122, 7, 'golpe');
    quieto(0.5);
  }
  ir(carril * 0.3, 6, -144.5, v * 0.82);
  ir(carril * 0.2, 6, META_Z - 1, v * 1.05);
  return { segs, fin: segs.find((s) => s.b.z !== undefined && s.b.z <= META_Z)?.t1 ?? t, v };
}

// Posición de un bot en el instante t: { x, y, z, ry (hacia dónde mira), a (animación) }
export function posBot(ruta, t, semilla) {
  const s = ruta.segs.find((g) => t < g.t1) || ruta.segs[ruta.segs.length - 1];
  const k = Math.max(0, Math.min(1, (t - s.t0) / (s.t1 - s.t0)));
  const punto = (p, tt) => {
    if (p.fila === undefined) return p;
    const pl = moviles(tt, semilla).plataformas[p.fila];
    return { x: pl.x, y: 0, z: pl.z };
  };
  const a = punto(s.a, t);
  const b = punto(s.b, t);
  const x = a.x + (b.x - a.x) * k;
  const z = a.z + (b.z - a.z) * k;
  let y = a.y + (b.y - a.y) * k;
  if (s.tipo === 'salto') y += Math.sin(k * Math.PI) * 2.4;
  const ry = Math.atan2(-(b.x - a.x), -(b.z - a.z)) || 0;
  const anim = t > ruta.fin ? 'festeja' : s.tipo === 'salto' ? 'salto' : s.tipo === 'golpe' ? 'golpe' : s.tipo === 'camina' ? 'corre' : 'quieto';
  return { x, y, z, ry: s.tipo === 'quieto' || s.tipo === 'plataforma' ? 0 : ry, a: anim };
}
