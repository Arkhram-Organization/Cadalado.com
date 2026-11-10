import { test } from 'node:test';
import assert from 'node:assert/strict';
import { royale } from '../lib/royale.js';
import { generarMapa, zona, moverCirculo, choqueBala, LADO, T, TAM } from '../public/js/mundo.js';
import { Peleador, CerebroBot, avanzarBala, nuevaBala } from '../public/js/juego.js';
import { getStore } from '../../../shared/store.js';
import { alinearPieza, validarPieza } from '../public/js/construccion.js';

async function req(metodo, ruta, body) {
  const res = await royale.handle(new Request('http://x/api/royale' + ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));
  return { status: res.status, data: await res.json() };
}
const accion = (code, pid, msg) => req('POST', `/salas/${code}`, { pid, ping: 1, msg });
const ver = async (code, pid) => (await req('GET', `/salas/${code}?pid=${pid}&ping=1`)).data;
async function tocar(code, cambios) {
  const k = `sala:royale:${code}`;
  const r = JSON.parse(await getStore().get(k));
  Object.assign(r, cambios);
  await getStore().set(k, JSON.stringify(r), 3600);
}

test('mapa: igual para la misma semilla, con casas, botín, lugares de salida y costa', () => {
  const a = generarMapa(1234);
  const b = generarMapa(1234);
  assert.equal(a, b);
  assert.ok(a.casas.length >= 6, `casas: ${a.casas.length}`);
  assert.ok(a.botin.length >= 30);
  assert.ok(a.salidas.length >= 16, `salidas: ${a.salidas.length}`);
  assert.equal(a.t[0], T.AGUA);
  assert.equal(a.t[(TAM / 2) * TAM + TAM / 2] === T.AGUA, false, 'el centro no es agua');
});

test('zona: arranca grande y se achica hasta casi nada', () => {
  const z0 = zona(99, 0);
  const z1 = zona(99, 200);
  const z2 = zona(99, 400);
  assert.ok(z0.r > LADO * 0.7);
  assert.ok(z1.r < z0.r && z2.r < z1.r);
  assert.ok(z2.dano > z0.dano);
});

test('movimiento y balas: las paredes frenan; una bala le pega a quien tiene adelante', () => {
  const m = generarMapa(77);
  const casa = m.casas[0];
  // una baldosa de pared de arriba (no puerta)
  let i = casa.x + 1;
  while (m.t[casa.y * TAM + i] !== T.PARED) i++;
  const pared = { x: i * 16 + 8, y: casa.y * 16 + 8 };
  let p = { x: pared.x, y: pared.y - 20 };
  for (let k = 0; k < 40; k++) p = moverCirculo(m, p.x, p.y, 0, 1.3, 5);
  assert.ok(p.y < pared.y - 4, `no atraviesa la pared (${p.y} vs ${pared.y})`);
  assert.notEqual(choqueBala(m, pared.x, pared.y - 30, pared.x, pared.y + 30), null);
  const s = m.salidas[0];
  const yo = new Peleador('yo', s.x, s.y);
  const otro = { id: 'otro', x: s.x + 40, y: s.y, vivo: true };
  yo.ang = 0;
  const [b] = yo.disparar(() => 0.5);
  let toco = null;
  for (let i = 0; i < 30 && !toco && b.viva; i++) toco = avanzarBala(m, b, 1 / 60, [otro]);
  assert.equal(toco, otro);
  assert.equal(yo.arma.bala, 11);
  assert.equal(yo.dano(200), true);
});

test('bots: se mueven, buscan pelea y disparan', () => {
  const m = generarMapa(55);
  const s = m.salidas[0];
  const bot = new Peleador('bot0', s.x, s.y);
  const cerebro = new CerebroBot(bot, () => 0.4);
  const enemigo = { id: 'yo', x: s.x + 70, y: s.y, vivo: true };
  let balas = 0;
  for (let i = 0; i < 240; i++) balas += cerebro.paso(1 / 60, m, 55, 10 + i / 60, [enemigo], []).balas.length;
  assert.ok(balas > 0, 'disparó');
});

test('dos bots en la misma posición se separan sin coordenadas inválidas', () => {
  const m = generarMapa(55), s = m.salidas[0];
  const a = new Peleador('bot0', s.x, s.y), b = new Peleador('bot1', s.x, s.y);
  const cerebro = new CerebroBot(a, () => 0.4);
  for (let i = 0; i < 30; i++) cerebro.paso(1 / 60, m, 55, 10 + i / 60, [b], []);
  assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y));
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 0);
});

test('partida: arranca, botín de a uno, bajas, el bot habla y termina con un ganador', async () => {
  const A = 'pidRoyaleAA1';
  const B = 'pidRoyaleBB2';
  const { code } = (await req('POST', '/crear', { pid: A, nombre: 'Ana', opciones: { bots: 2, publica: true } })).data;
  await accion(code, A, { t: 'join', nombre: 'Ana' });
  await accion(code, B, { t: 'join', nombre: 'Beto' });
  assert.equal((await accion(code, B, { t: 'empezar' })).data.error, 'Arranca quien armó la sala');
  let v = (await accion(code, A, { t: 'empezar' })).data.estado;
  assert.equal(v.fase, 'cuenta');
  assert.equal(v.vivos.length, 4);
  await tocar(code, { inicio: Date.now() - 1000 });
  v = await ver(code, A);
  assert.equal(v.estado.fase, 'partida');
  const idA = v.estado.yo;
  const idB = v.estado.jugadores.find((j) => j.nombre === 'Beto').id;
  // botín: el primero se lo queda
  await accion(code, A, { t: 'agarrar', id: 3 });
  await accion(code, B, { t: 'agarrar', id: 3 });
  v = await ver(code, A);
  assert.deepEqual(v.estado.tomados, [3]);
  // no se puede matar a otro por la API: cada uno avisa su muerte (los bots, cualquier participante)
  await accion(code, A, { t: 'muerte', victima: idB, por: idA });
  assert.equal((await ver(code, A)).estado.vivos.length, 4);
  await accion(code, A, { t: 'muerte', victima: 'bot0', por: idA });
  await accion(code, A, { t: 'botdice', bot: 'bot1', situacion: 'gana' });
  v = await ver(code, B);
  assert.ok(v.eventos.some((e) => e.k === 'chat' && e.bot && e.de === 'bot1'));
  await accion(code, B, { t: 'muerte', victima: idB, por: 'bot1' });
  await accion(code, A, { t: 'muerte', victima: 'bot1', por: 'zona' });
  v = await ver(code, A);
  assert.equal(v.estado.fase, 'fin');
  assert.equal(v.estado.ganador, idA);
  assert.equal(v.estado.kills[idA], 1);
  assert.equal(v.estado.bajas.length, 3);
  assert.equal(JSON.stringify(v.estado).includes('pidRoyale'), false, 'no se filtran identificadores');
});

test('cofre abre con una sola acción y entrega su contenido una sola vez', async () => {
  const pid='pidCofreAA1';
  const {code}=(await req('POST','/crear',{pid,nombre:'Lola',opciones:{bots:2}})).data;
  await accion(code,pid,{t:'join',nombre:'Lola'});
  await accion(code,pid,{t:'empezar'});
  await tocar(code,{inicio:Date.now()-1000});
  let v=(await ver(code,pid)).estado;
  const cofre=generarMapa(v.semilla).botin.find(b=>b.tipo==='cofre');
  const contenido=generarMapa(v.semilla).botin.find(b=>b.cofre===cofre.id);
  assert.ok((await accion(code,pid,{t:'agarrar',id:contenido.id})).data.error);
  v=(await accion(code,pid,{t:'abrirCofre',id:cofre.id})).data.estado;
  assert.ok(v.abiertos.includes(cofre.id));
  assert.ok(!(await accion(code,pid,{t:'abrirCofre',id:cofre.id})).data.error);
  assert.equal((await ver(code,pid)).estado.abiertos.filter(id=>id===cofre.id).length,1);
  await accion(code,pid,{t:'agarrar',id:contenido.id});
  assert.equal((await ver(code,pid)).estado.propietarios[contenido.id],v.yo);
});

test('pico junta material, construcción cuesta diez y el servidor impide apilar', async () => {
  const pid='pidConstruccionAA1';
  const {code}=(await req('POST','/crear',{pid,nombre:'Nico',opciones:{bots:2}})).data;
  await accion(code,pid,{t:'join',nombre:'Nico'});
  await accion(code,pid,{t:'empezar'});
  await tocar(code,{inicio:Date.now()-1000});
  let v=(await ver(code,pid)).estado;
  const m=generarMapa(v.semilla),arbol=m.obstaculos.find(o=>o.tipo==='arbol');
  await accion(code,pid,{t:'picar',id:arbol.id});
  const estado=JSON.parse(await getStore().get(`sala:royale:${code}`));estado.golpes={};await getStore().set(`sala:royale:${code}`,JSON.stringify(estado),3600);
  await accion(code,pid,{t:'picar',id:arbol.id});
  v=(await ver(code,pid)).estado;
  assert.ok(v.materiales[v.yo].madera>=10);
  let pieza;
  for(let y=20;y<140&&!pieza;y++)for(let x=20;x<140&&!pieza;x++){
    const p={id:'pieza-'+v.yo+'-1',...alinearPieza(x*16,y*16),tipo:'pared',material:'madera',rotacion:0};
    if(validarPieza(m,[],p,v.materiales[v.yo]))pieza=p;
  }
  assert.ok(pieza);
  v=(await accion(code,pid,{t:'construir',pieza})).data.estado;
  assert.equal(v.construcciones.length,1);
  assert.ok(v.materiales[v.yo].madera<10);
  assert.ok((await accion(code,pid,{t:'construir',pieza:{...pieza,id:'pieza-'+v.yo+'-2'}})).data.error);
  await accion(code,pid,{t:'danarPieza',id:pieza.id,dano:200});
  assert.equal((await ver(code,pid)).estado.construcciones[0].vida,0);
});

test('si muere la única persona, la partida termina aunque queden bots (no se traba)', async () => {
  const pid = 'pidSoloBots1';
  const { code } = (await req('POST', '/crear', { pid, nombre: 'Marti', opciones: { bots: 3 } })).data;
  await accion(code, pid, { t: 'join', nombre: 'Marti' });
  await accion(code, pid, { t: 'empezar' });
  await tocar(code, { inicio: Date.now() - 1000 });
  let v = (await ver(code, pid)).estado;
  // mata un bot, y el aviso repetido no cuenta dos veces
  await accion(code, pid, { t: 'muerte', victima: 'bot0', por: v.yo });
  await accion(code, pid, { t: 'muerte', victima: 'bot0', por: v.yo });
  v = (await ver(code, pid)).estado;
  assert.equal(v.vivos.length, 3);
  await accion(code, pid, { t: 'muerte', victima: v.yo, por: 'zona' });
  v = (await ver(code, pid)).estado;
  assert.equal(v.fase, 'fin', 'sin personas vivas se termina');
});

test('con la tormenta cerrada del todo, los bots que nadie simula quedan afuera y gana la persona', async () => {
  const { DURACION_MAX } = await import('../public/js/mundo.js');
  const pid = 'pidTormentaFin1';
  const { code } = (await req('POST', '/crear', { pid, nombre: 'Marti', opciones: { bots: 3 } })).data;
  await accion(code, pid, { t: 'join', nombre: 'Marti' });
  await accion(code, pid, { t: 'empezar' });
  await tocar(code, { fase: 'partida', inicio: Date.now() - (DURACION_MAX - 30) * 1000, chequeo: 0 });
  const v = (await ver(code, pid)).estado;
  assert.equal(v.fase, 'fin');
  assert.equal(v.ganador, v.yo);
});
