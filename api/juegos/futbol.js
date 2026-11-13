// Función de Vercel del juego "futbol" (La Canchita). Todo el código está en games/futbol/.
import { handle } from '../../games/futbol/api.js';

export function GET(request) {
  return handle(request);
}

export function POST(request) {
  return handle(request);
}
