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

test('tienda: se compra una skin con las fichas del casino y no se puede pagar dos veces', async () => {
  const a = cliente('11.0.0.9');
  const pid = 'pidtienda' + rnd();
  let r = await a('GET', `/tienda?pid=${pid}`);
  assert.equal(r.data.saldo, 10_000);
  assert.ok(r.data.skins.find((s) => s.id === 'mati').precio > r.data.skins.find((s) => s.id === 'capitan').precio, 'la mítica es la más cara');
  r = await a('POST', '/tienda/comprar', { pid, skin: 'olcho' });
  assert.equal(r.data.saldo, 10_000 - 3_500);
  assert.deepEqual(r.data.mias, ['olcho']);
  r = await a('POST', '/tienda/comprar', { pid, skin: 'olcho' });
  assert.equal(r.data.saldo, 6_500, 'comprarla otra vez no cobra');
  r = await a('POST', '/tienda/comprar', { pid, skin: 'mati' });
  assert.equal(r.status, 400, 'no alcanza para la mítica');
  assert.equal((await a('GET', `/tienda?pid=${pid}`)).data.saldo, 6_500);
});
