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

test('perfil: datos personalizables, foto y portada, y vista pública', async () => {
  const api = cliente('12.0.0.' + Math.floor(Math.random() * 200));
  const usuario = 'pf' + rnd();
  await api('POST', '/registro', { usuario, nombre: 'Pía', clave: 'secreta1' });
  let r = await api('POST', '/perfil', { bio: 'Hola\n\n\n\nsoy Pía', estado: 'jugando haxball', color: '#FF0000', fondo: 'casino', favorito: 'haxball', foto: 999, nombre: 'Pía M' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.usuario.perfil.bio, 'Hola\n\nsoy Pía');
  assert.equal(r.data.usuario.perfil.color, '#ff0000');
  assert.equal(r.data.usuario.perfil.foto, 0, 'la versión de la foto no se toca a mano');
  assert.equal(r.data.usuario.nombre, 'Pía M');
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  r = await api('POST', '/perfil/imagen', { tipo: 'foto', dato: PNG });
  assert.ok(r.data.usuario.perfil.foto > 0);
  assert.equal((await api('POST', '/perfil/imagen', { tipo: 'foto', dato: 'data:image/svg+xml;base64,PHN2Zz4=' })).status, 400);
  const res = await handle(new Request(`http://localhost/api/club/perfil/imagen?usuario=${usuario}&tipo=foto`));
  assert.equal(res.headers.get('content-type'), 'image/png');
  r = await cliente('12.9.9.9')('GET', '/perfil?usuario=' + usuario);
  assert.equal(r.data.usuario.perfil.estado, 'jugando haxball');
  assert.equal(r.data.relacion, '');
});

test('recuperar la contraseña: con el código propio o con la clave de admin', async () => {
  const { handle } = await import('../club-api.js');
  const cli = (ip) => {
    let cookie = '';
    return async (metodo, ruta, body) => {
      const res = await handle(new Request('http://localhost/api/club' + ruta, { method: metodo, headers: { 'content-type': 'application/json', cookie, 'x-forwarded-for': ip }, body: body ? JSON.stringify(body) : undefined }));
      const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
      return { status: res.status, data: await res.json() };
    };
  };
  const yo = cli('13.0.0.1'), otro = cli('13.0.0.2');
  const usuario = 'olvido' + Math.random().toString(36).slice(2, 7);
  await yo('POST', '/registro', { usuario, nombre: 'Olvidadizo', clave: 'vieja123' });
  assert.equal((await otro('GET', '/recuperacion')).status, 401, 'el código solo se ve con la cuenta');
  const { codigo } = (await yo('GET', '/recuperacion')).data;
  assert.match(codigo, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal((await yo('GET', '/recuperacion')).data.codigo, codigo, 'es siempre el mismo hasta que lo cambies');

  assert.equal((await otro('POST', '/recuperar', { usuario, codigo: 'AAAA-BBBB', clave: 'nueva123' })).status, 401, 'código equivocado');
  let r = await otro('POST', '/recuperar', { usuario, codigo: codigo.toLowerCase().replace('-', ' '), clave: 'nueva123' });
  assert.equal(r.status, 200, 'con el código (sin importar mayúsculas ni el guion)');
  assert.equal(r.data.usuario.usuario, usuario);
  assert.equal((await otro('GET', '/yo')).data.usuario?.usuario, usuario, 'queda adentro');
  assert.equal((await cli('13.0.0.3')('POST', '/entrar', { usuario, clave: 'vieja123' })).status, 401, 'la vieja ya no sirve');
  assert.equal((await cli('13.0.0.3')('POST', '/entrar', { usuario, clave: 'nueva123' })).status, 200, 'la nueva sí');
  assert.equal((await cli('13.0.0.4')('POST', '/recuperar', { usuario, codigo, clave: 'otra1234' })).status, 401, 'el código usado ya no sirve');

  // la clave de admin sirve para cualquier cuenta
  process.env.ADMIN_CLAVE = 'clave-admin-de-prueba';
  r = await cli('13.0.0.5')('POST', '/recuperar', { usuario, codigo: 'clave-admin-de-prueba', clave: 'desdeadmin' });
  assert.equal(r.status, 200);
  assert.equal((await cli('13.0.0.6')('POST', '/entrar', { usuario, clave: 'desdeadmin' })).status, 200);
  delete process.env.ADMIN_CLAVE;
  assert.equal((await cli('13.0.0.7')('POST', '/recuperar', { usuario, codigo: 'clave-admin-de-prueba', clave: 'x1234567' })).status, 401, 'sin la clave configurada, no');
});

test('mail: se carga, sirve para entrar y recuperar, no se muestra a los demás y los errores son claros', async () => {
  const { handle } = await import('../club-api.js');
  const cli = (ip) => {
    let cookie = '';
    return async (metodo, ruta, body) => {
      const res = await handle(new Request('http://localhost/api/club' + ruta, { method: metodo, headers: { 'content-type': 'application/json', cookie, 'x-forwarded-for': ip }, body: body ? JSON.stringify(body) : undefined }));
      const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
      return { status: res.status, data: await res.json() };
    };
  };
  const yo = cli('14.0.0.1');
  const usuario = 'conmail' + Math.random().toString(36).slice(2, 7);
  const mail = `${usuario}@ejemplo.com`;
  await yo('POST', '/registro', { usuario, nombre: 'Con Mail', clave: 'clave123', email: mail.toUpperCase() });
  assert.equal((await yo('GET', '/yo')).data.usuario.email, mail, 'el mail queda guardado (en minúscula)');
  assert.equal((await cli('14.0.0.2')('POST', '/entrar', { usuario: ' ' + mail + ' ', clave: 'clave123' })).status, 200, 'se entra con el mail');
  assert.equal((await cli('14.0.0.2')('POST', '/entrar', { usuario: '@' + usuario.toUpperCase(), clave: 'clave123' })).status, 200, 'y con @usuario en mayúscula');
  assert.equal((await cli('14.0.0.3')('POST', '/registro', { usuario: usuario + 'b', clave: 'clave123', email: mail })).status, 200, 'si el mail ya está, la cuenta se crea igual');

  // errores claros
  let r = await cli('14.0.0.4')('POST', '/recuperar', { usuario: 'nadie@nada.com', codigo: 'x', clave: 'nueva123' });
  assert.equal(r.status, 404);
  assert.match(r.data.error, /No hay ninguna cuenta/);
  delete process.env.ADMIN_CLAVE;
  r = await cli('14.0.0.4')('POST', '/recuperar', { usuario: mail, codigo: 'algo', clave: 'nueva123' });
  assert.match(r.data.error, /clave de admin configurada/);
  // clave corta (4+) y con espacios de más al pegar
  process.env.ADMIN_CLAVE = '  seba  ';
  r = await cli('14.0.0.5')('POST', '/recuperar', { usuario: mail, codigo: 'mala', clave: 'nueva123' });
  assert.match(r.data.error, /no coinciden/);
  r = await cli('14.0.0.5')('POST', '/recuperar', { usuario: mail, codigo: ' seba ', clave: 'nueva123' });
  assert.equal(r.status, 200, 'con el mail y la clave de admin');
  assert.equal((await cli('14.0.0.6')('POST', '/entrar', { usuario, clave: 'nueva123' })).status, 200);
  delete process.env.ADMIN_CLAVE;

  // cambiar y sacar el mail; los demás no lo ven
  const otro = 'otro' + Math.random().toString(36).slice(2, 7) + '@ejemplo.com';
  assert.equal((await yo('POST', '/yo', { email: otro })).data.usuario.email, otro);
  assert.equal((await cli('14.0.0.7')('POST', '/entrar', { usuario: mail, clave: 'nueva123' })).status, 401, 'el mail viejo ya no sirve');
  assert.equal((await yo('POST', '/yo', { email: 'no-es-un-mail' })).status, 400);
  assert.equal((await yo('POST', '/yo', { email: '' })).data.usuario.email, '');
  const perfil = await cli('14.0.0.8')('GET', '/perfil?u=' + usuario);
  assert.ok(!JSON.stringify(perfil.data).includes('@ejemplo.com'), 'el mail no aparece en el perfil público');
});
