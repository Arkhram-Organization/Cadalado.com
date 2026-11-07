import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memes } from '../lib/memes.js';

const P = ['pidMemeAAAA1', 'pidMemeBBBB2', 'pidMemeCCCC3'];
async function req(metodo, ruta, body) {
  const res = await memes.handle(new Request('http://x/api/memes' + ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));
  return { status: res.status, data: await res.json() };
}
const accion = (code, pid, msg) => req('POST', `/salas/${code}`, { pid, ping: 1, msg });
const ver = async (code, pid) => (await req('GET', `/salas/${code}?pid=${pid}&ping=1`)).data;

test('partida de memes completa: crear, votar anónimo, puntos y final', async () => {
  const { data } = await req('POST', '/crear', { pid: P[0], nombre: 'Ana', opciones: { rondas: 2, publica: true } });
  const code = data.code;
  await accion(code, P[0], { t: 'join', nombre: 'Ana' });
  assert.equal((await accion(code, P[0], { t: 'empezar' })).data.error, 'Hacen falta al menos 2 jugadores. ¡Mandá el link!');
  await accion(code, P[1], { t: 'join', nombre: 'Beto' });
  await accion(code, P[2], { t: 'join', nombre: 'Caro' });
  assert.equal((await accion(code, P[1], { t: 'empezar' })).data.error, 'Solo quien creó la sala puede empezar');
  let v = (await accion(code, P[0], { t: 'empezar' })).data.estado;
  assert.equal(v.fase, 'creando');
  assert.ok(v.miPlantilla);
  const antes = v.miPlantilla;
  v = (await accion(code, P[0], { t: 'cambiar' })).data.estado;
  assert.notEqual(v.miPlantilla, antes);
  assert.equal(v.misCambios, 1);

  for (let ronda = 1; ronda <= 2; ronda++) {
    assert.equal((await accion(code, P[0], { t: 'enviar', textos: [{ t: '   ' }] })).data.error, 'Escribí algo en tu meme');
    for (const [i, pid] of P.entries()) await accion(code, pid, { t: 'enviar', textos: [{ x: 0.1, y: 0.05, t: `meme ${i} r${ronda}`, s: 9, c: 'rojo' }] });
    // todos mandaron: en 1,5 s arranca la votación
    await new Promise((r) => setTimeout(r, 1600));
    v = await ver(code, P[0]);
    assert.equal(v.estado.fase, 'votando');
    assert.equal(v.estado.voto.total, 3);
    for (let k = 0; k < 3; k++) {
      v = await ver(code, P[0]);
      const voto = v.estado.voto;
      assert.equal(JSON.stringify(voto).includes('pidMeme'), false, 'el voto es anónimo');
      for (const [i, pid] of P.entries()) {
        const r = await accion(code, pid, { t: 'votar', n: 5 - i });
        if (r.data.estado.voto?.esMio) assert.equal(r.data.error, 'No podés votar tu propio meme');
      }
      await new Promise((r) => setTimeout(r, 1900));
      await ver(code, P[0]);
    }
    v = await ver(code, P[0]);
    if (ronda === 1) {
      assert.equal(v.estado.fase, 'resultados');
      assert.equal(v.estado.resultados.length, 3);
      assert.equal(v.estado.resultados[0].textos[0].s, 0.2); // tamaño limitado
      await accion(code, P[0], { t: 'siguiente' });
      v = await ver(code, P[0]);
      assert.equal(v.estado.fase, 'creando');
      assert.equal(v.estado.ronda, 2);
    }
  }
  assert.equal(v.estado.fase, 'final');
  const total = Object.values(v.estado.puntos).reduce((a, b) => a + b, 0);
  assert.ok(total >= 2 * 3 * 3 && total <= 2 * 3 * 2 * 5, `total ${total}`); // cada meme recibe 2 votos de 3 a 5
  assert.ok(v.estado.mejor);
  const lobby = (await req('GET', '/lobby')).data.salas;
  assert.ok(lobby.some((s) => s.code === code));
});
