import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carrera } from '../lib/carrera.js';
import { Jugador } from '../public/js/fisica.js';
import { rutaBot, posBot, moviles, estaticos, MAPAS, ordenLargada, posLargada, puedeMoverAhora } from '../public/js/pista.js';

test('el reloj libera a la persona en cuenta aunque el servidor todavía no cambió de fase', () => {
  assert.equal(puedeMoverAhora('cuenta', -0.01), false);
  assert.equal(puedeMoverAhora('cuenta', 0), true);
  assert.equal(puedeMoverAhora('carrera', 0, true), false);
});
import { NPCS, POR_ID, elegirNpcs, charlas } from '../../../shared/public/npcs.js';
import { getStore } from '../../../shared/store.js';

async function req(metodo, ruta, body) {
  const res = await carrera.handle(new Request('http://x/api/carrera' + ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));
  return { status: res.status, data: await res.json() };
}
const accion = (code, pid, msg) => req('POST', `/salas/${code}`, { pid, ping: 1, msg });
const ver = async (code, pid) => (await req('GET', `/salas/${code}?pid=${pid}&ping=1`)).data;
async function tocar(code, cambios) {
  const k = `sala:carrera:${code}`;
  const r = JSON.parse(await getStore().get(k));
  Object.assign(r, typeof cambios === 'function' ? cambios(r) : cambios);
  await getStore().set(k, JSON.stringify(r), 3600);
}

test('NPC: todos tienen look y frases; Mati aparece poco; las charlas son espaciadas', () => {
  for (const n of NPCS) {
    assert.ok(n.look.piel && n.look.ropa && n.frases.length >= 4, n.id);
  }
  let conMati = 0;
  for (let s = 0; s < 400; s++) if (elegirNpcs(7, s).includes('mati')) conMati++;
  assert.ok(conMati > 20 && conMati < 140, `mati en ${conMati}/400`);
  assert.deepEqual(elegirNpcs(5, 99), elegirNpcs(5, 99));
  const c = charlas('glinsky', 7, 1, 200);
  for (let i = 1; i < c.length; i++) assert.ok(c[i].t - c[i - 1].t >= 25);
  assert.ok(charlas('mati', 3, 0, 2000).some((x) => x.texto.includes('{jugador}')) || POR_ID.mati.frases.length);
});

test('mapas: iguales para todos, sin puertas, y los bots tardan más que una persona', () => {
  for (const id of [1, 2, 3, 4, 5]) {
    assert.deepEqual(moviles(id, 12.3, 99), moviles(id, 12.3, 99));
    assert.ok(estaticos(id).carteles.some((c) => c.texto === 'DOBLE SALTO'), `mapa ${id} tiene hueco de doble salto`);
    for (let i = 0; i < 11; i++) {
      const r = rutaBot(id, 4242, i);
      assert.ok(r.fin > 28 && r.fin < 80, `mapa ${id} bot ${i}: ${r.fin}`);
      assert.ok(posBot(id, r, r.fin + 1, 4242).z <= MAPAS[id].META_Z);
    }
  }
});

test('largada compartida y rutas sin atravesar columnas', () => {
  const orden = ordenLargada(['ana', 'beto'], [0, 1]);
  assert.deepEqual(orden, ['ana', 'bot0', 'beto', 'bot1']);
  assert.deepEqual(posLargada(0, 4), { x: -2.7, y: 0, z: -3 });
  assert.deepEqual(posLargada(1, 4), { x: -0.9, y: 0, z: -3 });
  for (const mapa of [1, 2, 3, 4, 5]) {
    const muros = estaticos(mapa).cajas.filter(c => c.y + c.h / 2 > 0.7 && c.y - c.h / 2 < 1.8 && c.w < 10);
    for (let i = 0; i < 11; i++) {
      const ruta = rutaBot(mapa, 1234, i);
      for (let t = 0; t < ruta.fin; t += 0.2) {
        const p = posBot(mapa, ruta, t, 1234);
        assert.ok(!muros.some(c => p.y < c.y + c.h / 2 && p.y + 1.6 > c.y - c.h / 2 && Math.abs(p.x - c.x) < c.w / 2 + 0.25 && Math.abs(p.z - c.z) < c.d / 2 + 0.25), `mapa ${mapa}, bot ${i}, t ${t.toFixed(1)}`);
      }
    }
  }
});

test('física: corre más tranquilo, doble salto, cae al agua y vuelve al último punto', () => {
  const j = new Jugador(1, 7);
  j.ubicar(0, 0, -3);
  for (let i = 0; i < 60; i++) j.paso(1 / 60, i / 60, { x: 0, z: 1 }, 0);
  assert.ok(j.z < -7 && j.z > -10 && j.enSuelo, `avanzó a ${j.z}`);
  let ev = j.paso(1 / 60, 1, { x: 0, z: 0, salto: true }, 0);
  assert.ok(ev.includes('salto') && j.vy > 0);
  for (let i = 0; i < 10; i++) j.paso(1 / 60, 1, { x: 0, z: 0 }, 0);
  ev = j.paso(1 / 60, 1, { x: 0, z: 0, salto: true }, 0);
  assert.ok(ev.includes('doble'), 'hace doble salto en el aire');
  ev = j.paso(1 / 60, 1, { x: 0, z: 0, salto: true }, 0);
  assert.ok(!ev.includes('doble') && !ev.includes('salto'), 'no hay triple salto');
  // el hueco de doble salto del mapa 1 (-104 a -109.5): con un salto solo no llega, con doble sí
  const cruzar = (doble) => {
    const k = new Jugador(1, 7);
    k.cp = 3;
    k.ubicar(0, 0, -98);
    let i2 = -1;
    for (let i = 0; i < 300; i++) {
      let s = false;
      if (i2 < 0 && k.z < -103.6) {
        s = true;
        i2 = i + 25;
      }
      if (doble && i === i2) s = true;
      const ev = k.paso(1 / 60, 3, { x: 0, z: 1, salto: s }, 0);
      if (ev.includes('caida')) return false;
      if (i2 > 0 && k.enSuelo && k.z < -109.5) return true;
    }
    return false;
  };
  assert.equal(cruzar(false), false);
  assert.equal(cruzar(true), true);
  // al agua
  j.ubicar(20, 0, -50);
  let cayo = false;
  for (let i = 0; i < 200 && !cayo; i++) cayo = j.paso(1 / 60, 3, { x: 0, z: 0 }, 0).includes('caida');
  assert.ok(cayo);
  assert.ok(Math.abs(j.z + 2) < 0.01, `vuelve al último punto: ${j.z}`);
  // piña con enfriamiento de 10 s
  const p = new Jugador(1, 7);
  assert.equal(p.golpear(), true);
  assert.equal(p.golpear(), false);
  for (let i = 0; i < 600; i++) p.paso(1 / 60, i / 60, { x: 0, z: 0 }, 0);
  assert.equal(p.golpear(), true);
  p.recibirGolpe(1, 0);
  assert.ok(p.vx > 5 && p.aturdido > 0);
});

test('sala: rondas con eliminación, NPC como bots, piñas solo al destinatario y podio', async () => {
  const A = 'pidCarreraAA1';
  const B = 'pidCarreraBB2';
  const C = 'pidCarreraCC3';
  const { code } = (await req('POST', '/crear', { pid: A, nombre: 'Ana', opciones: { bots: 5, publica: true } })).data;
  await accion(code, A, { t: 'join', nombre: 'Ana' });
  await accion(code, B, { t: 'join', nombre: 'Beto' });
  await accion(code, C, { t: 'join', nombre: 'Caro' });
  let v = await ver(code, A);
  assert.equal(v.estado.botNpc.length, 5);
  assert.ok(v.estado.botNpc.every((n) => POR_ID[n]));
  const idB = v.estado.jugadores.find((j) => j.nombre === 'Beto').id;
  // señalización y piñas: le llegan solo a Beto
  await accion(code, A, { t: 'senal', para: idB, data: { tipo: 'oferta', sdp: { type: 'offer', sdp: 'x' } } });
  await accion(code, A, { t: 'golpe', para: idB, dx: 1, dz: 0 });
  await accion(code, A, { t: 'golpe', para: idB, dx: 1, dz: 0 }); // enfriamiento: no pasa
  const deB = (await ver(code, B)).eventos;
  const deC = (await ver(code, C)).eventos;
  assert.equal(deB.filter((e) => e.k === 'senal').length, 1);
  assert.equal(deB.filter((e) => e.k === 'golpe').length, 1);
  assert.equal(deC.filter((e) => e.k === 'senal' || e.k === 'golpe').length, 0);
  // largada: 3 personas + 5 bots = 8 → tres rondas
  assert.equal((await accion(code, B, { t: 'empezar' })).data.error, 'Larga la carrera quien armó la sala');
  v = (await accion(code, A, { t: 'empezar' })).data;
  assert.equal(v.estado.fase, 'cuenta');
  assert.equal(v.estado.rondas.length, 3);
  assert.ok(MAPAS[v.estado.rondas[2]], 'la final tiene un mapa válido');
  assert.equal(v.estado.cupo, 5); // ceil(8 * .55)
  assert.equal(v.estado.vivos.length, 3);
  await tocar(code, { inicio: Date.now() - 1000 });
  v = await ver(code, A);
  assert.equal(v.estado.fase, 'carrera');
  // llegada demasiado rápida: no vale
  assert.equal((await accion(code, A, { t: 'meta' })).data.error, 'Llegada inválida');
  // Ana y Beto llegan antes que todos los bots; Caro no llega
  await tocar(code, { inicio: Date.now() - 25_000 });
  await accion(code, A, { t: 'meta' });
  await accion(code, B, { t: 'meta' });
  // pasa el tiempo: los bots llegan y se llena el cupo
  await tocar(code, { inicio: Date.now() - 200_000 });
  v = await ver(code, A);
  assert.equal(v.estado.fase, 'ronda');
  assert.equal(v.estado.clasificacion.filter((x) => x.paso).length, 5);
  assert.ok(v.estado.clasificacion.find((x) => x.nombre === 'Ana').paso);
  assert.ok(!v.estado.clasificacion.find((x) => x.nombre === 'Caro').paso, 'Caro no llegó: afuera');
  assert.equal(v.estado.vivos.length, 2);
  assert.equal(v.estado.botsVivos.length, 3);
  // siguiente ronda
  await tocar(code, { fin: Date.now() - 1 });
  v = await ver(code, A);
  assert.equal(v.estado.fase, 'cuenta');
  assert.equal(v.estado.ronda, 2);
  assert.equal(v.estado.cupo, 2); // ceil(5 * .4)
  assert.equal((await accion(code, C, { t: 'meta' })).data.error, undefined);
  await tocar(code, { inicio: Date.now() - 25_000, fase: 'carrera' });
  await accion(code, B, { t: 'meta' });
  await accion(code, C, { t: 'meta' }); // eliminada: no cuenta
  await tocar(code, { inicio: Date.now() - 200_000 });
  v = await ver(code, A);
  assert.equal(v.estado.fase, 'ronda');
  assert.equal(v.estado.vivos.length, 1, 'solo Beto sigue');
  // final
  await tocar(code, { fin: Date.now() - 1 });
  await ver(code, A);
  await tocar(code, { inicio: Date.now() - 22_000, fase: 'carrera' });
  v = (await accion(code, B, { t: 'meta' })).data;
  // el primero en llegar gana: termina enseguida
  await tocar(code, { fin: Date.now() - 1 });
  v = await ver(code, A);
  assert.equal(v.estado.fase, 'podio');
  assert.equal(v.estado.resultados[0].nombre, 'Beto');
  assert.ok(v.estado.resultados[0].paso);
  assert.equal(v.estado.resultados.length, 8);
  assert.equal(v.estado.resultados.at(-1).ronda, 1, 'los que quedaron afuera primero van al final');
  assert.equal(JSON.stringify(v.estado).includes('pidCarrera'), false, 'no se filtran identificadores');
  // relevo de posiciones (plan B)
  await req('POST', '/pos', { pid: A, code, s: '1,2,3,0,corre,10' });
  const pos = (await req('GET', `/pos?code=${code}`)).data.pos;
  assert.equal(Object.values(pos)[0], '1,2,3,0,corre,10');
});

test('jugando solo se juegan los tres mapas', async () => {
  const A = 'pidCarreraSolo1';
  const { code } = (await req('POST', '/crear', { pid: A, nombre: 'Sola', opciones: { bots: 0 } })).data;
  await accion(code, A, { t: 'join', nombre: 'Sola' });
  let v = (await accion(code, A, { t: 'empezar' })).data;
  assert.equal(v.estado.rondas.length, 3);
  assert.equal(new Set(v.estado.rondas).size, 3);
  assert.ok(v.estado.rondas.every(id => MAPAS[id]));
  for (let ronda = 1; ronda <= 3; ronda++) {
    await tocar(code, { inicio: Date.now() - 30_000, fase: 'carrera' });
    await accion(code, A, { t: 'meta' });
    await tocar(code, { fin: Date.now() - 1 });
    v = await ver(code, A);
    if (ronda < 3) {
      assert.equal(v.estado.fase, 'ronda', `ronda ${ronda}`);
      await tocar(code, { fin: Date.now() - 1 });
      v = await ver(code, A);
      assert.equal(v.estado.ronda, ronda + 1);
    }
  }
  assert.equal(v.estado.fase, 'podio');
  assert.ok(v.estado.resultados[0].paso);
});

test('los bots siempre pisan algo firme (no caminan por el aire ni sobre baldosas que se caen)', () => {
  for (const m of [1, 2, 3]) {
    const j = new Jugador(m, 77);
    for (let i = 0; i < 11; i++) for (const sem of [77, 4242]) {
      const ruta = rutaBot(m, sem, i);
      for (let t = 0; t < ruta.fin; t += 0.1) {
        const sg = ruta.segs.find((g) => t < g.t1);
        if (!sg || !['camina', 'quieto', 'tirado', 'plataforma'].includes(sg.tipo)) continue;
        const p = posBot(m, ruta, t, sem);
        const s = j.suelo(p.x, p.z, p.yPiso + 0.6, moviles(m, t, sem));
        assert.ok(s.y > p.yPiso - 0.6, `mapa ${m} bot ${i}: sin piso en x ${p.x.toFixed(1)} z ${p.z.toFixed(1)} (t ${t.toFixed(1)})`);
      }
    }
  }
});

test('los obstáculos y las piñas te tiran al piso un rato', () => {
  const j = new Jugador(1, 7);
  j.ubicar(0, 0, -4);
  j.recibirGolpe(0, -1); // hacia adelante, por el medio (lejos de las placas turbo)
  let tirado = false;
  for (let i = 0; i < 90; i++) {
    j.paso(1 / 60, 1, { x: 0, z: 1 }, 0);
    if (j.anim === 'tirado') tirado = true;
  }
  assert.ok(tirado, 'quedó tirado');
  for (let i = 0; i < 60; i++) j.paso(1 / 60, 3, { x: 0, z: 1 }, 0);
  assert.notEqual(j.anim, 'tirado', 'se levanta');
});

test('final: el cruce más temprano gana aunque su mensaje llegue después', async () => {
  const A='finalPrimeroA123', B='finalSegundoB123';
  const {code}=(await req('POST','/crear',{pid:A,nombre:'Primero',opciones:{bots:0}})).data;
  await accion(code,B,{t:'join',nombre:'Segundo'});
  await accion(code,A,{t:'empezar'});
  await tocar(code,{inicio:Date.now()-25000,fase:'carrera'});
  // Segundo tiene mejor conexión; Primero cruzó 500 ms antes.
  await accion(code,B,{t:'meta',tiempo:24700});
  await accion(code,A,{t:'meta',tiempo:24200});
  await tocar(code,{fin:Date.now()-1});
  const e=(await ver(code,A)).estado;
  assert.equal(e.fase,'podio');
  assert.equal(e.resultados[0].nombre,'Primero');
  assert.equal(e.resultados[0].puesto,1);
  assert.equal(e.ganador,e.resultados[0].id);
  assert.equal(e.resultados[1].nombre,'Segundo');
});

test('las placas turbo aceleran y los trampolines cruzan el hueco de doble salto', () => {
  const j = new Jugador(1, 7);
  j.ubicar(-5, 0, -7.2);
  let turbo = false;
  for (let i = 0; i < 40; i++) if (j.paso(1 / 60, 50, { x: 0, z: 1 }, 0).includes('turbo')) turbo = true;
  assert.ok(turbo, 'pisó la placa');
  assert.ok(Math.hypot(j.vx, j.vz) > 9, 'corre más rápido que lo normal');
  for (let i = 0; i < 200; i++) j.paso(1 / 60, 50, { x: 0, z: 0 }, 0);
  assert.equal(j.turbo, 0, 'el turbo se termina');

  // trampolín antes del hueco (-104 a -109.5): parado y todo, te deja del otro lado
  j.ubicar(-4.6, 0, -100.9);
  let rebote = false;
  for (let i = 0; i < 150 && !(rebote && j.enSuelo); i++) if (j.paso(1 / 60, 50, { x: 0, z: 1 }, 0).includes('rebote')) rebote = true;
  assert.ok(rebote, 'rebotó');
  assert.ok(j.enSuelo && j.z < -109.5 && j.y === 0, `aterrizó del otro lado (z=${j.z.toFixed(1)}, y=${j.y.toFixed(1)})`);
});

test('el salto apretado justo antes de aterrizar sale igual (buffer)', () => {
  const j = new Jugador(1, 7);
  j.ubicar(0, 0, -4);
  j.paso(1 / 60, 50, { x: 0, z: 0, salto: true }, 0);
  j.paso(1 / 60, 50, { x: 0, z: 0, salto: true }, 0); // doble salto
  let saltos = 0;
  let apretado = false;
  for (let i = 0; i < 200; i++) {
    // aprieta una sola vez, cuando está por tocar el piso (ya sin saltos disponibles)
    const apretar = !apretado && j.vy < 0 && j.y < 0.9;
    if (apretar) apretado = true;
    if (j.paso(1 / 60, 50, { x: 0, z: 0, salto: apretar }, 0).includes('salto')) saltos++;
  }
  assert.ok(apretado, 'apretó en el aire');
  assert.equal(saltos, 1, 'el salto guardado salió al aterrizar');
});
