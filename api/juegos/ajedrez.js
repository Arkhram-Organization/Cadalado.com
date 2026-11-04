// Función de Vercel del juego "ajedrez". Todo el código está en games/chessort/.
import { handle } from '../../games/chessort/api.js';

export function GET(request) {
  return handle(request);
}

export function POST(request) {
  return handle(request);
}
