// Función de Vercel del juego "empujon" (Empujón). Todo el código está en games/empujon/.
import { handle } from '../../games/empujon/api.js';

export function GET(request) {
  return handle(request);
}

export function POST(request) {
  return handle(request);
}
