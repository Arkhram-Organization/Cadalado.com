// Punto de entrada en Vercel. El código del juego está en games/chessort/api/.
import * as h from '../../games/chessort/api/games.js';

export function POST(request) {
  return h.POST(request);
}
