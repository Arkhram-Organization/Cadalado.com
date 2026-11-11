import { zona, LADO, LUGARES, TAM, T, rng } from './mundo.js';

export const DURACION_COLECTIVO = 34;

export function recorridoColectivo(semilla) {
  const r = rng(semilla ^ 0xc011ec7);
  const angulo = r() * Math.PI * 2;
  const dx = Math.cos(angulo), dy = Math.sin(angulo);
  const desvio = (r() - .5) * LADO * .18;
  const cx = LADO / 2 - dy * desvio, cy = LADO / 2 + dx * desvio;
  const tramo = LADO * .42;
  return { inicio: { x: cx - dx * tramo, y: cy - dy * tramo }, fin: { x: cx + dx * tramo, y: cy + dy * tramo }, angulo };
}

export function posicionColectivo(semilla, segundos) {
  const r = recorridoColectivo(semilla);
  const f = Math.max(0, Math.min(1, segundos / DURACION_COLECTIVO));
  return { x: r.inicio.x + (r.fin.x - r.inicio.x) * f, y: r.inicio.y + (r.fin.y - r.inicio.y) * f, angulo: r.angulo };
}

export const saltoAutomatico = segundos => segundos >= DURACION_COLECTIVO;

export function tiempoParaLugar(semilla, lugar) {
  const r = recorridoColectivo(semilla);
  const dx = r.fin.x - r.inicio.x, dy = r.fin.y - r.inicio.y;
  const x = (lugar.x + lugar.w / 2) * 16, y = (lugar.y + lugar.h / 2) * 16;
  const f = ((x - r.inicio.x) * dx + (y - r.inicio.y) * dy) / (dx * dx + dy * dy);
  return Math.max(2, Math.min(DURACION_COLECTIVO - 2, f * DURACION_COLECTIVO));
}

// Cada NPC aterriza en un claro distinto dentro de un lugar, aunque haya más bots que lugares.
export function puntosAterrizaje(mundo, semilla, cantidad) {
  const azar = rng(semilla ^ 0xa9e17a);
  const puntos = [];
  // Los bots eligen lugares que quedan dentro del primer círculo de la zona (si no, caían en la tormenta).
  const c1 = zona(semilla, 0).siguiente;
  const dentro = LUGARES.filter((l) => Math.hypot((l.x + l.w / 2) * 16 - c1.x, (l.y + l.h / 2) * 16 - c1.y) < c1.r - 90);
  const elegibles = dentro.length >= 2 ? dentro : LUGARES;
  for (let i = 0; i < cantidad; i++) {
    const lugar = elegibles[i % elegibles.length];
    let mejor = null, espacio = -1;
    for (let intento = 0; intento < 240; intento++) {
      const tx = lugar.x + 2 + Math.floor(azar() * (lugar.w - 4));
      const ty = lugar.y + 2 + Math.floor(azar() * (lugar.h - 4));
      if (![T.PASTO, T.TIERRA, T.PLAZA, T.CAMINO, T.ARENA].includes(mundo.t[ty * TAM + tx])) continue;
      const x = (tx + .5) * 16, y = (ty + .5) * 16;
      if (mundo.obstaculos.some((o) => !o.roto && Math.hypot(x - o.x, y - o.y) < o.r + 12)) continue;
      const distancia = puntos.filter((p) => p.lugar.id === lugar.id).reduce((d, p) => Math.min(d, Math.hypot(x - p.x, y - p.y)), 999);
      if (distancia > espacio) { mejor = { x, y, lugar }; espacio = distancia; }
      if (distancia >= 64) break;
    }
    puntos.push(mejor || { x: (lugar.x + lugar.w / 2) * 16, y: (lugar.y + lugar.h / 2) * 16, lugar });
  }
  return puntos;
}
