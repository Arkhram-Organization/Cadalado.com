import { LADO, rng } from './mundo.js';

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
