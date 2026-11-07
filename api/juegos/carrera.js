// Función de Vercel del juego "carrera". Todo el código está en games/carrera/.
import { handle } from '../../games/carrera/api.js';

export function GET(request) {
  return handle(request);
}

export function POST(request) {
  return handle(request);
}
