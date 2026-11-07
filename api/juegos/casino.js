// Función de Vercel del juego "casino". Todo el código está en games/casino/.
import { handle } from '../../games/casino/api.js';

export function GET(request) {
  return handle(request);
}

export function POST(request) {
  return handle(request);
}
