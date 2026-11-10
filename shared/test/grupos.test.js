import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../club-api.js';
import { haxball } from '../../games/haxball/lib/haxball.js';

function cliente(ip) {
  let cookie = '';
  return async (metodo, ruta, body) => {
    const res = await handle(new Request('http://localhost/api/club' + ruta, { method: metodo, headers: { 'content-type': 'application/json', cookie, 'x-forwarded-for': ip }, body: body ? JSON.stringify(body) : undefined }));
    const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    return { status: res.status, data: await res.json() };
  };
}
const rnd = () => Math.random().toString(36).slice(2, 8);

test('grupos: sin cuenta, lobby abierta, otro se une con la flechita, el líder arranca y van todos', async () => {
  const a = cliente('11.0.0.1'), b = cliente('11.0.0.2');
  const pa = 'pidgrupoA' + rnd(), pb = 'pidgrupoB' + rnd();
  let r = await a('GET', `/grupo?pid=${pa}&nombre=Ana`);
  const id = r.data.grupo.id;
  assert.equal(r.data.grupo.soyLider, true);
  await a('POST', '/grupo', { pid: pa, accion: 'abierto', valor: true });
  r = await b('GET', `/grupos?pid=${pb}`);
  assert.ok(r.data.abiertos.some((g) => g.id === id), 'se ve en las lobbys abiertas');
  r = await b('POST', '/grupo', { pid: pb, nombre: 'Beto', accion: 'unirse', id });
  assert.equal(r.data.grupo.miembros.length, 2);
  // los gestos de cada uno los ven los demás
  await b('POST', '/grupo', { pid: pb, accion: 'gesto', gesto: 'baila' });
  r = await a('GET', `/grupo?pid=${pa}&nombre=Ana`);
  assert.equal(r.data.grupo.miembros.find((m) => m.nombre === 'Beto').gesto.id, 'baila');
  assert.equal((await b('POST', '/grupo', { pid: pb, accion: 'gesto', gesto: '<script>' })).status, 400);
  assert.equal((await b('POST', '/grupo', { pid: pb, accion: 'jugar', url: '/royale/' })).status, 403);
  assert.equal((await b('POST', '/grupo', { pid: pb, accion: 'config', bots: 4 })).status, 403);
  assert.equal((await a('POST', '/grupo', { pid: pa, accion: 'jugar', url: '/haxball/sala/ABCDE' })).status, 400);
  await a('POST', '/grupo', { pid: pa, accion: 'juego', juego: 'haxball' });
  await a('POST', '/grupo', { pid: pa, accion: 'config', bots: 2, minutos: 5, goles: 7 });
  const creado = await haxball.handle(new Request('http://localhost/api/haxball/crear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pid: pa, nombre: 'Ana', opciones: { bots: 2, minutos: 5, goles: 7 } }) }));
  const { code } = await creado.json();
  assert.equal((await a('POST', '/grupo', { pid: pa, accion: 'jugar', url: `/haxball/sala/${code}` })).status, 200);
  r = await b('GET', `/grupo?pid=${pb}&nombre=Beto`);
  assert.equal(r.data.grupo.ir.url, `/haxball/sala/${code}`);
  assert.equal(r.data.grupo.config.goles, 7);
  // el líder se va: queda Beto de líder
  await a('POST', '/grupo', { pid: pa, accion: 'salir' });
  r = await b('GET', `/grupo?pid=${pb}&nombre=Beto`);
  assert.equal(r.data.grupo.soyLider, true);
});

test('grupos: con cuenta se invita a un amigo y ve la lobby del amigo', async () => {
  const a = cliente('11.0.1.1'), b = cliente('11.0.1.2');
  const ua = 'gra' + rnd(), ub = 'grb' + rnd();
  await a('POST', '/registro', { usuario: ua, nombre: 'Ana', clave: 'secreta1' });
  await b('POST', '/registro', { usuario: ub, nombre: 'Beto', clave: 'secreta1' });
  await a('POST', '/amigos', { accion: 'pedir', usuario: ub });
  await b('POST', '/amigos', { accion: 'aceptar', usuario: ua });
  const id = (await a('GET', '/grupo')).data.grupo.id;
  assert.equal((await a('POST', '/grupo', { accion: 'invitar', usuario: ub })).status, 200);
  let r = await b('GET', '/grupo');
  assert.equal(r.data.invitaciones[0].grupo, id);
  r = await b('GET', '/grupos');
  assert.equal(r.data.amigos[0].grupo.id, id);
});

test('tienda: se compra una skin en venta con las fichas del casino y no se puede pagar dos veces', async () => {
  const a = cliente('11.0.0.9');
  const pid = 'pidtienda' + rnd();
  let r = await a('GET', `/tienda?pid=${pid}`);
  assert.equal(r.data.saldo, 8_000);
  assert.ok(r.data.skins.every((s) => s.precio === 500), 'todas a 500');
  assert.equal(r.data.destacadas.length, 3);
  assert.equal(r.data.diarias.length, 4);
  assert.ok(r.data.skins.every((s) => s.frase), 'todas tienen su frase');
  const venta = [...r.data.destacadas, ...r.data.diarias];
  const barata = r.data.skins.filter((s) => r.data.diarias.includes(s.id)).sort((x, y) => x.precio - y.precio)[0];
  r = await a('POST', '/tienda/comprar', { pid, skin: barata.id });
  assert.equal(r.data.saldo, 8_000 - barata.precio);
  assert.deepEqual(r.data.mias, [barata.id]);
  r = await a('POST', '/tienda/comprar', { pid, skin: barata.id });
  assert.equal(r.data.saldo, 8_000 - barata.precio, 'comprarla otra vez no cobra');
  const fuera = ['capitan', 'chapa', 'colon', 'claude', 'angie', 'olcho', 'sandra'].find((id) => !venta.includes(id));
  r = await a('POST', '/tienda/comprar', { pid, skin: fuera });
  assert.equal(r.status, 400, 'lo que no está en venta hoy no se compra');
  assert.equal((await a('GET', `/tienda?pid=${pid}`)).data.saldo, 8_000 - barata.precio);
});

test('tienda: la rotación es fija por día, cambia entre días y vende solo un par', async () => {
  const { rotacion, enVenta, SKINS } = await import('../tienda.js');
  assert.deepEqual(rotacion(20800), rotacion(20800));
  const distintas = new Set(Array.from({ length: 10 }, (_, i) => enVenta(20800 + i).join()));
  assert.ok(distintas.size >= 8);
  for (let d = 20800; d < 20900; d++) {
    const v = enVenta(d);
    assert.equal(new Set(v).size, 7);
    assert.ok(v.length < SKINS.length / 2);
  }
});

test('tienda: regalar una skin de hoy a un amigo y le avisa', async () => {
  const a = cliente('11.0.0.21'), b = cliente('11.0.0.22');
  const ua = 'rega' + rnd(), ub = 'regb' + rnd();
  await a('POST', '/registro', { usuario: ua, nombre: 'Ana', clave: 'clave123' });
  await b('POST', '/registro', { usuario: ub, nombre: 'Beto', clave: 'clave123' });
  const pa = 'pidregaloA' + rnd(), pb = 'pidregaloB' + rnd();
  let r = await a('GET', `/tienda?pid=${pa}`);
  const id = r.data.diarias.map((x) => r.data.skins.find((s) => s.id === x)).sort((x, y) => x.precio - y.precio)[0].id;
  assert.equal((await a('POST', '/tienda/regalar', { pid: pa, skin: id, para: ub })).status, 403, 'solo a amigos');
  await a('POST', '/amigos', { accion: 'pedir', usuario: ub });
  await b('POST', '/amigos', { accion: 'aceptar', usuario: ua });
  r = await a('POST', '/tienda/regalar', { pid: pa, skin: id, para: ub });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.para, 'Beto');
  r = await b('GET', `/tienda?pid=${pb}`);
  assert.ok(r.data.mias.includes(id), 'le llegó');
  assert.equal(r.data.regalos[0].de, 'Ana');
  assert.equal((await b('GET', `/tienda?pid=${pb}`)).data.regalos.length, 0, 'el aviso sale una sola vez');
  assert.equal((await a('POST', '/tienda/regalar', { pid: pa, skin: id, para: ub })).status, 400, 'ya la tiene');
});

test('premios: cada partida deja fichas, más si ganás, con tope diario', async () => {
  const { premiar, PREMIOS, TOPE_DIARIO } = await import('../premios.js');
  const { saldo, quien } = await import('../../games/casino/lib/fichas.js');
  const pid = 'pidpremio' + rnd();
  assert.equal(await premiar(pid, null, 'victoria', 100), PREMIOS.victoria + 100);
  assert.equal(await premiar(pid, null, 'derrota'), PREMIOS.derrota);
  assert.equal(await premiar(pid, null, 'abortada'), 0);
  assert.equal(await saldo(quien(pid)), 8_000 + PREMIOS.victoria + 100 + PREMIOS.derrota);
  for (let i = 2; i < TOPE_DIARIO; i++) await premiar(pid, null, 'derrota');
  assert.equal(await premiar(pid, null, 'victoria'), 0, 'pasado el tope no paga');
});

test('tienda: códigos de creador, una sola vez por cuenta', async () => {
  const a = cliente('11.0.0.31');
  const pid = 'pidcodigo' + rnd();
  assert.equal((await a('POST', '/tienda/codigo', { pid, codigo: 'Opusreligioso' })).status, 401, 'sin cuenta no');
  await a('POST', '/registro', { usuario: 'cod' + rnd(), nombre: 'Coco', clave: 'clave123' });
  let r = await a('POST', '/tienda/codigo', { pid, codigo: ' opusRELIGIOSO ' });
  assert.equal(r.data.monto, 40_000);
  assert.equal(r.data.saldo, 8_000 + 40_000);
  assert.equal((await a('POST', '/tienda/codigo', { pid, codigo: 'Opusreligioso' })).status, 400, 'otra vez no');
  r = await a('POST', '/tienda/codigo', { pid, codigo: 'Ad1min' });
  assert.equal(r.data.saldo, 148_000);
  r = await a('POST', '/tienda/codigo', { pid, codigo: ' QuienesChapaMax ' });
  const { SKINS } = await import('../tienda.js');
  assert.equal(r.status, 200);
  assert.deepEqual(new Set(r.data.mias), new Set(SKINS.map((s) => s.id)));
  assert.equal(r.data.skins, SKINS.length);
  assert.equal(r.data.saldo, 148_000, 'el código de skins no altera las fichas');
  const guardadas = await a('GET', `/tienda?pid=${pid}`);
  assert.deepEqual(new Set(guardadas.data.mias), new Set(SKINS.map((s) => s.id)), 'las skins persisten al recargar');
  assert.equal((await a('POST', '/tienda/codigo', { pid, codigo: 'quieneschapamax' })).status, 400);
  assert.equal((await a('POST', '/tienda/codigo', { pid, codigo: 'cualquiera' })).status, 404);
});

test('lobby: consultas simultáneas no pierden gestos ni cambios de look', async () => {
  const a = cliente('12.0.0.1'), b = cliente('12.0.0.2');
  const pa = 'syncA' + rnd(), pb = 'syncB' + rnd();
  const id = (await a('GET', `/grupo?pid=${pa}&nombre=Ana`)).data.grupo.id;
  await b('POST', '/grupo', { pid: pb, nombre: 'Beto', accion: 'unirse', id });
  await Promise.all([
    a('GET', `/grupo?pid=${pa}&nombre=Ana`),
    b('POST', '/grupo', { pid: pb, nombre: 'Beto', accion: 'gesto', gesto: 'baila' }),
    b('GET', `/grupo?pid=${pb}&nombre=Beto&look=${encodeURIComponent(JSON.stringify({npc:'batata'}))}`),
  ]);
  const grupo = (await a('GET', `/grupo?pid=${pa}&nombre=Ana`)).data.grupo;
  const amigo = grupo.miembros.find(m => !m.yo);
  assert.equal(amigo.look.npc, 'batata');
  assert.equal(amigo.gesto.id, 'baila');
  assert.ok(amigo.gesto.ts > Date.now(), 'el inicio se agenda para que lo reciban ambos');
});

test('lobby: descarta una sala borrada en lugar de redirigir de nuevo', async () => {
  const { getStore } = await import('../store.js');
  const a = cliente('12.0.0.3'), pid = 'missing' + rnd();
  const id = (await a('GET', `/grupo?pid=${pid}`)).data.grupo.id;
  const g = JSON.parse(await getStore().get(`grupo:${id}`));
  g.ir = { url: '/royale/sala/NOEXISTE', ts: Date.now() };
  await getStore().set(`grupo:${id}`, JSON.stringify(g));
  assert.equal((await a('GET', `/grupo?pid=${pid}`)).data.grupo.ir, null);
});

test('amigos sugeridos: los que jugaron juntos y los amigos de tus amigos', async () => {
  const a = cliente('11.0.0.41'), b = cliente('11.0.0.42'), c = cliente('11.0.0.43');
  const ua = 'suga' + rnd(), ub = 'sugb' + rnd(), uc = 'sugc' + rnd();
  await a('POST', '/registro', { usuario: ua, nombre: 'Ana', clave: 'clave123' });
  await b('POST', '/registro', { usuario: ub, nombre: 'Beto', clave: 'clave123' });
  await c('POST', '/registro', { usuario: uc, nombre: 'Caro', clave: 'clave123' });
  assert.equal((await cliente('11.0.0.44')('GET', '/sugeridos')).status, 401, 'pide cuenta');
  // Ana y Beto comparten lobby
  const id = (await a('GET', `/grupo?pid=pidsugA${rnd()}`)).data.grupo.id;
  await b('POST', '/grupo', { pid: 'pidsugB' + rnd(), accion: 'unirse', id });
  let r = await a('GET', '/sugeridos');
  assert.ok(r.data.recientes.some((x) => x.usuario === ub), 'Beto: jugaron juntos');
  // Beto se hace amigo de Caro: Caro aparece como "quizás la conozcas" para Ana... si Ana es amiga de Beto
  await b('POST', '/amigos', { accion: 'pedir', usuario: uc }); await c('POST', '/amigos', { accion: 'aceptar', usuario: ub });
  await a('POST', '/amigos', { accion: 'pedir', usuario: ub }); await b('POST', '/amigos', { accion: 'aceptar', usuario: ua });
  r = await a('GET', '/sugeridos');
  assert.ok(!r.data.recientes.some((x) => x.usuario === ub), 'los amigos ya no se sugieren');
  const caro = r.data.conocidos.find((x) => x.usuario === uc);
  assert.ok(caro && caro.comunes === 1, 'Caro: amiga de un amigo');
});
