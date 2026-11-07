// Función de Vercel del juego "memes". Todo el código está en games/memes/.
import { handle } from '../../games/memes/api.js';

export function GET(request) {
  return handle(request);
}

export function POST(request) {
  return handle(request);
}
