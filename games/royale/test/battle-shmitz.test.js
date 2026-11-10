import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generarMapa, LUGARES, LADO, TAM, T, ARMAS, RAREZAS, danoRareza, danoArea, zona } from '../public/js/mundo.js';
import { DURACION_COLECTIVO, posicionColectivo, saltoAutomatico, tiempoParaLugar, puntosAterrizaje } from '../public/js/colectivo.js';
import { alinearPieza, validarPieza, vidaEnConstruccion, COSTO_PIEZA, VIDA_PIEZA } from '../public/js/construccion.js';

test('geografía fija, ocho lugares separados y botín variable por semilla', () => {
  const a = generarMapa(123), b = generarMapa(456);
  assert.equal(TAM, 160); assert.equal(LADO, 2560);
  assert.equal(LUGARES.length, 8);
  assert.deepEqual(a.t, b.t);
  assert.deepEqual(a.casas, b.casas);
  assert.deepEqual(a.obstaculos, b.obstaculos);
  assert.notDeepEqual(a.botin, b.botin);
  for (let i = 0; i < LUGARES.length; i++) for (let j = i + 1; j < LUGARES.length; j++) {
    const x = LUGARES[i], y = LUGARES[j];
    assert.ok(x.x + x.w <= y.x || y.x + y.w <= x.x || x.y + x.h <= y.y || y.y + y.h <= x.y, `${x.nombre} y ${y.nombre} se pisan`);
  }
  const q = LUGARES.find(l => l.id === 'queque');
  const cofresQueque = a.botin.filter(x => x.tipo === 'cofre' && x.x >= q.x*16 && x.x < (q.x+q.w)*16 && x.y >= q.y*16 && x.y < (q.y+q.h)*16).length;
  assert.ok(cofresQueque >= 6, `cofres en el Queque: ${cofresQueque}`);
  for (const l of LUGARES) assert.ok(a.botin.some(x => x.tipo === 'cofre' && x.x >= l.x*16 && x.x < (l.x+l.w)*16 && x.y >= l.y*16 && x.y < (l.y+l.h)*16), `sin cofres en ${l.nombre}`);
  assert.notDeepEqual(zona(123, 80), zona(456, 80));
});

test('todas las baldosas caminables se alcanzan desde el centro', () => {
  const m = generarMapa(99), vistos = new Uint8Array(TAM * TAM), cola = [80 * TAM + 80];
  vistos[cola[0]] = 1;
  for (let k = 0; k < cola.length; k++) {
    const n = cola[k], x = n % TAM, y = Math.floor(n / TAM);
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const xx = x + dx, yy = y + dy, j = yy * TAM + xx;
      if (xx >= 0 && xx < TAM && yy >= 0 && yy < TAM && !vistos[j] && m.t[j] !== T.AGUA && m.t[j] !== T.PARED) { vistos[j] = 1; cola.push(j); }
    }
  }
  for (let i = 0; i < m.t.length; i++) if (m.t[i] !== T.AGUA && m.t[i] !== T.PARED) assert.equal(vistos[i], 1, `baldosa ${i} aislada`);
});

test('colectivo determinista y salto automático al final', () => {
  const a = posicionColectivo(42, 0), b = posicionColectivo(42, DURACION_COLECTIVO / 2), c = posicionColectivo(42, DURACION_COLECTIVO);
  assert.deepEqual(b, posicionColectivo(42, DURACION_COLECTIVO / 2));
  assert.ok(Math.abs(b.x - (a.x + c.x)/2) < .001 && Math.abs(b.y - (a.y + c.y)/2) < .001);
  assert.equal(saltoAutomatico(DURACION_COLECTIVO - .01), false);
  assert.equal(saltoAutomatico(DURACION_COLECTIVO), true);
  assert.ok(tiempoParaLugar(42, LUGARES[0]) > 0);
});

test('los NPC aterrizan separados y el botín natural está en los lugares', () => {
  const m = generarMapa(73);
  const a = puntosAterrizaje(m, 73, 15);
  assert.deepEqual(a, puntosAterrizaje(m, 73, 15));
  assert.equal(a.length, 15);
  for (const p of a) {
    assert.ok(p.x >= p.lugar.x * 16 && p.x < (p.lugar.x + p.lugar.w) * 16);
    assert.ok(p.y >= p.lugar.y * 16 && p.y < (p.lugar.y + p.lugar.h) * 16);
    assert.ok(![T.AGUA, T.PARED].includes(m.t[Math.floor(p.y / 16) * TAM + Math.floor(p.x / 16)]));
  }
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i].lugar.id === a[j].lugar.id) assert.ok(Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y) >= 48);
  for (const b of m.botin) assert.ok(LUGARES.some(l => b.x >= l.x * 16 && b.x < (l.x + l.w) * 16 && b.y >= l.y * 16 && b.y < (l.y + l.h) * 16), `botín ${b.id} fuera de una ciudad`);
});

test('rarezas, explosión y vida de las piezas siguen las tablas', () => {
  assert.equal(danoRareza(100, 'legendaria'), 135);
  assert.equal(danoRareza(100, 'comun'), 100);
  assert.equal(danoArea(70, 40, 0), 70);
  assert.equal(danoArea(70, 40, 20), 35);
  assert.equal(danoArea(70, 40, 40), 0);
  assert.ok(ARMAS.francotirador.vel > ARMAS.rpg.vel);
  assert.ok(ARMAS.pistola.cadencia > .3);
  assert.deepEqual(Object.keys(RAREZAS), ['comun','poco_comun','rara','epica','legendaria']);
  const p={material:'madera',vida:VIDA_PIEZA.madera,inicio:1000};
  assert.equal(vidaEnConstruccion(p, 1500), 75);
  assert.equal(vidaEnConstruccion(p, 2000), 150);
});

test('una pieza cuesta 10, respeta la grilla y no se apila', () => {
  const m = generarMapa(7), materiales={madera:10,piedra:0,metal:0};
  let pieza;
  for(let y=20;y<140&&!pieza;y++)for(let x=20;x<140&&!pieza;x++){
    const p={id:'pieza-prueba-1',...alinearPieza(x*16,y*16),tipo:'pared',material:'madera',rotacion:0,vida:150};
    if(validarPieza(m,[],p,materiales))pieza=p;
  }
  assert.ok(pieza);
  assert.equal(COSTO_PIEZA,10);
  assert.equal(validarPieza(m,[],pieza,{madera:9}),false);
  assert.equal(validarPieza(m,[pieza],pieza,materiales),false);
  assert.equal(validarPieza(m,[],{...pieza,x:pieza.x+1},materiales),false);
});
