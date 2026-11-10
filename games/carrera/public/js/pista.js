// Los mapas de Ángeles Peña: geometría, obstáculos en movimiento y la ruta de los bots.
// Todo es determinístico (depende de la "semilla" de la ronda y del tiempo): todos los navegadores
// ven lo mismo sin mandarse nada, y el servidor sabe cuándo llega cada bot.
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

export const LIMITE_S = 120; // tiempo máximo de cada ronda
export const COLORES = ['#ff4fa3', '#7aa2ff', '#ff7a45', '#f2c94c', '#c084fc', '#4fd1c5', '#ff6b5b', '#9be15d', '#f4f1ea', '#38d9e6', '#ffa94d', '#e599f7'];
const caja = (x, y, z, w, h, d, c = 0, extra = {}) => ({ x, y, z, w, h, d, c, ...extra });
const piso = (z0, z1, ancho, top = 0, c = 0) => caja(0, top - 0.5, (z0 + z1) / 2, ancho, 1, Math.abs(z1 - z0), c);
const bordes = (z0, z1, ancho, top = 0) => [caja(-ancho / 2 - 0.3, top + 0.4, (z0 + z1) / 2, 0.6, 0.8, Math.abs(z1 - z0), 4), caja(ancho / 2 + 0.3, top + 0.4, (z0 + z1) / 2, 0.6, 0.8, Math.abs(z1 - z0), 4)];
export const alturaRampa = (r, z) => r.y0 + ((r.z0 - z) / (r.z0 - r.z1)) * (r.y1 - r.y0);

// Bolas que bajan por una rampa: aparece una por carril cada `periodo` segundos.
function bolasRampa(rampa, t, fases, periodo = 2.2, vel = 6.6) {
  const out = [];
  [-4, 0, 4].forEach((x, i) => {
    for (let k = 0; k < 3; k++) {
      const edad = ((t + fases[i]) % periodo) + k * periodo;
      const z = rampa.z1 + 1 + edad * vel;
      if (z > rampa.z0 + 2) continue;
      out.push({ x, y: alturaRampa(rampa, Math.max(rampa.z1, Math.min(rampa.z0, z))) + 1.1, z, r: 1.1, vz: vel, giro: (edad * vel) / 1.1 });
    }
  });
  return out;
}
const pendulo = (z, w, fase, t, ancho = 8) => {
  const ang = 1.1 * Math.sin(w * t + fase);
  const dang = 1.1 * w * Math.cos(w * t + fase);
  return { pivote: { x: 0, y: 9.5, z }, ang, brazo: 8, x: 8 * Math.sin(ang), y: 9.5 - 8 * Math.cos(ang), z, vx: 8 * Math.cos(ang) * dang, r: 1.4, ancho };
};

// Dos molinos de aspas (giran en el plano XY, como una hélice de frente) uno a cada lado, en contra.
const molinosPar = (z, w, t, fase) => [
  { x: -3.4, y: 4.6, z: z + 0.35, ang: w * t + fase, w, largo: 4.4, brazos: 3, grosor: 0.55 },
  { x: 3.4, y: 4.6, z: z - 0.35, ang: -w * t + fase + 0.5, w: -w, largo: 4.4, brazos: 3, grosor: 0.55 },
];

// ============================================================ MAPA 1: La largada
const M1 = {
  id: 1,
  nombre: 'La largada',
  META_Z: -166,
  metaY: 5,
  CHECKPOINTS: [{ z: -2, y: 0, nombre: 'Largada' }, { z: -44, y: 0, nombre: 'Saltos' }, { z: -74, y: 0, nombre: 'Martillos' }, { z: -111, y: 0, nombre: 'Molino' }, { z: -154, y: 5, nombre: 'Recta final' }],
  rampa: { x: 0, ancho: 12, z0: -127, z1: -153, y0: 0, y1: 5 },
  estaticos() {
    return {
      cajas: [
        piso(0, -14, 16), ...bordes(0, -14, 16),
        piso(-14, -46, 18, 0, 1), ...bordes(-14, -46, 18),
        caja(0, 1, -22, 1, 2, 1, 4), caja(0, 1, -38, 1, 2, 1, 4),
        // piedras para saltar (la segunda pide doble salto)
        caja(-2.5, -0.5, -49.5, 3, 1, 3, 3), caja(2.5, -0.5, -56.5, 3, 1, 3, 3),
        piso(-72, -104, 14, 0, 2), ...bordes(-72, -104, 14),
        // hueco de doble salto: -104 a -109.5
        piso(-109.5, -127, 14, 0, 3), ...bordes(-109.5, -127, 14),
        piso(-152.5, -174, 14, 5, 0), ...bordes(-152.5, -174, 14, 5),
      ],
      rampas: [this.rampa],
      cintas: [],
      carteles: [{ x: 0, y: 2.2, z: -102.5, texto: 'DOBLE SALTO' }],
    };
  },
  moviles(t, semilla) {
    const f = fases(semilla, 12);
    return {
      plataformas: [
        { x: 4 * Math.sin(0.8 * t + f[0]), y: -0.5, z: -63, w: 4, h: 1, d: 4, vx: 3.2 * Math.cos(0.8 * t + f[0]) },
        { x: 3.5 * Math.sin(1.0 * t + f[1]), y: -0.5, z: -69, w: 4, h: 1, d: 4, vx: 3.5 * Math.cos(1.0 * t + f[1]) },
      ],
      barras: [
        { x: 0, y: 0.55, z: -22, ang: 1.0 * t, w: 1.0, largo: 8.6, r: 0.35 },
        { x: 0, y: 0.55, z: -38, ang: -0.85 * t + 1, w: -0.85, largo: 8.6, r: 0.35 },
      ],
      martillos: [pendulo(-79, 1.4, f[2], t), pendulo(-88, 1.2, f[3], t), pendulo(-97, 1.6, f[4], t)],
      molinos: molinosPar(-118, 0.9, t, f[8]),
      pistones: [],
      bolas: bolasRampa(this.rampa, t, f.slice(5, 8)),
      baldosas: [],
    };
  },
  ruta: [
    { ir: -18 }, { ir: -30, peligro: 0.35 }, { ir: -44.5, peligro: 0.3 },
    { esperar: [0.3, 1.2] }, { saltar: [-2.5, 0, -49.5] }, { esperar: [0.2, 0.6] }, { saltar: [2.5, 0, -56.5], dur: 0.9 },
    { esperar: [0.3, 1.4] }, { fila: 0 }, { fila: 1 }, { saltar: [0, 0, -73.5] },
    { ir: -84, peligro: 0.45 }, { ir: -103.5, peligro: 0.4 }, { esperar: [0.2, 0.8] }, { saltar: [0, 0, -110.5], dur: 0.95 },
    { ir: -115, peligro: 0.2 }, { ir: -121, peligro: 0.45 }, { ir: -126 },
    { ir: -140, y: 'rampa', vel: 0.8, peligro: 0.45 }, { ir: -153.5, y: 'rampa', vel: 0.8 }, { ir: -167, y: 5, vel: 1.05 },
  ],
};

// ============================================================ MAPA 2: Cintas y pistones
const M2 = {
  id: 2,
  nombre: 'Cintas y pistones',
  META_Z: -164,
  metaY: 4,
  CHECKPOINTS: [{ z: -2, y: 0, nombre: 'Largada' }, { z: -46, y: 0, nombre: 'Pistones' }, { z: -82, y: 0, nombre: 'Vigas' }, { z: -111, y: 0, nombre: 'Molinos' }, { z: -152, y: 4, nombre: 'Recta final' }],
  estaticos() {
    const escalones = [0.8, 1.6, 2.4, 3.2].map((top, i) => caja(0, top / 2 - 0.25, -137.5 - i * 3.5, 12, top + 0.5, 2.5, 5));
    return {
      cajas: [
        piso(0, -14, 16), ...bordes(0, -14, 16),
        ...bordes(-14, -44, 12),
        piso(-44, -80, 14, 0, 2), ...bordes(-44, -80, 14),
        // vigas finas sobre el agua
        caja(-4, -0.5, -92, 1.6, 1, 24, 1), caja(0, -0.5, -92, 1.6, 1, 24, 1), caja(4, -0.5, -92, 1.6, 1, 24, 1),
        // hueco de doble salto: -104 a -109
        piso(-109, -135, 14, 0, 3), ...bordes(-109, -135, 14),
        ...escalones,
        piso(-150, -172, 14, 4, 0), ...bordes(-150, -172, 14, 4),
      ],
      rampas: [],
      cintas: [{ x: 0, y: 0, z: -29, w: 12, d: 30, vz: 3 }],
      carteles: [{ x: 0, y: 2.2, z: -102.5, texto: 'DOBLE SALTO' }],
    };
  },
  moviles(t, semilla) {
    const f = fases(semilla, 12);
    const pistones = [-50, -56, -62, -68, -74].map((z, i) => {
      const lado = i % 2 ? 1 : -1;
      const k = 0.5 + 0.5 * Math.sin(2.1 * t + f[i]); // 0 = adentro de la pared, 1 = afuera
      const dk = 0.5 * 2.1 * Math.cos(2.1 * t + f[i]);
      return { x: lado * (10 - k * 6.5), y: 1, z, w: 6, h: 2, d: 2.6, vx: -lado * dk * 6.5 };
    });
    return {
      plataformas: [],
      barras: [{ x: 0, y: 0.55, z: -92, ang: 1.1 * t, w: 1.1, largo: 7, r: 0.35 }],
      martillos: [],
      molinos: [...molinosPar(-116, 0.85, t, f[8]), ...molinosPar(-128, -1.0, t, f[9])],
      pistones,
      bolas: [],
      baldosas: [],
    };
  },
  ruta: [
    { ir: -14 }, { ir: -44, vel: 0.5, peligro: 0.2 }, { ir: -52, peligro: 0.5 }, { ir: -66, peligro: 0.5 }, { ir: -79.5, peligro: 0.35 },
    { carril: [-4, 0, 4], fijo: true }, { ir: -86 }, { ir: -95, peligro: 0.4 }, { ir: -103.5 }, { libre: true },
    { esperar: [0.2, 0.8] }, { saltar: [0, 0, -110.5], dur: 0.95 }, { ir: -114, peligro: 0.2 }, { ir: -124, peligro: 0.45 }, { ir: -134.5, peligro: 0.35 },
    { saltar: [0, 0.8, -137.5] }, { saltar: [0, 1.6, -141] }, { saltar: [0, 2.4, -144.5] }, { saltar: [0, 3.2, -148] }, { saltar: [0, 4, -151.5] },
    { ir: -165, y: 4, vel: 1.05 },
  ],
};

// ============================================================ MAPA 3 (final): Baldosas
const M3 = {
  id: 3,
  nombre: 'La final: baldosas',
  META_Z: -152,
  metaY: 5,
  CHECKPOINTS: [{ z: -2, y: 0, nombre: 'Largada' }, { z: -66, y: 0, nombre: 'Martillos' }, { z: -97, y: 0, nombre: 'Barras' }, { z: -142, y: 5, nombre: 'La corona' }],
  rampa: { x: 0, ancho: 12, z0: -116, z1: -140, y0: 0, y1: 5 },
  estaticos() {
    return {
      cajas: [
        piso(0, -14.4, 16), ...bordes(0, -14.4, 16),
        // después de las baldosas: un tramo firme con dos barras que barren
        piso(-39, -64, 14, 0, 3), ...bordes(-39, -64, 14),
        piso(-64, -90, 8, 0, 1), ...bordes(-64, -90, 8),
        // hueco de doble salto: -90 a -95
        piso(-95, -116, 14, 0, 2), ...bordes(-95, -116, 14),
        caja(0, 1, -102, 1, 2, 1, 4), caja(0, 1, -110, 1, 2, 1, 4),
        piso(-140, -160, 14, 5, 0), ...bordes(-140, -160, 14, 5),
      ],
      rampas: [this.rampa],
      cintas: [],
      carteles: [{ x: 0, y: 2.2, z: -88.5, texto: 'DOBLE SALTO' }],
    };
  },
  moviles(t, semilla) {
    const f = fases(semilla, 12);
    // campo de baldosas: 7 columnas x 12 filas; se caen en olas y vuelven a subir
    const baldosas = [];
    const r = rng(semilla ^ 0xba1d0);
    for (let fila = 0; fila < 12; fila++) for (let col = 0; col < 7; col++) {
      const periodo = 6.5;
      const ciclo = ((t + r() * periodo + fila * 0.35) % periodo) / periodo; // 0..1
      const cae = ciclo > 0.78 ? Math.min(1, (ciclo - 0.78) / 0.04) : 0;
      baldosas.push({ x: (col - 3) * 2.05, y: -0.4 - cae * 6, z: -15.5 - fila * 2.05, w: 1.95, h: 0.8, d: 1.95, solida: ciclo < 0.79, aviso: ciclo > 0.62 && ciclo <= 0.79 });
    }
    return {
      plataformas: [],
      barras: [
        { x: 0, y: 0.55, z: -46, ang: 0.95 * t + f[6], w: 0.95, largo: 6.6, r: 0.35 },
        { x: 0, y: 0.55, z: -56, ang: -1.1 * t + f[7], w: -1.1, largo: 6.6, r: 0.35 },
        { x: 0, y: 0.55, z: -102, ang: 1.2 * t, w: 1.2, largo: 7, r: 0.35 },
        { x: 0, y: 0.55, z: -110, ang: -1.0 * t + 1.3, w: -1.0, largo: 7, r: 0.35 },
      ],
      martillos: [pendulo(-70, 1.7, f[0], t, 6), pendulo(-77, 1.5, f[1], t, 6), pendulo(-84, 1.9, f[2], t, 6)],
      molinos: [],
      pistones: [],
      bolas: bolasRampa(this.rampa, t, f.slice(3, 6), 3.0, 7.5),
      baldosas,
    };
  },
  ruta: [
    { ir: -14 }, { baldosas: true }, { ir: -50, peligro: 0.35 }, { ir: -63.5, peligro: 0.35 },
    { ir: -74, peligro: 0.45, ancho: 2 }, { ir: -89.5, peligro: 0.45, ancho: 2 }, { esperar: [0.2, 0.7] }, { saltar: [0, 0, -96], dur: 0.95 },
    { ir: -105, peligro: 0.4 }, { ir: -115.5, peligro: 0.4 }, { ir: -128, y: 'rampa', vel: 0.8, peligro: 0.45 }, { ir: -140.5, y: 'rampa', vel: 0.8 },
    { ir: -153, y: 5, vel: 1.05 },
  ],
};

export const MAPAS = { 1: M1, 2: M2, 3: M3 };
export const ORDEN_RONDAS = [1, 2, 3];

const cacheF = new Map();
function fases(semilla, n) {
  if (!cacheF.has(semilla)) {
    const r = rng(semilla ^ 0x51ed27);
    cacheF.set(semilla, Array.from({ length: n }, () => r() * 6.28));
  }
  return cacheF.get(semilla);
}
const cacheE = new Map();
export function estaticos(mapaId) {
  if (!cacheE.has(mapaId)) cacheE.set(mapaId, MAPAS[mapaId].estaticos());
  return cacheE.get(mapaId);
}
// Ritmo de los obstáculos: más alto = todo se mueve más rápido (más difícil y más caótico).
export const RITMO = 1.38;
// (las baldosas que se caen siguen a su ritmo: los bots las cruzan en los momentos firmes)
export const moviles = (mapaId, t, semilla) => {
  const m = MAPAS[mapaId].moviles(t * RITMO, semilla);
  if (m.baldosas) m.baldosas = MAPAS[mapaId].moviles(t, semilla).baldosas;
  return m;
};

// ---------------------------------------------------------------- bots
// Cada bot recorre la ruta del mapa con su velocidad, a veces se cae o lo golpean.
// Son más lentos que una persona (6.4 m/s): se les puede ganar, pero no son malos.
export function rutaBot(mapaId, semilla, i) {
  const mapa = MAPAS[mapaId];
  const r = rng((semilla * 31 + i * 7919 + mapaId * 104729) >>> 0);
  const v = 5.3 + r() * 1.0; // bots más rápidos: hay que correr de verdad
  let carril = (r() - 0.5) * 6;
  const segs = [];
  let t = 0;
  let pos = { x: carril, y: 0, z: -3 - r() * 4 };
  const yDe = (y, z) => (y === 'rampa' ? alturaRampa(mapa.rampa, Math.max(mapa.rampa.z1, Math.min(mapa.rampa.z0, z))) : y ?? pos.y);
  const seg = (b, dur, tipo) => {
    segs.push({ t0: t, t1: t + dur, a: { ...pos }, b, tipo });
    t += dur;
    pos = b.fila === undefined ? { ...b } : b;
  };
  seg({ ...pos }, 0.2 + r() * 0.6, 'quieto');
  let fijo = false;
  for (const p of mapa.ruta) {
    if (p.libre) fijo = false;
    else if (p.carril) {
      carril = p.carril[Math.floor(r() * p.carril.length)];
      fijo = !!p.fijo;
      // se acomoda en su carril antes de subirse (por el piso)
      if (fijo) seg({ x: carril, y: pos.y, z: pos.z }, Math.max(0.1, Math.abs(carril - pos.x) / v), 'camina');
    } else if (p.baldosas) {
      // campo de baldosas: salta fila por fila a una que no se vaya a caer
      const tiempoFila = 2.05 / v + 0.08;
      const firme = (fila, col, t0, dur) => {
        for (let q = 0; q <= 3; q++) if (!moviles(mapaId, t0 + (dur * q) / 3, semilla).baldosas[fila * 7 + col].solida) return false;
        return true;
      };
      let col = Math.max(0, Math.min(6, Math.round(pos.x / 2.05) + 3));
      const zFila = (f) => (f < 0 ? -14 : -15.5 - f * 2.05);
      for (let fila = 0; fila < 12; fila++) {
        let elegida = null;
        for (let espera = 0; espera < 14 && elegida == null; espera++) {
          const opciones = [col, col - 1, col + 1].filter((c) => c >= 0 && c <= 6).sort((x, y) => Math.abs(x - 3) - Math.abs(y - 3) + (r() - 0.5) * 2.5);
          // si cambia de columna, primero se corre de costado en su fila (que también tiene que aguantar)
          elegida = opciones.find((c) => firme(fila, c, t, tiempoFila * 2 + 0.4) && (c === col || fila === 0 || (firme(fila - 1, c, t, tiempoFila + 0.3) && firme(fila - 1, col, t, tiempoFila * 0.7)))) ?? null;
          if (elegida == null) {
            if (fila > 0 && !firme(fila - 1, col, t, 0.4)) break;
            seg({ ...pos }, 0.3, 'quieto');
          }
        }
        if (elegida == null) {
          seg({ ...pos }, 2.5, 'cae');
          elegida = col;
        }
        if (elegida !== col) seg({ x: (elegida - 3) * 2.05, y: 0, z: zFila(fila - 1) }, tiempoFila, 'camina');
        col = elegida;
        seg({ x: (col - 3) * 2.05, y: 0, z: zFila(fila) }, tiempoFila, 'camina');
      }
      seg({ x: (col - 3) * 2.05 * 0.6, y: 0, z: -40 }, 1.1 / v + 0.15, 'camina');
    } else if (p.esperar) seg({ ...pos }, p.esperar[0] + r() * (p.esperar[1] - p.esperar[0]), 'quieto');
    else if (p.saltar) seg({ x: p.saltar[0] + (r() - 0.5) * 1.2, y: p.saltar[1], z: p.saltar[2] }, p.dur || 0.7, 'salto');
    else if (p.fila !== undefined) {
      seg({ fila: p.fila }, 0.7, 'salto');
      seg({ fila: p.fila }, 0.5 + r() * 1.0, 'plataforma');
    } else if (p.ir !== undefined) {
      // camina zigzagueando un poco (no en línea recta), sin salirse del piso
      const lim = p.ancho ?? 4.5;
      const z0 = pos.z;
      const tramos = fijo ? 1 : Math.max(1, Math.round(Math.abs(p.ir - z0) / 5));
      for (let k = 1; k <= tramos; k++) {
        const z = z0 + ((p.ir - z0) * k) / tramos;
        let x = fijo ? carril : Math.max(-lim, Math.min(lim, (pos.x ?? 0) * 0.5 + carril * 0.5 + (r() - 0.5) * 3.2));
        if (k === tramos && !fijo) x = Math.max(-lim, Math.min(lim, x));
        const destino = { x, y: yDe(p.y, z), z };
        const d = Math.hypot(destino.x - (pos.x ?? 0), destino.z - (pos.z ?? 0));
        seg(destino, Math.max(0.05, d / (v * (p.vel || 1) * (0.92 + r() * 0.16))), 'camina');
      }
      if (p.peligro && r() < p.peligro) {
        // un obstáculo lo voltea: vuela un poco para atrás, queda tirado y se levanta
        const atras = { x: Math.max(-lim, Math.min(lim, pos.x + (r() - 0.5) * 2)), y: pos.y, z: pos.z + 1.2 + r() * 1.2 };
        if (p.y === 'rampa') atras.y = yDe('rampa', atras.z);
        seg(atras, 0.55, 'golpe');
        seg({ ...pos }, 0.9 + r() * 0.7, 'tirado');
        if (r() < 0.2) seg({ ...pos }, 2.5, 'cae'); // se cayó al agua: vuelve al último punto
      }
    }
  }
  const fin = segs.find((s) => s.b.z !== undefined && s.b.z <= mapa.META_Z)?.t1 ?? t;
  return { segs, fin, v };
}

// Posición de un bot en el instante t: { x, y, z, ry, a }
export function posBot(mapaId, ruta, t, semilla) {
  const s = ruta.segs.find((g) => t < g.t1) || ruta.segs[ruta.segs.length - 1];
  const k = Math.max(0, Math.min(1, (t - s.t0) / (s.t1 - s.t0)));
  const punto = (p, tt) => {
    if (p.fila === undefined) return p;
    const pl = moviles(mapaId, tt, semilla).plataformas[p.fila];
    return { x: pl.x, y: 0, z: pl.z };
  };
  const a = punto(s.a, t);
  const b = punto(s.b, t);
  const x = a.x + (b.x - a.x) * k;
  const z = a.z + (b.z - a.z) * k;
  let y = a.y + (b.y - a.y) * k;
  if (s.tipo === 'salto') y += Math.sin(k * Math.PI) * (s.t1 - s.t0 > 0.8 ? 2.4 : 1.6);
  if (s.tipo === 'cae') y -= Math.min(8, k * 14);
  const ry = Math.atan2(-(b.x - a.x), -(b.z - a.z)) || 0;
  const anim = t > ruta.fin ? 'festeja' : s.tipo === 'salto' ? 'salto' : s.tipo === 'golpe' || s.tipo === 'cae' ? 'golpe' : s.tipo === 'tirado' ? 'tirado' : s.tipo === 'camina' ? 'corre' : 'quieto';
  return { x, y, z, ry: s.tipo === 'camina' || s.tipo === 'salto' ? ry : 0, a: anim };
}
