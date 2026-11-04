// Punto de entrada en Vercel. El código del juego está en games/chessort/api/.
import * as h from '../../../games/chessort/api/game/[id].js';

export function GET(request) {
  return h.GET(request);
}

export function POST(request) {
  return h.POST(request);
}
