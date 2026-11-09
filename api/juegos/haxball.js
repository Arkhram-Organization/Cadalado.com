// Función de Vercel del juego "haxball". Todo el código está en games/memes/.
import { handle } from '../../games/haxball/api.js';

export function GET(request) {
  return handle(request);
}

export function POST(request) {
  return handle(request);
}
