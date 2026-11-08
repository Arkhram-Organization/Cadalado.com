import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../club-api.js';
import { registrarPartida } from '../cuenta.js';

// Cliente de prueba que guarda la cookie de sesión como un navegador.
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
    return { status: res.status, data: await res.json() };
  };
}

const rnd = () => Math.random().toString(36).slice(2, 8);

test('registro, sesión, salir y entrar', async () => {
  const api = cliente('1.1.1.1');
  const usuario = 'ana' + rnd();
  let r = await api('POST', '/registro', { usuario, nombre: 'Ana', clave: 'secreta1' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.usuario.nombre, 'Ana');
  assert.equal(JSON.stringify(r.data).includes('secreta1'), false);
  assert.equal((await api('GET', '/yo')).data.usuario.usuario, usuario);

  assert.equal((await cliente('1.1.1.2')('POST', '/registro', { usuario: usuario.toUpperCase(), clave: 'otra123' })).status, 409);
  assert.equal((await cliente('1.1.1.3')('POST', '/registro', { usuario: 'a', clave: 'otra123' })).status, 400);

  await api('POST', '/salir');
  assert.equal((await api('GET', '/yo')).data.usuario, null);
  assert.equal((await api('POST', '/entrar', { usuario, clave: 'mal' })).status, 401);
  assert.equal((await api('POST', '/entrar', { usuario, clave: 'secreta1' })).status, 200);
  assert.equal((await api('GET', '/yo')).data.usuario.usuario, usuario);
});

test('amigos y chat privado', async () => {
  const a = cliente('2.2.2.1');
  const b = cliente('2.2.2.2');
  const ua = 'a' + rnd();
  const ub = 'b' + rnd();
  await a('POST', '/registro', { usuario: ua, clave: 'clave123' });
  await b('POST', '/registro', { usuario: ub, clave: 'clave123' });

  assert.equal((await a('POST', '/chat', { con: ub, texto: 'hola' })).status, 403); // todavía no son amigos
  assert.equal((await a('POST', '/amigos', { accion: 'pedir', usuario: ub })).data.estado, 'enviada');
  assert.equal((await b('GET', '/amigos')).data.recibidas[0].usuario, ua);
  assert.equal((await b('POST', '/amigos', { accion: 'aceptar', usuario: ua })).data.estado, 'amigo');

  assert.equal((await a('POST', '/chat', { con: ub, texto: '¿Sale una?' })).status, 200);
  const amigosB = (await b('GET', '/amigos')).data.amigos;
  assert.equal(amigosB[0].sinLeer, true);
  const chat = (await b('GET', '/chat?con=' + ua)).data.mensajes;
  assert.equal(chat.at(-1).texto, '¿Sale una?');
  assert.equal(chat.at(-1).mio, false);
  assert.equal((await b('GET', '/amigos')).data.amigos[0].sinLeer, false);

  await a('POST', '/chat', { con: 'general', texto: 'Buenas a todos' });
  const general = (await cliente('9.9.9.9')('GET', '/chat?con=general')).data.mensajes;
  assert.ok(general.some((m) => m.texto === 'Buenas a todos'));

  await b('POST', '/amigos', { accion: 'eliminar', usuario: ua });
  assert.equal((await a('GET', '/amigos')).data.amigos.length, 0);
});

test('historial y perfil', async () => {
  const a = cliente('3.3.3.1');
  const ua = 'h' + rnd();
  const { data } = await a('POST', '/registro', { usuario: ua, clave: 'clave123' });
  await registrarPartida(data.usuario.id, { juego: 'ajedrez', resultado: 'victoria', rivales: ['Beto'] });
  await registrarPartida(data.usuario.id, { juego: 'truco', resultado: 'derrota', rivales: ['Tito'] });
  const h = (await a('GET', '/historial')).data;
  assert.equal(h.historial[0].juego, 'truco');
  assert.deepEqual([h.resumen.jugadas, h.resumen.victorias, h.resumen.derrotas], [2, 1, 1]);
  const p = (await cliente('3.3.3.2')('GET', '/perfil?usuario=' + ua)).data;
  assert.equal(p.resumen.jugadas, 2);
  assert.equal(p.usuario.id !== undefined, true);
});

test('sin sesión no hay datos privados', async () => {
  const x = cliente('4.4.4.4');
  assert.equal((await x('GET', '/historial')).status, 401);
  assert.equal((await x('GET', '/amigos')).status, 401);
  assert.equal((await x('POST', '/chat', { con: 'general', texto: 'hola' })).status, 401);
});

test('personaje: se limpia lo que llega y se guarda en la cuenta', async () => {
  const { limpiarLook, lookParaDibujo, aplicarVestimenta, VESTIMENTAS } = await import('../public/look.js');
  const l = limpiarLook({ piel: '#ABCDEF', pelo: { estilo: 'hackeo', color: 'red' }, prenda: 'buzo', capucha: '#1f2a4d', script: '<x>', ropa: { remera: 'javascript:' } });
  assert.equal(l.piel, '#abcdef');
  assert.equal(l.pelo.estilo, 'corto');
  assert.equal(l.pelo.color, '#2b1d14');
  assert.equal(l.ropa.remera, '#7aa2ff');
  assert.equal(l.script, undefined);
  const d = lookParaDibujo(l);
  assert.equal(d.mangasLargas, true);
  assert.equal(d.capucha, '#1f2a4d');
  for (const v of VESTIMENTAS) assert.ok(limpiarLook(aplicarVestimenta(l, v.id)), v.id);
  assert.equal(aplicarVestimenta(l, 'fotografo').camara, true);
});
