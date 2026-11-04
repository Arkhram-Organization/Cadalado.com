// Función de Vercel del juego "truco". Todo el código está en games/truco/.
import { handle } from '../../games/truco/api.js';

export function GET(request) {
  return handle(request);
}

export function POST(request) {
  return handle(request);
}
