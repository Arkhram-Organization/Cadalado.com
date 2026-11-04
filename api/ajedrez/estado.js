// Punto de entrada en Vercel. El código del juego está en games/chessort/api/.
import * as h from '../../games/chessort/api/estado.js';

export function GET(request) {
  return h.GET(request);
}
