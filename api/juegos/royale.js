// Función de Vercel del juego "royale". Todo el código está en games/royale/.
import { handle } from '../../games/royale/api.js';

export function GET(request) {
  return handle(request);
}

export function POST(request) {
  return handle(request);
}
