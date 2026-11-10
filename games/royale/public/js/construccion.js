import { BALDOSA, LADO, T, tipoEn } from './mundo.js';

export const COSTO_PIEZA = 10;
export const VIDA_PIEZA = Object.freeze({ madera: 150, piedra: 300, metal: 500 });
export const GRILLA = BALDOSA * 2;

export const alinearPieza = (x, y) => ({ x: Math.floor(x / GRILLA) * GRILLA + GRILLA / 2, y: Math.floor(y / GRILLA) * GRILLA + GRILLA / 2 });

export function validarPieza(mundo, piezas, pieza, materiales) {
  if (!['pared', 'escalera'].includes(pieza.tipo) || !VIDA_PIEZA[pieza.material] || ![0, 1, 2, 3].includes(pieza.rotacion)) return false;
  if ((materiales[pieza.material] || 0) < COSTO_PIEZA) return false;
  const centro = alinearPieza(pieza.x, pieza.y);
  if (centro.x !== pieza.x || centro.y !== pieza.y || pieza.x < GRILLA || pieza.y < GRILLA || pieza.x > LADO - GRILLA || pieza.y > LADO - GRILLA) return false;
  for (const [x, y] of [[-12,-12], [12,-12], [-12,12], [12,12]]) {
    const tipo = tipoEn(mundo, pieza.x + x, pieza.y + y);
    if (tipo === T.AGUA || tipo === T.PARED) return false;
  }
  if (mundo.obstaculos.some(o => !o.roto && Math.hypot(o.x - pieza.x, o.y - pieza.y) < o.r + 19)) return false;
  return !piezas.some(p => p.vida > 0 && Math.abs(p.x - pieza.x) < GRILLA && Math.abs(p.y - pieza.y) < GRILLA);
}

export function vidaEnConstruccion(pieza, ahora) {
  const total = VIDA_PIEZA[pieza.material];
  return Math.min(pieza.vida, Math.max(1, total * Math.min(1, (ahora - pieza.inicio) / 1000)));
}

export function piezaEnPunto(piezas, x, y) {
  return piezas.find(p => p.vida > 0 && Math.abs(p.x - x) <= 16 && Math.abs(p.y - y) <= 16) || null;
}
