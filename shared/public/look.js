// Personaje propio: todas las opciones editables, vestimentas de base y la limpieza de lo que llega
// (lo usan el editor, el navegador al entrar a una sala y el servidor). Archivo puro, sin navegador.

const COLOR = /^#[0-9a-fA-F]{6}$/;

import { POR_ID } from './npcs.js';
import { limpiarRueda } from './gestos.js';

export const ESTILOS_PELO = [
  ['calvo', 'Pelado'], ['rapado', 'Rapado'], ['poco', 'Solo costados'], ['entradas', 'Corto con entradas'],
  ['corto', 'Corto'], ['rulosCorto', 'Rulos cortos'], ['rulos', 'Rulos'], ['rulosPoco', 'Rulos ralos'], ['largo', 'Largo'],
];
export const CUERPOS = [['flaco', 'Flaco'], ['normal', 'Normal'], ['gordito', 'Gordito']];
export const PRENDAS = [['remera', 'Remera'], ['chomba', 'Chomba'], ['camisa', 'Camisa'], ['buzo', 'Buzo'], ['smoking', 'Smoking']];
export const BARBAS = [['', 'Sin barba'], ['corta', 'Corta'], ['tupida', 'Tupida']];
export const LENTES = [['', 'Sin lentes'], ['redonda', 'Redondos'], ['cuadrada', 'Rectangulares']];

export const PALETAS = {
  piel: ['#f6dcc6', '#f0cfb4', '#e8c4a8', '#e3b58f', '#d9a982', '#c48c64', '#a8714c', '#8d5b3e', '#6a4128', '#4a2c1a'],
  pelo: ['#0f0d0c', '#1f1712', '#2b1d14', '#4a3020', '#6b4226', '#8a5a2e', '#b07a3e', '#d9b36a', '#e8d9a8', '#a9a49b', '#eeeeea', '#b8402a', '#c8102e', '#2f6fd6', '#7b3fd6', '#ff4fa3'],
  ojos: ['#3a2a1c', '#5a3a22', '#7a5230', '#4f8fc9', '#2f6fd6', '#3b6e3b', '#6b8e5a', '#8a8f96'],
  ropa: ['#141416', '#f4f1ea', '#1f2a4d', '#3a4256', '#7aa2ff', '#a9c4e8', '#2f6b4f', '#9be15d', '#c5f04a', '#f2c94c', '#ff7a45', '#d63a3a', '#ff4fa3', '#c084fc', '#7a1f2b', '#8a9488', '#5b3a26', '#b8783f'],
};

// Look de base (cuando no hay nada guardado)
export const LOOK_BASE = {
  piel: '#e8c4a8', ojos: '#5a3a22', cuerpo: 'normal',
  pelo: { estilo: 'corto', color: '#2b1d14' },
  prenda: 'remera', barbaTipo: '', barba: '#2b1d14', lentesForma: '', lentes: '#1d1d22', lentesClaros: false,
  ropa: { remera: '#7aa2ff', pantalon: '#3a4256', zapatillas: '#e9e1d1', estampado: '', franja: '', bolso: '' },
  campera: '', capucha: '', gorra: '', sombrero: '', kipa: '', auriculares: '', antifaz: '', capa: '', mochila: '', guantes: '', camara: false,
};

// Vestimentas de base: cambian solo la ropa y los accesorios (la cara y el pelo quedan como estaban).
export const VESTIMENTAS = [
  { id: 'casual', nombre: 'Casual', ropa: { prenda: 'remera', remera: '#7aa2ff', pantalon: '#3a4256', zapatillas: '#e9e1d1', bolso: '#b8783f' } },
  { id: 'oficina', nombre: 'Oficina', ropa: { prenda: 'camisa', remera: '#a9c4e8', pantalon: '#3a3f4a', zapatillas: '#3a2f28' } },
  { id: 'buzo', nombre: 'Buzo con capucha', ropa: { prenda: 'buzo', remera: '#1f2a4d', pantalon: '#15171c', zapatillas: '#e9e6e0' }, extra: { capucha: '#1f2a4d' } },
  { id: 'fotografo', nombre: 'Fotógrafo', ropa: { prenda: 'remera', remera: '#18181c', pantalon: '#2a2d36' }, extra: { mochila: '#6b6658', camara: true } },
  { id: 'cuadros', nombre: 'Cuadros y campera', ropa: { prenda: 'camisa', remera: '#4f73b0', estampado: 'cuadros', pantalon: '#2b2b33' }, extra: { campera: '#8a9488' } },
  { id: 'chomba', nombre: 'Chomba negra', ropa: { prenda: 'chomba', remera: '#151518', pantalon: '#18181b', zapatillas: '#2a2a2e' } },
  { id: 'deportivo', nombre: 'Deportivo', ropa: { prenda: 'remera', remera: '#d63a3a', franja: '#f4f1ea', pantalon: '#141416', zapatillas: '#f4f1ea' }, extra: { gorra: '#141416' } },
  { id: 'elegante', nombre: 'Elegante', ropa: { prenda: 'smoking', pantalon: '#141416' } },
  { id: 'heroe', nombre: 'Superhéroe', ropa: { prenda: 'remera', remera: '#f2c94c', pantalon: '#2f8f4e' }, extra: { capa: '#2f8f4e', antifaz: '#123d22' } },
  { id: 'dj', nombre: 'DJ', ropa: { prenda: 'buzo', remera: '#7b3fd6', pantalon: '#141416', zapatillas: '#c5f04a' }, extra: { auriculares: '#141416', lentes: '#141416', lentesForma: 'cuadrada' } },
];
const SIN_ACCESORIOS = { campera: '', capucha: '', gorra: '', sombrero: '', antifaz: '', capa: '', mochila: '', guantes: '', camara: false, auriculares: '' };

export function aplicarVestimenta(look, id) {
  const v = VESTIMENTAS.find((x) => x.id === id);
  if (!v) return look;
  const { prenda, ...ropa } = v.ropa;
  return limpiarLook({
    ...look, ...SIN_ACCESORIOS, kipa: look.kipa, prenda,
    ropa: { ...LOOK_BASE.ropa, ...ropa },
    lentes: v.extra?.lentes ?? look.lentes, lentesForma: v.extra?.lentesForma ?? look.lentesForma,
    ...Object.fromEntries(Object.entries(v.extra || {}).filter(([k]) => !k.startsWith('lentes'))),
  });
}

const color = (v, d = '') => (typeof v === 'string' && COLOR.test(v) ? v.toLowerCase() : d);
const enumv = (v, lista, d) => (lista.some(([k]) => k === v) ? v : d);

// Deja solo lo permitido (sirve para lo que llega de cualquier navegador).
export function limpiarLook(x) {
  const l = x && typeof x === 'object' ? x : {};
  const ropa = l.ropa && typeof l.ropa === 'object' ? l.ropa : {};
  return {
    piel: color(l.piel, LOOK_BASE.piel),
    ojos: color(l.ojos, LOOK_BASE.ojos),
    cuerpo: enumv(l.cuerpo, CUERPOS, 'normal'),
    pelo: { estilo: enumv(l.pelo?.estilo, ESTILOS_PELO, 'corto'), color: color(l.pelo?.color, '#2b1d14') },
    prenda: enumv(l.prenda, PRENDAS, 'remera'),
    barbaTipo: enumv(l.barbaTipo ?? '', BARBAS, ''),
    barba: color(l.barba, '#2b1d14'),
    lentesForma: enumv(l.lentesForma ?? '', LENTES, ''),
    lentes: color(l.lentes, '#1d1d22'),
    lentesClaros: !!l.lentesClaros,
    ropa: {
      remera: color(ropa.remera, '#7aa2ff'),
      pantalon: color(ropa.pantalon, '#3a4256'),
      zapatillas: color(ropa.zapatillas, '#e9e1d1'),
      estampado: ropa.estampado === 'cuadros' ? 'cuadros' : '',
      franja: color(ropa.franja),
      bolso: color(ropa.bolso),
    },
    campera: color(l.campera), capucha: color(l.capucha), gorra: color(l.gorra), sombrero: color(l.sombrero),
    kipa: color(l.kipa), auriculares: color(l.auriculares), antifaz: color(l.antifaz), capa: color(l.capa),
    mochila: color(l.mochila), guantes: color(l.guantes), camara: !!l.camara,
    // casillero: jugar con un personaje del elenco (solo ids que existen)
    npc: typeof l.npc === 'string' && POR_ID[l.npc] ? l.npc : '',
    // los 8 gestos de la rueda de la B (casillero)
    gestos: limpiarRueda(l.gestos),
  };
}

// Lo que entiende el dibujo 3D (persona3d) y los avatares, a partir del look editable.
export function lookParaDibujo(x) {
  const l = limpiarLook(x);
  if (l.npc) return { ...POR_ID[l.npc].look }; // elegiste un personaje del casillero
  const d = {
    piel: l.piel, ojos: l.ojos, cuerpo: l.cuerpo, pelo: l.pelo,
    ropa: { remera: l.ropa.remera, pantalon: l.ropa.pantalon, zapatillas: l.ropa.zapatillas, bolso: l.ropa.bolso || false },
  };
  if (l.ropa.estampado) d.ropa.estampado = l.ropa.estampado;
  if (l.ropa.franja) d.ropa.franja = l.ropa.franja;
  if (l.prenda === 'chomba') d.polo = true;
  if (l.prenda === 'camisa') d.camisa = true;
  if (l.prenda === 'buzo') d.mangasLargas = true;
  if (l.prenda === 'smoking') d.smoking = true;
  if (l.barbaTipo) {
    d.barba = l.barba;
    if (l.barbaTipo === 'corta') d.barbaCorta = true;
  }
  if (l.lentesForma) {
    d.lentes = l.lentes;
    d.lentesForma = l.lentesForma === 'cuadrada' ? 'cuadrada' : 'redonda';
    if (l.lentesClaros) d.lentesClaros = true;
  }
  for (const k of ['campera', 'capucha', 'gorra', 'sombrero', 'kipa', 'auriculares', 'antifaz', 'capa', 'mochila', 'guantes']) if (l[k]) d[k] = l[k];
  if (l.camara) d.camara = true;
  return d;
}

// Personaje al azar (botón "sorprendeme")
export function lookAlAzar(r = Math.random) {
  const de = (lista) => lista[Math.floor(r() * lista.length)];
  let l = {
    ...LOOK_BASE,
    piel: de(PALETAS.piel), ojos: de(PALETAS.ojos), cuerpo: de(CUERPOS)[0],
    pelo: { estilo: de(ESTILOS_PELO)[0], color: de(PALETAS.pelo.slice(0, 11)) },
    barbaTipo: r() < 0.35 ? de(BARBAS.slice(1))[0] : '',
    lentesForma: r() < 0.3 ? de(LENTES.slice(1))[0] : '',
  };
  l.barba = l.pelo.color;
  l = aplicarVestimenta(l, de(VESTIMENTAS).id);
  return l;
}
