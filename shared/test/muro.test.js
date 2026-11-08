import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../club-api.js';

function cliente(ip) {
  let cookie = '';
  return async (metodo, ruta, body) => {
    const res = await handle(
      new Request('http://localhost/api/club' + ruta, {
        method: metodo,
        headers: { 'content-type': 'application/json', cookie, 'x-forwarded-for': ip },
        body: body ? JSON.stringify(body) : undefined,
      })
    );
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const tipo = res.headers.get('content-type') || '';
    return { status: res.status, tipo, data: tipo.includes('json') ? await res.json() : new Uint8Array(await res.arrayBuffer()) };
  };
}
const rnd = () => Math.random().toString(36).slice(2, 8);
// PNG de 1x1
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('muro: publicar sin cuenta, con foto, like, comentar y borrar con la clave', async () => {
  const a = cliente('10.0.0.' + Math.floor(Math.random() * 200));
  let r = await a('POST', '/muro', { nombre: '  Tito  ', texto: 'Hola club\n\n\n\nqué onda', foto: PNG });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const { post, clave } = r.data;
  assert.equal(post.nombre, 'Tito');
  assert.equal(post.texto, 'Hola club\n\nqué onda');
  assert.equal(post.foto, true);
  assert.equal(post.cuenta, false);
  assert.ok(clave.length >= 32);

  r = await a('GET', '/muro');
  assert.ok(r.data.posts.some((p) => p.id === post.id));
  assert.ok(!('uid' in r.data.posts[0]));

  r = await a('GET', '/muro/foto?id=' + post.id);
  assert.equal(r.status, 200);
  assert.equal(r.tipo, 'image/png');
  assert.equal(r.data[1], 0x50); // "P" de PNG

  r = await a('POST', '/muro/like', { id: post.id, dispositivo: 'disp-' + rnd() + 'xyz' });
  assert.deepEqual(r.data, { likes: 1, diste: true });
  const otro = 'disp-' + rnd() + 'abc';
  await a('POST', '/muro/like', { id: post.id, dispositivo: otro });
  r = await a('POST', '/muro/like', { id: post.id, dispositivo: otro });
  assert.deepEqual(r.data, { likes: 1, diste: false });

  r = await a('POST', '/muro/responder', { id: post.id, nombre: 'Juli', texto: 'jajaja' });
  assert.equal(r.data.respuestas, 1);
  r = await a('GET', '/muro/respuestas?id=' + post.id);
  assert.equal(r.data.respuestas[0].texto, 'jajaja');
  r = await a('GET', '/muro');
  const visto = r.data.posts.find((p) => p.id === post.id);
  assert.equal(visto.likes, 1);
  assert.equal(visto.respuestas, 1);

  r = await a('POST', '/muro/borrar', { id: post.id, clave: 'mala' });
  assert.equal(r.status, 403);
  r = await a('POST', '/muro/borrar', { id: post.id, clave });
  assert.equal(r.status, 200);
  r = await a('GET', '/muro/foto?id=' + post.id);
  assert.equal(r.status, 404);
});

test('muro: rechaza vacíos, fotos que no son imagen y SVG', async () => {
  const a = cliente('10.1.0.' + Math.floor(Math.random() * 200));
  assert.equal((await a('POST', '/muro', { texto: '   ' })).status, 400);
  assert.equal((await a('POST', '/muro', { foto: 'data:image/svg+xml;base64,PHN2Zz4=' })).status, 400);
  assert.equal((await a('POST', '/muro', { foto: 'javascript:alert(1)' })).status, 400);
  assert.equal((await a('POST', '/muro', { foto: 'data:image/png;base64,' + 'A'.repeat(950_000) })).status, 400);
});

test('muro: con cuenta sale con su nombre y la puede borrar sin clave', async () => {
  const a = cliente('10.2.0.' + Math.floor(Math.random() * 200));
  const usuario = 'mu' + rnd();
  await a('POST', '/registro', { usuario, nombre: 'Mora', clave: 'secreta1' });
  let r = await a('POST', '/muro', { nombre: 'Otro nombre', texto: 'con cuenta' });
  assert.equal(r.data.post.nombre, 'Mora');
  assert.equal(r.data.post.cuenta, true);
  assert.equal(r.data.post.tuyo, true);
  r = await a('POST', '/muro/borrar', { id: r.data.post.id });
  assert.equal(r.status, 200);
});

test('muro: frena a quien publica demasiado', async () => {
  const a = cliente('10.3.0.' + Math.floor(Math.random() * 200));
  let ultimo;
  for (let i = 0; i < 9; i++) ultimo = await a('POST', '/muro', { texto: 'spam ' + i });
  assert.equal(ultimo.status, 429);
});

test('sugerencias: proponer, votar, ordenar y borrar', async () => {
  const a = cliente('10.4.0.' + Math.floor(Math.random() * 200));
  let r = await a('POST', '/sugerencias', { tipo: 'juego', texto: 'Un pictionary', nombre: 'Lu' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const s1 = r.data.sugerencia;
  assert.equal(s1.tipo, 'juego');
  r = await a('POST', '/sugerencias', { tipo: 'raro', texto: 'Modo oscuro más oscuro' });
  const s2 = r.data.sugerencia;
  assert.equal(s2.tipo, 'otro');
  assert.equal(s2.nombre, 'Anónimo');
  assert.equal((await a('POST', '/sugerencias', { texto: 'no' })).status, 400);

  await a('POST', '/sugerencias/votar', { id: s2.id, dispositivo: 'disp-' + rnd() + 'aaa' });
  await a('POST', '/sugerencias/votar', { id: s2.id, dispositivo: 'disp-' + rnd() + 'bbb' });
  r = await a('GET', '/sugerencias');
  const i1 = r.data.sugerencias.findIndex((x) => x.id === s1.id);
  const i2 = r.data.sugerencias.findIndex((x) => x.id === s2.id);
  assert.ok(i2 < i1, 'la más votada va primero');
  assert.equal(r.data.sugerencias[i2].votos, 2);

  assert.equal((await a('POST', '/sugerencias/estado', { id: s1.id, estado: 'hecho' })).status, 403);
  assert.equal((await a('POST', '/sugerencias/borrar', { id: s1.id })).status, 403);
});
