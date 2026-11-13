// Función de Vercel del juego "pelea" (Piña Final). Todo el código está en games/pelea/.
import { handle } from '../../games/pelea/api.js';

export function GET(request) {
  return handle(request);
}

export function POST(request) {
  return handle(request);
}
