import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, loadRoom, mutateRoom, applyAction, view, getPresence, touchPresence, listLobby } from '../lib/room.js';

const A = 'pidAAAAAAAA';
const B = 'pidBBBBBBBB';
const C = 'pidCCCCCCCC';
const act = (id, pid, msg) => mutateRoom(id, (room, chess) => applyAction(room, chess, pid, msg));

test('sala completa: unirse, jugar, chat, mate y revancha', async () => {
  const id = 'test' + Math.floor(Math.random() * 1e6);
  await createRoom({ id, tcId: '5+0', color: 'w', pid: A, name: 'Ana' });
  let r = await act(id, B, { t: 'join', name: 'Beto' });
  assert.equal(r.room.game.status, 'playing');
  assert.equal(r.room.chat.at(-1).text, 'Beto se unió a la partida');

  r = await act(id, C, { t: 'join', name: 'Carla' }); // tercera persona: espectadora
  assert.equal(view(r.room, C, null).you, null);
  assert.ok((await act(id, C, { t: 'move', from: 'e2', to: 'e4' })).error);
  assert.ok((await act(id, B, { t: 'move', from: 'e7', to: 'e5' })).error); // no es su turno

  for (const [pid, from, to] of [[A, 'e2', 'e4'], [B, 'e7', 'e5'], [A, 'f1', 'c4'], [B, 'b8', 'c6'], [A, 'd1', 'h5'], [B, 'g8', 'f6']]) {
    r = await act(id, pid, { t: 'move', from, to });
    assert.equal(r.error, undefined);
  }
  await act(id, B, { t: 'chat', text: 'uh' });
  r = await act(id, A, { t: 'move', from: 'h5', to: 'f7' });
  assert.deepEqual(r.room.game.result, { winner: 'w', reason: 'checkmate' });

  const v = view(r.room, A, null);
  assert.equal(v.you, 'w');
  assert.equal(JSON.stringify(v).includes(A), false, 'no se filtran los identificadores');

  await act(id, A, { t: 'rematch' });
  r = await act(id, B, { t: 'rematch' });
  assert.equal(r.room.game.gameNo, 2);
  assert.equal(r.room.game.players.w.name, 'Beto');
  assert.equal((await loadRoom(id)).game.gameNo, 2);
});

test('jugadas simultáneas no se pisan', async () => {
  const id = 'race' + Math.floor(Math.random() * 1e6);
  await createRoom({ id, tcId: '0+0', color: 'w', pid: A, name: 'Ana' });
  await act(id, B, { t: 'join', name: 'Beto' });
  await Promise.all(Array.from({ length: 10 }, (_, i) => act(id, A, { t: 'chat', text: 'msg' + i })));
  const room = await loadRoom(id);
  assert.equal(room.chat.filter((m) => !m.system).length, 10);
});

test('presencia y lobby', async () => {
  const id = 'lob' + Math.floor(Math.random() * 1e6);
  await createRoom({ id, tcId: '3+2', color: 'b', pid: A, name: 'Ana' });
  let lobby = await listLobby();
  assert.ok(lobby.open.some((g) => g.id === id && g.black === 'Ana'));
  await touchPresence(id, C);
  const room = await loadRoom(id);
  const p = await getPresence(id, room.game);
  assert.ok(p.online.has(A));
  assert.equal(p.spectators, 1);
  await act(id, B, { t: 'join', name: 'Beto' });
  lobby = await listLobby();
  assert.ok(lobby.live.some((g) => g.id === id));
});
