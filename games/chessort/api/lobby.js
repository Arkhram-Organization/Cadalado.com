// GET /api/lobby: desafíos abiertos y partidas en vivo (público: lo usa también el portal).
import { listLobby } from '../lib/room.js';
import { json, serverError } from '../lib/util.js';

export async function GET() {
  try {
    return json(await listLobby(), 200, { 'access-control-allow-origin': '*' });
  } catch (e) {
    return serverError(e);
  }
}
